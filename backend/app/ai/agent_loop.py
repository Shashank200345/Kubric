"""
ReAct diagnosis loop — an agentic, read-only investigator.

Instead of one fixed evidence bundle, the model calls read-only tools
(list_pods, describe_pod, get_pod_logs, list_events, list_deployments,
list_nodes) to gather exactly what it needs and follow the trail across
resources (multi-hop root cause). When confident, it emits the same diagnosis
JSON contract as the one-shot analyzer, and reuses the same fix guardrails.

Production hardening:
  - Bounded iterations + total tool-call budget + per-call timeout.
  - Concurrent tool execution per turn (asyncio.gather).
  - Per-run result cache to avoid redundant/looping calls.
  - Truncated tool outputs to control token cost.
  - Always returns a diagnosis: falls back to the one-shot analyzer on any failure.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from loguru import logger

from .agent import KubernetesAIAgent
from .llm import OpenRouterClient
from .prompts import PromptBuilder
from .tools import TOOL_SCHEMAS, ClusterReadTools, execute_tool

_TOOL_PREAMBLE = """You are an autonomous Kubernetes incident investigator. You have READ-ONLY
tools to inspect the cluster. Work like an SRE:

1. Start from the reported failing workload(s).
2. Call tools to gather the SPECIFIC evidence you need — read a pod's previous
   logs, describe the pod for its command/image/exit code, check events, and
   follow dependencies (e.g. a failing service may point to a deployment scaled
   to 0, a missing image, or an unschedulable pod). Chase the cause across
   resources; do not stop at the first symptom.
3. Be efficient: only fetch what you need, avoid repeating identical calls.
4. When you have enough evidence to name the ROOT CAUSE, STOP calling tools and
   respond with ONLY the final diagnosis JSON described below — no prose.

All tools are read-only; you cannot and must not change the cluster.
"""


class ReActDiagnosisAgent:
    MAX_ITERS = int(os.getenv("KUBRIC_REACT_MAX_ITERS", "6"))
    MAX_TOOL_CALLS = int(os.getenv("KUBRIC_REACT_MAX_TOOLS", "16"))

    def __init__(self) -> None:
        self.llm = OpenRouterClient()
        self.finalizer = KubernetesAIAgent()  # reuse guardrails + one-shot fallback
        self.system_prompt = _TOOL_PREAMBLE + "\n\n" + PromptBuilder.SYSTEM_PROMPT

    def _seed_user_message(self, evidence: Dict[str, Any]) -> str:
        problematic = (evidence.get("pods") or {}).get("problematic_pods") or []
        hint = json.dumps(problematic[:10], default=str) if problematic else "(none pre-identified — discover them with list_pods only_unhealthy=true)"
        return (
            "A cluster incident needs diagnosis. Pre-identified problematic pods:\n"
            f"{hint}\n\n"
            "Investigate with the read-only tools, then output the final diagnosis JSON."
        )

    async def diagnose(
        self,
        provider: ClusterReadTools,
        seed_evidence: Dict[str, Any],
    ) -> Dict[str, Any]:
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": self._seed_user_message(seed_evidence)},
        ]
        cache: Dict[str, str] = {}
        tool_budget = self.MAX_TOOL_CALLS

        try:
            for _ in range(self.MAX_ITERS):
                resp = await self.llm.call_with_tools(messages, tools=TOOL_SCHEMAS)
                if not resp:
                    logger.warning("[react] LLM call failed; falling back to one-shot analyzer.")
                    return await self.finalizer.analyze(seed_evidence)

                msg = resp["message"]
                tool_calls = msg.get("tool_calls") or []

                if not tool_calls:
                    parsed = self._parse_final(msg.get("content"))
                    if parsed is not None:
                        logger.info("[react] Final diagnosis produced.")
                        return await self.finalizer.finalize_diagnosis(parsed, seed_evidence)
                    # Model stopped without valid JSON — force a structured answer.
                    return await self._force_final(messages, seed_evidence)

                # Record the assistant turn (with its tool_calls) then answer each call.
                messages.append(msg)
                exec_specs = []
                for tc in tool_calls:
                    if tool_budget <= 0:
                        # Out of budget: return an error result so the model wraps up.
                        messages.append({
                            "role": "tool", "tool_call_id": tc.get("id"),
                            "content": json.dumps({"error": "tool budget exhausted — conclude now"}),
                        })
                        continue
                    tool_budget -= 1
                    exec_specs.append(tc)

                if exec_specs:
                    results = await asyncio.gather(*[
                        self._run_tool(provider, tc, cache) for tc in exec_specs
                    ])
                    for tc, content in zip(exec_specs, results):
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "content": content,
                        })

            # Iteration cap reached — force a final answer from what we have.
            return await self._force_final(messages, seed_evidence)

        except Exception as e:
            logger.error(f"[react] loop error: {e}; falling back to one-shot analyzer.")
            return await self.finalizer.analyze(seed_evidence)

    async def _run_tool(self, provider: ClusterReadTools, tool_call: Dict[str, Any], cache: Dict[str, str]) -> str:
        fn = tool_call.get("function", {}) or {}
        name = fn.get("name", "")
        raw_args = fn.get("arguments") or "{}"
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
        except json.JSONDecodeError:
            args = {}
        key = f"{name}:{json.dumps(args, sort_keys=True, default=str)}"
        if key in cache:
            return cache[key]
        result = await execute_tool(provider, name, args)
        cache[key] = result
        return result

    def _parse_final(self, content: Optional[str]) -> Optional[Dict[str, Any]]:
        if not content:
            return None
        cleaned = self.finalizer._clean_json_response(content)
        try:
            data = json.loads(cleaned)
            return data if isinstance(data, dict) and data.get("root_cause") else None
        except json.JSONDecodeError:
            return None

    async def _force_final(self, messages: List[Dict[str, Any]], seed_evidence: Dict[str, Any]) -> Dict[str, Any]:
        """Ask once more for the diagnosis JSON only (no tools, JSON-forced)."""
        prompt = list(messages) + [{
            "role": "user",
            "content": "Stop investigating. Based on everything gathered, output ONLY the final diagnosis JSON now.",
        }]
        resp = await self.llm.call_with_tools(prompt, tools=None, force_json=True)
        if resp:
            parsed = self._parse_final(resp["message"].get("content"))
            if parsed is not None:
                return await self.finalizer.finalize_diagnosis(parsed, seed_evidence)
        logger.warning("[react] force-final failed; falling back to one-shot analyzer.")
        return await self.finalizer.analyze(seed_evidence)

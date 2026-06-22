import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="AI Kubernetes Agent",
    description="Backend orchestrator for AI-driven Kubernetes troubleshooting",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting AI Kubernetes Agent backend...")
    
    # Docker networking fix: 
    # When running in a container, 127.0.0.1 refers to the container itself.
    # We must rewrite the mounted kubeconfig to point to the host machine.
    mounted_kubeconfig = "/root/.kube/config"
    if os.path.exists(mounted_kubeconfig):
        try:
            with open(mounted_kubeconfig, "r") as f:
                content = f.read()
            
            # Replace localhost IP/names with Docker's host gateway
            content = content.replace("127.0.0.1", "host.docker.internal")
            content = content.replace("0.0.0.0", "host.docker.internal")
            # We don't blindly replace "localhost" because it might be part of a URL path or name, 
            # but usually kubernetes API is an IP or "localhost:port"
            content = content.replace("https://localhost:", "https://host.docker.internal:")
            
            import re
            # Disable TLS verification because host.docker.internal is not in the cluster cert
            content = re.sub(r'certificate-authority.*:.*', 'insecure-skip-tls-verify: true', content)
            
            # Write to a writable location
            temp_kubeconfig = "/tmp/kubeconfig"
            with open(temp_kubeconfig, "w") as f:
                f.write(content)
            
            # Tell kubectl to use the rewritten config
            os.environ["KUBECONFIG"] = temp_kubeconfig
            logger.info("Successfully patched kubeconfig for Docker Desktop networking.")
        except Exception as e:
            logger.error(f"Failed to patch kubeconfig: {e}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-kubernetes-agent"
    }

from app.kubernetes.service import InvestigationService
from app.kubernetes.executor import KubectlExecutor, KubectlError
from app.ai.agent import KubernetesAIAgent
from app.insforge_client import InsForgeClient
from pydantic import BaseModel
from typing import Optional
from fastapi import HTTPException, Header

class InvestigationRequest(BaseModel):
    investigation_id: str
    cluster_context: Optional[str] = None

@app.get("/clusters")
async def get_clusters():
    try:
        output = KubectlExecutor.run("kubectl config get-contexts -o name", parse_json=False)
        clusters = [line.strip() for line in output.split('\n') if line.strip()] if output else []
        return {"clusters": clusters}
    except KubectlError as e:
        logger.error(f"Failed to fetch clusters: {str(e)}")
        # Even if it fails, return empty list so UI doesn't break
        return {"clusters": []}

@app.get("/investigate/{investigation_id}/progress")
async def get_investigation_progress(investigation_id: str, authorization: Optional[str] = Header(None)):
    """Fetches the progress steps for a specific investigation."""
    # We use the backend's admin client to bypass RLS since the frontend anon_key is blocked
    client = InsForgeClient()
    if not client.url:
        return {"progress": []}
        
    try:
        import httpx
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{client.base_url}/investigation_progress?session_id=eq.{investigation_id}&order=created_at.asc",
                headers=client.headers
            )
            resp.raise_for_status()
            data = resp.json()
            return {"progress": data}
    except Exception as e:
        logger.error(f"Failed to fetch progress for {investigation_id}: {e}")
        return {"progress": []}

@app.post("/investigate")
async def investigate_cluster(request: InvestigationRequest, authorization: Optional[str] = Header(None)):
    logger.info(f"Received request to investigate cluster for ID {request.investigation_id} (context: {request.cluster_context}).")
    
    # Initialize the client with the user's JWT so it passes RLS checks
    client = InsForgeClient(user_jwt=authorization)
    
    try:
        # 1. Collect Evidence
        service = InvestigationService(client=client)
        investigation_data = await service.run_investigation(request.investigation_id, request.cluster_context)
        
        # 2. AI Reasoning
        ai_agent = KubernetesAIAgent()
        diagnosis = await ai_agent.analyze(investigation_data)
        
        # 3. Save Final Diagnosis
        await client.complete_investigation(request.investigation_id, diagnosis)
        
        return {
            "status": "success",
            "diagnosis": diagnosis
        }
    except KubectlError as e:
        logger.error(f"Investigation failed due to cluster error: {str(e)}")
        # Save failure to db if investigation_id exists
        if request.investigation_id:
            client = InsForgeClient()
            # Send a default failure diagnosis
            failure_diagnosis = {
                "root_cause": str(e),
                "explanation": "The AI Agent could not communicate with the Kubernetes cluster.",
                "fix": "Please check your cluster connection, kubeconfig, and ensure the cluster is running.",
                "kubectl_command": None,
                "confidence": 0
            }
            await client.complete_investigation(request.investigation_id, failure_diagnosis)
            
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during investigation: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred during the investigation.")

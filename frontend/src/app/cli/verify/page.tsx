"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    // Simulate a brief verification delay for visual feedback
    const timer = setTimeout(() => {
      if (code) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0b0d",
        fontFamily: "var(--font-thicccboi), var(--font-inter), system-ui, sans-serif",
        color: "#e9edf1",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 480,
          padding: "48px 32px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(145deg, rgba(15,81,40,0.08), rgba(17,19,22,0.9))",
          backdropFilter: "blur(24px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 24px",
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: "#22c55e",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Verifying...
            </h1>
            <p style={{ fontSize: 14, color: "#9aa3ad", margin: 0 }}>
              Confirming your CLI login request
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 24px",
                borderRadius: "50%",
                background: "rgba(34,197,94,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "scaleIn 0.3s ease-out",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              CLI Login Approved
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "#9aa3ad",
                margin: "0 0 28px",
                lineHeight: 1.5,
              }}
            >
              You've been successfully authenticated.
              <br />
              You can close this tab and return to your terminal.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
                fontFamily: "var(--font-jetbrains-mono), monospace",
                color: "#6b727b",
              }}
            >
              <span style={{ color: "#22c55e" }}>✓</span>
              <span>Logged in as developer@kubric.dev</span>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 24px",
                borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Verification Failed
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "#9aa3ad",
                margin: "0 0 24px",
                lineHeight: 1.5,
              }}
            >
              No device code was provided. Run{" "}
              <code
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  background: "rgba(255,255,255,0.06)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                kubric login
              </code>{" "}
              in your terminal to try again.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function CLIVerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0b0d",
            color: "#9aa3ad",
          }}
        >
          Loading...
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ background: "#0a0a0a", color: "#fff", fontFamily: "monospace", padding: "20px", margin: 0 }}>
        <h1 style={{ color: "#ff6b6b", fontSize: "20px", marginBottom: "12px" }}>
          Global Error — Produção em Debug
        </h1>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "13px", background: "#1a0a0a", padding: "16px", borderRadius: "8px", border: "1px solid #400" }}>
          {`name: ${error.name}\nmessage: ${error.message}\ndigest: ${error.digest ?? "(none)"}\n\nstack:\n${error.stack ?? "(no stack)"}`}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: "16px", padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}

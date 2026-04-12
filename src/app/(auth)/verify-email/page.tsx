"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { verifyEmailChange } from "@/lib/actions/profile";
import Link from "next/link";

function VerifyEmailContent() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token inválido ou ausente");
      return;
    }

    verifyEmailChange(token).then((result) => {
      if (result.success) {
        setStatus("success");
        setMessage("E-mail alterado com sucesso!");
      } else {
        setStatus("error");
        setMessage(result.error || "Erro ao verificar e-mail");
      }
    });
  }, [token]);

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-2xl shadow-black/20 text-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando...</p>
        </div>
      )}
      {status === "success" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-foreground">{message}</p>
          <Link href="/profile" className="text-sm text-violet-400 hover:underline">
            Ir para o perfil
          </Link>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <XCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link href="/login" className="text-sm text-violet-400 hover:underline">
            Voltar ao login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-[#09090b] to-purple-950/60" />
      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" as const }}
        >
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Verificação de e-mail</h1>
            </div>
          </div>
          <Suspense>
            <VerifyEmailContent />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
}

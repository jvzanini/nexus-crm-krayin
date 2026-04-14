"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@nexusai360/design-system";
import { Input } from "@nexusai360/design-system";
import { Label } from "@nexusai360/design-system";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import Link from "next/link";
import { APP_CONFIG } from "@/lib/app.config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-[#09090b] to-purple-950/60" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] rounded-full bg-violet-600/8 blur-[100px] sm:blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[250px] w-[250px] sm:h-[400px] sm:w-[400px] rounded-full bg-purple-600/8 blur-[100px] sm:blur-[120px]" />
      </div>

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
              <h1 className="text-2xl font-bold text-foreground">Esqueci a senha</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sent
                  ? "Verifique sua caixa de entrada"
                  : "Informe seu e-mail para redefinir a senha"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-2xl shadow-black/20">
            {sent ? (
              <div className="text-center py-4">
                <Mail className="h-10 w-10 text-violet-400 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Se houver uma conta com esse e-mail, você receberá um link para redefinir sua senha em breve.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="h-12 rounded-xl border-zinc-800 bg-zinc-900/80"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-[0_0_24px_rgba(124,58,237,0.4)] transition-all duration-300 font-medium"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link"
                  )}
                </Button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-violet-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 pb-6">
        <p className="text-xs text-zinc-600">
          NexusAI360 &copy; {new Date().getFullYear()}. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_CONFIG } from "@/lib/app.config";
import Link from "next/link";

export function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("E-mail ou senha inválidos");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="w-full"
    >
      {/* Logo com glow animado */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <motion.div
          animate={{
            boxShadow: [
              "0 0 30px rgba(124,58,237,0.12)",
              "0 0 50px rgba(124,58,237,0.2)",
              "0 0 30px rgba(124,58,237,0.12)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" as const }}
          className="flex h-[88px] w-[88px] items-center justify-center rounded-[22%] bg-gradient-to-br from-violet-600 to-purple-600"
        >
          <ShieldCheck className="h-10 w-10 text-white" />
        </motion.div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{APP_CONFIG.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acesse sua conta para continuar
          </p>
        </div>
      </div>

      {/* Card de login */}
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-2xl shadow-black/20">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-900/50 bg-red-950/30 p-3.5 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}

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
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-xl border-zinc-800 bg-zinc-900/80 pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-violet-400 transition-colors"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-[0_0_24px_rgba(124,58,237,0.4)] transition-all duration-300 font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

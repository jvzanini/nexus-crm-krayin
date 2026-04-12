"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  UserCircle,
  Mail,
  Lock,
  Palette,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfile,
  changePassword,
  requestEmailChange,
} from "@/lib/actions/profile";
import { useTheme } from "@/components/providers/theme-provider";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();

  const user = session?.user as any;
  const [name, setName] = useState(user?.name || "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading("profile");
    const result = await updateProfile({ name });
    if (result.success) {
      toast.success("Perfil atualizado");
      await update({ name });
    } else {
      toast.error(result.error || "Erro ao atualizar");
    }
    setLoading(null);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading("password");
    const result = await changePassword({
      currentPassword: currentPass,
      newPassword: newPass,
      confirmPassword: confirmPass,
    });
    if (result.success) {
      toast.success("Senha alterada com sucesso");
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
    } else {
      toast.error(result.error || "Erro ao alterar senha");
    }
    setLoading(null);
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    const result = await requestEmailChange(newEmail);
    if (result.success) {
      toast.success("Link de confirmação enviado para o novo e-mail");
      setNewEmail("");
    } else {
      toast.error(result.error || "Erro ao solicitar alteração");
    }
    setLoading(null);
  }

  const themes = [
    { value: "dark" as const, label: "Escuro", icon: Moon },
    { value: "light" as const, label: "Claro", icon: Sun },
    { value: "system" as const, label: "Sistema", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Perfil</h1>

      <div className="grid gap-6">
        {/* Informações pessoais */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" as const }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={loading === "profile"} size="sm">
                    {loading === "profile" ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* E-mail */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" as const }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Mail className="h-4 w-4 text-muted-foreground" />
                E-mail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  E-mail atual:{" "}
                  <span className="text-foreground">{user?.email}</span>
                </p>
              </div>
              <form onSubmit={handleEmailChange} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-email">Novo e-mail</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={loading === "email" || !newEmail} size="sm">
                    {loading === "email" ? "Enviando..." : "Solicitar alteração"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alterar senha */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" as const }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current-pass">Senha atual</Label>
                  <Input
                    id="current-pass"
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-pass">Nova senha</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
                  <Input
                    id="confirm-pass"
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading === "password" || !currentPass || !newPass || !confirmPass}
                    size="sm"
                  >
                    {loading === "password" ? "Salvando..." : "Alterar senha"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Aparência */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18, ease: "easeOut" as const }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Aparência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {themes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                      theme === t.value
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <t.icon
                      className={`h-5 w-5 ${
                        theme === t.value ? "text-violet-400" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        theme === t.value ? "text-violet-400" : "text-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

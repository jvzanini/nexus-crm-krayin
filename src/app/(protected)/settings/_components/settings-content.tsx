"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Settings, Globe, Bell, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nexusai360/design-system";
import { Button } from "@nexusai360/design-system";
import { Input } from "@nexusai360/design-system";
import { Label } from "@nexusai360/design-system";
import { Switch } from "@nexusai360/design-system";
import { getAllSettings, setSetting } from "@/lib/actions/settings";

export function SettingsContent() {
  const [loading, setLoading] = useState(true);

  const [platformName, setPlatformName] = useState("Nexus CRM");
  const [supportEmail, setSupportEmail] = useState("contato@nexusai360.com");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [platformNotifications, setPlatformNotifications] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [isPendingGeral, startGeral] = useTransition();
  const [isPendingNotif, startNotif] = useTransition();
  const [isPendingSistema, startSistema] = useTransition();

  useEffect(() => {
    getAllSettings().then((result) => {
      if (result.success && result.settings) {
        setPlatformName(String(result.settings.platform_name ?? "Nexus CRM"));
        setSupportEmail(String(result.settings.support_email ?? "contato@nexusai360.com"));
        setEmailNotifications(Boolean(result.settings.notifications_email ?? true));
        setPlatformNotifications(Boolean(result.settings.notifications_platform ?? true));
        setMaintenanceMode(Boolean(result.settings.maintenance_mode ?? false));
      }
      setLoading(false);
    });
  }, []);

  function handleSaveGeral() {
    startGeral(async () => {
      const [r1, r2] = await Promise.all([
        setSetting("platform_name", platformName),
        setSetting("support_email", supportEmail),
      ]);
      if (r1.success && r2.success) {
        toast.success("Configurações gerais salvas");
      } else {
        toast.error("Erro ao salvar configurações gerais");
      }
    });
  }

  function handleSaveNotif() {
    startNotif(async () => {
      const [r1, r2] = await Promise.all([
        setSetting("notifications_email", emailNotifications),
        setSetting("notifications_platform", platformNotifications),
      ]);
      if (r1.success && r2.success) {
        toast.success("Configurações de notificações salvas");
      } else {
        toast.error("Erro ao salvar configurações de notificações");
      }
    });
  }

  function handleSaveSistema() {
    startSistema(async () => {
      const result = await setSetting("maintenance_mode", maintenanceMode);
      if (result.success) {
        toast.success("Configurações do sistema salvas");
      } else {
        toast.error("Erro ao salvar configurações do sistema");
      }
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-600/20">
            <Settings className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              Configurações globais da plataforma
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-600/20">
          <Settings className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Configurações globais da plataforma
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Geral */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" as const }}
        >
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="platform-name" className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Nome da plataforma
                </Label>
                <Input
                  id="platform-name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="Nome da plataforma"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="support-email" className="block text-sm font-medium text-foreground/80 mb-1.5">
                  E-mail de suporte
                </Label>
                <Input
                  id="support-email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="contato@nexusai360.com"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveGeral}
                  disabled={isPendingGeral}
                >
                  {isPendingGeral ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notificações */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" as const }}
        >
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Notificações por e-mail
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviar alertas por e-mail quando houver eventos importantes
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Notificações na plataforma
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Exibir notificações in-app para eventos do sistema
                  </p>
                </div>
                <Switch
                  checked={platformNotifications}
                  onCheckedChange={setPlatformNotifications}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotif}
                  disabled={isPendingNotif}
                >
                  {isPendingNotif ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sistema */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" as const }}
        >
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Modo manutenção
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia acesso de usuários não-admin durante manutenção
                  </p>
                </div>
                <Switch
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveSistema}
                  disabled={isPendingSistema}
                >
                  {isPendingSistema ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

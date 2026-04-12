"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Settings, Globe, Bell, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsContent() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="platform-name">Nome da plataforma</Label>
                <Input
                  id="platform-name"
                  defaultValue="Nexus CRM"
                  placeholder="Nome da plataforma"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="support-email">E-mail de suporte</Label>
                <Input
                  id="support-email"
                  type="email"
                  defaultValue="contato@nexusai360.com"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => toast.success("Configurações salvas")}
                >
                  Salvar
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
          <Card>
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
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => toast.success("Configurações salvas")}
                >
                  Salvar
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
          <Card>
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
                  onClick={() => toast.success("Configurações salvas")}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

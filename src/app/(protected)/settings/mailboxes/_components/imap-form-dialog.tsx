"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Input,
  Label,
} from "@nexusai360/design-system";
import { toast } from "sonner";
import { connectImapSmtpAction } from "@/lib/actions/mailboxes";

// TODO 7b-T6: extract to i18n pack mailboxes

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImapFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const [saving, startSaving] = useTransition();

  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  function resetForm() {
    setEmailAddress("");
    setDisplayName("");
    setImapHost("");
    setImapPort(993);
    setSmtpHost("");
    setSmtpPort(587);
    setAuthUsername("");
    setAuthPassword("");
  }

  function handleSubmit() {
    startSaving(async () => {
      const res = await connectImapSmtpAction({
        emailAddress,
        displayName: displayName.trim() || undefined,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        authUsername,
        authPassword,
      });

      if (res.success) {
        toast.success("Caixa IMAP/SMTP conectada com sucesso"); // TODO 7b-T6
        resetForm();
        onSuccess();
      } else {
        toast.error(res.error ?? "Erro ao conectar caixa IMAP/SMTP"); // TODO 7b-T6
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle>Conectar caixa IMAP/SMTP</DialogTitle>{/* TODO 7b-T6 */}
          <DialogDescription>
            Configure as credenciais do servidor IMAP e SMTP para enviar e receber e-mails.{/* TODO 7b-T6 */}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* E-mail + nome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                E-mail *
              </Label>
              <Input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="você@exemplo.com" // TODO 7b-T6
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                Nome de exibição
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Opcional" // TODO 7b-T6
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* IMAP */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Servidor IMAP
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Host *
                </Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.exemplo.com" // TODO 7b-T6
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Porta *
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={imapPort}
                  onChange={(e) => setImapPort(Number(e.target.value))}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {/* SMTP */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Servidor SMTP
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Host *
                </Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.exemplo.com" // TODO 7b-T6
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Porta *
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Credenciais */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Autenticação
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Usuário *
                </Label>
                <Input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="usuário ou e-mail" // TODO 7b-T6
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  Senha *
                </Label>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            Cancelar {/* TODO 7b-T6 */}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !emailAddress || !imapHost || !smtpHost || !authUsername || !authPassword}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Conectar {/* TODO 7b-T6 */}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

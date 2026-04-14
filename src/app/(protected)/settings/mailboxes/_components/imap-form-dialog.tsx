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
import { useTranslations } from "next-intl";
import { connectImapSmtpAction } from "@/lib/actions/mailboxes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImapFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations("mailboxes");
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
        toast.success(t("toast.imapSuccess"));
        resetForm();
        onSuccess();
      } else {
        toast.error(res.error ?? t("toast.imapError"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg overflow-visible">
        <DialogHeader>
          <DialogTitle>{t("imap.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("imap.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* E-mail + nome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                {t("imap.field.emailAddress")} *
              </Label>
              <Input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder={t("imap.placeholder.emailAddress")}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                {t("imap.field.displayName")}
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("imap.placeholder.displayName")}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* IMAP */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t("imap.section.imap")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.imapHost")} *
                </Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder={t("imap.placeholder.imapHost")}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.imapPort")} *
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
              {t("imap.section.smtp")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.smtpHost")} *
                </Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder={t("imap.placeholder.smtpHost")}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.smtpPort")} *
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
              {t("imap.section.auth")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.authUsername")} *
                </Label>
                <Input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder={t("imap.placeholder.authUsername")}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground/80 mb-1.5 block">
                  {t("imap.field.authPassword")} *
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
            {t("imap.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !emailAddress || !imapHost || !smtpHost || !authUsername || !authPassword}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("imap.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

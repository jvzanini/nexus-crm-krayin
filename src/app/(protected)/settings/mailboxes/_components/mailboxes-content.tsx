"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Mail, Star, Plus, Loader2, AtSign, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@nexusai360/design-system";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  listMailboxes,
  setPrimaryMailbox,
  disconnectMailbox,
  type MailboxItem,
} from "@/lib/actions/mailboxes";
import { ImapFormDialog } from "./imap-form-dialog";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

interface Props {
  canManage: boolean;
  canConnect: boolean;
  googleConfigured: boolean;
  outlookConfigured: boolean;
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "gmail":
      return "Gmail";
    case "outlook":
      return "Outlook";
    case "imap_smtp":
      return "IMAP/SMTP";
    default:
      return provider;
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const label = providerLabel(provider);
  const isOAuth = provider === "gmail" || provider === "outlook";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {isOAuth ? (
        <Mail className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <AtSign className="h-3.5 w-3.5 shrink-0" />
      )}
      {label}
    </span>
  );
}

export function MailboxesContent({
  canManage,
  canConnect,
  googleConfigured,
  outlookConfigured,
}: Props) {
  const t = useTranslations("mailboxes");
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, startActing] = useTransition();

  const [imapOpen, setImapOpen] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<MailboxItem | null>(null);

  async function load() {
    setLoading(true);
    const res = await listMailboxes();
    if (res.success && res.data) {
      setMailboxes(res.data);
    } else {
      toast.error(res.error ?? t("toast.loadError"));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function handleSetPrimary(id: string) {
    startActing(async () => {
      const res = await setPrimaryMailbox(id);
      if (res.success) {
        toast.success(t("toast.setPrimarySuccess"));
        await load();
      } else {
        toast.error(res.error ?? t("toast.setPrimaryError"));
      }
    });
  }

  function handleDisconnect(id: string) {
    startActing(async () => {
      const res = await disconnectMailbox(id);
      if (res.success) {
        toast.success(t("toast.disconnectSuccess"));
        setDisconnectTarget(null);
        await load();
      } else {
        toast.error(res.error ?? t("toast.disconnectError"));
      }
    });
  }

  return (
    <TooltipProvider>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
              <Mail className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("list.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? t("list.loading")
                  : t("list.subtitle.count", { count: mailboxes.length })}
              </p>
            </div>
          </div>

          {canConnect && (
            <DropdownMenuRoot>
              <DropdownMenuTrigger render={
                <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200">
                  <Plus className="h-4 w-4" />
                  {t("action.connect")}
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-48">
                {/* Gmail */}
                {googleConfigured ? (
                  <DropdownMenuItem render={
                    <a href="/api/oauth/gmail/authorize" className="flex items-center gap-2 w-full">
                      <Mail className="h-4 w-4 text-red-400" />
                      {t("action.connectGmail")}
                    </a>
                  } />
                ) : (
                  <TooltipRoot>
                    <TooltipTrigger render={
                      <DropdownMenuItem disabled className="flex items-center gap-2 cursor-not-allowed opacity-50">
                        <Mail className="h-4 w-4 text-red-400" />
                        {t("action.connectGmail")}
                      </DropdownMenuItem>
                    } />
                    <TooltipContent>{t("tooltip.gmailNotConfigured")}</TooltipContent>
                  </TooltipRoot>
                )}

                {/* Outlook */}
                {outlookConfigured ? (
                  <DropdownMenuItem render={
                    <a href="/api/oauth/outlook/authorize" className="flex items-center gap-2 w-full">
                      <Mail className="h-4 w-4 text-blue-400" />
                      {t("action.connectOutlook")}
                    </a>
                  } />
                ) : (
                  <TooltipRoot>
                    <TooltipTrigger render={
                      <DropdownMenuItem disabled className="flex items-center gap-2 cursor-not-allowed opacity-50">
                        <Mail className="h-4 w-4 text-blue-400" />
                        {t("action.connectOutlook")}
                      </DropdownMenuItem>
                    } />
                    <TooltipContent>{t("tooltip.outlookNotConfigured")}</TooltipContent>
                  </TooltipRoot>
                )}

                {/* IMAP/SMTP */}
                <DropdownMenuItem
                  onClick={() => setImapOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  {t("action.connectImap")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>
          )}
        </motion.div>

        {/* Tabela */}
        <motion.div variants={itemVariants}>
          <Card className="border-border bg-card/50 rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{t("list.connected")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
                  ))}
                </div>
              ) : mailboxes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Mail className="h-12 w-12 mb-3 text-muted-foreground/60" />
                  <p className="text-sm">{t("list.empty")}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">{t("list.columns.provider")}</TableHead>
                      <TableHead className="text-muted-foreground">{t("list.columns.emailAddress")}</TableHead>
                      <TableHead className="text-muted-foreground text-center">{t("list.status.primary")}</TableHead>
                      <TableHead className="text-muted-foreground text-center">{t("list.columns.status")}</TableHead>
                      {canManage && (
                        <TableHead className="text-muted-foreground text-right">{t("list.columns.actions")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mailboxes.map((mb, idx) => (
                      <motion.tr
                        key={mb.id}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: idx * 0.05 }}
                        className="border-border hover:bg-muted/30 transition-colors"
                      >
                        <TableCell>
                          <ProviderBadge provider={mb.provider} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          <div className="flex flex-col">
                            <span>{mb.emailAddress}</span>
                            {mb.displayName && (
                              <span className="text-xs text-muted-foreground">{mb.displayName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {mb.isPrimary ? (
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {mb.isActive ? (
                            <Badge variant="default" className="text-xs bg-green-600/15 text-green-400 border-green-600/20">
                              {t("list.status.active")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {t("list.status.inactive")}
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!mb.isPrimary && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={acting}
                                  onClick={() => handleSetPrimary(mb.id)}
                                  className="gap-1.5 text-xs h-7 px-2 cursor-pointer hover:bg-violet-600/10 hover:text-violet-400"
                                >
                                  <Star className="h-3 w-3" />
                                  {t("action.setPrimary")}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={acting}
                                onClick={() => setDisconnectTarget(mb)}
                                className="gap-1.5 text-xs h-7 px-2 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                {t("action.disconnect")}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Dialog IMAP */}
        <ImapFormDialog
          open={imapOpen}
          onOpenChange={setImapOpen}
          onSuccess={() => {
            setImapOpen(false);
            load();
          }}
        />

        {/* AlertDialog desconectar */}
        <AlertDialog open={!!disconnectTarget} onOpenChange={(v) => !v && setDisconnectTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("action.confirmDisconnectTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("action.confirmDisconnectDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectTarget && handleDisconnect(disconnectTarget.id)}
                disabled={acting}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.disconnect")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </TooltipProvider>
  );
}

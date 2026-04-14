"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, PageHeader } from "@nexusai360/design-system";
import {
  Megaphone,
  Loader2,
  Pause,
  Play,
  X,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  activateCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
} from "@/lib/actions/marketing-campaigns";
import type { CampaignItem } from "@/lib/actions/marketing-campaigns";

// ---------------------------------------------------------------------------
// Variants de animação
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// ---------------------------------------------------------------------------
// Status labels e estilos
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  canceled: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  paused: "Pausada",
  canceled: "Cancelada",
  failed: "Falhou",
};

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  skipped_consent: "Pulado (consent)",
  skipped_quota: "Pulado (cota)",
  bounced: "Devolvido",
  complained: "Reclamação",
  unsubscribed: "Cancelou inscrição",
};

const RECIPIENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  skipped_consent: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  skipped_quota: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  bounced: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  complained: "bg-red-500/15 text-red-400 border-red-500/30",
  unsubscribed: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CampaignDetailContentProps {
  campaign: CampaignItem;
  stats: { byStatus: Record<string, number>; total: number };
  canManage: boolean;
  canSend: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CampaignDetailContent({
  campaign: initialCampaign,
  stats,
  canSend,
}: CampaignDetailContentProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [acting, startActing] = useTransition();

  function handleActivate() {
    startActing(async () => {
      const result = await activateCampaignAction(campaign.id);
      if (result.success) {
        toast.success(`Campanha ativada — ${result.data?.enqueued ?? 0} destinatários enfileirados`);
        setCampaign((prev) => ({ ...prev, status: "sending" }));
      } else {
        toast.error(result.error ?? "Erro ao ativar campanha");
      }
    });
  }

  function handlePause() {
    startActing(async () => {
      const result = await pauseCampaignAction(campaign.id);
      if (result.success) {
        toast.success("Campanha pausada");
        setCampaign((prev) => ({ ...prev, status: "paused" }));
      } else {
        toast.error(result.error ?? "Erro ao pausar campanha");
      }
    });
  }

  function handleResume() {
    startActing(async () => {
      const result = await resumeCampaignAction(campaign.id);
      if (result.success) {
        toast.success(`Campanha retomada — ${result.data?.enqueued ?? 0} jobs re-enfileirados`);
        setCampaign((prev) => ({ ...prev, status: "sending" }));
      } else {
        toast.error(result.error ?? "Erro ao retomar campanha");
      }
    });
  }

  function handleCancel() {
    startActing(async () => {
      const result = await cancelCampaignAction(campaign.id);
      if (result.success) {
        toast.success("Campanha cancelada");
        setCampaign((prev) => ({ ...prev, status: "canceled" }));
      } else {
        toast.error(result.error ?? "Erro ao cancelar campanha");
      }
    });
  }

  const statusEntries = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
            <Mail className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[campaign.status] ?? "bg-muted text-muted-foreground border-border"}`}
              >
                {STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{campaign.subject}</p>
          </div>
        </div>

        {/* Botões de ação conforme status */}
        {canSend && (
          <div className="flex items-center gap-2 shrink-0">
            {campaign.status === "draft" && (
              <Button
                onClick={handleActivate}
                disabled={acting}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200 disabled:opacity-50"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Ativar
              </Button>
            )}
            {["sending", "scheduled"].includes(campaign.status) && (
              <Button
                onClick={handlePause}
                disabled={acting}
                variant="outline"
                className="gap-2 border-border cursor-pointer transition-all duration-200 disabled:opacity-50"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                Pausar
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button
                onClick={handleResume}
                disabled={acting}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200 disabled:opacity-50"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Retomar
              </Button>
            )}
            {!["sent", "canceled", "failed"].includes(campaign.status) && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Informações da campanha */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Lote por minuto</p>
          <p className="text-2xl font-bold text-foreground mt-1">{campaign.batchSize}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Criada em</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {new Date(campaign.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {campaign.scheduledAt && (
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-xs text-muted-foreground">Agendada para</p>
            <p className="text-sm font-medium text-foreground mt-1">
              {new Date(campaign.scheduledAt).toLocaleString("pt-BR")}
            </p>
          </div>
        )}
      </motion.div>

      {/* Estatísticas por status */}
      {statusEntries.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-border bg-card/50 p-5 space-y-3"
        >
          <h2 className="text-sm font-semibold text-foreground">Estatísticas por status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statusEntries.map(([status, count]) => (
              <motion.div
                key={status}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" as const }}
                className="rounded-lg border border-border bg-muted/20 p-3"
              >
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium mb-2 ${RECIPIENT_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"}`}
                >
                  {RECIPIENT_STATUS_LABELS[status] ?? status}
                </span>
                <p className="text-xl font-bold text-foreground">{count}</p>
                {stats.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((count / stats.total) * 100)}%
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Estado vazio (sem stats) */}
      {stats.total === 0 && campaign.status === "draft" && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center"
        >
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Nenhum destinatário ainda. Ative a campanha para enfileirar os contatos do segmento.
          </p>
        </motion.div>
      )}

      {/* Botão voltar */}
      <motion.div variants={itemVariants} className="pb-8">
        <button
          type="button"
          onClick={() => router.push("/marketing/campaigns")}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          Voltar para campanhas
        </button>
      </motion.div>
    </motion.div>
  );
}

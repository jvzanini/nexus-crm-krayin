"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@nexusai360/design-system";
import { Mail, Plus, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listCampaignsAction } from "@/lib/actions/marketing-campaigns";
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
// Badge de status
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CampaignsListContentProps {
  canManage: boolean;
  canSend: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CampaignsListContent({ canManage }: CampaignsListContentProps) {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCampaigns() {
    setLoading(true);
    const result = await listCampaignsAction();
    if (result.success && result.data) {
      setCampaigns(result.data);
    } else {
      toast.error(result.error ?? "Erro ao carregar campanhas");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const count = campaigns.length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
            <Mail className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Campanhas</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Carregando..."
                : count === 0
                  ? "Nenhuma campanha cadastrada"
                  : count === 1
                    ? "1 campanha cadastrada"
                    : `${count} campanhas cadastradas`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={() => router.push("/marketing/campaigns/new")}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        )}
      </motion.div>

      {/* Tabela */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
              />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Nenhuma campanha cadastrada ainda</p>
            {canManage && (
              <button
                onClick={() => router.push("/marketing/campaigns/new")}
                className="mt-3 text-sm text-violet-400 hover:text-violet-300 cursor-pointer transition-colors"
              >
                Criar primeira campanha
              </button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Agendada para</TableHead>
                <TableHead className="text-muted-foreground text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign, index) => (
                <motion.tr
                  key={campaign.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.03,
                    ease: "easeOut" as const,
                  }}
                  className="border-border hover:bg-accent/30 transition-colors duration-200"
                >
                  <TableCell className="font-medium text-foreground">
                    {campaign.name}
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {campaign.subject}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell text-sm">
                    {campaign.scheduledAt
                      ? new Date(campaign.scheduledAt).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => router.push(`/marketing/campaigns/${campaign.id}`)}
                      title="Ver detalhes"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>
    </motion.div>
  );
}

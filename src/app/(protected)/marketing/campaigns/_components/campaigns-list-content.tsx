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
  PageHeader,
  EmptyState,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nexusai360/design-system";
import { Megaphone, Plus, Eye, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listCampaignsAction,
  deleteCampaignsBulkAction,
} from "@/lib/actions/marketing-campaigns";
import type { CampaignItem } from "@/lib/actions/marketing-campaigns";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";

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

interface CampaignsListContentProps {
  canManage: boolean;
  canSend: boolean;
}

export function CampaignsListContent({ canManage }: CampaignsListContentProps) {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

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

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(rowIds: string[]) {
    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(rowIds));
  }
  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDeleting(async () => {
      const result = await deleteCampaignsBulkAction(ids);
      if (result.success && result.data) {
        const { deletedCount, skippedActive } = result.data;
        toast.success(
          `${deletedCount} campanha${deletedCount === 1 ? "" : "s"} excluída${deletedCount === 1 ? "" : "s"}${skippedActive > 0 ? ` (${skippedActive} em execução ignorada${skippedActive === 1 ? "" : "s"})` : ""}`,
        );
        await loadCampaigns();
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir campanhas");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  const count = campaigns.length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={Megaphone} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>Campanhas</PageHeader.Title>
              <PageHeader.Description>
                {loading
                  ? "Carregando..."
                  : count === 0
                    ? "Nenhuma campanha cadastrada"
                    : count === 1
                      ? "1 campanha cadastrada"
                      : `${count} campanhas cadastradas`}
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          {canManage && (
            <PageHeader.Actions>
              <Button
                onClick={() => router.push("/marketing/campaigns/new")}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nova campanha
              </Button>
            </PageHeader.Actions>
          )}
        </PageHeader.Root>
      </motion.div>

      {/* Bulk action bar */}
      {canManage && (
        <BulkActionBar
          count={selectedIds.size}
          onCancel={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          entityLabel="campanha"
          entityPlural="campanhas"
        />
      )}

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
          <EmptyState.Root>
            <EmptyState.Icon icon={Megaphone} color="violet" />
            <EmptyState.Title>Nenhuma campanha cadastrada</EmptyState.Title>
            <EmptyState.Description>
              Crie campanhas para engajar sua base de contatos.
            </EmptyState.Description>
            {canManage && (
              <EmptyState.Action>
                <Button
                  onClick={() => router.push("/marketing/campaigns/new")}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Nova campanha
                </Button>
              </EmptyState.Action>
            )}
          </EmptyState.Root>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {canManage && (
                  <TableHead className="text-muted-foreground w-10">
                    <Checkbox
                      checked={
                        campaigns.length > 0 &&
                        campaigns.every((c) => selectedIds.has(c.id))
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        !campaigns.every((c) => selectedIds.has(c.id))
                      }
                      onCheckedChange={() =>
                        toggleAll(campaigns.map((c) => c.id))
                      }
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                )}
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
                  {canManage && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedIds.has(campaign.id)}
                        onCheckedChange={() => toggleRow(campaign.id)}
                        aria-label={`Selecionar ${campaign.name}`}
                      />
                    </TableCell>
                  )}
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

      {/* AlertDialog — Bulk delete */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir campanhas selecionadas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              campanha{selectedIds.size === 1 ? "" : "s"}? Campanhas em execução (agendadas/enviando/pausadas) serão ignoradas. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {bulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
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
  IconTile,
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
import { CrmListShell } from "@nexusai360/patterns";
import { Megaphone, Plus, Eye, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listCampaignsAction,
  deleteCampaignsBulkAction,
} from "@/lib/actions/marketing-campaigns";
import type { CampaignItem } from "@/lib/actions/marketing-campaigns";
import {
  CampaignsFiltersSchema,
  type CampaignsFilters,
} from "@/lib/actions/marketing-campaigns-schemas";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { FilterBar, type FilterConfig } from "@/components/tables/filter-bar";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendada" },
  { value: "sending", label: "Enviando" },
  { value: "sent", label: "Enviada" },
  { value: "paused", label: "Pausada" },
  { value: "canceled", label: "Cancelada" },
  { value: "failed", label: "Falhou" },
];

interface CampaignsListContentProps {
  canManage: boolean;
  canSend: boolean;
  initialFilters?: Record<string, string | undefined>;
}

export function CampaignsListContent({
  canManage,
  initialFilters = {},
}: CampaignsListContentProps) {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros — safeParse de initialFilters
  const [filters, setFilters] = useState<CampaignsFilters>(() => {
    const parsed = CampaignsFiltersSchema.safeParse(initialFilters);
    return parsed.success ? parsed.data : {};
  });
  const [qInput, setQInput] = useState<string>(filters.q ?? "");
  const debouncedQ = useDebouncedValue(qInput, 300);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saved = useSavedFilters("campaigns");
  const currentFiltersAsRecord = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        out[k] = String(v);
      }
    }
    return out;
  }, [filters]);
  function onApplySavedCampaignsFilter(f: Record<string, string>) {
    const parsed = CampaignsFiltersSchema.safeParse(f);
    if (parsed.success) {
      setFilters(parsed.data);
      setQInput(parsed.data.q ?? "");
      setSelectedIds(new Set());
    }
  }
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

  async function loadCampaigns(f: CampaignsFilters = filters) {
    setLoading(true);
    const result = await listCampaignsAction(f);
    if (result.success && result.data) {
      setCampaigns(result.data);
    } else {
      toast.error(result.error ?? "Erro ao carregar campanhas");
    }
    setLoading(false);
  }

  // Sincroniza q debounced com filters
  useEffect(() => {
    const next: CampaignsFilters = {
      ...filters,
      q: debouncedQ.trim() === "" ? undefined : debouncedQ.trim(),
    };
    // só atualiza se mudou
    if (next.q !== filters.q) {
      setFilters(next);
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Recarrega + replace URL quando filters mudam
  const didMount = useRef(false);
  useEffect(() => {
    loadCampaigns(filters);
    if (!didMount.current) {
      // Primeira render: não sujar history; URL já reflete initialFilters SSR.
      didMount.current = true;
      return;
    }
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    const s = qs.toString();
    router.replace(`/marketing/campaigns${s ? "?" + s : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.from, filters.to, filters.q]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== undefined && v !== ""),
    [filters],
  );

  function updateFilter(key: string, value: string) {
    if (key === "q") {
      setQInput(value);
      return;
    }
    const next: CampaignsFilters = {
      ...filters,
      [key]: value === "" || value === "all" ? undefined : value,
    } as CampaignsFilters;
    setFilters(next);
    setSelectedIds(new Set());
  }

  function clearFilters() {
    setFilters({});
    setQInput("");
    setSelectedIds(new Set());
    router.replace("/marketing/campaigns");
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: "input",
      key: "q",
      label: "Buscar",
      value: qInput,
      placeholder: "Buscar nome...",
    },
    {
      type: "select",
      key: "status",
      label: "Status",
      value: filters.status ?? "all",
      options: [{ value: "all", label: "Todos" }, ...STATUS_OPTIONS],
    },
    {
      type: "date",
      key: "from",
      label: "De",
      value: filters.from ?? "",
    },
    {
      type: "date",
      key: "to",
      label: "Até",
      value: filters.to ?? "",
    },
  ];

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
  const campaignsDesc = loading
    ? "Carregando..."
    : count === 0
      ? "Nenhuma campanha cadastrada"
      : count === 1
        ? "1 campanha cadastrada"
        : `${count} campanhas cadastradas`;

  return (
    <CrmListShell
      title="Campanhas"
      description={campaignsDesc}
      icon={<IconTile icon={Megaphone} color="violet" />}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Marketing" },
        { label: "Campanhas" },
      ]}
      actions={
        canManage ? (
          <Button
            onClick={() => router.push("/marketing/campaigns/new")}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        ) : null
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >

      {/* Filtros */}
      <motion.div variants={itemVariants}>
        <FilterBar
          filters={filterConfigs}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
          savedFilters={{
            moduleKey: "campaigns",
            current: currentFiltersAsRecord,
            list: saved.list,
            onApply: onApplySavedCampaignsFilter,
            onListChange: saved.reload,
          }}
        />
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
            <EmptyState.Title>
              {hasActiveFilters
                ? "Nenhuma campanha encontrada"
                : "Nenhuma campanha cadastrada"}
            </EmptyState.Title>
            <EmptyState.Description>
              {hasActiveFilters
                ? "Nenhum resultado para os filtros aplicados. Tente ajustar ou limpar os filtros."
                : "Crie campanhas para engajar sua base de contatos."}
            </EmptyState.Description>
            {hasActiveFilters ? (
              <EmptyState.Action>
                <Button
                  onClick={clearFilters}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Limpar filtros
                </Button>
              </EmptyState.Action>
            ) : (
              canManage && (
                <EmptyState.Action>
                  <Button
                    onClick={() => router.push("/marketing/campaigns/new")}
                    className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                  >
                    Nova campanha
                  </Button>
                </EmptyState.Action>
              )
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
    </CrmListShell>
  );
}

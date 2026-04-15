"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexusai360/design-system";
import { Button } from "@nexusai360/design-system";
import { Input } from "@nexusai360/design-system";
import { PageHeader } from "@nexusai360/design-system";
import { EmptyState } from "@nexusai360/design-system";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@nexusai360/design-system";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nexusai360/design-system";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import {
  getOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  deleteOpportunitiesBulk,
} from "@/lib/actions/opportunities";
import type {
  OpportunityItem,
  OpportunitiesFilters,
} from "@/lib/actions/opportunities";
import { getContacts } from "@/lib/actions/contacts";
import type { ContactItem } from "@/lib/actions/contacts";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterBar, type FilterConfig } from "@/components/tables/filter-bar";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  prospecting: { label: "Prospecção", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  qualification: { label: "Qualificação", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  proposal: { label: "Proposta", className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  negotiation: { label: "Negociação", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  closed_won: { label: "Fechado (Ganho)", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  closed_lost: { label: "Fechado (Perdido)", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const STAGE_OPTIONS = [
  { value: "prospecting", label: "Prospecção" },
  { value: "qualification", label: "Qualificação" },
  { value: "proposal", label: "Proposta" },
  { value: "negotiation", label: "Negociação" },
  { value: "closed_won", label: "Fechado (Ganho)" },
  { value: "closed_lost", label: "Fechado (Perdido)" },
];

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
        />
      ))}
    </div>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface OpportunitiesContentProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialFilters?: Record<string, string | undefined>;
}

export function OpportunitiesContent({
  canCreate,
  canEdit,
  canDelete,
  initialFilters = {},
}: OpportunitiesContentProps) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OpportunitiesFilters>({
    stage: initialFilters.stage,
    minValue: initialFilters.minValue,
    maxValue: initialFilters.maxValue,
    from: initialFilters.from,
    to: initialFilters.to,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContactId, setCreateContactId] = useState("");
  const [createValue, setCreateValue] = useState("");
  const [createStage, setCreateStage] = useState("prospecting");
  const [createProbability, setCreateProbability] = useState("");
  const [saving, startSaving] = useTransition();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunityItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContactId, setEditContactId] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editStage, setEditStage] = useState("prospecting");
  const [editProbability, setEditProbability] = useState("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [oppToDelete, setOppToDelete] = useState<OpportunityItem | null>(null);
  const [deleting, startDeleting] = useTransition();

  async function loadOpportunities(f: OpportunitiesFilters = filters) {
    const result = await getOpportunities(f);
    if (result.success && result.data) {
      setOpportunities(result.data);
    } else {
      toast.error(result.error || "Erro ao carregar oportunidades");
    }
    setLoading(false);
  }

  async function loadContacts() {
    const result = await getContacts();
    if (result.success && result.data) {
      setContacts(result.data);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadOpportunities(filters);
  }, [
    filters.stage,
    filters.minValue,
    filters.maxValue,
    filters.from,
    filters.to,
  ]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== undefined && v !== ""),
    [filters]
  );

  function updateFilter(key: string, value: string) {
    const next: OpportunitiesFilters = {
      ...filters,
      [key]: value === "" || value === "all" ? undefined : value,
    };
    setFilters(next);
    setSelectedIds(new Set());
    const qs = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    const s = qs.toString();
    router.replace(`/opportunities${s ? "?" + s : ""}`);
  }

  function clearFilters() {
    setFilters({});
    setSelectedIds(new Set());
    router.replace("/opportunities");
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: "select",
      key: "stage",
      label: "Stage",
      value: filters.stage ?? "all",
      options: [{ value: "all", label: "Todos" }, ...STAGE_OPTIONS],
    },
    {
      type: "input",
      key: "minValue",
      label: "Valor mínimo",
      value: filters.minValue ?? "",
      placeholder: "0",
      inputType: "number",
    },
    {
      type: "input",
      key: "maxValue",
      label: "Valor máximo",
      value: filters.maxValue ?? "",
      placeholder: "0",
      inputType: "number",
    },
    { type: "date", key: "from", label: "De", value: filters.from ?? "" },
    { type: "date", key: "to", label: "Até", value: filters.to ?? "" },
  ];

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === opportunities.length && opportunities.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(opportunities.map((o) => o.id)));
    }
  }

  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDeleting(async () => {
      const result = await deleteOpportunitiesBulk(ids);
      if (result.success && result.data) {
        toast.success(
          `${result.data.deletedCount} excluída${result.data.deletedCount === 1 ? "" : "s"}`
        );
        setOpportunities((prev) =>
          prev.filter((o) => !selectedIds.has(o.id))
        );
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  function openCreate() {
    setCreateTitle("");
    setCreateContactId("");
    setCreateValue("");
    setCreateStage("prospecting");
    setCreateProbability("");
    setCreateOpen(true);
  }

  function openEdit(opp: OpportunityItem) {
    setEditingOpp(opp);
    setEditTitle(opp.title);
    setEditContactId(opp.contactId || "");
    setEditValue(opp.value !== null ? String(opp.value) : "");
    setEditStage(opp.stage);
    setEditProbability(opp.probability !== null ? String(opp.probability) : "");
    setEditOpen(true);
  }

  function openDeleteDialog(opp: OpportunityItem) {
    setOppToDelete(opp);
    setDeleteDialogOpen(true);
  }

  function handleSubmitCreate() {
    if (!createTitle.trim()) {
      toast.error("T\u00edtulo da oportunidade \u00e9 obrigat\u00f3rio");
      return;
    }

    startSaving(async () => {
      const result = await createOpportunity({
        title: createTitle.trim(),
        contactId: createContactId || undefined,
        value: createValue ? Number(createValue) : undefined,
        stage: createStage,
        probability: createProbability ? Number(createProbability) : undefined,
      });

      if (result.success) {
        toast.success("Oportunidade criada com sucesso");
        setCreateOpen(false);
        await loadOpportunities();
      } else {
        toast.error(result.error || "Erro ao criar oportunidade");
      }
    });
  }

  function handleSubmitEdit() {
    if (!editingOpp) return;
    if (!editTitle.trim()) {
      toast.error("T\u00edtulo \u00e9 obrigat\u00f3rio");
      return;
    }

    startSaving(async () => {
      const result = await updateOpportunity(editingOpp.id, {
        title: editTitle.trim(),
        contactId: editContactId || undefined,
        value: editValue ? Number(editValue) : undefined,
        stage: editStage,
        probability: editProbability ? Number(editProbability) : undefined,
      });

      if (result.success) {
        toast.success("Oportunidade atualizada com sucesso");
        setEditOpen(false);
        setEditingOpp(null);
        await loadOpportunities();
      } else {
        toast.error(result.error || "Erro ao atualizar oportunidade");
      }
    });
  }

  function handleDelete() {
    if (!oppToDelete) return;

    startDeleting(async () => {
      const result = await deleteOpportunity(oppToDelete.id);

      if (result.success) {
        toast.success(`Oportunidade "${oppToDelete.title}" exclu\u00edda com sucesso`);
        setDeleteDialogOpen(false);
        setOppToDelete(null);
        await loadOpportunities();
      } else {
        toast.error(result.error || "Erro ao excluir oportunidade");
      }
    });
  }

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
            <PageHeader.Icon icon={TrendingUp} color="amber" />
            <PageHeader.Heading>
              <PageHeader.Title>Oportunidades</PageHeader.Title>
              <PageHeader.Description>
                {loading
                  ? "Carregando..."
                  : `${opportunities.length} oportunidade${opportunities.length !== 1 ? "s" : ""} cadastrada${opportunities.length !== 1 ? "s" : ""}`}
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          <PageHeader.Actions>
            <Link href="/opportunities/pipeline">
              <Button variant="outline" className="cursor-pointer">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Pipeline
              </Button>
            </Link>
            {canCreate && (
              <Button
                onClick={openCreate}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nova Oportunidade
              </Button>
            )}
          </PageHeader.Actions>
        </PageHeader.Root>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemVariants}>
        <FilterBar
          filters={filterConfigs}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
        />
      </motion.div>

      {/* Bulk Action Bar */}
      {canDelete && (
        <BulkActionBar
          count={selectedIds.size}
          onCancel={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          entityLabel="oportunidade"
          entityPlural="oportunidades"
        />
      )}

      {/* Table */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState.Root>
            <EmptyState.Icon icon={TrendingUp} color="amber" />
            <EmptyState.Title>Nenhuma oportunidade aberta</EmptyState.Title>
            <EmptyState.Description>
              Crie oportunidades para acompanhar negócios em andamento.
            </EmptyState.Description>
            {canCreate && (
              <EmptyState.Action>
                <Button
                  onClick={openCreate}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Nova oportunidade
                </Button>
              </EmptyState.Action>
            )}
          </EmptyState.Root>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {canDelete && (
                  <TableHead className="text-muted-foreground w-10">
                    <Checkbox
                      checked={
                        opportunities.length > 0 &&
                        selectedIds.size === opportunities.length
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        selectedIds.size < opportunities.length
                      }
                      onCheckedChange={() => toggleAll()}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground">T\u00edtulo</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Valor</TableHead>
                <TableHead className="text-muted-foreground text-center">Stage</TableHead>
                <TableHead className="text-muted-foreground text-center">Probabilidade</TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">Criado em</TableHead>
                {(canEdit || canDelete) && (
                  <TableHead className="text-muted-foreground text-center">A\u00e7\u00f5es</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp, index) => {
                const stageConfig = STAGE_CONFIG[opp.stage] || STAGE_CONFIG.prospecting;
                return (
                  <motion.tr
                    key={opp.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.03,
                      ease: "easeOut" as const,
                    }}
                    className="border-border hover:bg-accent/30 transition-colors duration-200"
                  >
                    {canDelete && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(opp.id)}
                          onCheckedChange={() => toggleRow(opp.id)}
                          aria-label={`Selecionar ${opp.title}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-foreground">
                      {opp.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {opp.contact
                        ? `${opp.contact.firstName} ${opp.contact.lastName}`
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(opp.value)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageConfig.className}`}
                      >
                        {stageConfig.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {opp.probability !== null ? `${opp.probability}%` : "\u2014"}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm hidden sm:table-cell">
                      {format(new Date(opp.createdAt), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(opp)}
                              title="Editar oportunidade"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(opp)}
                              title="Excluir oportunidade"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Nova Oportunidade</DialogTitle>
            <DialogDescription>
              Adicione uma nova oportunidade ao pipeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                T\u00edtulo *
              </label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="T\u00edtulo da oportunidade"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitCreate();
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Contato
              </label>
              <select
                value={createContactId}
                onChange={(e) => setCreateContactId(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecione um contato</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Valor (R$)
              </label>
              <Input
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Stage
              </label>
              <select
                value={createStage}
                onChange={(e) => setCreateStage(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Probabilidade (%)
              </label>
              <Input
                value={createProbability}
                onChange={(e) => setCreateProbability(e.target.value)}
                placeholder="0"
                type="number"
                min="0"
                max="100"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitCreate}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Oportunidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingOpp(null);
        }}
      >
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Editar Oportunidade</DialogTitle>
            <DialogDescription>
              Atualize os dados da oportunidade
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                T\u00edtulo *
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="T\u00edtulo da oportunidade"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Contato
              </label>
              <select
                value={editContactId}
                onChange={(e) => setEditContactId(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecione um contato</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Valor (R$)
              </label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Stage
              </label>
              <select
                value={editStage}
                onChange={(e) => setEditStage(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Probabilidade (%)
              </label>
              <Input
                value={editProbability}
                onChange={(e) => setEditProbability(e.target.value)}
                placeholder="0"
                type="number"
                min="0"
                max="100"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitEdit}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Altera\u00e7\u00f5es
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir oportunidades selecionadas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              oportunidade{selectedIds.size === 1 ? "" : "s"}? Esta ação é
              irreversível.
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir oportunidade
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir a oportunidade{" "}
              <strong className="text-foreground">
                &quot;{oppToDelete?.title}&quot;
              </strong>
              ? Esta a\u00e7\u00e3o \u00e9 irrevers\u00edvel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

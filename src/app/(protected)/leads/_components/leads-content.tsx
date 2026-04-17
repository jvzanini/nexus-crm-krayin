"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
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
import { CrmListShell } from "@nexusai360/patterns";
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
  Target,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  deleteLeadsBulk,
  updateLeadsStatusBulk,
  assignLeadsBulk,
  getCompanyAssignees,
} from "@/lib/actions/leads";
import type { LeadItem, LeadsFilters } from "@/lib/actions/leads";
import { ConsentFieldset, type ConsentValue } from "@/components/consent/consent-fieldset";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterBar, type FilterConfig } from "@/components/tables/filter-bar";
import { useSavedFilters } from "@/lib/hooks/use-saved-filters";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { CustomFieldsSection } from "@/components/custom-attributes/CustomFieldsSection";
import { CustomColumnsRenderer } from "@/components/custom-attributes/CustomColumnsRenderer";
import type { CustomAttribute } from "@/lib/custom-attributes/types";
import { parseCustomFiltersFromSearchParams } from "@/lib/filters/custom-parser";
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: "Novo", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  contacted: { label: "Contactado", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  qualified: { label: "Qualificado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  unqualified: { label: "Não qualificado", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  converted: { label: "Convertido", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

const STATUS_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "unqualified", label: "Não qualificado" },
  { value: "converted", label: "Convertido" },
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

interface LeadsContentProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialFilters?: Record<string, string | undefined>;
  /** Definitions de custom attributes ativos para entity=lead. */
  customDefs?: CustomAttribute[];
}

export function LeadsContent({
  canCreate,
  canEdit,
  canDelete,
  initialFilters = {},
  customDefs = [],
}: LeadsContentProps) {
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const router = useRouter();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadsFilters>(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(initialFilters)) {
      if (typeof v === "string") sp.set(k, v);
    }
    const custom = parseCustomFiltersFromSearchParams(sp);
    return {
      status: initialFilters.status,
      source: initialFilters.source,
      from: initialFilters.from,
      to: initialFilters.to,
      q: initialFilters.q,
      custom: custom.length > 0 ? custom : undefined,
    };
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saved = useSavedFilters("leads");
  const currentFiltersAsRecord = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (filters.status) out.status = filters.status;
    if (filters.source) out.source = filters.source;
    if (filters.from) out.from = filters.from;
    if (filters.to) out.to = filters.to;
    if (filters.q) out.q = filters.q;
    return out;
  }, [filters]);
  function onApplySavedLeadsFilter(f: Record<string, string>) {
    const VALID = new Set(["status", "source", "from", "to", "q"]);
    const next: LeadsFilters = {};
    for (const [k, v] of Object.entries(f)) {
      if (!VALID.has(k) || typeof v !== "string" || v.length === 0) continue;
      (next as Record<string, string>)[k] = v;
    }
    setFilters(next);
    setSelectedIds(new Set());
  }
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

  // Bulk edit status
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("new");
  const [bulkUpdating, startBulkUpdating] = useTransition();

  // Bulk assign
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkAssigneeValue, setBulkAssigneeValue] = useState<string>("");
  const [bulkAssigning, startBulkAssigning] = useTransition();
  const [assignees, setAssignees] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    if (bulkAssignDialogOpen && assignees.length === 0) {
      getCompanyAssignees().then((r) => {
        if (r.success && r.data) setAssignees(r.data);
      });
    }
  }, [bulkAssignDialogOpen, assignees.length]);

  function confirmBulkAssign() {
    const ids = Array.from(selectedIds);
    const assigneeId = bulkAssigneeValue === "" ? null : bulkAssigneeValue;
    startBulkAssigning(async () => {
      const result = await assignLeadsBulk(ids, assigneeId);
      if (result.success && result.data) {
        toast.success(
          `${result.data.updatedCount} lead${result.data.updatedCount === 1 ? "" : "s"} ${assigneeId ? "atribuído" : "desatribuído"}${result.data.updatedCount === 1 ? "" : "s"}`,
        );
        await loadLeads();
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao atribuir leads");
      }
      setBulkAssignDialogOpen(false);
    });
  }

  function confirmBulkStatus() {
    const ids = Array.from(selectedIds);
    startBulkUpdating(async () => {
      const result = await updateLeadsStatusBulk(ids, bulkStatusValue);
      if (result.success && result.data) {
        toast.success(
          `${result.data.updatedCount} lead${result.data.updatedCount === 1 ? "" : "s"} atualizado${result.data.updatedCount === 1 ? "" : "s"}`,
        );
        await loadLeads();
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao atualizar status");
      }
      setBulkStatusDialogOpen(false);
    });
  }

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createCompany, setCreateCompany] = useState("");
  const [createSource, setCreateSource] = useState("");
  const [createConsent, setCreateConsent] = useState<ConsentValue>({
    marketing: false,
    tracking: false,
  });
  const [saving, startSaving] = useTransition();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editStatus, setEditStatus] = useState("new");
  const [editConsent, setEditConsent] = useState<ConsentValue>({
    marketing: false,
    tracking: false,
  });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadItem | null>(null);
  const [deleting, startDeleting] = useTransition();

  async function loadLeads(f: LeadsFilters = filters) {
    const result = await getLeads(f);
    if (result.success && result.data) {
      setLeads(result.data);
    } else {
      toast.error(result.error || "Erro ao carregar leads");
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadLeads(filters);
  }, [filters.status, filters.source, filters.from, filters.to, filters.q]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== undefined && v !== ""),
    [filters]
  );

  function updateFilter(key: string, value: string) {
    const next: LeadsFilters = {
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
    router.replace(`/leads${s ? "?" + s : ""}`);
  }

  function clearFilters() {
    setFilters({});
    setSelectedIds(new Set());
    router.replace("/leads");
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: "select",
      key: "status",
      label: "Status",
      value: filters.status ?? "all",
      options: [
        { value: "all", label: "Todos" },
        ...STATUS_OPTIONS,
      ],
    },
    {
      type: "input",
      key: "q",
      label: "Buscar",
      value: filters.q ?? "",
      placeholder: "Nome ou email",
    },
    {
      type: "input",
      key: "source",
      label: "Fonte",
      value: filters.source ?? "",
      placeholder: "Ex: Site",
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

  function toggleAll() {
    if (selectedIds.size === leads.length && leads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }

  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDeleting(async () => {
      const result = await deleteLeadsBulk(ids);
      if (result.success && result.data) {
        toast.success(`${result.data.deletedCount} excluído${result.data.deletedCount === 1 ? "" : "s"}`);
        setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  function openCreate() {
    setCreateName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateCompany("");
    setCreateSource("");
    setCreateConsent({ marketing: false, tracking: false });
    setCreateOpen(true);
  }

  function openEdit(lead: LeadItem) {
    setEditingLead(lead);
    setEditName(lead.name);
    setEditEmail(lead.email || "");
    setEditPhone(lead.phone || "");
    setEditCompany(lead.company || "");
    setEditSource(lead.source || "");
    setEditStatus(lead.status);
    setEditConsent({
      marketing: Boolean(lead.consentMarketing),
      tracking: Boolean(lead.consentTracking),
    });
    setEditOpen(true);
  }

  function openDeleteDialog(lead: LeadItem) {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  }

  function handleSubmitCreate() {
    if (!createName.trim()) {
      toast.error("Nome do lead é obrigatório");
      return;
    }

    startSaving(async () => {
      const result = await createLead({
        name: createName.trim(),
        email: createEmail.trim() || undefined,
        phone: createPhone.trim() || undefined,
        company: createCompany.trim() || undefined,
        source: createSource.trim() || undefined,
        consent: createConsent,
        custom: customDefs.length > 0 ? customValues : undefined,
      });

      if (result.success) {
        toast.success("Lead criado com sucesso");
        setCreateOpen(false);
        setCustomValues({});
        await loadLeads();
      } else {
        toast.error(result.error || "Erro ao criar lead");
      }
    });
  }

  function handleSubmitEdit() {
    if (!editingLead) return;
    if (!editName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    startSaving(async () => {
      const result = await updateLead(editingLead.id, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        company: editCompany.trim() || undefined,
        source: editSource.trim() || undefined,
        status: editStatus,
        consent: editConsent,
      });

      if (result.success) {
        toast.success("Lead atualizado com sucesso");
        setEditOpen(false);
        setEditingLead(null);
        await loadLeads();
      } else {
        toast.error(result.error || "Erro ao atualizar lead");
      }
    });
  }

  function handleDelete() {
    if (!leadToDelete) return;

    startDeleting(async () => {
      const result = await deleteLead(leadToDelete.id);

      if (result.success) {
        toast.success(`Lead "${leadToDelete.name}" excluído com sucesso`);
        setDeleteDialogOpen(false);
        setLeadToDelete(null);
        await loadLeads();
      } else {
        toast.error(result.error || "Erro ao excluir lead");
      }
    });
  }

  const leadsCount = loading
    ? "Carregando..."
    : `${leads.length} lead${leads.length !== 1 ? "s" : ""} cadastrado${leads.length !== 1 ? "s" : ""}`;

  return (
    <CrmListShell
      title="Leads"
      description={leadsCount}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Leads" },
      ]}
      actions={
        canCreate ? (
          <Button
            onClick={openCreate}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Novo Lead
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

      {/* Filter Bar */}
      <motion.div variants={itemVariants}>
        <FilterBar
          filters={filterConfigs}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
          savedFilters={{
            moduleKey: "leads",
            current: currentFiltersAsRecord,
            list: saved.list,
            onApply: onApplySavedLeadsFilter,
            onListChange: saved.reload,
          }}
        />
      </motion.div>

      {/* Bulk Action Bar */}
      {canDelete && (
        <BulkActionBar
          count={selectedIds.size}
          onCancel={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          entityLabel="lead"
          entityPlural="leads"
          editActions={
            canEdit
              ? [
                  {
                    key: "change-status",
                    label: "Mudar status",
                    onClick: () => setBulkStatusDialogOpen(true),
                  },
                  {
                    key: "assign",
                    label: "Atribuir a...",
                    onClick: () => setBulkAssignDialogOpen(true),
                  },
                ]
              : undefined
          }
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
        ) : leads.length === 0 ? (
          <EmptyState.Root>
            <EmptyState.Icon icon={Target} color="violet" />
            <EmptyState.Title>Nenhum lead ainda</EmptyState.Title>
            <EmptyState.Description>
              Adicione seu primeiro lead para iniciar o funil de vendas.
            </EmptyState.Description>
            {canCreate && (
              <EmptyState.Action>
                <Button
                  onClick={openCreate}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Novo lead
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
                        leads.length > 0 && selectedIds.size === leads.length
                      }
                      indeterminate={
                        selectedIds.size > 0 && selectedIds.size < leads.length
                      }
                      onCheckedChange={() => toggleAll()}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Telefone</TableHead>
                <TableHead className="text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">Criado em</TableHead>
                {customDefs
                  .filter((d) => d.visibleInList)
                  .map((d) => (
                    <TableHead
                      key={d.id}
                      className="text-muted-foreground"
                      data-custom-key={d.key}
                    >
                      {d.label}
                    </TableHead>
                  ))}
                {(canEdit || canDelete) && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead, index) => {
                const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                return (
                  <motion.tr
                    key={lead.id}
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
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleRow(lead.id)}
                          aria-label={`Selecionar ${lead.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-foreground">
                      {lead.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.phone || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.company || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm hidden sm:table-cell">
                      {format(new Date(lead.createdAt), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <CustomColumnsRenderer
                      defs={customDefs}
                      customValues={
                        (lead.custom as Record<string, unknown>) ?? {}
                      }
                    />
                    {(canEdit || canDelete) && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(lead)}
                              title="Editar lead"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(lead)}
                              title="Excluir lead"
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
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>
              Adicione um novo lead ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome *
              </label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Nome do lead"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitCreate();
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Email
              </label>
              <Input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="email@exemplo.com"
                type="email"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Telefone
              </label>
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Empresa
              </label>
              <Input
                value={createCompany}
                onChange={(e) => setCreateCompany(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Fonte
              </label>
              <Input
                value={createSource}
                onChange={(e) => setCreateSource(e.target.value)}
                placeholder="Ex: Site, Indicação, LinkedIn"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <ConsentFieldset value={createConsent} onChange={setCreateConsent} disabled={saving} />
            {customDefs.length > 0 ? (
              <CustomFieldsSection
                defs={customDefs}
                values={customValues}
                onChange={setCustomValues}
                disabled={saving}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitCreate}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingLead(null);
        }}
      >
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>
              Atualize os dados do lead
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome *
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do lead"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Email
              </label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
                type="email"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Telefone
              </label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Empresa
              </label>
              <Input
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Fonte
              </label>
              <Input
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                placeholder="Ex: Site, Indicação, LinkedIn"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <ConsentFieldset value={editConsent} onChange={setEditConsent} disabled={saving} />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitEdit}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir leads a usuário</DialogTitle>
            <DialogDescription>
              Atribuir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              lead{selectedIds.size === 1 ? "" : "s"} ao usuário escolhido.
              Deixar em branco para desatribuir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground/80">
              Responsável
            </label>
            <select
              value={bulkAssigneeValue}
              onChange={(e) => setBulkAssigneeValue(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Sem responsável —</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              onClick={confirmBulkAssign}
              disabled={bulkAssigning}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {bulkAssigning && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar a {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Change Status Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mudar status em massa</DialogTitle>
            <DialogDescription>
              Aplicar novo status a{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              lead{selectedIds.size === 1 ? "" : "s"} selecionado{selectedIds.size === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground/80">
              Novo status
            </label>
            <select
              value={bulkStatusValue}
              onChange={(e) => setBulkStatusValue(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              onClick={confirmBulkStatus}
              disabled={bulkUpdating}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {bulkUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar a {selectedIds.size}
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
              Excluir leads selecionados
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              lead{selectedIds.size === 1 ? "" : "s"}? Esta ação é irreversível.
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
              Excluir lead
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o lead{" "}
              <strong className="text-foreground">
                &quot;{leadToDelete?.name}&quot;
              </strong>
              ? Esta ação é irreversível.
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
    </CrmListShell>
  );
}

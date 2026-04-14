"use client";

import { useState, useEffect, useTransition } from "react";
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
} from "@/lib/actions/leads";
import type { LeadItem } from "@/lib/actions/leads";
import { ConsentFieldset, type ConsentValue } from "@/components/consent/consent-fieldset";
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
}

export function LeadsContent({ canCreate, canEdit, canDelete }: LeadsContentProps) {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

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

  async function loadLeads() {
    const result = await getLeads();
    if (result.success && result.data) {
      setLeads(result.data);
    } else {
      toast.error(result.error || "Erro ao carregar leads");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

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
      });

      if (result.success) {
        toast.success("Lead criado com sucesso");
        setCreateOpen(false);
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
            <PageHeader.Icon icon={Target} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>Leads</PageHeader.Title>
              <PageHeader.Description>
                {loading
                  ? "Carregando..."
                  : `${leads.length} lead${leads.length !== 1 ? "s" : ""} cadastrado${leads.length !== 1 ? "s" : ""}`}
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          <PageHeader.Actions>
            {canCreate && (
              <Button
                onClick={openCreate}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            )}
          </PageHeader.Actions>
        </PageHeader.Root>
      </motion.div>

      {/* Status Filters */}
      <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "Todos" }, ...STATUS_OPTIONS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              filter === s.value
                ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                : "border-border text-muted-foreground hover:border-muted-foreground/30"
            }`}
          >
            {s.label}
          </button>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Target className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Telefone</TableHead>
                <TableHead className="text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">Criado em</TableHead>
                {(canEdit || canDelete) && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead, index) => {
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
  );
}

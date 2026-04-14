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
} from "lucide-react";
import { toast } from "sonner";
import {
  getOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "@/lib/actions/opportunities";
import type { OpportunityItem } from "@/lib/actions/opportunities";
import { getContacts } from "@/lib/actions/contacts";
import type { ContactItem } from "@/lib/actions/contacts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
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

export function OpportunitiesContent() {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

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

  async function loadOpportunities() {
    const result = await getOpportunities();
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
    loadOpportunities();
    loadContacts();
  }, []);

  const filtered =
    filter === "all" ? opportunities : opportunities.filter((o) => o.stage === filter);

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
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
            <TrendingUp className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Oportunidades</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Carregando..."
                : `${opportunities.length} oportunidade${opportunities.length !== 1 ? "s" : ""} cadastrada${opportunities.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </motion.div>

      {/* Stage Filters */}
      <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "Todos" }, ...STAGE_OPTIONS].map((s) => (
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
            <TrendingUp className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Nenhuma oportunidade encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">T\u00edtulo</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Valor</TableHead>
                <TableHead className="text-muted-foreground text-center">Stage</TableHead>
                <TableHead className="text-muted-foreground text-center">Probabilidade</TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">Criado em</TableHead>
                <TableHead className="text-muted-foreground text-center">A\u00e7\u00f5es</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((opp, index) => {
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
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(opp)}
                          title="Editar oportunidade"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(opp)}
                          title="Excluir oportunidade"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
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

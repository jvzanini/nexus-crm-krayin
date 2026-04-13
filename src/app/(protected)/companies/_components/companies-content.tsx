"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "@/lib/actions/company";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CurrentUser } from "@/lib/auth";

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

interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  logoUrl: string | null;
  createdAt: Date;
  _count: { memberships: number };
}

// --- BadgeSelect component ---

function BadgeSelect({
  value,
  onChange,
  options,
  getBadgeStyle,
  useFixed = false,
  minWidth = 150,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; bg: string; icon: React.ComponentType<{ className?: string }> }[];
  getBadgeStyle: (value: string) => { bg: string; icon: React.ComponentType<{ className?: string }> };
  useFixed?: boolean;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const current = getBadgeStyle(value);
  const CurrentIcon = current.icon;
  const currentOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle() {
    if (!open && useFixed && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({
        position: 'fixed' as const,
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, minWidth),
        zIndex: 200,
      });
    }
    setOpen(!open);
  }

  const dropdownClasses = useFixed
    ? "rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
    : `absolute left-0 top-full mt-1 z-[200] rounded-lg border border-border bg-popover shadow-xl overflow-hidden`;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${current.bg}`}
      >
        <CurrentIcon className="h-3 w-3" />
        {currentOption?.label ?? value}
        <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={useFixed ? dropdownPos : { minWidth }}
            className={dropdownClasses}
          >
            {options.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all hover:bg-accent ${value === option.value ? "bg-accent/50" : ""}`}
                >
                  <OptionIcon className={`h-4 w-4 shrink-0 ${option.bg.includes("emerald") ? "text-emerald-600 dark:text-emerald-400" : option.bg.includes("red") ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                  </div>
                  {value === option.value && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Skeleton ---

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

// --- Main component ---

interface CompaniesContentProps {
  currentUser: CurrentUser;
}

export function CompaniesContent({ currentUser }: CompaniesContentProps) {
  const isAdmin = currentUser.isSuperAdmin || currentUser.platformRole === "admin";

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyItem | null>(null);

  async function loadCompanies() {
    const result = await getCompanies();
    if (result.success && result.companies) {
      setCompanies(result.companies as CompanyItem[]);
    } else {
      toast.error(result.error || "Erro ao carregar empresas");
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadCompanies();
  }, []);

  function openCreate() {
    setName("");
    setCreateOpen(true);
  }

  function openEdit(company: CompanyItem) {
    setEditingCompany(company);
    setEditName(company.name);
    setEditIsActive(company.isActive);
    setEditOpen(true);
  }

  function openDeleteDialog(company: CompanyItem) {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  }

  function handleSubmitCreate() {
    if (!name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    startSaving(async () => {
      const result = await createCompany({ name: name.trim() });

      if (result.success) {
        toast.success("Empresa criada com sucesso");
        setCreateOpen(false);
        setName("");
        await loadCompanies();
      } else {
        toast.error(result.error || "Erro ao criar empresa");
      }
    });
  }

  function handleSubmitEdit() {
    if (!editingCompany) return;
    if (!editName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    startSaving(async () => {
      const result = await updateCompany(editingCompany.id, {
        name: editName.trim(),
        isActive: editIsActive,
      });

      if (result.success) {
        toast.success("Empresa atualizada com sucesso");
        setEditOpen(false);
        setEditingCompany(null);
        await loadCompanies();
      } else {
        toast.error(result.error || "Erro ao atualizar empresa");
      }
    });
  }

  function handleDelete() {
    if (!companyToDelete) return;

    startDeleting(async () => {
      const result = await deleteCompany(companyToDelete.id);

      if (result.success) {
        toast.success(`Empresa "${companyToDelete.name}" excluída com sucesso`);
        setDeleteDialogOpen(false);
        setCompanyToDelete(null);
        await loadCompanies();
      } else {
        toast.error(result.error || "Erro ao excluir empresa");
      }
    });
  }

  async function handleInlineStatusChange(companyId: string, isActive: boolean) {
    startSaving(async () => {
      const result = await updateCompany(companyId, { isActive });
      if (result.success) {
        toast.success(isActive ? "Empresa ativada" : "Empresa inativada");
        await loadCompanies();
      } else {
        toast.error(result.error || "Erro ao atualizar status");
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
            <Building2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Carregando..."
                : `${companies.length} empresa${companies.length !== 1 ? "s" : ""} cadastrada${companies.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={openCreate}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        )}
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
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Nenhuma empresa encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Slug</TableHead>
                <TableHead className="text-muted-foreground text-center">
                  Membros
                </TableHead>
                <TableHead className="text-muted-foreground text-center">
                  Status
                </TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">
                  Criado em
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-muted-foreground text-center">
                    Ações
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company, index) => (
                <motion.tr
                  key={company.id}
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
                    {company.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {company.slug}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {company._count.memberships}
                  </TableCell>
                  <TableCell className="text-center">
                    {isAdmin ? (
                      <BadgeSelect
                        useFixed
                        minWidth={150}
                        value={company.isActive ? "active" : "inactive"}
                        onChange={(val) => handleInlineStatusChange(company.id, val === "active")}
                        options={[
                          { value: "active", label: "Ativa", bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", icon: UserCheck },
                          { value: "inactive", label: "Inativa", bg: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400", icon: UserX },
                        ]}
                        getBadgeStyle={(val) => val === "active"
                          ? { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", icon: UserCheck }
                          : { bg: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400", icon: UserX }
                        }
                      />
                    ) : (
                      company.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          <UserCheck className="h-3 w-3" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
                          <UserX className="h-3 w-3" /> Inativa
                        </span>
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm hidden sm:table-cell">
                    {format(new Date(company.createdAt), "dd MMM yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(company)}
                          title="Editar empresa"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(company)}
                          title="Excluir empresa"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Crie uma nova empresa na plataforma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitCreate();
                }}
              />
              {name.trim() && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Slug: <span className="font-mono">{name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitCreate}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingCompany(null);
        }}
      >
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Atualize os dados da empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {editIsActive ? (
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                ) : (
                  <UserX className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm text-foreground/80">
                  {editIsActive ? "Ativa" : "Inativa"}
                </span>
              </div>
              <Switch
                checked={editIsActive}
                onCheckedChange={(checked) => setEditIsActive(!!checked)}
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
              Excluir empresa
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir a empresa{" "}
              <strong className="text-foreground">
                &quot;{companyToDelete?.name}&quot;
              </strong>
              ? Esta ação é irreversível. Todas as associações de membros
              serão removidas.
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

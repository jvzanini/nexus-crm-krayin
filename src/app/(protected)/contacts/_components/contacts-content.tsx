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
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/actions/contacts";
import type { ContactItem } from "@/lib/actions/contacts";
import { ConsentFieldset, type ConsentValue } from "@/components/consent/consent-fieldset";
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

export function ContactsContent() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createOrganization, setCreateOrganization] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createConsent, setCreateConsent] = useState<ConsentValue>({
    marketing: false,
    tracking: false,
  });
  const [saving, startSaving] = useTransition();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrganization, setEditOrganization] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editConsent, setEditConsent] = useState<ConsentValue>({
    marketing: false,
    tracking: false,
  });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactItem | null>(null);
  const [deleting, startDeleting] = useTransition();

  async function loadContacts() {
    const result = await getContacts();
    if (result.success && result.data) {
      setContacts(result.data);
    } else {
      toast.error(result.error || "Erro ao carregar contatos");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadContacts();
  }, []);

  function openCreate() {
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateOrganization("");
    setCreateTitle("");
    setCreateConsent({ marketing: false, tracking: false });
    setCreateOpen(true);
  }

  function openEdit(contact: ContactItem) {
    setEditingContact(contact);
    setEditFirstName(contact.firstName);
    setEditLastName(contact.lastName);
    setEditEmail(contact.email || "");
    setEditPhone(contact.phone || "");
    setEditOrganization(contact.organization || "");
    setEditTitle(contact.title || "");
    setEditConsent({
      marketing: Boolean(contact.consentMarketing),
      tracking: Boolean(contact.consentTracking),
    });
    setEditOpen(true);
  }

  function openDeleteDialog(contact: ContactItem) {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  }

  function handleSubmitCreate() {
    if (!createFirstName.trim() || !createLastName.trim()) {
      toast.error("Nome e sobrenome são obrigatórios");
      return;
    }

    startSaving(async () => {
      const result = await createContact({
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        email: createEmail.trim() || undefined,
        phone: createPhone.trim() || undefined,
        organization: createOrganization.trim() || undefined,
        title: createTitle.trim() || undefined,
        consent: createConsent,
      });

      if (result.success) {
        toast.success("Contato criado com sucesso");
        setCreateOpen(false);
        await loadContacts();
      } else {
        toast.error(result.error || "Erro ao criar contato");
      }
    });
  }

  function handleSubmitEdit() {
    if (!editingContact) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      toast.error("Nome e sobrenome são obrigatórios");
      return;
    }

    startSaving(async () => {
      const result = await updateContact(editingContact.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        organization: editOrganization.trim() || undefined,
        title: editTitle.trim() || undefined,
        consent: editConsent,
      });

      if (result.success) {
        toast.success("Contato atualizado com sucesso");
        setEditOpen(false);
        setEditingContact(null);
        await loadContacts();
      } else {
        toast.error(result.error || "Erro ao atualizar contato");
      }
    });
  }

  function handleDelete() {
    if (!contactToDelete) return;

    startDeleting(async () => {
      const result = await deleteContact(contactToDelete.id);

      if (result.success) {
        toast.success(`Contato "${contactToDelete.firstName} ${contactToDelete.lastName}" excluído com sucesso`);
        setDeleteDialogOpen(false);
        setContactToDelete(null);
        await loadContacts();
      } else {
        toast.error(result.error || "Erro ao excluir contato");
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 border border-emerald-600/20">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Carregando..."
                : `${contacts.length} contato${contacts.length !== 1 ? "s" : ""} cadastrado${contacts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Novo Contato
        </Button>
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
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Telefone</TableHead>
                <TableHead className="text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-muted-foreground">Cargo</TableHead>
                <TableHead className="text-muted-foreground text-center hidden sm:table-cell">Criado em</TableHead>
                <TableHead className="text-muted-foreground text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact, index) => (
                <motion.tr
                  key={contact.id}
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
                    {contact.firstName} {contact.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.organization || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.title || "-"}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm hidden sm:table-cell">
                    {format(new Date(contact.createdAt), "dd MMM yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(contact)}
                        title="Editar contato"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(contact)}
                        title="Excluir contato"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
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
            <DialogTitle>Novo Contato</DialogTitle>
            <DialogDescription>
              Adicione um novo contato ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome *
              </label>
              <Input
                value={createFirstName}
                onChange={(e) => setCreateFirstName(e.target.value)}
                placeholder="Nome"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitCreate();
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Sobrenome *
              </label>
              <Input
                value={createLastName}
                onChange={(e) => setCreateLastName(e.target.value)}
                placeholder="Sobrenome"
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
                value={createOrganization}
                onChange={(e) => setCreateOrganization(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Cargo
              </label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Ex: Gerente, Diretor, Analista"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <ConsentFieldset value={createConsent} onChange={setCreateConsent} disabled={saving} />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitCreate}
              disabled={saving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingContact(null);
        }}
      >
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
            <DialogDescription>
              Atualize os dados do contato
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Nome *
              </label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="Nome"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Sobrenome *
              </label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Sobrenome"
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
                value={editOrganization}
                onChange={(e) => setEditOrganization(e.target.value)}
                placeholder="Nome da empresa"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Cargo
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Gerente, Diretor, Analista"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <ConsentFieldset value={editConsent} onChange={setEditConsent} disabled={saving} />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitEdit}
              disabled={saving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-200"
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
              Excluir contato
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o contato{" "}
              <strong className="text-foreground">
                &quot;{contactToDelete?.firstName} {contactToDelete?.lastName}&quot;
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

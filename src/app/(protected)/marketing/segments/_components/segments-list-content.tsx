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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PageHeader,
  EmptyState,
} from "@nexusai360/design-system";
import { Layers, Users2, Plus, Pencil, Trash2, Loader2, AlertTriangle, Filter } from "lucide-react";
import { toast } from "sonner";
import {
  listSegmentsAction,
  deleteSegmentAction,
  deleteSegmentsBulkAction,
} from "@/lib/actions/marketing-segments";
import type { SegmentItem } from "@/lib/actions/marketing-segments";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";

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
// Props
// ---------------------------------------------------------------------------

interface SegmentsListContentProps {
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SegmentsListContent({ canManage }: SegmentsListContentProps) {
  const router = useRouter();

  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSegment, setDeletingSegment] = useState<SegmentItem | null>(null);
  const [deleting, startDeleting] = useTransition();

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

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
      const result = await deleteSegmentsBulkAction(ids);
      if (result.success && result.data) {
        const { deletedCount, skippedInUse } = result.data;
        toast.success(
          `${deletedCount} segmento${deletedCount === 1 ? "" : "s"} excluído${deletedCount === 1 ? "" : "s"}${skippedInUse > 0 ? ` (${skippedInUse} ignorado${skippedInUse === 1 ? "" : "s"} por uso em campanha)` : ""}`,
        );
        await loadSegments();
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir segmentos");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  async function loadSegments() {
    setLoading(true);
    const result = await listSegmentsAction();
    if (result.success && result.data) {
      setSegments(result.data);
    } else {
      toast.error(result.error ?? "Erro ao carregar segmentos");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSegments();
  }, []);

  function openDeleteDialog(segment: SegmentItem) {
    setDeletingSegment(segment);
    setDeleteDialogOpen(true);
  }

  function handleDelete() {
    if (!deletingSegment) return;
    startDeleting(async () => {
      const result = await deleteSegmentAction(deletingSegment.id);
      if (result.success) {
        toast.success(`Segmento "${deletingSegment.name}" excluído`);
        setDeleteDialogOpen(false);
        setDeletingSegment(null);
        await loadSegments();
      } else {
        toast.error(result.error ?? "Erro ao excluir segmento");
      }
    });
  }

  const count = segments.length;

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
            <PageHeader.Icon icon={Layers} color="blue" />
            <PageHeader.Heading>
              <PageHeader.Title>Segmentos de marketing</PageHeader.Title>
              <PageHeader.Description>
                {loading
                  ? "Carregando..."
                  : count === 0
                    ? "Nenhum segmento cadastrado"
                    : count === 1
                      ? "1 segmento cadastrado"
                      : `${count} segmentos cadastrados`}
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          {canManage && (
            <PageHeader.Actions>
              <Button
                onClick={() => router.push("/marketing/segments/new")}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Novo segmento
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
          entityLabel="segmento"
          entityPlural="segmentos"
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
        ) : segments.length === 0 ? (
          <EmptyState.Root>
            <EmptyState.Icon icon={Layers} color="blue" />
            <EmptyState.Title>Nenhum segmento criado</EmptyState.Title>
            <EmptyState.Description>
              Segmente seus contatos para campanhas mais eficazes.
            </EmptyState.Description>
            {canManage && (
              <EmptyState.Action>
                <Button
                  onClick={() => router.push("/marketing/segments/new")}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Novo segmento
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
                        segments.length > 0 &&
                        segments.every((s) => selectedIds.has(s.id))
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        !segments.every((s) => selectedIds.has(s.id))
                      }
                      onCheckedChange={() =>
                        toggleAll(segments.map((s) => s.id))
                      }
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Filtros</TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">Atualizado em</TableHead>
                {canManage && (
                  <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment, index) => (
                <motion.tr
                  key={segment.id}
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
                        checked={selectedIds.has(segment.id)}
                        onCheckedChange={() => toggleRow(segment.id)}
                        aria-label={`Selecionar ${segment.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium text-foreground">
                    {segment.name}
                    {segment.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {segment.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {segment.filters.length} filtro{segment.filters.length !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                    {new Date(segment.updatedAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/marketing/segments/${segment.id}`)}
                          title="Editar segmento"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(segment)}
                          title="Excluir segmento"
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

      {/* AlertDialog — Bulk delete */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir segmentos selecionados
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              segmento{selectedIds.size === 1 ? "" : "s"}? Segmentos em uso por campanhas ativas serão ignorados. Esta ação é irreversível.
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

      {/* AlertDialog — Excluir segmento */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir segmento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Excluir segmento{" "}
              <strong className="text-foreground">
                &quot;{deletingSegment?.name}&quot;
              </strong>
              ? Não é possível excluir se há campanhas ativas usando.
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
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

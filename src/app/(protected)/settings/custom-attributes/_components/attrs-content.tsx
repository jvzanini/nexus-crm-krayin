"use client";

/**
 * Fase 5 T14/34 — Custom Attributes admin UI.
 *
 * Orquestra Tabs por entity (lead/contact/opportunity), lista por position,
 * dispara dialogs de create/edit/delete. Reordenação feita via botões up/down
 * (drag-drop ficou fora do escopo MVP — não há @dnd-kit no projeto e adicioná-lo
 * extrapola o T14; botões up/down atendem `reorderCustomAttributes`).
 *
 * RBAC:
 *  - canManage=false → só leitura (Badges, sem botões Novo/Editar/Excluir/up-down).
 *  - canManage=true  → CRUD + reorder.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Sliders,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabsRoot,
  TabsList,
  TabsTab,
  TabsPanel,
  PageHeader,
  IconTile,
  EmptyState,
  TooltipProvider,
} from "@nexusai360/design-system";
import { CrmListShell } from "@nexusai360/patterns";
import { toast } from "sonner";
import {
  listCustomAttributesAction,
  reorderCustomAttributes,
} from "@/lib/actions/custom-attributes";
import type {
  CustomAttribute,
  CustomAttributeEntity,
} from "@/lib/custom-attributes/types";
import { AttrFormDialog } from "./attr-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

const ENTITIES: { value: CustomAttributeEntity; label: string }[] = [
  { value: "lead" as CustomAttributeEntity, label: "Leads" },
  { value: "contact" as CustomAttributeEntity, label: "Contatos" },
  { value: "opportunity" as CustomAttributeEntity, label: "Oportunidades" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

interface Props {
  canManage: boolean;
}

export function AttrsContent({ canManage }: Props) {
  const [activeEntity, setActiveEntity] = useState<CustomAttributeEntity>(
    "lead" as CustomAttributeEntity,
  );
  const [attrsByEntity, setAttrsByEntity] = useState<
    Record<string, CustomAttribute[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [acting, startActing] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomAttribute | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomAttribute | null>(null);

  const loadEntity = useCallback(async (entity: CustomAttributeEntity) => {
    const res = await listCustomAttributesAction(entity);
    if (res.success && res.data) {
      setAttrsByEntity((prev) => ({ ...prev, [entity]: res.data ?? [] }));
    } else {
      toast.error(res.error ?? "Erro ao carregar atributos");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all(ENTITIES.map((e) => loadEntity(e.value))).finally(() =>
      setLoading(false),
    );
  }, [loadEntity]);

  const currentList = useMemo(
    () => attrsByEntity[activeEntity] ?? [],
    [attrsByEntity, activeEntity],
  );

  function move(entity: CustomAttributeEntity, from: number, to: number) {
    const list = attrsByEntity[entity] ?? [];
    if (to < 0 || to >= list.length) return;
    const reordered = [...list];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    setAttrsByEntity((prev) => ({ ...prev, [entity]: reordered }));
    startActing(async () => {
      const res = await reorderCustomAttributes(
        entity,
        reordered.map((a) => a.id),
      );
      if (!res.success) {
        toast.error(res.error ?? "Erro ao reordenar");
        loadEntity(entity);
      }
    });
  }

  function typeBadge(type: string) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wide text-muted-foreground"
      >
        {type}
      </Badge>
    );
  }

  function renderTable(entity: CustomAttributeEntity) {
    const list = attrsByEntity[entity] ?? [];
    if (loading) {
      return (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-muted/50"
            />
          ))}
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <EmptyState.Root>
          <EmptyState.Icon icon={Sliders} color="violet" />
          <EmptyState.Title>Nenhum atributo personalizado</EmptyState.Title>
          <EmptyState.Description>
            Crie atributos para capturar informações específicas do seu negócio
            em {ENTITIES.find((e) => e.value === entity)?.label}.
          </EmptyState.Description>
          {canManage && (
            <EmptyState.Action>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo atributo
              </Button>
            </EmptyState.Action>
          )}
        </EmptyState.Root>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground w-[48px]">#</TableHead>
            <TableHead className="text-muted-foreground">Label</TableHead>
            <TableHead className="text-muted-foreground">Key</TableHead>
            <TableHead className="text-muted-foreground">Tipo</TableHead>
            <TableHead className="text-muted-foreground text-center">
              Flags
            </TableHead>
            {canManage && (
              <TableHead className="text-muted-foreground text-right">
                Ações
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((attr, idx) => (
            <motion.tr
              key={attr.id}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: idx * 0.04 }}
              className="border-border hover:bg-muted/30 transition-colors"
            >
              <TableCell className="text-muted-foreground font-mono text-xs">
                {idx + 1}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {attr.label}
                {attr.helpText && (
                  <span className="block text-xs text-muted-foreground">
                    {attr.helpText}
                  </span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {attr.key}
              </TableCell>
              <TableCell>{typeBadge(attr.type as string)}</TableCell>
              <TableCell className="text-center">
                <div className="flex flex-wrap justify-center gap-1">
                  {attr.required && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-400 border-amber-500/30"
                    >
                      required
                    </Badge>
                  )}
                  {attr.isUnique && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-violet-400 border-violet-500/30"
                    >
                      unique
                    </Badge>
                  )}
                  {attr.piiMasked && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-rose-400 border-rose-500/30"
                    >
                      pii
                    </Badge>
                  )}
                  {attr.visibleInList && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-emerald-400 border-emerald-500/30"
                    >
                      list
                    </Badge>
                  )}
                </div>
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={acting || idx === 0}
                      onClick={() => move(entity, idx, idx - 1)}
                      aria-label="Mover para cima"
                      className="h-7 w-7 p-0 cursor-pointer hover:bg-violet-600/10 hover:text-violet-400"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={acting || idx === list.length - 1}
                      onClick={() => move(entity, idx, idx + 1)}
                      aria-label="Mover para baixo"
                      className="h-7 w-7 p-0 cursor-pointer hover:bg-violet-600/10 hover:text-violet-400"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditTarget(attr)}
                      className="h-7 px-2 gap-1.5 text-xs cursor-pointer hover:bg-violet-600/10 hover:text-violet-400"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(attr)}
                      className="h-7 px-2 gap-1.5 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
                    </Button>
                  </div>
                </TableCell>
              )}
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <TooltipProvider>
      <CrmListShell
        title="Atributos personalizados"
        description="Configure campos customizados por entidade do CRM."
        icon={<IconTile icon={Sliders} color="violet" />}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Configurações" },
          { label: "Atributos personalizados" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Novo atributo
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

        <motion.div variants={itemVariants}>
          <Card className="border-border bg-card/50 rounded-xl overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Por entidade</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsRoot
                value={activeEntity}
                onValueChange={(v) =>
                  setActiveEntity(v as CustomAttributeEntity)
                }
              >
                <TabsList className="mb-4">
                  {ENTITIES.map((e) => (
                    <TabsTab key={e.value} value={e.value}>
                      {e.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(attrsByEntity[e.value] ?? []).length}
                      </span>
                    </TabsTab>
                  ))}
                </TabsList>
                {ENTITIES.map((e) => (
                  <TabsPanel key={e.value} value={e.value}>
                    {renderTable(e.value)}
                  </TabsPanel>
                ))}
              </TabsRoot>
            </CardContent>
          </Card>
        </motion.div>

        <AttrFormDialog
          mode="create"
          entity={activeEntity}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={async () => {
            setCreateOpen(false);
            await loadEntity(activeEntity);
          }}
        />

        {editTarget && (
          <AttrFormDialog
            mode="edit"
            entity={editTarget.entity as CustomAttributeEntity}
            target={editTarget}
            open={!!editTarget}
            onOpenChange={(v) => !v && setEditTarget(null)}
            onSuccess={async () => {
              const entity = editTarget.entity as CustomAttributeEntity;
              setEditTarget(null);
              await loadEntity(entity);
            }}
          />
        )}

        <DeleteConfirmDialog
          target={deleteTarget}
          onOpenChange={(v) => !v && setDeleteTarget(null)}
          onSuccess={async () => {
            const entity = (deleteTarget?.entity ??
              activeEntity) as CustomAttributeEntity;
            setDeleteTarget(null);
            await loadEntity(entity);
          }}
        />

        {/* Nota: currentList apenas para ref futura/telemetria */}
        <span className="sr-only" aria-hidden="true">
          {currentList.length}
        </span>
        </motion.div>
      </CrmListShell>
    </TooltipProvider>
  );
}

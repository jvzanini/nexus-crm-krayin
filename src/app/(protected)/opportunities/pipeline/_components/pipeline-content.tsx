"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  PageHeader,
  // CrmListShell importado abaixo

  Button,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  IconTile,
} from "@nexusai360/design-system";
import { CrmListShell } from "@nexusai360/patterns";
import {
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { updateOpportunity } from "@/lib/actions/opportunities";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
} from "@/lib/opportunities/stage-config";
import type { OpportunityStage } from "@/generated/prisma/client";

interface OpportunityCard {
  id: string;
  title: string;
  stage: OpportunityStage;
  value: number | null;
  currency: string | null;
  probability: number | null;
  contact: { id: string; name: string } | null;
}

interface PipelineContentProps {
  opportunities: OpportunityCard[];
  canEdit: boolean;
}

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

const STAGE_DOT_COLOR: Record<OpportunityStage, string> = {
  prospecting: "bg-zinc-500",
  qualification: "bg-blue-500",
  proposal: "bg-amber-500",
  negotiation: "bg-violet-500",
  closed_won: "bg-emerald-500",
  closed_lost: "bg-red-500",
};

const STAGE_COLOR_CLASSES: Record<string, string> = {
  zinc: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
};

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null || value === undefined) return "—";
  try {
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    });
  } catch {
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
}

function KanbanCard({
  opp,
  canEdit,
  index,
}: {
  opp: OpportunityCard;
  canEdit: boolean;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: opp.id,
      disabled: !canEdit,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={itemVariants}
      {...listeners}
      {...attributes}
      className={`border border-border bg-card/50 rounded-xl p-3 ${
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } hover:border-violet-500/40 hover:bg-card/70 transition-colors duration-200`}
    >
      <Link
        href={`/opportunities/${opp.id}/activities`}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
        className="block"
      >
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-foreground line-clamp-2">
            {opp.title}
          </div>
          {opp.contact && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {opp.contact.name}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-medium text-foreground/80">
              {formatCurrency(opp.value, opp.currency)}
            </span>
            {opp.probability !== null && (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-400 border-violet-500/30">
                {opp.probability}%
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function KanbanColumn({
  stage,
  items,
  canEdit,
}: {
  stage: OpportunityStage;
  items: OpportunityCard[];
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const colorKey = STAGE_COLORS[stage];
  const colorClass = STAGE_COLOR_CLASSES[colorKey] ?? STAGE_COLOR_CLASSES.zinc;

  const total = items.reduce((acc, it) => acc + (it.value ?? 0), 0);
  const currency = items.find((i) => i.currency)?.currency ?? "BRL";

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] bg-card/30 border border-border rounded-xl p-3 flex flex-col gap-2 transition-colors duration-200 ${
        isOver ? "border-violet-500/50 bg-violet-500/5" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {STAGE_LABELS[stage]}
          </h3>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
          >
            {items.length}
          </span>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          {formatCurrency(total, currency)}
        </span>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-2 min-h-[100px]"
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
            Sem oportunidades
          </div>
        ) : (
          items.map((opp, index) => (
            <KanbanCard
              key={opp.id}
              opp={opp}
              canEdit={canEdit}
              index={index}
            />
          ))
        )}
      </motion.div>
    </div>
  );
}

function MobileCard({
  opp,
  canEdit,
  onMove,
}: {
  opp: OpportunityCard;
  canEdit: boolean;
  onMove: (stage: OpportunityStage) => void;
}) {
  return (
    <div className="border-border border bg-card/50 rounded-xl p-3 flex items-start justify-between gap-2">
      <Link
        href={`/opportunities/${opp.id}/activities`}
        className="flex-1 min-w-0"
      >
        <p className="text-sm font-medium text-foreground truncate">
          {opp.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {opp.contact?.name ?? "sem contato"}
        </p>
        <p className="text-sm font-semibold text-violet-500 mt-1">
          {formatCurrency(opp.value, opp.currency)}
        </p>
      </Link>
      {canEdit && (
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 cursor-pointer"
                aria-label="Mover oportunidade"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent>
            {STAGE_ORDER.filter((s) => s !== opp.stage).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                Mover para {STAGE_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenuRoot>
      )}
    </div>
  );
}

export function PipelineContent({
  opportunities: initial,
  canEdit,
}: PipelineContentProps) {
  const [opportunities, setOpportunities] =
    useState<OpportunityCard[]>(initial);
  const [openStages, setOpenStages] = useState<Set<OpportunityStage>>(
    () => new Set<OpportunityStage>(["prospecting"])
  );

  const toggleStage = (stage: OpportunityStage) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const byStage = useMemo(() => {
    const map: Record<OpportunityStage, OpportunityCard[]> = {
      prospecting: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: [],
    };
    for (const opp of opportunities) {
      if (map[opp.stage]) {
        map[opp.stage].push(opp);
      }
    }
    return map;
  }, [opportunities]);

  async function handleDragEnd(event: DragEndEvent) {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id) as OpportunityStage;

    if (!STAGE_ORDER.includes(overId)) return;

    const current = opportunities.find((o) => o.id === activeId);
    if (!current || current.stage === overId) return;

    const previousStage = current.stage;

    // otimista
    setOpportunities((prev) =>
      prev.map((o) => (o.id === activeId ? { ...o, stage: overId } : o))
    );

    const result = await updateOpportunity(activeId, { stage: overId });

    if (!result.success) {
      // revert
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === activeId ? { ...o, stage: previousStage } : o
        )
      );
      toast.error(result.error || "Erro ao mover oportunidade");
    } else {
      toast.success(
        `Movido para ${STAGE_LABELS[overId]}`
      );
    }
  }

  async function handleMoveMobile(id: string, newStage: OpportunityStage) {
    const current = opportunities.find((o) => o.id === id);
    if (!current || current.stage === newStage) return;
    const previousStage = current.stage;

    // otimista
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, stage: newStage } : o))
    );

    try {
      const result = await updateOpportunity(id, { stage: newStage });
      if (!result.success) throw new Error(result.error || "fail");
      toast.success(`Movido para ${STAGE_LABELS[newStage]}`);
    } catch {
      // revert
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, stage: previousStage } : o
        )
      );
      toast.error("Erro ao mover oportunidade");
    }
  }

  return (
    <CrmListShell
      title="Pipeline"
      description="Visualização kanban das oportunidades por stage"
      icon={<IconTile icon={LayoutGrid} color="violet" />}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Oportunidades", href: "/opportunities" },
        { label: "Pipeline" },
      ]}
      actions={
        <Link href="/opportunities">
          <Button variant="outline" className="cursor-pointer">
            <TableIcon className="h-4 w-4 mr-2" />
            Lista
          </Button>
        </Link>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >

      <motion.div variants={itemVariants} className="hidden md:block">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGE_ORDER.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                items={byStage[stage]}
                canEdit={canEdit}
              />
            ))}
          </div>
        </DndContext>
      </motion.div>

      <motion.div variants={itemVariants} className="md:hidden space-y-2">
        {STAGE_ORDER.map((stage) => {
          const items = byStage[stage] ?? [];
          const isOpen = openStages.has(stage);
          return (
            <div
              key={stage}
              className="border-border border rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleStage(stage)}
                className="w-full flex items-center justify-between p-4 bg-card/50 hover:bg-card/70 transition-colors cursor-pointer min-h-[56px]"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${STAGE_DOT_COLOR[stage]}`}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="p-3 space-y-2 bg-card/20"
                >
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma oportunidade neste stage
                    </p>
                  ) : (
                    items.map((opp) => (
                      <MobileCard
                        key={opp.id}
                        opp={opp}
                        canEdit={canEdit}
                        onMove={(newStage) =>
                          handleMoveMobile(opp.id, newStage)
                        }
                      />
                    ))
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </motion.div>
      </motion.div>
    </CrmListShell>
  );
}

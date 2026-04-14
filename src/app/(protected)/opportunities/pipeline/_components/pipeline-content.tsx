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
import { PageHeader, Button } from "@nexusai360/design-system";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
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

export function PipelineContent({
  opportunities: initial,
  canEdit,
}: PipelineContentProps) {
  const [opportunities, setOpportunities] =
    useState<OpportunityCard[]>(initial);

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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={LayoutGrid} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>Pipeline</PageHeader.Title>
              <PageHeader.Description>
                Visualização kanban das oportunidades por stage
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
          <PageHeader.Actions>
            <Link href="/opportunities">
              <Button
                variant="outline"
                className="cursor-pointer"
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Lista
              </Button>
            </Link>
          </PageHeader.Actions>
        </PageHeader.Root>
      </motion.div>

      <motion.div variants={itemVariants}>
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
    </motion.div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@nexusai360/design-system";
import type { ReportsData } from "@/lib/actions/reports";
import { RevenueForecastCard } from "./revenue-forecast-card";
import { LeadsBySourceCard } from "./leads-by-source-card";
import { OwnerPerformanceCard } from "./owner-performance-card";
import { PipelineEvolutionCard } from "./pipeline-evolution-card";

interface ReportsContentProps {
  initialData: ReportsData | null;
  initialPeriod: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const PERIODS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
];

export function ReportsContent({ initialData, initialPeriod }: ReportsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handlePeriodChange(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", String(days));
    startTransition(() => {
      router.push(`/reports?${params.toString()}`);
    });
  }

  if (!initialData) {
    return (
      <div className="space-y-6">
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={BarChart3} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>Relatórios</PageHeader.Title>
              <PageHeader.Description>Análise avançada de performance</PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
        </PageHeader.Root>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Sem dados para exibir
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Você não tem permissão ou não há oportunidades no período selecionado.
          </p>
        </div>
      </div>
    );
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
            <PageHeader.Icon icon={BarChart3} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>Relatórios</PageHeader.Title>
              <PageHeader.Description>
                Análise avançada de performance
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
        </PageHeader.Root>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-2">Período:</span>
        <div className="flex rounded-xl border border-border overflow-hidden bg-card/80">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              disabled={isPending}
              className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                initialPeriod === p.value
                  ? "bg-violet-600 text-white shadow-[0_0_8px_rgba(124,58,237,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2">
        <RevenueForecastCard data={initialData.revenueForecast} />
        <LeadsBySourceCard data={initialData.leadsBySource} />
        <OwnerPerformanceCard data={initialData.ownerPerformance} />
        <PipelineEvolutionCard data={initialData.pipelineEvolution} />
      </motion.div>
    </motion.div>
  );
}

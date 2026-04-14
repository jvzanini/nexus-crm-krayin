"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, PageHeader } from "@nexusai360/design-system";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCampaignAction,
  updateCampaignAction,
} from "@/lib/actions/marketing-campaigns";
import type { CampaignItem } from "@/lib/actions/marketing-campaigns";
import { listSegmentsAction } from "@/lib/actions/marketing-segments";
import type { SegmentItem } from "@/lib/actions/marketing-segments";

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

interface CampaignEditorContentProps {
  mode: "create" | "edit";
  campaign?: CampaignItem;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CampaignEditorContent({ mode, campaign }: CampaignEditorContentProps) {
  const router = useRouter();

  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(campaign?.bodyHtml ?? "");
  const [mailboxId, setMailboxId] = useState(campaign?.mailboxId ?? "");
  const [segmentId, setSegmentId] = useState(campaign?.segmentId ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduledAt
      ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
      : "",
  );
  const [batchSize, setBatchSize] = useState(String(campaign?.batchSize ?? 100));

  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    listSegmentsAction().then((result) => {
      if (result.success && result.data) {
        setSegments(result.data);
      }
    });
  }, []);

  const inputClass = "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground";
  const selectClass =
    "flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  function handleSaveDraft() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!subject.trim()) {
      toast.error("Assunto do e-mail é obrigatório");
      return;
    }
    if (!bodyHtml.trim()) {
      toast.error("Corpo HTML é obrigatório");
      return;
    }
    if (!segmentId) {
      toast.error("Selecione um segmento");
      return;
    }

    startSaving(async () => {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        mailboxId: mailboxId.trim() || "00000000-0000-0000-0000-000000000000", // MVP placeholder
        segmentId,
        scheduledAt: scheduledAt || undefined,
        batchSize: Number(batchSize) || 100,
      };

      if (mode === "create") {
        const result = await createCampaignAction(payload);
        if (result.success) {
          toast.success("Campanha criada como rascunho");
          router.push("/marketing/campaigns");
        } else {
          toast.error(result.error ?? "Erro ao criar campanha");
        }
      } else {
        const result = await updateCampaignAction(campaign!.id, payload);
        if (result.success) {
          toast.success("Campanha atualizada");
          router.push("/marketing/campaigns");
        } else {
          toast.error(result.error ?? "Erro ao atualizar campanha");
        }
      }
    });
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-3xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <PageHeader.Root>
          <PageHeader.Row>
            <PageHeader.Icon icon={Megaphone} color="violet" />
            <PageHeader.Heading>
              <PageHeader.Title>
                {mode === "create" ? "Nova campanha" : "Editar campanha"}
              </PageHeader.Title>
              <PageHeader.Description>
                Configure e envie e-mails para um segmento de contatos
              </PageHeader.Description>
            </PageHeader.Heading>
          </PageHeader.Row>
        </PageHeader.Root>
      </motion.div>

      {/* Identificação */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Nome interno *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Newsletter Abril 2026"
            className={inputClass}
            disabled={saving}
          />
        </div>
      </motion.div>

      {/* Configuração do e-mail */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-foreground">Conteúdo do e-mail</h2>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Assunto *
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Novidades de abril 🎉"
            className={inputClass}
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Corpo HTML *
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="<p>Olá {{name}},</p><p>...</p>"
            rows={8}
            disabled={saving}
            className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Suporta variáveis: <code className="text-violet-400">{"{{name}}"}</code>, <code className="text-violet-400">{"{{email}}"}</code>. Link de unsubscribe é inserido automaticamente.
          </p>
        </div>
      </motion.div>

      {/* Destino */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-foreground">Destino e envio</h2>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Segmento *
          </label>
          <select
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            disabled={saving}
            className={selectClass}
          >
            <option value="">Selecione um segmento...</option>
            {segments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.name} ({seg.filters.length} filtro{seg.filters.length !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Caixa remetente (UUID)
          </label>
          <Input
            value={mailboxId}
            onChange={(e) => setMailboxId(e.target.value)}
            placeholder="UUID da mailbox — TODO: select em Fase 7c"
            className={inputClass}
            disabled={saving}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Selecionar caixas de entrada disponível em Fase 7c.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Agendar para (opcional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={saving}
              className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Tamanho do lote (por minuto)
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              min={1}
              max={1000}
              disabled={saving}
              className="flex h-9 w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </motion.div>

      {/* Botões */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3 pb-8"
      >
        <Button
          onClick={handleSaveDraft}
          disabled={saving}
          variant="outline"
          className="gap-2 border-border text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar rascunho
        </Button>
        <button
          type="button"
          onClick={() => router.push("/marketing/campaigns")}
          disabled={saving}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

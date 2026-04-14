"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Flag, Plus, Loader2, Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexusai360/design-system";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  listFlagsAction,
  setFlagAction,
} from "@/lib/actions/feature-flags";

type FlagRow = {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPct: number;
  updatedAt: Date;
  overrides: { id: string; scope: string; scopeId: string; enabled: boolean }[];
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export function FlagsContent() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [newRollout, setNewRollout] = useState(0);

  async function load() {
    const res = await listFlagsAction();
    if (res.success && res.data) {
      setFlags(res.data as unknown as FlagRow[]);
    } else {
      toast.error(res.error ?? "Erro ao carregar flags");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function handleToggle(key: string, enabled: boolean) {
    startSaving(async () => {
      const res = await setFlagAction({ key, enabled });
      if (res.success) {
        toast.success(`Flag "${key}" ${enabled ? "ativada" : "desativada"}`);
        await load();
      } else {
        toast.error(res.error ?? "Erro ao atualizar flag");
      }
    });
  }

  function handleRolloutChange(key: string, rolloutPct: number) {
    startSaving(async () => {
      const res = await setFlagAction({ key, rolloutPct });
      if (res.success) {
        toast.success(`Rollout atualizado em "${key}": ${rolloutPct}%`);
        await load();
      } else {
        toast.error(res.error ?? "Erro ao atualizar rollout");
      }
    });
  }

  function handleCreate() {
    const k = newKey.trim();
    if (!k) {
      toast.error("Chave é obrigatória");
      return;
    }
    startSaving(async () => {
      const res = await setFlagAction({
        key: k,
        description: newDescription.trim() || undefined,
        enabled: newEnabled,
        rolloutPct: newRollout,
      });
      if (res.success) {
        toast.success(`Flag "${k}" criada`);
        setCreateOpen(false);
        setNewKey("");
        setNewDescription("");
        setNewEnabled(false);
        setNewRollout(0);
        await load();
      } else {
        toast.error(res.error ?? "Erro ao criar flag");
      }
    });
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
            <Flag className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Feature Flags</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Carregando..." : `${flags.length} flag${flags.length !== 1 ? "s" : ""} registrada${flags.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Nova flag
        </Button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-border bg-card/50 rounded-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Flags registradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
                ))}
              </div>
            ) : flags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Flag className="h-12 w-12 mb-3 text-muted-foreground/60" />
                <p className="text-sm">Nenhuma feature flag registrada ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Chave</TableHead>
                    <TableHead className="text-muted-foreground">Descrição</TableHead>
                    <TableHead className="text-muted-foreground text-center">Ativada</TableHead>
                    <TableHead className="text-muted-foreground text-center">Rollout (%)</TableHead>
                    <TableHead className="text-muted-foreground text-center hidden md:table-cell">Atualizada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((f) => (
                    <TableRow key={f.key} className="border-border">
                      <TableCell className="font-mono text-foreground">{f.key}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{f.description ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={(next) => handleToggle(f.key, next === true)}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={f.rolloutPct}
                          onBlur={(e) => {
                            const v = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                            if (v !== f.rolloutPct) handleRolloutChange(f.key, v);
                          }}
                          disabled={saving}
                          className="w-20 mx-auto text-center bg-muted/50 border-border"
                        />
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden md:table-cell">
                        {format(new Date(f.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Nova feature flag</DialogTitle>
            <DialogDescription>Cria ou atualiza uma flag no catálogo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Chave *</label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="ex: new_dashboard, v2_search"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Aceita letras, números, `_`, `-` e `:`.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Descrição</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Opcional — explica o que a flag controla"
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-sm text-foreground">Ativada por padrão</span>
              <Switch checked={newEnabled} onCheckedChange={(n) => setNewEnabled(n === true)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Rollout inicial (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newRollout}
                onChange={(e) =>
                  setNewRollout(Math.max(0, Math.min(100, Number(e.target.value || 0))))
                }
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

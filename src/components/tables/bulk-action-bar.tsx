"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, Pencil } from "lucide-react";
import { Button } from "@nexusai360/design-system";

export interface BulkEditOption {
  /** Identificador da ação (ex: "change-status") */
  key: string;
  /** Texto exibido no botão */
  label: string;
  /** Handler quando clicado (opcional — ou render um menu externo) */
  onClick: () => void;
}

interface BulkActionBarProps {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  entityLabel: string;
  entityPlural: string;
  /** Ações secundárias (ex: mudar status). Renderizadas entre "Cancelar" e "Excluir". */
  editActions?: BulkEditOption[];
}

export function BulkActionBar({
  count,
  onCancel,
  onDelete,
  entityLabel,
  entityPlural,
  editActions,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" as const }}
          role="status"
          aria-live="polite"
          className="sticky top-4 z-20 bg-violet-600 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg"
        >
          <span className="text-sm font-medium">
            {count} {count === 1 ? entityLabel : entityPlural} selecionado
            {count === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              onClick={onCancel}
              className="h-8 bg-transparent hover:bg-white/10 text-white border border-white/30 cursor-pointer"
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            {editActions?.map((a) => (
              <Button
                key={a.key}
                onClick={a.onClick}
                className="h-8 bg-white/10 hover:bg-white/20 text-white border border-white/30 cursor-pointer"
              >
                <Pencil className="h-4 w-4 mr-1" />
                {a.label}
              </Button>
            ))}
            <Button
              onClick={onDelete}
              className="h-8 bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir {count}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

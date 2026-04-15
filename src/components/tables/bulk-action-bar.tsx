"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { Button } from "@nexusai360/design-system";

interface BulkActionBarProps {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  entityLabel: string; // "lead" | "contato" | "oportunidade"
  entityPlural: string; // "leads" | "contatos" | "oportunidades"
}

export function BulkActionBar({
  count,
  onCancel,
  onDelete,
  entityLabel,
  entityPlural,
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

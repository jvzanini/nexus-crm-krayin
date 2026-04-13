"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, X } from "lucide-react";
import { LOCALE_PACKS } from "@/locale/registry";
import type { LocaleCode } from "@/locale/types";

interface CompanyLocaleConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromLocale: LocaleCode;
  toLocale: LocaleCode;
  onConfirm: () => void;
  loading?: boolean;
}

const CONFIRM_KEYWORD = "CONFIRMAR";

export function CompanyLocaleConfirmDialog({
  open,
  onOpenChange,
  fromLocale,
  toLocale,
  onConfirm,
  loading,
}: CompanyLocaleConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed === CONFIRM_KEYWORD;

  const willChange = [
    "Formulários passarão a usar o formato de documento do novo país",
    "Máscaras de telefone seguirão o padrão do novo país",
    "Datas serão exibidas no formato do novo país",
    "Campos de endereço se ajustarão ao novo país",
    "Textos da interface mudarão para o novo idioma",
  ];

  const wontChange = [
    "Telefones já cadastrados continuam válidos (E.164)",
    "Documentos já cadastrados permanecem",
    "Moedas de cotações/produtos não são convertidas",
    "Datas armazenadas não são re-convertidas",
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTyped("");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>
                Trocar idioma da empresa de {LOCALE_PACKS[fromLocale].name} para{" "}
                {LOCALE_PACKS[toLocale].name}?
              </DialogTitle>
              <DialogDescription>
                Esta alteração afeta a interface e os formulários de todos os
                usuários desta empresa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              O que vai mudar
            </h4>
            <ul className="space-y-1.5">
              {willChange.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              O que NÃO vai mudar
            </h4>
            <ul className="space-y-1.5">
              {wontChange.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-keyword">
              Digite{" "}
              <span className="font-mono font-bold text-foreground">
                {CONFIRM_KEYWORD}
              </span>{" "}
              para prosseguir
            </Label>
            <Input
              id="confirm-keyword"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_KEYWORD}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setTyped("");
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || loading}
            onClick={onConfirm}
          >
            {loading ? "Confirmando..." : "Confirmar troca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

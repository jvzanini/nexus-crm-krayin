"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleField } from "@/components/locale/LocaleField";
import { TimezoneCombobox } from "@/components/locale/TimezoneCombobox";
import { setUserLocale, setUserTimezone } from "@/lib/actions/locale";
import { toast } from "sonner";
import { Globe, Save } from "lucide-react";
import type { LocaleCode } from "@/locale/types";

interface UserRegionalFormProps {
  currentLocale: string;
  currentTimezone: string;
}

export function UserRegionalForm({
  currentLocale,
  currentTimezone,
}: UserRegionalFormProps) {
  const [locale, setLocale] = useState(currentLocale);
  const [timezone, setTimezone] = useState(currentTimezone);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const results = await Promise.all([
        locale !== currentLocale
          ? setUserLocale(locale)
          : { success: true },
        timezone !== currentTimezone
          ? setUserTimezone(timezone)
          : { success: true },
      ]);

      if (results.every((r) => r.success)) {
        toast.success("Preferências salvas");
      } else {
        toast.error("Erro ao salvar preferências");
      }
    });
  }

  const hasChanges = locale !== currentLocale || timezone !== currentTimezone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Minhas preferências regionais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Idioma</Label>
          <p className="text-xs text-muted-foreground">
            Idioma usado em toda a interface e formulários.
          </p>
          <LocaleField
            value={locale}
            onChange={(l) => setLocale(l)}
          />
        </div>

        <div className="space-y-2">
          <Label>Fuso horário</Label>
          <p className="text-xs text-muted-foreground">
            Afeta a exibição de datas e horários.
          </p>
          <TimezoneCombobox value={timezone} onChange={setTimezone} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

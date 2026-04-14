"use client";

import { useId } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

export interface ConsentValue {
  marketing: boolean;
  tracking: boolean;
}

interface ConsentFieldsetProps {
  value: ConsentValue;
  onChange: (next: ConsentValue) => void;
  disabled?: boolean;
}

export function ConsentFieldset({ value, onChange, disabled }: ConsentFieldsetProps) {
  const t = useTranslations("consent");
  const legendId = useId();
  const marketingHintId = useId();
  const trackingHintId = useId();

  return (
    <fieldset
      aria-labelledby={legendId}
      className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
    >
      <legend
        id={legendId}
        className="flex items-center gap-2 px-1 text-sm font-medium text-foreground"
      >
        <ShieldCheck className="h-4 w-4 text-violet-400" aria-hidden="true" />
        {t("legend")}
      </legend>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <Checkbox
          checked={value.marketing}
          onCheckedChange={(next) =>
            onChange({ ...value, marketing: next === true })
          }
          aria-describedby={marketingHintId}
          disabled={disabled}
          className="mt-0.5"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">
            {t("marketing.label")}
          </span>
          <span
            id={marketingHintId}
            className="block text-xs text-muted-foreground mt-0.5"
          >
            {t("marketing.hint")}
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <Checkbox
          checked={value.tracking}
          onCheckedChange={(next) =>
            onChange({ ...value, tracking: next === true })
          }
          aria-describedby={trackingHintId}
          disabled={disabled}
          className="mt-0.5"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">
            {t("tracking.label")}
          </span>
          <span
            id={trackingHintId}
            className="block text-xs text-muted-foreground mt-0.5"
          >
            {t("tracking.hint")}
          </span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
        {t("disclosure")}{" "}
        <Link
          href="/privacy"
          className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
        >
          {t("policyLink")}
        </Link>
      </p>
    </fieldset>
  );
}

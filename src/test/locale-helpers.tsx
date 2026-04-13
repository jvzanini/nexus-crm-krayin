import { render } from "@testing-library/react";
import { LocaleClientProvider } from "@/components/locale/LocaleClientProvider";
import type { LocaleCode } from "@/locale/types";

export function renderWithLocale(
  ui: React.ReactElement,
  locale: LocaleCode = "pt-BR"
) {
  return render(
    <LocaleClientProvider locale={locale}>{ui}</LocaleClientProvider>
  );
}

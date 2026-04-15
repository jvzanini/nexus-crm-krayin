"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedFilter } from "@/generated/prisma/client";
import { listSavedFilters } from "@/lib/actions/saved-filters";
import type { SavedFilterModuleKey } from "@/lib/actions/saved-filters-schemas";

/**
 * Hook cliente para carregar filtros salvos do módulo + reload imperativo.
 * Fase 33.
 */
export function useSavedFilters(moduleKey: SavedFilterModuleKey) {
  const [list, setList] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await listSavedFilters({ moduleKey });
    if (r.success && r.data) setList(r.data);
    else setList([]);
    setLoading(false);
  }, [moduleKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { list, loading, reload };
}

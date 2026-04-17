"use client";

import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexusai360/design-system";
import { Button } from "@nexusai360/design-system";
import { Input } from "@nexusai360/design-system";
import { Switch } from "@nexusai360/design-system";
import { PageHeader, IconTile } from "@nexusai360/design-system";
import { CrmListShell } from "@nexusai360/patterns";
import { EmptyState } from "@nexusai360/design-system";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@nexusai360/design-system";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nexusai360/design-system";
import {
  Package,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  AlertTriangle,
  DollarSign,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  listProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  unarchiveProduct,
  deleteProduct,
  deleteProductsBulk,
  upsertPrice,
  deletePrice,
} from "@/lib/actions/products";
import type { ProductItem } from "@/lib/actions/products";
import {
  SUPPORTED_CURRENCIES,
  currencyLabel,
} from "@/lib/currency/allowlist";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { FilterBar, type FilterConfig } from "@/components/tables/filter-bar";
import { useSavedFilters } from "@/lib/hooks/use-saved-filters";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ProductsFiltersSchema,
  type ProductsFilters,
} from "@/lib/actions/products-schemas";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface PriceRow {
  currency: string;
  amount: string;
  active: boolean;
  /** Presente apenas ao editar — id do preço salvo no banco */
  id?: string;
}

interface ProductsContentProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialFilters?: Record<string, string | undefined>;
  categoryOptions?: string[];
}

// ---------------------------------------------------------------------------
// Variants de animação (stagger 0.08 conforme padrão)
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
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-muted/50 border border-border"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente de linha de preço no dialog
// ---------------------------------------------------------------------------

interface PriceRowEditorProps {
  row: PriceRow;
  usedCurrencies: string[];
  onChange: (updated: PriceRow) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function PriceRowEditor({
  row,
  usedCurrencies,
  onChange,
  onRemove,
  disabled,
}: PriceRowEditorProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
      <select
        value={row.currency}
        disabled={disabled}
        onChange={(e) => onChange({ ...row, currency: e.target.value })}
        className="flex h-8 rounded-md border bg-muted/50 border-border px-2 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-36 shrink-0"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option
            key={c}
            value={c}
            disabled={c !== row.currency && usedCurrencies.includes(c)}
          >
            {c}
          </option>
        ))}
      </select>
      <Input
        value={row.amount}
        disabled={disabled}
        onChange={(e) => onChange({ ...row, amount: e.target.value })}
        placeholder="0.00"
        className="h-8 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground text-xs flex-1 min-w-0"
      />
      <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Switch
          checked={row.active}
          onCheckedChange={(checked) => onChange({ ...row, active: checked })}
          disabled={disabled}
        />
        <span className="hidden sm:inline">Ativo</span>
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        title="Remover preço"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ProductsContent({
  canCreate,
  canEdit,
  canDelete,
  initialFilters = {},
  categoryOptions = [],
}: ProductsContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // --- Estado da lista ---
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filtros URL (ProductsFilters) ---
  const [filters, setFilters] = useState<ProductsFilters>(() => {
    const parsed = ProductsFiltersSchema.safeParse(initialFilters);
    return parsed.success ? parsed.data : {};
  });
  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);

  // --- Dialogs ---
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingProduct, setArchivingProduct] = useState<ProductItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);

  // --- Campos do formulário (compartilhado create/edit) ---
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formPrices, setFormPrices] = useState<PriceRow[]>([]);

  // --- Transitions ---
  const [saving, startSaving] = useTransition();
  const [archiving, startArchiving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saved = useSavedFilters("products");
  const currentFiltersAsRecord = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (filters.q) out.q = filters.q;
    if (filters.active) out.active = filters.active;
    if (filters.category) out.category = filters.category;
    return out;
  }, [filters]);
  function onApplySavedProductsFilter(f: Record<string, string>) {
    const parsed = ProductsFiltersSchema.safeParse(f);
    if (parsed.success) {
      setFilters(parsed.data);
      setSelectedIds(new Set());
    }
  }
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, startBulkDeleting] = useTransition();

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(rowIds: string[]) {
    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(rowIds));
  }
  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulkDeleting(async () => {
      const result = await deleteProductsBulk(ids);
      if (result.success && result.data) {
        toast.success(
          `${result.data.deletedCount} produto${result.data.deletedCount === 1 ? "" : "s"} excluído${result.data.deletedCount === 1 ? "" : "s"}`,
        );
        setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Erro ao excluir produtos");
      }
      setBulkDeleteDialogOpen(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  const loadProducts = useCallback(
    async (f: ProductsFilters = filters) => {
      setLoading(true);
      // Passa o shape URL direto — `listProducts` valida via Zod server-side.
      const payload: Record<string, string> = {};
      if (f.q) payload.q = f.q;
      if (f.active) payload.active = f.active;
      if (f.category) payload.category = f.category;
      const result = await listProducts(payload);
      if (result.success && result.data) {
        setProducts(result.data);
      } else {
        toast.error(result.error ?? "Erro ao carregar produtos");
      }
      setLoading(false);
    },
    [filters],
  );

  // Sincroniza URL + refaz listProducts quando filtros mudam (debounce em q).
  const didMount = useRef(false);
  useEffect(() => {
    const effective: ProductsFilters = {
      ...filters,
      q: debouncedQ ? debouncedQ : undefined,
    };
    loadProducts(effective);
    if (!didMount.current) {
      // Primeira render: não sujar history; URL já reflete initialFilters SSR.
      didMount.current = true;
      return;
    }
    const qs = new URLSearchParams();
    if (effective.q) qs.set("q", effective.q);
    if (effective.active) qs.set("active", effective.active);
    if (effective.category) qs.set("category", effective.category);
    const s = qs.toString();
    router.replace(`${pathname}${s ? "?" + s : ""}`, { scroll: false });
    // Deps intencionais: usamos `debouncedQ` em vez de `filters.q` para aplicar
    // debounce de 300ms no input de busca; incluir `filters`/`loadProducts`
    // dispararia refetch imediato a cada tecla, anulando o debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters.active, filters.category]);

  // ---------------------------------------------------------------------------
  // Filtros derivados
  // ---------------------------------------------------------------------------

  const categories = categoryOptions;

  // Tudo que voltar do servidor já vem filtrado; exposto como `filtered`
  // para minimizar a quantidade de alterações no JSX abaixo.
  const filtered = products;

  const hasActiveFilters = useMemo(
    () => Boolean(filters.q || filters.active || filters.category),
    [filters.q, filters.active, filters.category],
  );

  function updateFilter(key: string, value: string) {
    setFilters((prev) => {
      const next: ProductsFilters = { ...prev };
      if (key === "q") {
        next.q = value.trim() === "" ? undefined : value;
      } else if (key === "active") {
        next.active =
          value === "active" || value === "inactive" ? value : undefined;
      } else if (key === "category") {
        next.category = value === "" ? undefined : value;
      }
      return next;
    });
    setSelectedIds(new Set());
  }

  function clearFilters() {
    setFilters({});
    setSelectedIds(new Set());
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: "input",
      key: "q",
      label: "Buscar",
      value: filters.q ?? "",
      placeholder: "Buscar nome ou SKU...",
    },
    {
      type: "select",
      key: "active",
      label: "Status",
      value: filters.active ?? "",
      placeholder: "Todos",
      options: [
        { value: "", label: "Todos" },
        { value: "active", label: "Ativos" },
        { value: "inactive", label: "Inativos" },
      ],
    },
    {
      type: "select",
      key: "category",
      label: "Categoria",
      value: filters.category ?? "",
      placeholder: "Todas",
      options: [
        { value: "", label: "Todas" },
        ...categories.map((c) => ({ value: c, label: c })),
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // Helpers de dialog
  // ---------------------------------------------------------------------------

  function resetForm() {
    setFormSku("");
    setFormName("");
    setFormDescription("");
    setFormCategory("");
    setFormActive(true);
    setFormPrices([]);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(product: ProductItem) {
    setEditingProduct(product);
    setFormSku(product.sku);
    setFormName(product.name);
    setFormDescription(product.description ?? "");
    setFormCategory(product.category ?? "");
    setFormActive(product.active);
    setFormPrices(
      product.prices.map((pr) => ({
        id: pr.id,
        currency: pr.currency,
        amount: pr.amount,
        active: pr.active,
      }))
    );
    setEditOpen(true);
  }

  function openArchiveDialog(product: ProductItem) {
    setArchivingProduct(product);
    setArchiveDialogOpen(true);
  }

  function openDeleteDialog(product: ProductItem) {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  }

  // ---------------------------------------------------------------------------
  // Gerenciamento de preços no form
  // ---------------------------------------------------------------------------

  const usedCurrencies = formPrices.map((r) => r.currency);

  function addPriceRow() {
    const available = SUPPORTED_CURRENCIES.find(
      (c) => !usedCurrencies.includes(c)
    );
    if (!available) {
      toast.error("Todas as moedas disponíveis já foram adicionadas");
      return;
    }
    setFormPrices((prev) => [
      ...prev,
      { currency: available, amount: "", active: true },
    ]);
  }

  function updatePriceRow(index: number, updated: PriceRow) {
    setFormPrices((prev) =>
      prev.map((row, i) => (i === index ? updated : row))
    );
  }

  function removePriceRow(index: number) {
    setFormPrices((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Submit create
  // ---------------------------------------------------------------------------

  function handleSubmitCreate() {
    if (!formSku.trim()) {
      toast.error("SKU é obrigatório");
      return;
    }
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    for (const pr of formPrices) {
      if (!pr.amount || isNaN(Number(pr.amount))) {
        toast.error(`Valor inválido para ${pr.currency}`);
        return;
      }
    }

    startSaving(async () => {
      const result = await createProduct({
        sku: formSku.trim(),
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory.trim() || undefined,
        prices: formPrices.map((pr) => ({
          currency: pr.currency,
          amount: pr.amount,
          active: pr.active,
        })),
      });

      if (result.success) {
        toast.success("Produto criado com sucesso");
        setCreateOpen(false);
        await loadProducts();
      } else {
        toast.error(result.error ?? "Erro ao criar produto");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Submit edit
  // ---------------------------------------------------------------------------

  function handleSubmitEdit() {
    if (!editingProduct) return;
    if (!formSku.trim()) {
      toast.error("SKU é obrigatório");
      return;
    }
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    for (const pr of formPrices) {
      if (!pr.amount || isNaN(Number(pr.amount))) {
        toast.error(`Valor inválido para ${pr.currency}`);
        return;
      }
    }

    startSaving(async () => {
      // 1. Atualiza campos básicos
      const updateResult = await updateProduct(editingProduct.id, {
        sku: formSku.trim(),
        name: formName.trim(),
        description: formDescription.trim() || null,
        category: formCategory.trim() || null,
        active: formActive,
      });

      if (!updateResult.success) {
        toast.error(updateResult.error ?? "Erro ao atualizar produto");
        return;
      }

      // 2. Sincroniza preços (diff entre original e atual)
      const originalPrices = editingProduct.prices;
      const originalCurrencies = new Set(originalPrices.map((p) => p.currency));
      const newCurrencies = new Set(formPrices.map((p) => p.currency));

      // Upsert das linhas novas/alteradas
      const upsertErrors: string[] = [];
      for (const pr of formPrices) {
        const upsertResult = await upsertPrice(
          editingProduct.id,
          pr.currency,
          pr.amount,
          pr.active
        );
        if (!upsertResult.success) {
          upsertErrors.push(`${pr.currency}: ${upsertResult.error}`);
        }
      }

      // Remove moedas que foram deletadas
      const deleteErrors: string[] = [];
      for (const orig of originalPrices) {
        if (!newCurrencies.has(orig.currency)) {
          const delResult = await deletePrice(editingProduct.id, orig.currency);
          if (!delResult.success) {
            deleteErrors.push(`${orig.currency}: ${delResult.error}`);
          }
        }
      }

      if (upsertErrors.length > 0 || deleteErrors.length > 0) {
        toast.error(
          `Produto atualizado, mas houve erros nos preços: ${[...upsertErrors, ...deleteErrors].join("; ")}`
        );
      } else {
        toast.success("Produto atualizado com sucesso");
      }

      void originalCurrencies; // satisfaz lint de var não usada diretamente

      setEditOpen(false);
      setEditingProduct(null);
      await loadProducts();
    });
  }

  // ---------------------------------------------------------------------------
  // Archive / Unarchive
  // ---------------------------------------------------------------------------

  function handleArchiveToggle() {
    if (!archivingProduct) return;

    const isArchived = !archivingProduct.active;
    startArchiving(async () => {
      const result = isArchived
        ? await unarchiveProduct(archivingProduct.id)
        : await archiveProduct(archivingProduct.id);

      if (result.success) {
        toast.success(
          isArchived
            ? `Produto "${archivingProduct.sku}" reativado`
            : `Produto "${archivingProduct.sku}" arquivado`
        );
        setArchiveDialogOpen(false);
        setArchivingProduct(null);
        await loadProducts();
      } else {
        toast.error(result.error ?? "Erro ao alterar status do produto");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function handleDelete() {
    if (!deletingProduct) return;

    startDeleting(async () => {
      const result = await deleteProduct(deletingProduct.id);

      if (result.success) {
        toast.success(`Produto "${deletingProduct.sku}" excluído`);
        setDeleteDialogOpen(false);
        setDeletingProduct(null);
        await loadProducts();
      } else {
        toast.error(result.error ?? "Erro ao excluir produto");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render de preços na tabela
  // ---------------------------------------------------------------------------

  function renderPricesBadge(prices: ProductItem["prices"]) {
    if (prices.length === 0)
      return <span className="text-muted-foreground text-xs">—</span>;

    const first = prices[0];
    const rest = prices.length - 1;

    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono">
        <span className="text-foreground">
          {first.currency} {Number(first.amount).toFixed(2)}
        </span>
        {rest > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-[10px]">
            +{rest}
          </span>
        )}
      </span>
    );
  }

  // ---------------------------------------------------------------------------
  // Dialog de formulário (create + edit compartilham a mesma estrutura)
  // ---------------------------------------------------------------------------

  function ProductForm() {
    return (
      <div className="space-y-4">
        {/* SKU + Nome */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              SKU *
            </label>
            <Input
              value={formSku}
              onChange={(e) => setFormSku(e.target.value.toUpperCase())}
              placeholder="EX: PROD-001"
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground font-mono uppercase"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Nome *
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nome do produto"
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              disabled={saving}
            />
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Categoria
          </label>
          <Input
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
            placeholder="Ex: Software, Hardware, Serviço"
            list="categories-datalist"
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
            disabled={saving}
          />
          {categories.length > 0 && (
            <datalist id="categories-datalist">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Descrição
          </label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Descrição detalhada do produto"
            rows={3}
            disabled={saving}
            className="flex w-full rounded-md border bg-muted/50 border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Ativo (apenas no edit) */}
        {editingProduct && (
          <div className="flex items-center gap-3">
            <Switch
              checked={formActive}
              onCheckedChange={setFormActive}
              disabled={saving}
            />
            <label className="text-sm text-foreground/80">
              Produto ativo
            </label>
          </div>
        )}

        {/* Preços inline */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-violet-400" />
              Preços por moeda
            </label>
            {usedCurrencies.length < SUPPORTED_CURRENCIES.length && (
              <button
                type="button"
                onClick={addPriceRow}
                disabled={saving}
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors"
              >
                <Plus className="h-3 w-3" />
                Adicionar moeda
              </button>
            )}
          </div>

          {formPrices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
              Nenhum preço cadastrado. Clique em &quot;Adicionar moeda&quot; para inserir.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-1">
              {formPrices.map((row, index) => (
                <PriceRowEditor
                  key={`${row.currency}-${index}`}
                  row={row}
                  usedCurrencies={usedCurrencies.filter(
                    (_, i) => i !== index
                  )}
                  onChange={(updated) => updatePriceRow(index, updated)}
                  onRemove={() => removePriceRow(index)}
                  disabled={saving}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX principal
  // ---------------------------------------------------------------------------

  const productsDesc = loading
    ? "Carregando..."
    : `${filtered.length} produto${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`;

  return (
    <CrmListShell
      title="Produtos"
      description={productsDesc}
      icon={<IconTile icon={Package} color="blue" />}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Produtos" },
      ]}
      actions={
        canCreate ? (
          <Button
            onClick={openCreate}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </Button>
        ) : null
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >

      {/* Filtros */}
      <motion.div variants={itemVariants}>
        <FilterBar
          filters={filterConfigs}
          onChange={updateFilter}
          onClear={clearFilters}
          hasActive={hasActiveFilters}
          savedFilters={{
            moduleKey: "products",
            current: currentFiltersAsRecord,
            list: saved.list,
            onApply: onApplySavedProductsFilter,
            onListChange: saved.reload,
          }}
        />
      </motion.div>

      {/* Bulk action bar */}
      {canDelete && (
        <BulkActionBar
          count={selectedIds.size}
          onCancel={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          entityLabel="produto"
          entityPlural="produtos"
        />
      )}

      {/* Tabela */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border bg-card/50 overflow-hidden overflow-x-auto"
      >
        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState.Root>
              <EmptyState.Icon icon={Package} color="blue" />
              <EmptyState.Title>
                Nenhum resultado com os filtros aplicados
              </EmptyState.Title>
              <EmptyState.Description>
                Ajuste ou limpe os filtros para ver mais produtos.
              </EmptyState.Description>
              <EmptyState.Action>
                <Button
                  onClick={clearFilters}
                  className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                >
                  Limpar filtros
                </Button>
              </EmptyState.Action>
            </EmptyState.Root>
          ) : (
            <EmptyState.Root>
              <EmptyState.Icon icon={Package} color="blue" />
              <EmptyState.Title>Nenhum produto cadastrado</EmptyState.Title>
              <EmptyState.Description>
                Adicione produtos ao seu catálogo para associar a oportunidades.
              </EmptyState.Description>
              {canCreate && (
                <EmptyState.Action>
                  <Button
                    onClick={openCreate}
                    className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                  >
                    Novo produto
                  </Button>
                </EmptyState.Action>
              )}
            </EmptyState.Root>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {canDelete && (
                  <TableHead className="text-muted-foreground w-10">
                    <Checkbox
                      checked={
                        filtered.length > 0 &&
                        filtered.every((p) => selectedIds.has(p.id))
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        !filtered.every((p) => selectedIds.has(p.id))
                      }
                      onCheckedChange={() =>
                        toggleAll(filtered.map((p) => p.id))
                      }
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground">SKU</TableHead>
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  Categoria
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  Preços
                </TableHead>
                <TableHead className="text-muted-foreground text-center">
                  Status
                </TableHead>
                {(canEdit || canDelete) && (
                  <TableHead className="text-muted-foreground text-center">
                    Ações
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product, index) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.03,
                    ease: "easeOut" as const,
                  }}
                  className="border-border hover:bg-accent/30 transition-colors duration-200"
                >
                  {canDelete && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleRow(product.id)}
                        aria-label={`Selecionar ${product.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm text-foreground font-medium">
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {product.category ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {renderPricesBadge(product.prices)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        product.active
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                      }`}
                    >
                      {product.active ? "Ativo" : "Arquivado"}
                    </span>
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              title="Editar produto"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openArchiveDialog(product)}
                              title={
                                product.active
                                  ? "Arquivar produto"
                                  : "Reativar produto"
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-all duration-200"
                            >
                              {product.active ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <ArchiveRestore className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(product)}
                            title="Excluir produto"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — Criar produto                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg overflow-visible">
          <DialogHeader>
            <DialogTitle>Novo produto</DialogTitle>
            <DialogDescription>
              Cadastre um novo produto no catálogo
            </DialogDescription>
          </DialogHeader>
          <ProductForm />
          <DialogFooter>
            <Button
              onClick={handleSubmitCreate}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — Editar produto                                              */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-visible">
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
            <DialogDescription>
              Atualize os dados do produto
            </DialogDescription>
          </DialogHeader>
          <ProductForm />
          <DialogFooter>
            <Button
              onClick={handleSubmitEdit}
              disabled={saving}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* AlertDialog — Arquivar / Reativar                                   */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              {archivingProduct?.active ? "Arquivar produto" : "Reativar produto"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {archivingProduct?.active
                ? `Tem certeza que deseja arquivar o produto `
                : `Tem certeza que deseja reativar o produto `}
              <strong className="text-foreground">
                &quot;{archivingProduct?.sku}&quot;
              </strong>
              ?{" "}
              {archivingProduct?.active
                ? "O produto ficará inativo mas poderá ser reativado."
                : "O produto voltará a aparecer como ativo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={archiving}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveToggle}
              disabled={archiving}
              className="bg-amber-600 text-white hover:bg-amber-700 cursor-pointer transition-all duration-200"
            >
              {archiving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {archivingProduct?.active ? "Arquivar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------------------ */}
      {/* AlertDialog — Excluir produto                                        */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir produtos selecionados
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              produto{selectedIds.size === 1 ? "" : "s"}? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {bulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Excluir produto
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir permanentemente o produto{" "}
              <strong className="text-foreground">
                &quot;{deletingProduct?.sku}&quot;
              </strong>
              ? Esta ação é irreversível e removerá todos os preços associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-all duration-200"
            >
              {deleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </motion.div>
    </CrmListShell>
  );
}

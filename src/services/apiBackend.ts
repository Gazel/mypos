// src/services/apiBackend.ts
import type {
  CartItem,
  DashboardReport,
  DashboardSalesTrendMode,
  DashboardSalesTrendReport,
  Ingredient,
  IngredientBaseUnit,
  IngredientPrice,
  Product,
  ProductRecipeItem,
  RecipeUsageReport,
  RecipeUsageWarningType,
  Transaction,
  UserRole,
  UserRow,
} from "../types";

const API_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// helper to attach token
function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface FetchTransactionsOptions {
  date?: string;
  startDate?: string;
  endDate?: string;
}

export interface DailySalesSummaryRow {
  date: string;
  transactionCount: number;
  totalSales: number;
  totalCash: number;
  totalQris: number;
}

export interface FetchRecipeUsageReportOptions {
  startDate: string;
  endDate: string;
}

export interface FetchDashboardReportOptions {
  startDate: string;
  endDate: string;
  previousStartDate?: string;
  previousEndDate?: string;
}

export interface FetchDashboardSalesTrendOptions {
  mode: DashboardSalesTrendMode;
  endDate: string;
}

function buildApiUrl(path: string, params?: Record<string, string | undefined>) {
  const isAbsoluteUrl = API_URL.startsWith("http");
  const url = isAbsoluteUrl
    ? new URL(`${API_URL}${path}`)
    : new URL(`${API_URL}${path}`, window.location.origin);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return isAbsoluteUrl ? url.toString() : `${url.pathname}${url.search}`;
}

type ApiRecord = Record<string, unknown>;
type ApiTransaction = ApiRecord & Partial<Transaction>;
type ApiCartItem = ApiRecord & Partial<CartItem>;

function normalizeTransaction(t: ApiTransaction): Transaction {
  const items = Array.isArray(t.items) ? (t.items as ApiCartItem[]) : [];

  return {
    id: String(t.id ?? ""),
    date: String(t.date || new Date().toISOString()),
    subtotal: Number(t.subtotal ?? 0),
    discount: Number(t.discount ?? 0),
    total: Number(t.total ?? 0),
    paymentMethod: (t.paymentMethod || "cash") as Transaction["paymentMethod"],
    cashReceived: Number(t.cashReceived ?? 0),
    change: Number(t.change ?? 0),
    customerName: t.customerName ? String(t.customerName) : undefined,
    note: t.note ? String(t.note) : undefined,
    status: (t.status || "SUCCESS") as Transaction["status"],
    items: items.map((it) => ({
      productId: String(it.productId ?? ""),
      name: String(it.name ?? ""),
      price: Number(it.price ?? 0),
      quantity: Number(it.quantity ?? 0),
      subtotal: Number(it.subtotal ?? 0),
    })),
  } as Transaction;
}

/* ============================
 * TRANSACTIONS
 * ============================ */

export async function fetchTransactionsOnline(
  token: string,
  filters: FetchTransactionsOptions = {}
): Promise<Transaction[]> {
  const res = await fetch(buildApiUrl("/api/transactions", { ...filters }), {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching transactions", res.status);
    return [];
  }

  const data = await res.json();

  // Normalisasi ke bentuk Transaction
  return (data as ApiTransaction[]).map(normalizeTransaction);
}

export async function fetchDailySalesSummaryOnline(
  token: string,
  filters: Required<Pick<FetchTransactionsOptions, "startDate" | "endDate">>
): Promise<DailySalesSummaryRow[]> {
  const res = await fetch(
    buildApiUrl("/api/transactions/summary", { ...filters }),
    {
      headers: authHeader(token),
    }
  );

  if (!res.ok) {
    console.error("Failed fetching daily sales summary", res.status);
    return [];
  }

  const data = (await res.json()) as Array<Record<string, unknown>>;

  return data.map((row) => ({
    date: String(row.date ?? ""),
    transactionCount: Number(row.transactionCount ?? 0),
    totalSales: Number(row.totalSales ?? 0),
    totalCash: Number(row.totalCash ?? 0),
    totalQris: Number(row.totalQris ?? 0),
  }));
}

function normalizeDashboardReport(data: ApiRecord): DashboardReport {
  const filters = (data.filters || {}) as ApiRecord;
  const summary = (data.summary || {}) as ApiRecord;
  const comparison = (data.comparison || {}) as ApiRecord;
  const paymentBreakdown = Array.isArray(data.paymentBreakdown)
    ? (data.paymentBreakdown as ApiRecord[])
    : [];
  const dailyTrend = Array.isArray(data.dailyTrend)
    ? (data.dailyTrend as ApiRecord[])
    : [];
  const topProducts = Array.isArray(data.topProducts)
    ? (data.topProducts as ApiRecord[])
    : [];
  const recentTransactions = Array.isArray(data.recentTransactions)
    ? (data.recentTransactions as ApiRecord[])
    : [];
  const insights = Array.isArray(data.insights)
    ? (data.insights as ApiRecord[])
    : [];

  return {
    filters: {
      startDate: String(filters.startDate ?? ""),
      endDate: String(filters.endDate ?? ""),
      previousStartDate: String(filters.previousStartDate ?? ""),
      previousEndDate: String(filters.previousEndDate ?? ""),
    },
    summary: {
      transactionCount: Number(summary.transactionCount ?? 0),
      totalSales: Number(summary.totalSales ?? 0),
      averageBill: Number(summary.averageBill ?? 0),
      totalCash: Number(summary.totalCash ?? 0),
      totalQris: Number(summary.totalQris ?? 0),
      itemsSold: Number(summary.itemsSold ?? 0),
    },
    comparison: {
      totalSales: Number(comparison.totalSales ?? 0),
      transactionCount: Number(comparison.transactionCount ?? 0),
      averageBill: Number(comparison.averageBill ?? 0),
      salesChangePct: Number(comparison.salesChangePct ?? 0),
      transactionChangePct: Number(comparison.transactionChangePct ?? 0),
      averageBillChangePct: Number(comparison.averageBillChangePct ?? 0),
    },
    paymentBreakdown: paymentBreakdown.map((row) => ({
      method: String(row.method ?? ""),
      transactionCount: Number(row.transactionCount ?? 0),
      totalSales: Number(row.totalSales ?? 0),
    })),
    dailyTrend: dailyTrend.map((row) => ({
      date: String(row.date ?? ""),
      transactionCount: Number(row.transactionCount ?? 0),
      totalSales: Number(row.totalSales ?? 0),
    })),
    topProducts: topProducts.map((row) => ({
      productId: String(row.productId ?? ""),
      productName: String(row.productName ?? ""),
      quantitySold: Number(row.quantitySold ?? 0),
      totalSales: Number(row.totalSales ?? 0),
    })),
    recentTransactions: recentTransactions.map((row) => ({
      id: String(row.id ?? ""),
      date: String(row.date ?? ""),
      total: Number(row.total ?? 0),
      paymentMethod: String(row.paymentMethod ?? ""),
      itemCount: Number(row.itemCount ?? 0),
    })),
    insights: insights.map((row) => ({
      key: String(row.key ?? ""),
      label: String(row.label ?? ""),
      value:
        typeof row.value === "number"
          ? row.value
          : typeof row.value === "string"
          ? row.value
          : "",
      unit: String(row.unit ?? ""),
      tone:
        row.tone === "positive" || row.tone === "negative"
          ? row.tone
          : "neutral",
      detail: String(row.detail ?? ""),
    })),
  };
}

export async function fetchDashboardReportOnline(
  token: string,
  filters: FetchDashboardReportOptions
): Promise<DashboardReport> {
  const res = await fetch(buildApiUrl("/api/reports/dashboard", { ...filters }), {
    headers: authHeader(token),
  });

  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, "Failed fetching dashboard report")
    );
  }

  return normalizeDashboardReport((await res.json()) as ApiRecord);
}

function normalizeDashboardSalesTrend(data: ApiRecord): DashboardSalesTrendReport {
  const filters = (data.filters || {}) as ApiRecord;
  const rows = Array.isArray(data.rows) ? (data.rows as ApiRecord[]) : [];

  return {
    mode:
      data.mode === "weekly" || data.mode === "monthly"
        ? data.mode
        : "daily",
    filters: {
      startDate: String(filters.startDate ?? ""),
      endDate: String(filters.endDate ?? ""),
    },
    rows: rows.map((row) => ({
      key: String(row.key ?? ""),
      startDate: String(row.startDate ?? ""),
      endDate: String(row.endDate ?? ""),
      transactionCount: Number(row.transactionCount ?? 0),
      totalSales: Number(row.totalSales ?? 0),
    })),
  };
}

export async function fetchDashboardSalesTrendOnline(
  token: string,
  filters: FetchDashboardSalesTrendOptions
): Promise<DashboardSalesTrendReport> {
  const res = await fetch(
    buildApiUrl("/api/reports/dashboard/sales-trend", { ...filters }),
    {
      headers: authHeader(token),
    }
  );

  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, "Failed fetching dashboard sales trend")
    );
  }

  return normalizeDashboardSalesTrend((await res.json()) as ApiRecord);
}

function normalizeRecipeUsageIngredient(row: ApiRecord) {
  return {
    ingredientId: String(row.ingredientId ?? ""),
    ingredientName: String(row.ingredientName ?? ""),
    baseUnit: row.baseUnit as IngredientBaseUnit,
    displayUnit: String(row.displayUnit ?? ""),
    usedBaseQty: Number(row.usedBaseQty ?? 0),
    usedDisplayQty: Number(row.usedDisplayQty ?? 0),
    pricePerDisplayUnit: Number(row.pricePerDisplayUnit ?? 0),
    estimatedHpp: Number(row.estimatedHpp ?? 0),
  };
}

function normalizeRecipeUsageReport(data: ApiRecord): RecipeUsageReport {
  const filters = (data.filters || {}) as ApiRecord;
  const summary = (data.summary || {}) as ApiRecord;
  const productUsage = Array.isArray(data.productUsage)
    ? (data.productUsage as ApiRecord[])
    : [];
  const ingredientUsage = Array.isArray(data.ingredientUsage)
    ? (data.ingredientUsage as ApiRecord[])
    : [];
  const warnings = Array.isArray(data.warnings)
    ? (data.warnings as ApiRecord[])
    : [];

  return {
    filters: {
      startDate: String(filters.startDate ?? ""),
      endDate: String(filters.endDate ?? ""),
    },
    summary: {
      transactionCount: Number(summary.transactionCount ?? 0),
      totalSales: Number(summary.totalSales ?? 0),
      estimatedHpp: Number(summary.estimatedHpp ?? 0),
      estimatedGrossProfit: Number(summary.estimatedGrossProfit ?? 0),
      estimatedMargin: Number(summary.estimatedMargin ?? 0),
    },
    productUsage: productUsage.map((row) => ({
      productId: String(row.productId ?? ""),
      productName: String(row.productName ?? ""),
      soldQty: Number(row.soldQty ?? 0),
      totalSales: Number(row.totalSales ?? 0),
      estimatedHppPerProduct: Number(row.estimatedHppPerProduct ?? 0),
      totalEstimatedHpp: Number(row.totalEstimatedHpp ?? 0),
      estimatedGrossProfit: Number(row.estimatedGrossProfit ?? 0),
      estimatedMargin: Number(row.estimatedMargin ?? 0),
      ingredients: Array.isArray(row.ingredients)
        ? (row.ingredients as ApiRecord[]).map(normalizeRecipeUsageIngredient)
        : [],
    })),
    ingredientUsage: ingredientUsage.map(normalizeRecipeUsageIngredient),
    warnings: warnings.map((row) => ({
      type: row.type as RecipeUsageWarningType,
      message: String(row.message ?? ""),
      productId: row.productId ? String(row.productId) : undefined,
      productName: row.productName ? String(row.productName) : undefined,
      ingredientId: row.ingredientId ? String(row.ingredientId) : undefined,
      ingredientName: row.ingredientName
        ? String(row.ingredientName)
        : undefined,
      date: row.date ? String(row.date) : undefined,
    })),
  };
}

export async function fetchRecipeUsageReportOnline(
  token: string,
  filters: FetchRecipeUsageReportOptions
): Promise<RecipeUsageReport> {
  const res = await fetch(
    buildApiUrl("/api/reports/recipe-usage", { ...filters }),
    {
      headers: authHeader(token),
    }
  );

  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, "Failed fetching recipe usage report")
    );
  }

  return normalizeRecipeUsageReport((await res.json()) as ApiRecord);
}

export async function saveTransactionOnline(
  transaction: Omit<Transaction, "id">,
  token: string,
  idempotencyKey?: string
): Promise<Transaction> {
  const res = await fetch(buildApiUrl("/api/transactions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(transaction),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed saving transaction");
  }

  const saved = (await res.json()) as ApiTransaction;

  return normalizeTransaction({
    ...transaction,
    ...saved,
    id: saved.id ?? "",
    items: saved.items || transaction.items || [],
  });
}

export function subscribeTransactionsOnline(
  token: string,
  onTransaction: (transaction: Transaction) => void,
  onError?: () => void
): EventSource {
  const streamUrl = buildApiUrl("/api/transactions/stream", {
    token,
  });

  const source = new EventSource(streamUrl);

  source.addEventListener("transaction-created", (event) => {
    onTransaction(
      normalizeTransaction(JSON.parse((event as MessageEvent).data))
    );
  });

  source.onerror = () => {
    onError?.();
  };

  return source;
}

/* ============================
 * PRODUCTS
 * ============================ */

export async function fetchProductsOnline(token: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products`, {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching products", res.status);
    return [];
  }

  const data = await res.json();

  return (data as ApiRecord[]).map((p) => ({
    id: String(p.id),
    name: p.name,
    price: Number(p.price),
    image: p.image ?? "",
    category: p.category ?? "",
    stock: Number(p.stock ?? 0),
    sort_order: typeof p.sort_order === "number" ? p.sort_order : 0,
  })) as Product[];
}

export async function createProductOnline(
  product: Omit<Product, "id">,
  token: string
): Promise<Product> {
  const res = await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(product),
  });

  if (!res.ok) {
    throw new Error("Failed creating product");
  }

  const data = await res.json();
  return {
    id: String(data.id),
    name: data.name,
    price: Number(data.price),
    image: data.image ?? "",
    category: data.category ?? "",
    stock: Number(data.stock ?? 0),
    sort_order:
      typeof data.sort_order === "number"
        ? data.sort_order
        : product.sort_order ?? 0,
  } as Product;
}

export async function updateProductOnline(
  id: string,
  product: Omit<Product, "id">,
  token: string
): Promise<Product> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(product),
  });

  if (!res.ok) {
    throw new Error("Failed updating product");
  }

  const data = await res.json();
  return {
    id: String(data.id),
    name: data.name,
    price: Number(data.price),
    image: data.image ?? "",
    category: data.category ?? "",
    stock: Number(data.stock ?? 0),
    sort_order:
      typeof data.sort_order === "number"
        ? data.sort_order
        : product.sort_order ?? 0,
  } as Product;
}

export async function deleteProductOnline(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

  if (!res.ok) {
    throw new Error("Failed deleting product");
  }
}

export async function clearCategoryOnline(
  name: string,
  token: string
): Promise<void> {
  const res = await fetch(
    buildApiUrl(`/api/categories/${encodeURIComponent(name)}`),
    {
      method: "DELETE",
      headers: authHeader(token),
    }
  );

  if (!res.ok) {
    throw new Error("Failed clearing category");
  }
}

/* ============================
 * INGREDIENTS / RECIPES
 * ============================ */

function normalizeIngredient(row: ApiRecord): Ingredient {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    baseUnit: row.baseUnit as IngredientBaseUnit,
    displayUnit: String(row.displayUnit ?? ""),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

function normalizeIngredientPrice(row: ApiRecord): IngredientPrice {
  return {
    id: String(row.id ?? ""),
    ingredientId: String(row.ingredientId ?? ""),
    ingredientName: String(row.ingredientName ?? ""),
    effectiveDate: String(row.effectiveDate ?? ""),
    pricePerDisplayUnit: Number(row.pricePerDisplayUnit ?? 0),
    displayUnit: String(row.displayUnit ?? ""),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
  };
}

function normalizeProductRecipeItem(row: ApiRecord): ProductRecipeItem {
  return {
    id: row.id ? String(row.id) : undefined,
    productId: String(row.productId ?? ""),
    ingredientId: String(row.ingredientId ?? ""),
    ingredientName: row.ingredientName ? String(row.ingredientName) : undefined,
    baseUnit: row.baseUnit as IngredientBaseUnit | undefined,
    displayUnit: row.displayUnit ? String(row.displayUnit) : undefined,
    isIngredientActive:
      typeof row.isIngredientActive === "boolean"
        ? row.isIngredientActive
        : undefined,
    quantityPerProduct: Number(row.quantityPerProduct ?? 0),
    unit: row.unit as IngredientBaseUnit,
  };
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchIngredientsOnline(
  token: string
): Promise<Ingredient[]> {
  const res = await fetch(buildApiUrl("/api/ingredients"), {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching ingredients", res.status);
    return [];
  }

  const data = (await res.json()) as ApiRecord[];
  return data.map(normalizeIngredient);
}

export async function createIngredientOnline(
  payload: {
    name: string;
    baseUnit: IngredientBaseUnit;
    displayUnit: string;
    isActive: boolean;
  },
  token: string
): Promise<Ingredient> {
  const res = await fetch(buildApiUrl("/api/ingredients"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed creating ingredient"));
  }

  return normalizeIngredient((await res.json()) as ApiRecord);
}

export async function updateIngredientOnline(
  id: string,
  payload: {
    name: string;
    baseUnit: IngredientBaseUnit;
    displayUnit: string;
    isActive: boolean;
  },
  token: string
): Promise<Ingredient> {
  const res = await fetch(buildApiUrl(`/api/ingredients/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed updating ingredient"));
  }

  return normalizeIngredient((await res.json()) as ApiRecord);
}

export async function deleteIngredientOnline(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/ingredients/${id}`), {
    method: "DELETE",
    headers: authHeader(token),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed deleting ingredient"));
  }
}

export async function fetchIngredientPricesOnline(
  token: string
): Promise<IngredientPrice[]> {
  const res = await fetch(buildApiUrl("/api/ingredient-prices"), {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching ingredient prices", res.status);
    return [];
  }

  const data = (await res.json()) as ApiRecord[];
  return data.map(normalizeIngredientPrice);
}

export async function createIngredientPriceOnline(
  payload: {
    ingredientId: string;
    effectiveDate: string;
    pricePerDisplayUnit: number;
  },
  token: string
): Promise<IngredientPrice> {
  const res = await fetch(buildApiUrl("/api/ingredient-prices"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, "Failed creating ingredient price")
    );
  }

  return normalizeIngredientPrice((await res.json()) as ApiRecord);
}

export async function updateIngredientPriceOnline(
  id: string,
  payload: {
    ingredientId: string;
    effectiveDate: string;
    pricePerDisplayUnit: number;
  },
  token: string
): Promise<IngredientPrice> {
  const res = await fetch(buildApiUrl(`/api/ingredient-prices/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, "Failed updating ingredient price")
    );
  }

  return normalizeIngredientPrice((await res.json()) as ApiRecord);
}

export async function fetchProductRecipeOnline(
  productId: string,
  token: string
): Promise<ProductRecipeItem[]> {
  const res = await fetch(buildApiUrl(`/api/products/${productId}/recipe`), {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching product recipe", res.status);
    return [];
  }

  const data = (await res.json()) as ApiRecord[];
  return data.map(normalizeProductRecipeItem);
}

export async function saveProductRecipeOnline(
  productId: string,
  recipeItems: Array<{
    ingredientId: string;
    quantityPerProduct: number;
    unit: IngredientBaseUnit;
  }>,
  token: string
): Promise<ProductRecipeItem[]> {
  const res = await fetch(buildApiUrl(`/api/products/${productId}/recipe`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify({ items: recipeItems }),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed saving recipe"));
  }

  const data = (await res.json()) as ApiRecord[];
  return data.map(normalizeProductRecipeItem);
}

/* ============================
 * USERS (ADMIN / SUPERADMIN)
 * ============================ */

export async function fetchUsersOnline(token: string): Promise<UserRow[]> {
  const res = await fetch(`${API_URL}/api/users`, {
    headers: authHeader(token),
  });

  if (!res.ok) {
    console.error("Failed fetching users", res.status);
    return [];
  }

  const data = await res.json();
  return (data as ApiRecord[]).map((u) => ({
    id: String(u.id),
    username: String(u.username ?? ""),
    full_name: u.full_name ? String(u.full_name) : "",
    role: u.role as UserRole,
    created_at: u.created_at ? String(u.created_at) : undefined,
  }));
}

export async function createUserOnline(
  payload: {
    username: string;
    password: string;
    full_name?: string;
    role: UserRole;
  },
  token: string
): Promise<UserRow> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed creating user");

  const u = await res.json();
  return {
    id: String(u.id),
    username: u.username,
    full_name: u.full_name ?? "",
    role: u.role as UserRole,
    created_at: u.created_at,
  };
}

export async function updateUserOnline(
  id: string,
  payload: {
    username?: string;
    password?: string;
    full_name?: string;
    role?: UserRole;
  },
  token: string
): Promise<UserRow> {
  const res = await fetch(`${API_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed updating user");

  const u = await res.json();
  return {
    id: String(u.id),
    username: u.username,
    full_name: u.full_name ?? "",
    role: u.role as UserRole,
    created_at: u.created_at,
  };
}

export async function deleteUserOnline(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

  if (!res.ok) throw new Error("Failed deleting user");
}

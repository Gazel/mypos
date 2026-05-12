// src/services/apiBackend.ts
import type { CartItem, Transaction, Product, UserRow, UserRole } from "../types";

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

// ===============================
// Product Types
// ===============================
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;        // optional display image
  category: string;
  stock: number;        // -1 means unlimited
  sort_order?: number;  // ordering index on POS screen
}

// ===============================
// Cart / POS Types
// ===============================
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

// ===============================
// Transaction Types
// ===============================
export type PaymentMethod = "cash" | "qris" | "cancelled";
export type TransactionStatus = "SUCCESS" | "CANCELLED";

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  date: string;               // ISO string from backend
  paymentMethod: PaymentMethod;
  cashReceived: number;
  change: number;
  customerName?: string;
  note?: string;
  status?: TransactionStatus; // used for CANCELLED
}

// ===============================
// User / Auth Types
// ===============================
export type UserRole = "superadmin" | "admin" | "cashier";

export interface UserRow {
  id: string;
  username: string;
  full_name?: string;
  role: UserRole;
  created_at?: string;
}

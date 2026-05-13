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

// ===============================
// Recipe / Ingredient Types
// ===============================
export type IngredientBaseUnit = "gram" | "ml" | "pcs";

export interface Ingredient {
  id: string;
  name: string;
  baseUnit: IngredientBaseUnit;
  displayUnit: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngredientPrice {
  id: string;
  ingredientId: string;
  ingredientName: string;
  effectiveDate: string;
  pricePerDisplayUnit: number;
  displayUnit: string;
  createdAt?: string;
}

export interface ProductRecipeItem {
  id?: string;
  productId: string;
  ingredientId: string;
  ingredientName?: string;
  baseUnit?: IngredientBaseUnit;
  displayUnit?: string;
  isIngredientActive?: boolean;
  quantityPerProduct: number;
  unit: IngredientBaseUnit;
}

// ===============================
// Recipe Usage Report Types
// ===============================
export type RecipeUsageWarningType =
  | "MISSING_RECIPE"
  | "MISSING_PRICE"
  | "INACTIVE_INGREDIENT";

export interface RecipeUsageWarning {
  type: RecipeUsageWarningType;
  message: string;
  productId?: string;
  productName?: string;
  ingredientId?: string;
  ingredientName?: string;
  date?: string;
}

export interface RecipeUsageIngredientRow {
  ingredientId: string;
  ingredientName: string;
  baseUnit: IngredientBaseUnit;
  displayUnit: string;
  usedBaseQty: number;
  usedDisplayQty: number;
  pricePerDisplayUnit: number;
  estimatedHpp: number;
}

export interface RecipeUsageProductRow {
  productId: string;
  productName: string;
  soldQty: number;
  totalSales: number;
  estimatedHppPerProduct: number;
  totalEstimatedHpp: number;
  estimatedGrossProfit: number;
  estimatedMargin: number;
  ingredients: RecipeUsageIngredientRow[];
}

export interface RecipeUsageReport {
  filters: {
    startDate: string;
    endDate: string;
  };
  summary: {
    transactionCount: number;
    totalSales: number;
    estimatedHpp: number;
    estimatedGrossProfit: number;
    estimatedMargin: number;
  };
  productUsage: RecipeUsageProductRow[];
  ingredientUsage: RecipeUsageIngredientRow[];
  warnings: RecipeUsageWarning[];
}

// ===============================
// Dashboard Report Types
// ===============================
export interface DashboardReportSummary {
  transactionCount: number;
  totalSales: number;
  averageBill: number;
  totalCash: number;
  totalQris: number;
  itemsSold: number;
}

export interface DashboardReportComparison {
  totalSales: number;
  transactionCount: number;
  averageBill: number;
  salesChangePct: number;
  transactionChangePct: number;
  averageBillChangePct: number;
}

export interface DashboardPaymentBreakdownRow {
  method: "cash" | "qris" | string;
  transactionCount: number;
  totalSales: number;
}

export interface DashboardTrendRow {
  date: string;
  transactionCount: number;
  totalSales: number;
}

export type DashboardSalesTrendMode = "daily" | "weekly" | "monthly";

export interface DashboardSalesTrendRow {
  key: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  totalSales: number;
}

export interface DashboardSalesTrendReport {
  mode: DashboardSalesTrendMode;
  filters: {
    startDate: string;
    endDate: string;
  };
  rows: DashboardSalesTrendRow[];
}

export interface DashboardTopProductRow {
  productId: string;
  productName: string;
  quantitySold: number;
  totalSales: number;
}

export interface DashboardRecentTransactionRow {
  id: string;
  date: string;
  total: number;
  paymentMethod: PaymentMethod | string;
  itemCount: number;
}

export interface DashboardInsight {
  key: string;
  label: string;
  value: string | number;
  unit: string;
  tone: "positive" | "negative" | "neutral";
  detail: string;
}

export interface DashboardReport {
  filters: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  summary: DashboardReportSummary;
  comparison: DashboardReportComparison;
  paymentBreakdown: DashboardPaymentBreakdownRow[];
  dailyTrend: DashboardTrendRow[];
  topProducts: DashboardTopProductRow[];
  recentTransactions: DashboardRecentTransactionRow[];
  insights: DashboardInsight[];
}

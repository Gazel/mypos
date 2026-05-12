// src/contexts/CartContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import { useLocation } from "react-router-dom";
import type { CartItem, Transaction } from "../types";
import {
  type FetchTransactionsOptions,
  fetchTransactionsOnline,
  saveTransactionOnline,
} from "../services/apiBackend";
import { useAuth } from "./AuthContext";

interface CartContextProps {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "subtotal">) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  discount: number;
  setDiscount: (discount: number) => void;

  transactions: Transaction[];
  reloadTransactions: (
    filters?: FetchTransactionsOptions
  ) => Promise<Transaction[]>;

  // ✅ IMPORTANT: must return saved trx (with id)
  addTransaction: (
    transaction: Omit<Transaction, "id">,
    tokenOverride?: string,
    idempotencyKey?: string
  ) => Promise<Transaction>;

  calculateTotal: () => { subtotal: number; total: number };
}

const CartContext = createContext<CartContextProps | undefined>(undefined);

function toInputDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function transactionMatchesFilters(
  transaction: Transaction,
  filters?: FetchTransactionsOptions
) {
  if (!filters || (!filters.date && !filters.startDate && !filters.endDate)) {
    return true;
  }

  const trxDate = toInputDate(transaction.date);
  if (!trxDate) return false;

  if (filters.date) return trxDate === filters.date;
  if (filters.startDate && trxDate < filters.startDate) return false;
  if (filters.endDate && trxDate > filters.endDate) return false;

  return true;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const { token, user } = useAuth();
  const location = useLocation();
  const [transactionFilters, setTransactionFilters] = useState<
    FetchTransactionsOptions | undefined
  >();

  const reloadTransactions = useCallback(
    async (filters?: FetchTransactionsOptions) => {
      setTransactionFilters(filters);

      if (!token) {
        setTransactions([]);
        return [];
      }

      const data = await fetchTransactionsOnline(token, filters);
      setTransactions(data);
      return data;
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setTransactions([]);
      setTransactionFilters(undefined);
      return;
    }

    if (location.pathname === "/") {
      reloadTransactions();
    } else if (location.pathname !== "/history") {
      setTransactions([]);
      setTransactionFilters(undefined);
    }
  }, [token, location.pathname, reloadTransactions]);

  const addToCart = (item: Omit<CartItem, "subtotal">) => {
    const existingItem = cart.find((i) => i.productId === item.productId);

    if (existingItem) {
      updateQuantity(item.productId, existingItem.quantity + item.quantity);
      return;
    }

    const newItem: CartItem = {
      ...item,
      subtotal: item.price * item.quantity,
    };
    setCart((prev) => [...prev, newItem]);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity, subtotal: item.price * quantity }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
    const total = subtotal - discount;
    return { subtotal, total: total < 0 ? 0 : total };
  };

  // ✅ FIXED: return saved trx with backend id
  const addTransaction = async (
    transaction: Omit<Transaction, "id">,
    tokenOverride?: string,
    idempotencyKey?: string
  ): Promise<Transaction> => {
    const authToken = tokenOverride || token;

    if (!authToken) {
      alert("Session login habis / belum login. Silakan login dulu.");
      throw new Error("Missing token");
    }

    const savedTrx = await saveTransactionOnline(
      transaction,
      authToken,
      idempotencyKey
    );

    setTransactions((prev) => {
      const withoutDuplicate = prev.filter((trx) => trx.id !== savedTrx.id);
      const cashierCanSee =
        user?.role !== "cashier" ||
        (savedTrx.status || "SUCCESS") === "SUCCESS";

      if (
        !cashierCanSee ||
        !transactionMatchesFilters(savedTrx, transactionFilters)
      ) {
        return withoutDuplicate;
      }

      return [savedTrx, ...withoutDuplicate];
    });

    clearCart();

    return savedTrx; // ✅ Cart.tsx needs this
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        discount,
        setDiscount,
        transactions,
        reloadTransactions,
        addTransaction,
        calculateTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};

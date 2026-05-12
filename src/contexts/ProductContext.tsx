import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from "react";
import type { Product } from "../types";
import {
  fetchProductsOnline,
  createProductOnline,
  updateProductOnline,
  deleteProductOnline
} from "../services/apiBackend";
import { useAuth } from "./AuthContext";

interface ProductContextProps {
  products: Product[];
  categories: string[];
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, product: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  reloadProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextProps | undefined>(
  undefined
);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { token } = useAuth(); // ✅ JWT token
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const recalcCategories = (list: Product[]) => {
    const cats = Array.from(
      new Set(
        list
          .map((p) => p.category)
          .filter((c): c is string => !!c && c.trim() !== "")
      )
    ).sort();
    setCategories(cats);
  };

  const reloadProducts = useCallback(async () => {
    if (!token) return; // wait for login
    try {
      const data = await fetchProductsOnline(token);
      setProducts(data);
      recalcCategories(data);
    } catch (err) {
      console.error("Failed to reload products", err);
    }
  }, [token]);

  useEffect(() => {
    reloadProducts();
  }, [reloadProducts]);

  const addProduct = async (product: Omit<Product, "id">) => {
    if (!token) throw new Error("Missing token");
    const saved = await createProductOnline(product, token);
    setProducts((prev) => {
      const updated = [...prev, saved];
      recalcCategories(updated);
      return updated;
    });
  };

  const updateProduct = async (id: string, product: Omit<Product, "id">) => {
    if (!token) throw new Error("Missing token");
    const saved = await updateProductOnline(id, product, token);
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === id ? saved : p));
      recalcCategories(updated);
      return updated;
    });
  };

  const deleteProduct = async (id: string) => {
    if (!token) throw new Error("Missing token");
    await deleteProductOnline(id, token);
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      recalcCategories(updated);
      return updated;
    });
  };

  const getProductById = (id: string) =>
    products.find((p) => p.id === id);

  return (
    <ProductContext.Provider
      value={{
        products,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductById,
        reloadProducts
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useProducts = () => {
  const ctx = useContext(ProductContext);
  if (!ctx) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return ctx;
};

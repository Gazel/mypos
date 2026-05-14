// src/pages/SettingsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useProducts } from "../contexts/ProductContext";
import { useAuth } from "../contexts/AuthContext";

import { Plus, Edit2, Trash2, Save, Users, GripVertical } from "lucide-react";
import Button from "../components/UI/Button";
import Input from "../components/UI/Input";
import Modal from "../components/UI/Modal";
import { useModal } from "../components/UI/useModal";
import { formatCurrency } from "../utils/formatter";

import {
  fetchUsersOnline,
  createUserOnline,
  updateUserOnline,
  deleteUserOnline,
  clearCategoryOnline,
  createIngredientOnline,
  createIngredientPriceOnline,
  deleteIngredientOnline,
  fetchIngredientPricesOnline,
  fetchIngredientsOnline,
  fetchProductRecipeOnline,
  saveProductRecipeOnline,
  updateIngredientOnline,
  updateIngredientPriceOnline,
} from "../services/apiBackend";

// drag & drop
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Ingredient,
  IngredientBaseUnit,
  IngredientPrice,
  Product,
  UserRole,
  UserRow,
} from "../types";

type ProductFormData = {
  name: string;
  price: string;
  image: string;
  category: string;
  stock: string;
};

type ProductFormErrorKey = keyof ProductFormData;
type ProductFormErrors = Partial<Record<ProductFormErrorKey, string>>;
type UserFormErrors = Partial<Record<"username" | "password", string>>;
type IngredientFormErrors = Partial<Record<"name" | "displayUnit", string>>;
type IngredientPriceFormErrors = Partial<
  Record<"ingredientId" | "effectiveDate" | "pricePerDisplayUnit", string>
>;
type UpdateUserPayload = {
  username: string;
  full_name: string;
  role: UserRole;
  password?: string;
};

type IngredientFormData = {
  name: string;
  baseUnit: IngredientBaseUnit;
  displayUnit: string;
};

type IngredientPriceFormData = {
  ingredientId: string;
  effectiveDate: string;
  pricePerDisplayUnit: string;
};

type RecipeFormItem = {
  ingredientId: string;
  quantityPerProduct: string;
  unit: IngredientBaseUnit;
};

type SettingsTab = "products" | "ingredients" | "users";
type ProductModalTab = "product" | "recipe";

const unitOptions: IngredientBaseUnit[] = ["gram", "ml", "pcs"];
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "products", label: "Pengaturan Produk" },
  { id: "ingredients", label: "Pengaturan Bahan" },
  { id: "users", label: "Manajemen User" },
];

function createEmptyRecipeItem(): RecipeFormItem {
  return {
    ingredientId: "",
    quantityPerProduct: "",
    unit: "gram",
  };
}

function isRecipeItemEmpty(item: RecipeFormItem) {
  return !item.ingredientId && !item.quantityPerProduct.trim();
}

function hasRecipeItemInput(item: RecipeFormItem) {
  return !isRecipeItemEmpty(item);
}

function normalizeRecipeDraftRows(items: RecipeFormItem[]) {
  const filledRows = items.filter((item) => !isRecipeItemEmpty(item));
  return [...filledRows, createEmptyRecipeItem()];
}

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultDisplayUnit(baseUnit: IngredientBaseUnit) {
  if (baseUnit === "gram") return "kg";
  if (baseUnit === "ml") return "liter";
  return "pcs";
}

function getPricePerBaseUnit(
  ingredient: Ingredient | undefined,
  latestPrice: IngredientPrice | undefined
) {
  if (!ingredient || !latestPrice) return null;
  const displayUnit = latestPrice.displayUnit.toLowerCase();

  if (ingredient.baseUnit === "gram" && displayUnit === "kg") {
    return latestPrice.pricePerDisplayUnit / 1000;
  }

  if (ingredient.baseUnit === "ml" && displayUnit === "liter") {
    return latestPrice.pricePerDisplayUnit / 1000;
  }

  return latestPrice.pricePerDisplayUnit;
}

type SortableRowProps = {
  productId: string;
  children: (args: {
    setNodeRef: ReturnType<typeof useSortable>["setNodeRef"];
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    transform: ReturnType<typeof useSortable>["transform"];
    transition: ReturnType<typeof useSortable>["transition"];
    isDragging: ReturnType<typeof useSortable>["isDragging"];
  }) => React.ReactNode;
};

function SortableRow({ productId, children }: SortableRowProps) {
  const {
    setNodeRef,
    attributes,
        listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: productId });

  return (
    <>
      {children({
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
      })}
    </>
  );
}

const SettingsPage: React.FC = () => {
  const { token, user, hasRole } = useAuth();

  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const canAccessSettings = hasRole("admin", "superadmin");
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTab>("products");

  // -------------------------------------------------
  // PRODUCTS
  // -------------------------------------------------
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    reloadProducts,
  } = useProducts();

  const {
    isOpen: isProductModalOpen,
    openModal: openProductModal,
    closeModal: closeProductModal,
  } = useModal();

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalTab, setProductModalTab] =
    useState<ProductModalTab>("product");
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    price: "",
    image: "",
    category: "",
    stock: "",
  });
  const [newCategory, setNewCategory] = useState("");
  const [errors, setErrors] = useState<ProductFormErrors>({});

  // ordering state
  const [orderedProducts, setOrderedProducts] = useState(products);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => setOrderedProducts(products), [products]);

  const orderedIds = useMemo(
    () => orderedProducts.map((p) => p.id),
    [orderedProducts]
  );
  const originalIds = useMemo(() => products.map((p) => p.id), [products]);

  const orderChanged = useMemo(() => {
    if (orderedIds.length !== originalIds.length) return true;
    for (let i = 0; i < orderedIds.length; i++) {
      if (orderedIds[i] !== originalIds[i]) return true;
    }
    return false;
  }, [orderedIds, originalIds]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isProductModalOpen) {
      setEditingProduct(null);
      setFormData({
        name: "",
        price: "",
        image: "",
        category: "",
        stock: "",
      });
      setNewCategory("");
      setErrors({});
    }
  }, [isProductModalOpen]);

  const openAddModal = () => {
    setEditingProduct(null);
    setProductModalTab("product");
    setFormData({
      name: "",
      price: "",
      image: "",
      category: "",
      stock: "",
    });
    setNewCategory("");
    setErrors({});
    openProductModal();
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setProductModalTab("product");
    setFormData({
      name: product.name,
      price: product.price.toString(),
      image: product.image,
      category: product.category,
      stock: product.stock === -1 ? "" : product.stock?.toString() ?? "",
    });
    setNewCategory("");
    setErrors({});
    openProductModal();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const name = e.target.name as ProductFormErrorKey;
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
      const n = { ...prev };
      delete n[name];
      return n;
      });
    }
  };

  const validateForm = () => {
    const n: ProductFormErrors = {};

    if (!formData.name.trim()) n.name = "Nama produk tidak boleh kosong";
    if (!formData.price.trim()) n.price = "Harga tidak boleh kosong";
    else if (isNaN(Number(formData.price)) || Number(formData.price) <= 0)
      n.price = "Harga harus berupa angka positif";

    const finalCategory = newCategory.trim()
      ? newCategory.trim()
      : formData.category;
    if (!finalCategory.trim())
      n.category = "Kategori harus dipilih atau dibuat";

    if (formData.stock.trim()) {
      const stockNum = parseInt(formData.stock, 10);
      if (isNaN(stockNum) || stockNum < 0) {
        n.stock = "Stok harus berupa angka 0 atau lebih";
      }
    }

    setErrors(n);
    return Object.keys(n).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalCategory = newCategory.trim()
      ? newCategory.trim()
      : formData.category;

    const stockValue = formData.stock.trim()
      ? parseInt(formData.stock, 10)
      : -1;

    const payload = {
      name: formData.name.trim(),
      price: Number(formData.price),
      image: formData.image,
      category: finalCategory,
      stock: stockValue,
      sort_order: editingProduct?.sort_order ?? 0,
    };

    try {
      if (editingProduct) await updateProduct(editingProduct.id, payload);
      else await addProduct(payload);

      await reloadProducts();
      closeProductModal();
    } catch (e) {
      console.error(e);
      alert("Gagal simpan produk.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Anda yakin ingin menghapus produk ini?")) return;
    try {
      await deleteProduct(productId);
      await reloadProducts();
    } catch (e) {
      console.error(e);
      alert("Gagal hapus produk.");
    }
  };

  // Delete category handler
  const deleteCategory = async (cat: string) => {
    if (!token) return alert("Session login habis / belum login.");
    if (
      !window.confirm(
        `Hapus kategori "${cat}"?\nSemua produk dalam kategori ini akan jadi kosong.`
      )
    )
      return;

    try {
      await clearCategoryOnline(cat, token);
      await reloadProducts();
    } catch (e) {
      console.error(e);
      alert("Gagal hapus kategori.");
    }
  };

  // ==========================
  // ORDERING (DND)
  // ==========================
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedProducts((items) => {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const newIndex = items.findIndex((i) => i.id === overId);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const saveOrder = async () => {
    if (isSavingOrder || !orderChanged) return;
    setIsSavingOrder(true);

    try {
      await Promise.all(
        orderedProducts.map((p, idx) =>
          updateProduct(p.id, {
            name: p.name,
            price: p.price,
            image: p.image,
            category: p.category,
            stock: p.stock,
            sort_order: idx,
          })
        )
      );

      await reloadProducts();
      alert("Urutan produk berhasil disimpan!");
    } catch (e) {
      console.error(e);
      alert("Gagal simpan urutan produk.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // -------------------------------------------------
  // INGREDIENTS / PRICES / RECIPES
  // -------------------------------------------------
  const {
    isOpen: isIngredientModalOpen,
    openModal: openIngredientModal,
    closeModal: closeIngredientModal,
  } = useModal();
  const {
    isOpen: isIngredientPriceModalOpen,
    openModal: openIngredientPriceModal,
    closeModal: closeIngredientPriceModal,
  } = useModal();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientPrices, setIngredientPrices] = useState<IngredientPrice[]>(
    []
  );
  const [editingIngredient, setEditingIngredient] =
    useState<Ingredient | null>(null);
  const [editingIngredientPrice, setEditingIngredientPrice] =
    useState<IngredientPrice | null>(null);
  const [ingredientForm, setIngredientForm] = useState<IngredientFormData>({
    name: "",
    baseUnit: "gram",
    displayUnit: "kg",
  });
  const [ingredientErrors, setIngredientErrors] =
    useState<IngredientFormErrors>({});
  const [ingredientPriceForm, setIngredientPriceForm] =
    useState<IngredientPriceFormData>({
      ingredientId: "",
      effectiveDate: todayInputValue(),
      pricePerDisplayUnit: "",
    });
  const [ingredientPriceErrors, setIngredientPriceErrors] =
    useState<IngredientPriceFormErrors>({});
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeFormItem[]>([]);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [isRecipeSaving, setIsRecipeSaving] = useState(false);
  const [recipeError, setRecipeError] = useState("");

  const loadRecipeSetupData = useCallback(async () => {
    if (!token || !canAccessSettings) return;

    try {
      const [ingredientRows, priceRows] = await Promise.all([
        fetchIngredientsOnline(token),
        fetchIngredientPricesOnline(token),
      ]);
      setIngredients(ingredientRows);
      setIngredientPrices(priceRows);
    } catch (err) {
      console.error(err);
      alert("Gagal memuat data bahan baku.");
    }
  }, [canAccessSettings, token]);

  useEffect(() => {
    loadRecipeSetupData();
  }, [loadRecipeSetupData]);

  const availableIngredients = ingredients;

  const latestPriceByIngredientId = useMemo(() => {
    const sortedPrices = [...ingredientPrices].sort((a, b) => {
      const dateDiff =
        new Date(b.effectiveDate).getTime() -
        new Date(a.effectiveDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return Number(b.id) - Number(a.id);
    });
    const map = new Map<string, IngredientPrice>();

    sortedPrices.forEach((price) => {
      if (!map.has(price.ingredientId)) {
        map.set(price.ingredientId, price);
      }
    });

    return map;
  }, [ingredientPrices]);

  const ingredientById = useMemo(() => {
    const map = new Map<string, Ingredient>();
    ingredients.forEach((ingredient) => map.set(ingredient.id, ingredient));
    return map;
  }, [ingredients]);

  useEffect(() => {
    if (!isIngredientModalOpen) {
      setEditingIngredient(null);
      setIngredientForm({
        name: "",
        baseUnit: "gram",
        displayUnit: "kg",
      });
      setIngredientErrors({});
    }
  }, [isIngredientModalOpen]);

  useEffect(() => {
    if (!isIngredientPriceModalOpen) {
      setIngredientPriceForm({
        ingredientId: "",
        effectiveDate: todayInputValue(),
        pricePerDisplayUnit: "",
      });
      setEditingIngredientPrice(null);
      setIngredientPriceErrors({});
    }
  }, [isIngredientPriceModalOpen]);

  useEffect(() => {
    if (!isProductModalOpen) {
      setProductModalTab("product");
      setRecipeProduct(null);
      setRecipeItems([]);
      setRecipeError("");
      setIsRecipeLoading(false);
      setIsRecipeSaving(false);
    }
  }, [isProductModalOpen]);

  useEffect(() => {
    if (!token || !isProductModalOpen || !editingProduct) return;

    let cancelled = false;
    setRecipeProduct(editingProduct);
    setRecipeItems([createEmptyRecipeItem()]);
    setRecipeError("");
    setIsRecipeLoading(true);

    fetchProductRecipeOnline(editingProduct.id, token)
      .then((rows) => {
        if (cancelled) return;
        setRecipeItems(
          normalizeRecipeDraftRows(
            rows.map((item) => ({
              ingredientId: item.ingredientId,
              quantityPerProduct: String(item.quantityPerProduct),
              unit: item.unit,
            }))
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setRecipeError("Gagal memuat resep produk.");
      })
      .finally(() => {
        if (!cancelled) setIsRecipeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingProduct, isProductModalOpen, token]);

  const openAddIngredientModal = () => {
    setEditingIngredient(null);
    setIngredientForm({
      name: "",
      baseUnit: "gram",
      displayUnit: "kg",
    });
    setIngredientErrors({});
    openIngredientModal();
  };

  const openEditIngredientModal = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setIngredientForm({
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      displayUnit: ingredient.displayUnit,
    });
    setIngredientErrors({});
    openIngredientModal();
  };

  const handleIngredientFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "baseUnit") {
      const baseUnit = value as IngredientBaseUnit;
      setIngredientForm((prev) => ({
        ...prev,
        baseUnit,
        displayUnit: defaultDisplayUnit(baseUnit),
      }));
      return;
    }

    setIngredientForm((prev) => ({ ...prev, [name]: value }));
    if (name === "name" || name === "displayUnit") {
      setIngredientErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateIngredientForm = () => {
    const nextErrors: IngredientFormErrors = {};
    if (!ingredientForm.name.trim()) nextErrors.name = "Nama bahan wajib diisi";
    if (!ingredientForm.displayUnit.trim()) {
      nextErrors.displayUnit = "Display unit wajib diisi";
    }

    setIngredientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitIngredient = async () => {
    if (!token || !validateIngredientForm()) return;

    const payload = {
      name: ingredientForm.name.trim(),
      baseUnit: ingredientForm.baseUnit,
      displayUnit: ingredientForm.displayUnit.trim(),
      isActive: true,
    };

    try {
      if (editingIngredient) {
        await updateIngredientOnline(editingIngredient.id, payload, token);
      } else {
        await createIngredientOnline(payload, token);
      }

      closeIngredientModal();
      await loadRecipeSetupData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Gagal menyimpan bahan.");
    }
  };

  const deleteIngredient = async (ingredient: Ingredient) => {
    if (!token) return;
    if (
      !window.confirm(
        `Hapus bahan "${ingredient.name}"? Harga dan baris resep yang memakai bahan ini juga akan dihapus.`
      )
    ) {
      return;
    }

    try {
      await deleteIngredientOnline(ingredient.id, token);
      await loadRecipeSetupData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Gagal menghapus bahan.");
    }
  };

  const openAddIngredientPriceModal = (ingredient?: Ingredient) => {
    setEditingIngredientPrice(null);
    setIngredientPriceForm({
      ingredientId: ingredient?.id || "",
      effectiveDate: todayInputValue(),
      pricePerDisplayUnit: "",
    });
    setIngredientPriceErrors({});
    openIngredientPriceModal();
  };

  const openEditIngredientPriceModal = (
    ingredient: Ingredient,
    price: IngredientPrice
  ) => {
    setEditingIngredientPrice(price);
    setIngredientPriceForm({
      ingredientId: ingredient.id,
      effectiveDate: price.effectiveDate,
      pricePerDisplayUnit: String(price.pricePerDisplayUnit),
    });
    setIngredientPriceErrors({});
    openIngredientPriceModal();
  };

  const handleIngredientPriceFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setIngredientPriceForm((prev) => ({ ...prev, [name]: value }));

    if (
      name === "ingredientId" ||
      name === "effectiveDate" ||
      name === "pricePerDisplayUnit"
    ) {
      setIngredientPriceErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateIngredientPriceForm = () => {
    const nextErrors: IngredientPriceFormErrors = {};
    if (!ingredientPriceForm.ingredientId) {
      nextErrors.ingredientId = "Bahan wajib dipilih";
    }
    if (!ingredientPriceForm.effectiveDate) {
      nextErrors.effectiveDate = "Tanggal berlaku wajib diisi";
    }
    if (
      !ingredientPriceForm.pricePerDisplayUnit.trim() ||
      Number(ingredientPriceForm.pricePerDisplayUnit) <= 0
    ) {
      nextErrors.pricePerDisplayUnit = "Harga harus lebih dari 0";
    }

    setIngredientPriceErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitIngredientPrice = async () => {
    if (!token || !validateIngredientPriceForm()) return;

    const payload = {
      ingredientId: ingredientPriceForm.ingredientId,
      effectiveDate: ingredientPriceForm.effectiveDate,
      pricePerDisplayUnit: Number(ingredientPriceForm.pricePerDisplayUnit),
    };
    const existingPrice = ingredientPrices.find(
      (price) =>
        price.ingredientId === payload.ingredientId &&
        price.effectiveDate === payload.effectiveDate
    );

    try {
      if (editingIngredientPrice) {
        await updateIngredientPriceOnline(editingIngredientPrice.id, payload, token);
      } else if (existingPrice) {
        await updateIngredientPriceOnline(existingPrice.id, payload, token);
      } else {
        await createIngredientPriceOnline(payload, token);
      }

      closeIngredientPriceModal();
      await loadRecipeSetupData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Gagal menyimpan harga bahan.");
    }
  };

  const updateRecipeItem = (
    index: number,
    field: keyof RecipeFormItem,
    value: string
  ) => {
    setRecipeItems((prev) => {
      const next = prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "ingredientId") {
          const ingredient = ingredientById.get(value);
          return {
            ...item,
            ingredientId: value,
            unit: ingredient?.baseUnit || item.unit,
          };
        }

        return {
          ...item,
          [field]: field === "unit" ? (value as IngredientBaseUnit) : value,
        };
      });

      return normalizeRecipeDraftRows(next);
    });
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems((prev) =>
      normalizeRecipeDraftRows(
        prev.filter((_, itemIndex) => itemIndex !== index)
      )
    );
  };

  const estimateRecipeItemHpp = useCallback(
    (item: RecipeFormItem) => {
      const ingredient = ingredientById.get(item.ingredientId);
      const latestPrice = latestPriceByIngredientId.get(item.ingredientId);
      const pricePerBaseUnit = getPricePerBaseUnit(ingredient, latestPrice);
      const qty = Number(item.quantityPerProduct);

      if (!pricePerBaseUnit || !Number.isFinite(qty) || qty <= 0) return null;
      return qty * pricePerBaseUnit;
    },
    [ingredientById, latestPriceByIngredientId]
  );

  const estimatedRecipeTotal = useMemo(
    () =>
      recipeItems.filter(hasRecipeItemInput).reduce((sum, item) => {
        const estimated = estimateRecipeItemHpp(item);
        return sum + (estimated ?? 0);
      }, 0),
    [estimateRecipeItemHpp, recipeItems]
  );

  const recipeRowsForSave = useCallback(
    () => recipeItems.filter(hasRecipeItemInput),
    [recipeItems]
  );

  const validateRecipeItems = () => {
    const seen = new Set<string>();
    const rows = recipeRowsForSave();

    for (const item of rows) {
      if (!item.ingredientId) {
        setRecipeError("Semua baris resep harus memilih bahan.");
        return false;
      }

      if (seen.has(item.ingredientId)) {
        setRecipeError("Bahan tidak boleh duplikat dalam satu resep.");
        return false;
      }

      const qty = Number(item.quantityPerProduct);
      if (!Number.isFinite(qty) || qty <= 0) {
        setRecipeError("Qty per porsi harus lebih dari 0.");
        return false;
      }

      const ingredient = ingredientById.get(item.ingredientId);
      if (!ingredient || ingredient.baseUnit !== item.unit) {
        setRecipeError("Unit resep harus sama dengan base unit bahan.");
        return false;
      }

      seen.add(item.ingredientId);
    }

    setRecipeError("");
    return true;
  };

  const submitRecipe = async () => {
    if (!token || !recipeProduct || !validateRecipeItems()) return;

    const rows = recipeRowsForSave();

    setIsRecipeSaving(true);
    try {
      await saveProductRecipeOnline(
        recipeProduct.id,
        rows.map((item) => ({
          ingredientId: item.ingredientId,
          quantityPerProduct: Number(item.quantityPerProduct),
          unit: item.unit,
        })),
        token
      );
      closeProductModal();
    } catch (err) {
      console.error(err);
      setRecipeError(
        err instanceof Error ? err.message : "Gagal menyimpan resep."
      );
    } finally {
      setIsRecipeSaving(false);
    }
  };

  // -------------------------------------------------
  // USERS (ADMIN / SUPERADMIN)
  // -------------------------------------------------
  const {
    isOpen: isUserModalOpen,
    openModal: openUserModal,
    closeModal: closeUserModal,
  } = useModal();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userErrors, setUserErrors] = useState<UserFormErrors>({});
  const [userForm, setUserForm] = useState<{
    username: string;
    full_name: string;
    password: string;
    role: UserRole;
  }>({
    username: "",
    full_name: "",
    password: "",
    role: "cashier",
  });

  const loadUsers = useCallback(async () => {
    if (!token || !canAccessSettings) return;
    try {
      const data = await fetchUsersOnline(token);
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  }, [token, canAccessSettings]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({
      username: "",
      full_name: "",
      password: "",
      role: "cashier",
    });
    setUserErrors({});
    openUserModal();
  };

  const openEditUserModal = (u: UserRow) => {
    // admin tidak boleh edit user superadmin
    if (!isSuperadmin && u.role === "superadmin") {
      alert("Hanya superadmin yang dapat mengedit user superadmin.");
      return;
    }

    setEditingUser(u);
    setUserForm({
      username: u.username,
      full_name: u.full_name || "",
      password: "",
      role: u.role as UserRole,
    });
    setUserErrors({});
    openUserModal();
  };

  const handleUserInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserForm((p) => ({
      ...p,
      [name]: name === "role" ? (value as UserRole) : value,
    }));

    if (name === "username" || name === "password") {
      if (!userErrors[name]) return;
      setUserErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
    }
  };

  const validateUserForm = () => {
    const e: Record<string, string> = {};
    if (!userForm.username.trim()) e.username = "Username wajib diisi";

    const isEditing = !!editingUser;
    const editingSelf = editingUser && user && editingUser.id === user.id;

    const canEditPassword =
      isSuperadmin ||
      (isEditing && editingSelf && (isAdmin || isSuperadmin)) ||
      (!isEditing && hasRole("admin", "superadmin")); // new user

    if (!isEditing) {
      if (!userForm.password.trim()) {
        e.password = "Password wajib diisi untuk user baru";
      }
    } else if (userForm.password.trim() && !canEditPassword) {
      e.password = "Anda tidak dapat mengubah password user ini";
    }

    setUserErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitUser = async () => {
    if (!token) return;
    if (!validateUserForm()) return;

    const isEditing = !!editingUser;
    const editingSelf = editingUser && user && editingUser.id === user.id;
    const canEditPassword =
      isSuperadmin ||
      (isEditing && editingSelf && (isAdmin || isSuperadmin)) ||
      (!isEditing && hasRole("admin", "superadmin"));

    try {
      if (editingUser) {
        const payload: UpdateUserPayload = {
          username: userForm.username.trim(),
          full_name: userForm.full_name.trim(),
          role: userForm.role,
        };

        if (canEditPassword && userForm.password.trim()) {
          payload.password = userForm.password;
        }

        await updateUserOnline(editingUser.id, payload, token);
      } else {
        await createUserOnline(
          {
            username: userForm.username.trim(),
            full_name: userForm.full_name.trim(),
            password: userForm.password,
            role: userForm.role,
          },
          token
        );
      }

      closeUserModal();
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan user. Coba lagi.");
    }
  };

  const removeUser = async (u: UserRow) => {
    if (!token) return;

    // tidak boleh menghapus diri sendiri
    if (user && u.id === user.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    // admin tidak boleh hapus superadmin
    if (!isSuperadmin && u.role === "superadmin") {
      alert("Hanya superadmin yang dapat menghapus user superadmin.");
      return;
    }

    if (!window.confirm(`Hapus user "${u.username}"?`)) return;

    try {
      await deleteUserOnline(u.id, token);
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus user.");
    }
  };

  // -------------------------------------------------
  // GUARD: hanya admin & superadmin boleh ke halaman ini
  // -------------------------------------------------
  if (!canAccessSettings) {
    return (
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Akses ditolak
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Halaman pengaturan hanya dapat diakses oleh admin atau superadmin.
        </p>
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola produk, bahan, harga bahan, dan akun staf.
          </p>
        </div>

        <div
          className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
          role="tablist"
          aria-label="Settings sections"
        >
          {settingsTabs.map((tab, index) => {
            const isActive = activeSettingsTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`whitespace-nowrap px-3 py-2 text-sm transition-colors ${
                  index > 0 ? "border-l border-gray-300 dark:border-gray-700" : ""
                } ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= PRODUCTS ================= */}
      {activeSettingsTab === "products" && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Pengaturan Produk</h1>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={saveOrder}
              disabled={!orderChanged || isSavingOrder || products.length === 0}
            >
              <Save size={16} className="mr-1" />
              {isSavingOrder ? "Saving..." : "Save Order"}
            </Button>

            <Button variant="primary" onClick={openAddModal}>
              <Plus size={16} className="mr-1" />
              Tambah Produk
            </Button>
          </div>
        </div>

        {/* CATEGORY LIST (compact) */}
        {categories.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-3">
            <div className="text-sm font-semibold mb-2">Kategori</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
                >
                  <span className="truncate max-w-[160px]">{cat}</span>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800"
                    title="Delete category"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Menghapus kategori akan mengosongkan kategori pada semua produk di
              dalamnya.
            </p>
          </div>
        )}

        {/* PRODUCTS TABLE + DND */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={orderedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="w-10 px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nama
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Harga
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Stok
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Aksi (Drag)
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {orderedProducts.map((product, idx) => (
                      <SortableRow key={product.id} productId={product.id}>
                        {({
                          setNodeRef,
                          attributes,
                          listeners,
                          transform,
                          transition,
                          isDragging,
                        }) => (
                          <tr
                            ref={setNodeRef}
                            style={{
                              transform: CSS.Transform.toString(transform),
                              transition,
                              opacity: isDragging ? 0.6 : 1,
                            }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                          >
                            <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {product.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {product.category || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(product.price)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {product.stock === -1
                                ? "Unlimited"
                                : product.stock}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                className="inline-flex items-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 mr-2 cursor-grab active:cursor-grabbing"
                                {...attributes}
                                {...listeners}
                                title="Drag to reorder"
                              >
                                <GripVertical size={16} />
                              </button>

                              <button
                                onClick={() => openEditModal(product)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )}
                      </SortableRow>
                    ))}

                    {orderedProducts.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                        >
                          Belum ada produk
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Product Modal */}
        <Modal
          isOpen={isProductModalOpen}
          onClose={closeProductModal}
          title={editingProduct ? "Edit Produk" : "Tambah Produk"}
          footer={
            <>
              <Button variant="secondary" onClick={closeProductModal}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={productModalTab === "recipe" ? submitRecipe : handleSubmit}
                disabled={
                  productModalTab === "recipe" &&
                  (isRecipeSaving || isRecipeLoading)
                }
              >
                <Save size={16} className="mr-1" />
                {productModalTab === "recipe"
                  ? isRecipeSaving
                    ? "Saving..."
                    : "Simpan Resep"
                  : "Simpan"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {editingProduct && (
              <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                <button
                  onClick={() => setProductModalTab("product")}
                  className={`px-3 py-2 text-sm ${
                    productModalTab === "product"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  Edit Produk
                </button>
                <button
                  onClick={() => setProductModalTab("recipe")}
                  className={`px-3 py-2 text-sm border-l border-gray-300 dark:border-gray-700 ${
                    productModalTab === "recipe"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  Edit Resep
                </button>
              </div>
            )}

            {productModalTab === "product" ? (
              <>
                <Input
                  id="name"
                  name="name"
                  label="Nama Produk"
                  value={formData.name}
                  onChange={handleInputChange}
                  error={errors.name}
                  required
                />

                <Input
                  id="price"
                  name="price"
                  label="Harga"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  error={errors.price}
                  required
                />

                <div className="mb-4">
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Kategori<span className="text-red-500 ml-1">*</span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border ${
                        errors.category
                          ? "border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                      } rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                      disabled={!!newCategory}
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>

                    <Input
                      id="newCategory"
                      name="newCategory"
                      label="Atau Buat Kategori Baru"
                      placeholder="Kategori baru..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="mb-0"
                    />
                  </div>

                  {errors.category && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.category}
                    </p>
                  )}
                </div>

                <Input
                  id="stock"
                  name="stock"
                  label="Stok (Opsional, kosong = Unlimited)"
                  type="number"
                  value={formData.stock}
                  onChange={handleInputChange}
                  error={errors.stock}
                  placeholder="Kosongkan untuk stok unlimited"
                />
              </>
            ) : (
              <div className="space-y-4">
                {recipeError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {recipeError}
                  </div>
                )}

                {availableIngredients.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Tambahkan bahan baku terlebih dahulu.
                  </div>
                ) : isRecipeLoading ? (
                  <div className="text-sm text-gray-500">Memuat resep...</div>
                ) : (
                  <div className="space-y-3">
                    {recipeItems.map((item, index) => {
                      const ingredient = ingredientById.get(item.ingredientId);
                      const estimated = estimateRecipeItemHpp(item);
                      const hasInput = hasRecipeItemInput(item);

                      return (
                        <div
                          key={`${item.ingredientId || "empty"}-${index}`}
                          className="rounded-md border border-gray-200 p-3 space-y-2"
                        >
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Bahan
                            </label>
                            <select
                              value={item.ingredientId}
                              onChange={(e) =>
                                updateRecipeItem(
                                  index,
                                  "ingredientId",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                            >
                              <option value="">-- Pilih Bahan --</option>
                              {availableIngredients.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-xs text-gray-500">
                              Qty / Porsi
                              <input
                                type="number"
                                value={item.quantityPerProduct}
                                onChange={(e) =>
                                  updateRecipeItem(
                                    index,
                                    "quantityPerProduct",
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full px-2 py-2 border border-gray-300 rounded-md bg-white text-sm"
                              />
                            </label>

                            <label className="text-xs text-gray-500">
                              Unit
                              <select
                                value={item.unit}
                                onChange={(e) =>
                                  updateRecipeItem(index, "unit", e.target.value)
                                }
                                className="mt-1 w-full px-2 py-2 border border-gray-300 rounded-md bg-white text-sm"
                              >
                                {unitOptions.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="text-xs text-gray-500">
                              Est. HPP
                              <div className="mt-1 min-h-[38px] flex items-center text-sm font-semibold text-gray-900">
                                {estimated === null
                                  ? "-"
                                  : formatCurrency(Math.round(estimated))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                              {ingredient
                                ? `Display: ${ingredient.displayUnit}`
                                : "Pilih bahan"}
                            </div>
                            {hasInput && (
                              <button
                                onClick={() => removeRecipeItem(index)}
                                className="text-xs font-semibold text-red-600"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t pt-3 text-sm font-semibold">
                  Total Estimasi HPP / Porsi:{" "}
                  {formatCurrency(Math.round(estimatedRecipeTotal))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </section>
      )}

      {/* ================= INGREDIENTS ================= */}
      {activeSettingsTab === "ingredients" && (
      <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Bahan Baku</h2>

          <Button variant="primary" onClick={openAddIngredientModal}>
            <Plus size={16} className="mr-1" />
            Tambah Bahan
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bahan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Base Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Display Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ingredients.map((ingredient) => (
                  <tr
                    key={ingredient.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {ingredient.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {ingredient.baseUnit}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {ingredient.displayUnit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      <button
                        onClick={() => openEditIngredientModal(ingredient)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteIngredient(ingredient)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

                {ingredients.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      Belum ada bahan baku
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= INGREDIENT PRICES ================= */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Harga Bahan</h2>

          <Button
            variant="primary"
            onClick={() => openAddIngredientPriceModal()}
            disabled={availableIngredients.length === 0}
          >
            <Plus size={16} className="mr-1" />
            Tambah Harga
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bahan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Harga Terakhir
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Berlaku Sejak
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ingredients.map((ingredient) => {
                  const latestPrice = latestPriceByIngredientId.get(
                    ingredient.id
                  );

                  return (
                    <tr
                      key={ingredient.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {ingredient.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {latestPrice
                          ? `${formatCurrency(
                              latestPrice.pricePerDisplayUnit
                            )} / ${latestPrice.displayUnit}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {latestPrice?.effectiveDate || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {latestPrice && (
                          <button
                            onClick={() =>
                              openEditIngredientPriceModal(
                                ingredient,
                                latestPrice
                              )
                            }
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-3"
                            title="Edit harga"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openAddIngredientPriceModal(ingredient)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Tambah harga"
                        >
                          <Plus size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {ingredients.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      Tambahkan bahan baku terlebih dahulu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Ingredient Modal */}
      <Modal
        isOpen={isIngredientModalOpen}
        onClose={closeIngredientModal}
        title={editingIngredient ? "Edit Bahan" : "Tambah Bahan"}
        footer={
          <>
            <Button variant="secondary" onClick={closeIngredientModal}>
              Batal
            </Button>
            <Button variant="primary" onClick={submitIngredient}>
              <Save size={16} className="mr-1" />
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="ingredient-name"
            name="name"
            label="Nama Bahan"
            value={ingredientForm.name}
            onChange={handleIngredientFormChange}
            error={ingredientErrors.name}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Base Unit
            </label>
            <select
              name="baseUnit"
              value={ingredientForm.baseUnit}
              onChange={handleIngredientFormChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            >
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="ingredient-display-unit"
            name="displayUnit"
            label="Display Unit"
            value={ingredientForm.displayUnit}
            onChange={handleIngredientFormChange}
            error={ingredientErrors.displayUnit}
            required
          />

        </div>
      </Modal>

      {/* Ingredient Price Modal */}
      <Modal
        isOpen={isIngredientPriceModalOpen}
        onClose={closeIngredientPriceModal}
        title={editingIngredientPrice ? "Edit Harga Bahan" : "Tambah Harga Bahan"}
        footer={
          <>
            <Button variant="secondary" onClick={closeIngredientPriceModal}>
              Batal
            </Button>
            <Button variant="primary" onClick={submitIngredientPrice}>
              <Save size={16} className="mr-1" />
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bahan<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="ingredientId"
              value={ingredientPriceForm.ingredientId}
              onChange={handleIngredientPriceFormChange}
              className={`w-full px-3 py-2 border ${
                ingredientPriceErrors.ingredientId
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              } rounded-md bg-white dark:bg-gray-700`}
            >
              <option value="">-- Pilih Bahan --</option>
              {availableIngredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name} / {ingredient.displayUnit}
                </option>
              ))}
            </select>
            {ingredientPriceErrors.ingredientId && (
              <p className="mt-1 text-sm text-red-500">
                {ingredientPriceErrors.ingredientId}
              </p>
            )}
          </div>

          <Input
            id="ingredient-effective-date"
            name="effectiveDate"
            label="Berlaku Sejak"
            type="date"
            value={ingredientPriceForm.effectiveDate}
            onChange={handleIngredientPriceFormChange}
            error={ingredientPriceErrors.effectiveDate}
            required
          />

          <Input
            id="ingredient-price"
            name="pricePerDisplayUnit"
            label="Harga per Display Unit"
            type="number"
            value={ingredientPriceForm.pricePerDisplayUnit}
            onChange={handleIngredientPriceFormChange}
            error={ingredientPriceErrors.pricePerDisplayUnit}
            required
          />
        </div>
      </Modal>
      </div>
      )}

      {/* ================= USERS ================= */}
      {activeSettingsTab === "users" && hasRole("admin", "superadmin") && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users size={20} />
              Manajemen User
            </h2>

            <Button variant="primary" onClick={openAddUserModal}>
              <Plus size={16} className="mr-1" />
              Tambah User
            </Button>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((u) => {
                    const isSelf = user && u.id === user.id;
                    const isSuperRow = u.role === "superadmin";

                    let roleBadgeClass =
                      "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300";
                    if (u.role === "admin") {
                      roleBadgeClass =
                        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
                    } else if (u.role === "superadmin") {
                      roleBadgeClass =
                        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
                    }

                    const canEditRow =
                      isSuperadmin || (isAdmin && !isSuperRow);
                    const canDeleteRow = canEditRow && !isSelf;

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {u.username}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {u.full_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClass}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {canEditRow ? (
                            <>
                              <button
                                onClick={() => openEditUserModal(u)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              {canDeleteRow && (
                                <button
                                  onClick={() => removeUser(u)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              (Hanya superadmin)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                      >
                        Belum ada user
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Modal */}
          <Modal
            isOpen={isUserModalOpen}
            onClose={closeUserModal}
            title={editingUser ? "Edit User" : "Tambah User"}
            footer={
              <>
                <Button variant="secondary" onClick={closeUserModal}>
                  Batal
                </Button>
                <Button variant="primary" onClick={submitUser}>
                  <Save size={16} className="mr-1" />
                  Simpan
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <Input
                id="username"
                name="username"
                label="Username"
                value={userForm.username}
                onChange={handleUserInput}
                error={userErrors.username}
                required
              />

              <Input
                id="full_name"
                name="full_name"
                label="Nama Lengkap (Opsional)"
                value={userForm.full_name}
                onChange={handleUserInput}
              />

              {(() => {
                const isEditing = !!editingUser;
                const editingSelf =
                  editingUser && user && editingUser.id === user.id;

                const canEditPasswordField =
                  isSuperadmin ||
                  (!isEditing && hasRole("admin", "superadmin")) ||
                  (isEditing && editingSelf && (isAdmin || isSuperadmin));

                if (!canEditPasswordField && isEditing) {
                  return (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Password hanya dapat diubah oleh superadmin atau oleh
                      user itu sendiri.
                    </div>
                  );
                }

                return (
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    label={
                      editingUser
                        ? "Password (Kosongkan jika tidak diganti)"
                        : "Password"
                    }
                    value={userForm.password}
                    onChange={handleUserInput}
                    error={userErrors.password}
                    required={!editingUser}
                  />
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={userForm.role}
                  onChange={handleUserInput}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  disabled={
                    !!editingUser &&
                    editingUser.role === "superadmin" &&
                    !isSuperadmin
                  }
                >
                  <option value="cashier">cashier</option>
                  <option value="admin">admin</option>
                  {isSuperadmin && <option value="superadmin">superadmin</option>}
                </select>
              </div>
            </div>
          </Modal>
        </section>
      )}
    </div>
  );
};

export default SettingsPage;

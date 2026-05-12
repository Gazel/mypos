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
import type { Product, UserRow, UserRole } from "../types";

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
type UpdateUserPayload = {
  username: string;
  full_name: string;
  role: UserRole;
  password?: string;
};

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
    <div className="container mx-auto px-4 py-6 space-y-10">
      {/* ================= PRODUCTS ================= */}
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
              <Button variant="primary" onClick={handleSubmit}>
                <Save size={16} className="mr-1" />
                Simpan
              </Button>
            </>
          }
        >
          <div className="space-y-4">
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
                <p className="mt-1 text-sm text-red-500">{errors.category}</p>
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
          </div>
        </Modal>
      </section>

      {/* ================= USERS ================= */}
      {hasRole("admin", "superadmin") && (
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

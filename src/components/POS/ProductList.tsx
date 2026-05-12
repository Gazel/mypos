// src/components/POS/ProductList.tsx
import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useProducts } from "../../contexts/ProductContext";
import { useCart } from "../../contexts/CartContext";
import { formatCurrency } from "../../utils/formatter";
import type { Product } from "../../types";

const ProductList: React.FC = () => {
  const { products, categories } = useProducts();
  const { cart, addToCart } = useCart(); // 👈 your real cart structure

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [filteredProducts, setFilteredProducts] = useState(products);

  useEffect(() => {
    let result = products;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(lower)
      );
    }

    if (selectedCategory) {
      result = result.filter(
        (product) => product.category === selectedCategory
      );
    }

    setFilteredProducts(result);
  }, [products, searchTerm, selectedCategory]);

  const handleAddToCart = (product: Product) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  };

  // 🔍 Find quantity of product in cart
  const getQuantityInCart = (id: string) => {
    const item = cart.find((cartItem) => cartItem.productId === id);
    return item ? item.quantity : 0;
  };

  const chips = ["", ...categories];

  return (
    <div className="h-full flex flex-col">
      {/* Sticky Search + Chips */}
<div
  className="
    sticky top-0
    z-20
    bg-white/95 dark:bg-gray-800/95 
    backdrop-blur p-2 rounded-lg shadow-sm mb-2
  "
>

        {/* Search */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Cari produk..."
            className="
              w-full pl-10 pr-3 py-1.5
              border border-gray-300 dark:border-gray-600 rounded-md
              bg-gray-50 dark:bg-gray-700
              text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-1 focus:ring-blue-500
            "
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Chips */}
        <div className="mt-2 -mx-2 px-2 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {chips.map((cat) => {
              const isActive = selectedCategory === cat;
              const label = cat === "" ? "Semua" : cat;

              return (
                <button
                  key={label}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium
                    border transition
                    ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                    }
                    active:scale-[0.98]
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>Tidak ada produk yang ditemukan</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                quantity={getQuantityInCart(product.id)} // 👈 real quantity
                onAdd={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProductRow: React.FC<{
  product: Product;
  onAdd: (p: Product) => void;
  quantity: number;
}> = ({ product, onAdd, quantity }) => {
  const added = quantity > 0;

  return (
    <button
      onClick={() => onAdd(product)}
      className={`
        w-full flex items-center gap-3
        rounded-xl border px-3 py-3 shadow-sm active:scale-[0.99]
        ${
          added
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        }
      `}
    >
      {/* Dot */}
      <div
        className={`
          h-4 w-4 rounded-full flex-shrink-0
          ${added ? "bg-blue-500" : "bg-blue-400 dark:bg-blue-600"}
        `}
      />

      {/* Product name */}
      <div className="flex-1 text-left min-w-0">
        <div className="text-base font-semibold truncate">
          {product.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {product.category}
        </div>
      </div>

      {/* Price + quantity */}
      <div className="text-right">
        <div className="text-base font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(product.price)}
        </div>

        {/* 👇 replace “Tap to add” with quantity */}
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {added ? `${quantity}x di keranjang` : "Tap untuk tambah"}
        </div>
      </div>
    </button>
  );
};

export default ProductList;

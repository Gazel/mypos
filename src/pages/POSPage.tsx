import React, { useState } from "react";
import ProductList from "../components/POS/ProductList";
import Cart from "../components/POS/Cart";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/formatter";

const POSPage: React.FC = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const { cart, calculateTotal } = useCart();
  const { total } = calculateTotal();

  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="h-full relative md:flex md:gap-4 p-4">
      {/* LEFT: Product List (always visible full screen on mobile) */}
      <div className="flex-1">
        <h1 className="text-xl font-bold mb-3 md:mb-4">Kasir</h1>
        <ProductList />
      </div>

      {/* RIGHT: Cart stays visible only on desktop */}
      <div className="hidden md:block w-[380px]">
        <Cart />
      </div>

      {/* MOBILE FLOATING "CART" BUTTON */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-30">
        <button
          onClick={() => setCartOpen(true)}
          className="
            w-full flex items-center justify-between
            rounded-xl bg-blue-600 text-white
            px-4 py-3 shadow-lg
            active:scale-[0.98]
          "
        >
          <div className="text-left">
            <div className="text-xs opacity-90">Keranjang</div>
            <div className="text-lg font-bold">{formatCurrency(total)}</div>
          </div>

          <div className="text-right">
            <div className="text-xs opacity-90">{itemCount} item</div>
            <div className="text-sm font-semibold">Lihat Cart ↑</div>
          </div>
        </button>
      </div>

      {/* MOBILE CART DRAWER */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            className="
              absolute bottom-0 left-0 right-0
              bg-white dark:bg-gray-900
              rounded-t-2xl shadow-xl
              max-h-[85vh] flex flex-col
            "
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="font-semibold text-base">Keranjang</div>
              <button
                onClick={() => setCartOpen(false)}
                className="text-sm text-gray-500 dark:text-gray-300"
              >
                Tutup ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto">
              <Cart embeddedInDrawer onCloseDrawer={() => setCartOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;

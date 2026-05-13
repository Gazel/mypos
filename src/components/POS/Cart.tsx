// src/components/POS/Cart.tsx
import React, { useRef, useState, useEffect } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/formatter";
import Button from "../UI/Button";
import Input from "../UI/Input";
import Modal from "../UI/Modal";
import { useModal } from "../UI/useModal";
import Receipt from "./Receipt";
import type { Transaction } from "../../types";

const Cart: React.FC<{
  embeddedInDrawer?: boolean;
  onCloseDrawer?: () => void;
}> = ({ embeddedInDrawer = false, onCloseDrawer }) => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    discount,
    setDiscount,
    addTransaction,
    calculateTotal,
  } = useCart();

  const { token } = useAuth();

  // Payment modal (sebelum bayar)
  const paymentModal = useModal();

  // Receipt modal (success screen)
  const receiptModal = useModal();
  const [savedTrx, setSavedTrx] = useState<Transaction | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");

  const { subtotal, total } = calculateTotal();

  // 🔒 state untuk lock request
  const [isSaving, setIsSaving] = useState(false); // untuk transaksi SUCCESS
  const [isCancelling, setIsCancelling] = useState(false); // untuk transaksi CANCELLED
  const activeRequestKeyRef = useRef<string | null>(null);

  // Force discount selalu 0 di POS
  useEffect(() => {
    if (discount !== 0) setDiscount(0);
  }, [discount, setDiscount]);

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity >= 1) updateQuantity(productId, quantity);
  };

  // 🚫 Block remove last item (suruh pakai tombol batal)
  const handleRemoveItem = (productId: string) => {
    if (cart.length <= 1) {
      alert(
        "Item terakhir tidak bisa dihapus. Gunakan tombol Batal untuk membatalkan transaksi."
      );
      return;
    }
    removeFromCart(productId);
  };

  const getRequestKey = () => {
    if (!activeRequestKeyRef.current) {
      activeRequestKeyRef.current =
        crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    }

    return activeRequestKeyRef.current;
  };

  const safeAddTransaction = async (trx: Omit<Transaction, "id">) => {
    if (!token) {
      alert("Session login habis / belum login. Silakan login lagi.");
      throw new Error("No token");
    }
    return addTransaction(trx, token, getRequestKey());
  };

  // ===============================
  // PAYMENT (Bayar)
  // ===============================
  const handlePayment = async () => {
    if (cart.length === 0) return;
    if (isSaving || isCancelling) return; // lock kalau lagi ada request lain

    if (
      paymentMethod === "cash" &&
      (!cashReceived || parseFloat(cashReceived) < total)
    ) {
      alert("Jumlah uang yang diberikan tidak mencukupi");
      return;
    }

    const cashAmount =
      paymentMethod === "cash" ? parseFloat(cashReceived) : total;

    const trxPayload = {
      items: [...cart],
      subtotal,
      discount: 0,
      total,
      date: new Date().toISOString(),
      paymentMethod,
      cashReceived: cashAmount,
      change: paymentMethod === "cash" ? cashAmount - total : 0,
      customerName,
      note,
      status: "SUCCESS" as const,
    };

    setIsSaving(true);
    try {
      const saved = await safeAddTransaction(trxPayload);

      // close payment modal ONLY
      paymentModal.closeModal();

      // reset form input
      setCashReceived("");
      setCustomerName("");
      setNote("");
      setDiscount(0);

      // buka receipt modal
      setSavedTrx(saved);
      receiptModal.openModal();
      activeRequestKeyRef.current = null;
      // ❗ tidak close drawer di sini (mobile)
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan transaksi. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  // ===============================
  // CANCEL CART (log CANCELLED)
  // ===============================
  const handleCancelCart = async () => {
    if (isSaving || isCancelling) return; // lock double tekan
    if (cart.length === 0) {
      clearCart();
      return;
    }

    const trxPayload = {
      items: [...cart],
      subtotal,
      discount: 0,
      total,
      date: new Date().toISOString(),
      paymentMethod: "cancelled" as const,
      cashReceived: 0,
      change: 0,
      customerName,
      note,
      status: "CANCELLED" as const,
    };

    setIsCancelling(true);
    try {
      await safeAddTransaction(trxPayload);
    } catch (e) {
      console.error("Cancel logging failed:", e);
      // tetap lanjut bersih-bersih, jangan spam user
    } finally {
      clearCart();
      setCustomerName("");
      setNote("");
      onCloseDrawer?.();
      activeRequestKeyRef.current = null;
      setIsCancelling(false);
    }
  };

  // ===============================
  // Close receipt (Back button)
  // ===============================
  const handleCloseReceipt = () => {
    receiptModal.closeModal();
    setSavedTrx(null);
    // aman tutup drawer (mobile) setelah receipt
    if (onCloseDrawer) onCloseDrawer();
  };

  // ===============================
  // EMPTY STATE
  // ===============================
  if (cart.length === 0 && !receiptModal.isOpen) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
        <svg
          className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <p className="mb-2">Keranjang belanja kosong</p>
        <p className="text-sm text-center">
          Tambahkan produk dari sebelah kiri
        </p>
      </div>
    );
  }

  const actionDisabled = isSaving || isCancelling;

  return (
    <div className="h-full flex flex-col">
      {/* Cart Items */}
      <div
        className={`flex-1 overflow-y-auto ${
          embeddedInDrawer ? "pb-4" : "pb-24"
        }`}
      >
        <div className="space-y-3 p-1">
          {cart.map((item) => (
            <div
              key={item.productId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between mb-2">
                <div className="font-medium">{item.name}</div>
                <div>{formatCurrency(item.price)}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600"
                    onClick={() =>
                      handleQuantityChange(item.productId, item.quantity - 1)
                    }
                    disabled={actionDisabled}
                  >
                    <Minus size={14} />
                  </button>

                  <span className="w-8 text-center">{item.quantity}</span>

                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600"
                    onClick={() =>
                      handleQuantityChange(item.productId, item.quantity + 1)
                    }
                    disabled={actionDisabled}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <div>{formatCurrency(item.subtotal)}</div>

                  <button
                    className={`text-red-500 active:text-red-700 ${
                      cart.length <= 1 ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    disabled={cart.length <= 1 || actionDisabled}
                    onClick={() => handleRemoveItem(item.productId)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Summary */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 mt-4">
        <div className="border-t pt-2 flex justify-between items-center font-medium text-lg">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleCancelCart}
            disabled={actionDisabled}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            className="w-full"
            onClick={paymentModal.openModal}
            disabled={cart.length === 0 || actionDisabled}
          >
            Bayar
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Footer */}
      {embeddedInDrawer && (
        <div className="md:hidden sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Total
            </span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCancelCart}
              disabled={actionDisabled}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              className="w-full"
              onClick={paymentModal.openModal}
              disabled={cart.length === 0 || actionDisabled}
            >
              Bayar
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bar (kalau Cart dipakai standalone, sekarang tetap aman) */}
      {!embeddedInDrawer && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </div>
              <div className="text-lg font-bold">{formatCurrency(total)}</div>
            </div>

            <button
              onClick={paymentModal.openModal}
              disabled={cart.length === 0 || actionDisabled}
              className="
                flex-shrink-0
                px-5 py-3 rounded-xl
                bg-blue-600 text-white font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-[0.98]
              "
            >
              Bayar
            </button>
          </div>
        </div>
      )}

      {/* ===============================
          PAYMENT MODAL
         =============================== */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={paymentModal.closeModal}
        title="Pembayaran"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={paymentModal.closeModal}
              disabled={actionDisabled}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handlePayment}
              disabled={cart.length === 0 || actionDisabled}
            >
              {isSaving ? "Menyimpan..." : "Selesaikan Transaksi"}
            </Button>
          </>
        }
      >
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metode Pembayaran
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                className={`py-2 px-4 border rounded-md ${
                  paymentMethod === "cash"
                    ? "bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-700"
                }`}
                onClick={() => setPaymentMethod("cash")}
                disabled={actionDisabled}
              >
                Tunai
              </button>

              <button
                className={`py-2 px-4 border rounded-md ${
                  paymentMethod === "qris"
                    ? "bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-700"
                }`}
                onClick={() => setPaymentMethod("qris")}
                disabled={actionDisabled}
              >
                QRIS
              </button>
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="mb-4">
              <Input
                id="cashReceived"
                name="cashReceived"
                label="Jumlah Uang (Rp)"
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                required
                disabled={actionDisabled}
              />

              {cashReceived && parseFloat(cashReceived) >= total && (
                <div className="mt-2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 p-2 rounded-md text-sm">
                  Kembalian:{" "}
                  {formatCurrency(parseFloat(cashReceived) - total)}
                </div>
              )}
            </div>
          )}

          <Input
            id="customerName"
            name="customerName"
            label="Nama Pelanggan (Opsional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={actionDisabled}
          />

          <Input
            id="note"
            name="note"
            label="Catatan (Opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={actionDisabled}
          />

          {/* Ringkasan text-only */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <h3 className="font-medium mb-2">Ringkasan Transaksi</h3>

            <div className="space-y-1 text-sm mb-2">
              {cart.map((item) => (
                <div key={item.productId} className="flex justify-between">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 flex justify-between">
              <span className="font-medium">Total:</span>
              <span className="font-medium">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      </Modal>

      {/* ===============================
          RECEIPT MODAL (success page)
         =============================== */}
      {savedTrx && (
        <Modal
          isOpen={receiptModal.isOpen}
          onClose={handleCloseReceipt}
          title="Struk Transaksi"
          footer={
            <Button variant="secondary" onClick={handleCloseReceipt}>
              Back
            </Button>
          }
        >
          <div className="max-h-[85dvh] overflow-y-auto">
            <Receipt
              items={savedTrx.items}
              subtotal={savedTrx.subtotal}
              discount={savedTrx.discount || 0}
              total={savedTrx.total}
              paymentMethod={savedTrx.paymentMethod}
              cashReceived={savedTrx.cashReceived || 0}
              change={savedTrx.change || 0}
              customerName={savedTrx.customerName}
              note={savedTrx.note}
              transactionId={savedTrx.id}
              date={savedTrx.date}
              status={savedTrx.status || "SUCCESS"}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Cart;

// src/components/POS/Receipt.tsx
import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { CartItem } from "../../types";
import { formatCurrency } from "../../utils/formatter";
import Button from "../UI/Button";
import { printReceipt } from "../../utils/print";

interface ReceiptProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "qris" | "cancelled";
  cashReceived: number;
  change: number;
  customerName?: string;
  note?: string;
  transactionId?: string;
  date?: string;
  status?: "SUCCESS" | "CANCELLED";
  preview?: boolean;
}

const Receipt: React.FC<ReceiptProps> = ({
  items,
  subtotal,
  discount,
  total,
  paymentMethod,
  cashReceived,
  change,
  customerName,
  note,
  transactionId,
  date,
  status = "SUCCESS",
  preview = false,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (receiptRef.current) printReceipt(receiptRef.current);
  };

  const receiptNumber = transactionId || "PREVIEW";
  const d = date ? new Date(date) : new Date();
  const transactionDate =
    `${String(d.getDate()).padStart(2, "0")}/` +
    `${String(d.getMonth() + 1).padStart(2, "0")}/` +
    `${d.getFullYear()} ` +
    `${String(d.getHours()).padStart(2, "0")}:` +
    `${String(d.getMinutes()).padStart(2, "0")}`;


  const paymentLabel =
    paymentMethod === "cash"
      ? "Tunai"
      : paymentMethod === "qris"
      ? "QRIS"
      : "Dibatalkan";

  return (
    <div>
      {!preview && (
        <div className="no-print mb-4 flex justify-end">
          <Button variant="primary" onClick={handlePrint}>
            <Printer size={16} className="mr-1" />
            Cetak Struk
          </Button>
        </div>
      )}

      <div
        ref={receiptRef}
        className={`thermal-receipt bg-white p-3 ${
          preview ? "text-xs mt-4" : ""
        } mx-auto`}
      >
        {/* Header */}
        <h2 className="font-bold text-center text-lg mb-1">
          Warung Jepang Abusan
        </h2>
        <p className="text-center text-sm mb-1">Setiabudi</p>
        <p className="text-center text-sm mb-1">Telp: 082289100385</p>

        {status === "CANCELLED" && (
          <div className="mt-2 mb-1 text-center">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
              CANCELLED
            </span>
          </div>
        )}

        <div className="border-t border-b border-dashed my-2 py-1 text-sm">
          <p>No: {receiptNumber}</p>
          <p>Tanggal: {transactionDate}</p>
          {customerName && <p>Pelanggan: {customerName}</p>}
          {note && <p>Catatan: {note}</p>}
        </div>

        {/* Items (3-column grid, harga di baris kedua) */}
        <div className="receipt-items-grid text-sm">
          {/* Header row */}
          <div className="receipt-grid-row receipt-grid-header border-b pb-1 mb-1">
            <div className="receipt-col-name">Item</div>
            <div className="receipt-col-qty text-right">Qty</div>
            <div className="receipt-col-amount text-right">Jumlah</div>
          </div>

          {/* Item rows */}
          {items.map((item, index) => (
            <div className="receipt-grid-row" key={item.productId || index}>
              <div className="receipt-col-name">
                <div className="receipt-item-name">{item.name}</div>
                <div className="receipt-item-meta">
                  @{formatCurrency(item.price)}
                </div>
              </div>

              <div className="receipt-col-qty tabular-nums">
                x{item.quantity}
              </div>

              <div className="receipt-col-amount tabular-nums">
                {formatCurrency(item.subtotal)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="receipt-total mt-2 pt-1 border-t border-dashed text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between">
              <span>Diskon:</span>
              <span className="tabular-nums">
                -{formatCurrency(discount)}
              </span>
            </div>
          )}

          <div className="flex justify-between font-bold mt-1">
            <span>Total:</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="mt-1">
            <div className="flex justify-between">
              <span>Pembayaran ({paymentLabel}):</span>
              <span className="tabular-nums">
                {paymentMethod === "cancelled"
                  ? "-"
                  : formatCurrency(cashReceived)}
              </span>
            </div>

            {paymentMethod === "cash" && status === "SUCCESS" && (
              <div className="flex justify-between">
                <span>Kembalian:</span>
                <span className="tabular-nums">
                  {formatCurrency(change)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="receipt-footer mt-4 text-center text-xs">
          <p>Terima kasih atas kunjungan Anda!</p>
          <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
        </div>
      </div>
    </div>
  );
};

export default Receipt;

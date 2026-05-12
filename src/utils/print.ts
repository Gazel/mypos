/**
 * Print receipt
 */
export const printReceipt = (receiptContent: HTMLElement): void => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Mohon izinkan popup untuk mencetak struk");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Struk</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 58mm;
            margin: 0;
            padding: 0;
            font-family: monospace;
            color: #000;
            background: #fff;
          }

          .no-print {
            display: none !important;
          }

          .thermal-receipt {
            width: 58mm;
            max-width: 58mm;
            margin: 0;
            padding: 2mm;
            font-family: monospace;
            font-size: 11px;
            line-height: 1.25;
            color: #000;
            background: #fff;
          }

          h2,
          p {
            margin: 0;
          }

          .text-center {
            text-align: center;
          }

          .font-bold {
            font-weight: 700;
          }

          .text-lg {
            font-size: 13px;
          }

          .text-sm {
            font-size: 11px;
          }

          .text-xs {
            font-size: 10px;
          }

          .mb-1 {
            margin-bottom: 1mm;
          }

          .mt-1 {
            margin-top: 1mm;
          }

          .mt-2 {
            margin-top: 2mm;
          }

          .mt-4 {
            margin-top: 4mm;
          }

          .my-2 {
            margin-top: 2mm;
            margin-bottom: 2mm;
          }

          .py-1 {
            padding-top: 1mm;
            padding-bottom: 1mm;
          }

          .pt-1 {
            padding-top: 1mm;
          }

          .pb-1 {
            padding-bottom: 1mm;
          }

          .border-t {
            border-top: 1px solid #000;
          }

          .border-b {
            border-bottom: 1px solid #000;
          }

          .border-dashed {
            border-style: dashed;
          }

          .receipt-total {
            border-top: 1px dashed #000;
          }

          .receipt-footer {
            text-align: center;
            margin-top: 4mm;
            font-size: 10px;
          }

          .flex {
            display: flex;
          }

          .justify-between {
            justify-content: space-between;
            gap: 2mm;
          }

          .tabular-nums {
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }

          .receipt-items-grid {
            display: flex;
            flex-direction: column;
            gap: 1mm;
          }

          .receipt-grid-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 8mm 17mm;
            column-gap: 1.5mm;
            align-items: start;
          }

          .receipt-grid-header {
            font-weight: 700;
          }

          .receipt-item-name {
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.25;
          }

          .receipt-item-meta {
            font-size: 9px;
            opacity: 0.8;
          }

          .receipt-col-qty,
          .receipt-col-amount {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }

          @media print {
            body {
              width: 58mm;
            }
          }
        </style>
      </head>
      <body>
        ${receiptContent.outerHTML}
        <script>
          setTimeout(() => {
            window.print();
            window.onafterprint = () => window.close();
          }, 500);
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};

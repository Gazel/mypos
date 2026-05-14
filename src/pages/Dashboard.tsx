import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarDays,
  CreditCard,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchDashboardReportOnline,
  fetchDashboardSalesTrendOnline,
  subscribeTransactionsOnline,
} from "../services/apiBackend";
import type {
  DashboardInsight,
  DashboardReport,
  DashboardSalesTrendMode,
  DashboardSalesTrendReport,
  Transaction,
} from "../types";
import { formatCurrency } from "../utils/formatter";

type RangeMode =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "custom";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface RangeOption {
  value: RangeMode;
  label: string;
}

const rangeOptions: RangeOption[] = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "thisWeek", label: "Minggu Ini" },
  { value: "thisMonth", label: "Bulan Ini" },
  { value: "lastMonth", label: "Bulan Kemarin" },
  { value: "custom", label: "Custom Date" },
];

const trendModeOptions: Array<{
  value: DashboardSalesTrendMode;
  label: string;
}> = [
  { value: "daily", label: "31 Hari" },
  { value: "weekly", label: "12 Minggu" },
  { value: "monthly", label: "6 Bulan" },
];

function toInputDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfPreviousMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getPresetRange(mode: Exclude<RangeMode, "custom">): DateRange {
  const today = new Date();

  if (mode === "today") {
    return { startDate: toInputDate(today), endDate: toInputDate(today) };
  }

  if (mode === "yesterday") {
    const yesterday = addDays(today, -1);
    return {
      startDate: toInputDate(yesterday),
      endDate: toInputDate(yesterday),
    };
  }

  if (mode === "thisWeek") {
    return {
      startDate: toInputDate(startOfWeek(today)),
      endDate: toInputDate(today),
    };
  }

  if (mode === "thisMonth") {
    return {
      startDate: toInputDate(startOfMonth(today)),
      endDate: toInputDate(today),
    };
  }

  const previousMonth = startOfPreviousMonth(today);

  return {
    startDate: toInputDate(previousMonth),
    endDate: toInputDate(endOfMonth(previousMonth)),
  };
}

function getPreviousComparisonRange(
  mode: RangeMode,
  currentRange: DateRange
): DateRange {
  const currentStart = dateKeyToDate(currentRange.startDate);
  const currentEnd = dateKeyToDate(currentRange.endDate);

  if (mode === "today" || mode === "yesterday") {
    const previous = addDays(currentStart, -1);
    return {
      startDate: toInputDate(previous),
      endDate: toInputDate(previous),
    };
  }

  if (mode === "thisWeek") {
    return {
      startDate: toInputDate(addDays(currentStart, -7)),
      endDate: toInputDate(addDays(currentEnd, -7)),
    };
  }

  if (mode === "thisMonth") {
    const previousMonthStart = startOfPreviousMonth(currentEnd);
    const previousMonthDay = Math.min(
      currentEnd.getDate(),
      daysInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth())
    );

    return {
      startDate: toInputDate(previousMonthStart),
      endDate: toInputDate(
        new Date(
          previousMonthStart.getFullYear(),
          previousMonthStart.getMonth(),
          previousMonthDay
        )
      ),
    };
  }

  if (mode === "lastMonth") {
    const twoMonthsAgo = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth() - 1,
      1
    );

    return {
      startDate: toInputDate(twoMonthsAgo),
      endDate: toInputDate(endOfMonth(twoMonthsAgo)),
    };
  }

  const spanDays =
    Math.floor(
      (currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)
    ) + 1;
  const previousEnd = addDays(currentStart, -1);

  return {
    startDate: toInputDate(addDays(currentStart, -spanDays)),
    endDate: toInputDate(previousEnd),
  };
}

function getComparisonLabel(mode: RangeMode) {
  if (mode === "thisWeek") return "vs minggu lalu";
  if (mode === "thisMonth") return "vs bulan lalu sampai tanggal yang sama";
  if (mode === "lastMonth") return "vs bulan sebelumnya";
  if (mode === "custom") return "vs periode sebelumnya";
  return "vs hari sebelumnya";
}

function dateKeyToDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFromValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return toInputDate(d);
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(dateKeyToDate(dateKey));
}

function formatMonthLabel(dateKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(dateKeyToDate(dateKey));
}

function formatTrendLabel(
  mode: DashboardSalesTrendMode,
  startDate: string,
  endDate: string
) {
  if (mode === "monthly") return formatMonthLabel(startDate);
  if (mode === "weekly") {
    return `${formatShortDate(startDate)}-${formatShortDate(endDate)}`;
  }

  return formatShortDate(startDate);
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `Rp ${formatNumber(value / 1_000_000_000, 1)} M`;
  }

  if (absValue >= 1_000_000) {
    return `Rp ${formatNumber(value / 1_000_000, 1)} jt`;
  }

  if (absValue >= 1_000) {
    return `Rp ${formatNumber(value / 1_000, 0)} rb`;
  }

  return formatCurrency(value);
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}%`;
}

function getRangeLabel(range: DateRange) {
  if (range.startDate === range.endDate) {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(dateKeyToDate(range.startDate));
  }

  return `${range.startDate} sampai ${range.endDate}`;
}

function isSuccessTransaction(transaction: Transaction) {
  return (
    (transaction.status || "SUCCESS") === "SUCCESS" &&
    transaction.paymentMethod !== "cancelled"
  );
}

function isTransactionInRange(transaction: Transaction, range: DateRange) {
  const dateKey = dateKeyFromValue(transaction.date);
  return Boolean(
    dateKey && dateKey >= range.startDate && dateKey <= range.endDate
  );
}

function paymentLabel(method: string) {
  return method.toLowerCase() === "qris" ? "QRIS" : "Cash";
}

function changeToneClass(value: number) {
  if (value > 0) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (value < 0) {
    return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  }

  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

const ChangePill: React.FC<{ value: number }> = ({ value }) => {
  const Icon = value < 0 ? TrendingDown : TrendingUp;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${changeToneClass(
        value
      )}`}
    >
      <Icon size={13} />
      {formatSignedPercent(value)}
    </span>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClassName: string;
  changePct?: number;
}> = ({ title, value, detail, icon: Icon, iconClassName, changePct }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${iconClassName}`}
      >
        <Icon size={22} />
      </div>
    </div>
    <div className="mt-4 flex min-h-7 items-center justify-between gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>
      {typeof changePct === "number" && <ChangePill value={changePct} />}
    </div>
  </div>
);

function insightValue(insight: DashboardInsight) {
  if (typeof insight.value === "number" && insight.unit === "%") {
    return formatSignedPercent(insight.value);
  }

  return `${insight.value}${insight.unit ? ` ${insight.unit}` : ""}`;
}

function insightToneClass(tone: DashboardInsight["tone"]) {
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200";
  }

  if (tone === "negative") {
    return "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200";
  }

  return "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
}

const InsightCard: React.FC<{ insight: DashboardInsight }> = ({ insight }) => (
  <div className={`rounded-lg border p-4 shadow-sm ${insightToneClass(insight.tone)}`}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
      {insight.label}
    </p>
    <p className="mt-2 truncate text-xl font-bold">{insightValue(insight)}</p>
    <p className="mt-2 text-sm opacity-75">{insight.detail}</p>
  </div>
);

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
    {message}
  </div>
);

type ChartBox = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const defaultChartBox: ChartBox = {
  width: 760,
  height: 320,
  left: 86,
  right: 56,
  top: 22,
  bottom: 48,
};

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function buildChartBox(width: number, height: number): ChartBox {
  const compact = width < 520;

  return {
    width,
    height,
    left: compact ? 62 : 86,
    right: compact ? 40 : 56,
    top: compact ? 24 : 22,
    bottom: compact ? 44 : 48,
  };
}

function getChartPoint(
  value: number,
  index: number,
  length: number,
  maxValue: number,
  chartBox: ChartBox
) {
  const plotWidth = chartBox.width - chartBox.left - chartBox.right;
  const plotHeight = chartBox.height - chartBox.top - chartBox.bottom;
  const x =
    length > 1
      ? chartBox.left + (index * plotWidth) / (length - 1)
      : chartBox.left + plotWidth / 2;
  const y =
    chartBox.top +
    plotHeight -
    (maxValue > 0 ? (value / maxValue) * plotHeight : 0);

  return { x, y };
}

function buildLinePath(values: number[], maxValue: number, chartBox: ChartBox) {
  return values
    .map((value, index) => {
      const point = getChartPoint(
        value,
        index,
        values.length,
        maxValue,
        chartBox
      );
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(
        2
      )} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function shouldShowTrendTick(
  mode: DashboardSalesTrendMode,
  index: number,
  length: number
) {
  if (index === 0 || index === length - 1) return true;
  if (mode === "monthly") return true;
  if (mode === "weekly") return index % 2 === 0;
  return index % 5 === 0;
}

function xLabelAnchor(index: number, length: number) {
  if (index === 0) return "start";
  if (index === length - 1) return "end";
  return "middle";
}

const SalesTrendChart: React.FC<{
  report: DashboardSalesTrendReport | null;
  mode: DashboardSalesTrendMode;
  isLoading: boolean;
  errorMessage: string;
  onModeChange: (mode: DashboardSalesTrendMode) => void;
}> = ({ report, mode, isLoading, errorMessage, onModeChange }) => {
  const rows = report?.rows || [];
  const [chartContainerRef, chartSize] = useElementSize<HTMLDivElement>();
  const chartBox = useMemo(
    () =>
      buildChartBox(
        chartSize.width || defaultChartBox.width,
        chartSize.height || defaultChartBox.height
      ),
    [chartSize.height, chartSize.width]
  );
  const maxSales = Math.max(...rows.map((row) => row.totalSales), 1);
  const maxTransactions = Math.max(
    ...rows.map((row) => row.transactionCount),
    1
  );
  const salesPath = buildLinePath(
    rows.map((row) => row.totalSales),
    maxSales,
    chartBox
  );
  const transactionPath = buildLinePath(
    rows.map((row) => row.transactionCount),
    maxTransactions,
    chartBox
  );
  const totalSales = rows.reduce((sum, row) => sum + row.totalSales, 0);
  const totalTransactions = rows.reduce(
    (sum, row) => sum + row.transactionCount,
    0
  );
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
    const plotHeight = chartBox.height - chartBox.top - chartBox.bottom;

    return {
      ratio,
      y: chartBox.top + (1 - ratio) * plotHeight,
      sales: maxSales * ratio,
      transactions: maxTransactions * ratio,
    };
  });
  const salesPoints = rows.map((row, index) =>
    getChartPoint(row.totalSales, index, rows.length, maxSales, chartBox)
  );
  const transactionPoints = rows.map((row, index) =>
    getChartPoint(
      row.transactionCount,
      index,
      rows.length,
      maxTransactions,
      chartBox
    )
  );

  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Trend Penjualan
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total penjualan dan total transaksi dalam rentang operasional
          </p>
        </div>

        <div className="inline-grid grid-cols-3 rounded-md border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          {trendModeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={`h-8 rounded px-3 text-sm font-medium ${
                mode === option.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Total Penjualan
          </p>
          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(totalSales)}
          </p>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Total Transaksi
          </p>
          <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
            {formatNumber(totalTransactions)}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <EmptyPanel message={errorMessage} />
      ) : rows.length === 0 || isLoading ? (
        <div className="h-[320px] animate-pulse rounded-md bg-gray-100 dark:bg-gray-700" />
      ) : (
        <div
          ref={chartContainerRef}
          className="h-[320px] w-full overflow-hidden"
        >
          <div className="h-full w-full">
            <svg
              viewBox={`0 0 ${chartBox.width} ${chartBox.height}`}
              role="img"
              aria-label="Trend penjualan dan transaksi"
              className="block h-full w-full"
              preserveAspectRatio="none"
            >
              <text
                x={chartBox.left}
                y="12"
                className="fill-blue-600 text-[11px] font-semibold"
              >
                Penjualan
              </text>
              <text
                x={chartBox.width - chartBox.right}
                y="12"
                textAnchor="end"
                className="fill-amber-600 text-[11px] font-semibold"
              >
                Transaksi
              </text>

              {yTicks.map((tick) => (
                <g key={tick.ratio}>
                  <line
                    x1={chartBox.left}
                    x2={chartBox.width - chartBox.right}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="currentColor"
                    className="text-gray-200 dark:text-gray-700"
                    strokeWidth="1"
                  />
                  <text
                    x={chartBox.left - 8}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-gray-500 text-[11px] dark:fill-gray-400"
                  >
                    {formatCompactCurrency(tick.sales)}
                  </text>
                  <text
                    x={chartBox.width - chartBox.right + 8}
                    y={tick.y + 4}
                    textAnchor="start"
                    className="fill-gray-500 text-[11px] dark:fill-gray-400"
                  >
                    {formatNumber(tick.transactions, 0)}
                  </text>
                </g>
              ))}

              <line
                x1={chartBox.left}
                x2={chartBox.width - chartBox.right}
                y1={chartBox.height - chartBox.bottom}
                y2={chartBox.height - chartBox.bottom}
                stroke="currentColor"
                className="text-gray-300 dark:text-gray-600"
                strokeWidth="1.25"
              />

              <path
                d={salesPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={transactionPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {salesPoints.map((point, index) => (
                <circle
                  key={`sales-${rows[index].key}`}
                  cx={point.x}
                  cy={point.y}
                  r={mode === "daily" ? 2.2 : 3}
                  fill="#2563eb"
                  className="stroke-white dark:stroke-gray-800"
                  strokeWidth="1.5"
                >
                  <title>
                    {`${formatTrendLabel(
                      mode,
                      rows[index].startDate,
                      rows[index].endDate
                    )}: ${formatCurrency(rows[index].totalSales)}`}
                  </title>
                </circle>
              ))}
              {transactionPoints.map((point, index) => (
                <circle
                  key={`transactions-${rows[index].key}`}
                  cx={point.x}
                  cy={point.y}
                  r={mode === "daily" ? 2.2 : 3}
                  fill="#f59e0b"
                  className="stroke-white dark:stroke-gray-800"
                  strokeWidth="1.5"
                >
                  <title>
                    {`${formatTrendLabel(
                      mode,
                      rows[index].startDate,
                      rows[index].endDate
                    )}: ${formatNumber(rows[index].transactionCount)} transaksi`}
                  </title>
                </circle>
              ))}

              {rows.map((row, index) => {
                if (!shouldShowTrendTick(mode, index, rows.length)) return null;

                const point = getChartPoint(0, index, rows.length, 1, chartBox);

                return (
                  <text
                    key={`label-${row.key}`}
                    x={point.x}
                    y={chartBox.height - 14}
                    textAnchor={xLabelAnchor(index, rows.length)}
                    className="fill-gray-500 text-[11px] dark:fill-gray-400"
                  >
                    {formatTrendLabel(mode, row.startDate, row.endDate)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-blue-600" />
          Total Penjualan
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-amber-500" />
          Total Transaksi
        </span>
      </div>
    </section>
  );
};

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const defaultRange = useMemo(() => getPresetRange("today"), []);
  const [rangeMode, setRangeMode] = useState<RangeMode>("today");
  const [customStart, setCustomStart] = useState(defaultRange.startDate);
  const [customEnd, setCustomEnd] = useState(defaultRange.endDate);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [salesTrendMode, setSalesTrendMode] =
    useState<DashboardSalesTrendMode>("daily");
  const [salesTrendReport, setSalesTrendReport] =
    useState<DashboardSalesTrendReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trendErrorMessage, setTrendErrorMessage] = useState("");

  const selectedRange = useMemo<DateRange>(() => {
    if (rangeMode === "custom") {
      return {
        startDate: customStart,
        endDate: customEnd,
      };
    }

    return getPresetRange(rangeMode);
  }, [customEnd, customStart, rangeMode]);

  const comparisonRange = useMemo(
    () => getPreviousComparisonRange(rangeMode, selectedRange),
    [rangeMode, selectedRange]
  );

  const isInvalidRange = selectedRange.startDate > selectedRange.endDate;

  const loadDashboard = useCallback(async () => {
    if (!token) return;

    if (isInvalidRange) {
      setErrorMessage("Start date tidak boleh lebih besar dari end date.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchDashboardReportOnline(token, {
        ...selectedRange,
        previousStartDate: comparisonRange.startDate,
        previousEndDate: comparisonRange.endDate,
      });
      setReport(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat dashboard."
      );
    } finally {
      setIsLoading(false);
    }
  }, [comparisonRange, isInvalidRange, selectedRange, token]);

  const loadSalesTrend = useCallback(async () => {
    if (!token) return;

    setIsTrendLoading(true);
    setTrendErrorMessage("");

    try {
      const data = await fetchDashboardSalesTrendOnline(token, {
        mode: salesTrendMode,
        endDate: toInputDate(),
      });
      setSalesTrendReport(data);
    } catch (error) {
      setTrendErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat trend penjualan."
      );
    } finally {
      setIsTrendLoading(false);
    }
  }, [salesTrendMode, token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadSalesTrend();
  }, [loadSalesTrend]);

  useEffect(() => {
    if (!token) return undefined;

    const source = subscribeTransactionsOnline(
      token,
      (transaction) => {
        if (
          isSuccessTransaction(transaction) &&
          isTransactionInRange(transaction, selectedRange)
        ) {
          void loadDashboard();
        }

        if (isSuccessTransaction(transaction)) {
          void loadSalesTrend();
        }
      },
      () => undefined
    );

    return () => source.close();
  }, [loadDashboard, loadSalesTrend, selectedRange, token]);

  const summary = report?.summary;
  const comparison = report?.comparison;
  const totalPaymentSales = summary?.totalSales || 0;
  const comparisonLabel = getComparisonLabel(rangeMode);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Activity size={16} />
            Operational Overview
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {getRangeLabel(selectedRange)}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:w-56">
            <span className="sr-only">Periode Dashboard</span>
            <CalendarDays
              size={16}
              className="shrink-0 text-gray-400"
            />
            <select
              value={rangeMode}
              onChange={(event) => setRangeMode(event.target.value as RangeMode)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-700 outline-none dark:text-gray-100"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {rangeMode === "custom" && (
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Start Date
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            End Date
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {errorMessage}
        </div>
      )}

      {!report && isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Penjualan"
              value={formatCurrency(summary?.totalSales || 0)}
              detail={`${formatCurrency(summary?.totalCash || 0)} cash, ${formatCurrency(
                summary?.totalQris || 0
              )} QRIS`}
              icon={WalletCards}
              iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              changePct={comparison?.salesChangePct}
            />
            <MetricCard
              title="Total Transaksi"
              value={formatNumber(summary?.transactionCount || 0)}
              detail={`Jumlah transaksi sukses, ${comparisonLabel}`}
              icon={ReceiptText}
              iconClassName="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              changePct={comparison?.transactionChangePct}
            />
            <MetricCard
              title="Average Penjualan"
              value={formatCurrency(summary?.averageBill || 0)}
              detail={`Rata-rata nilai per transaksi, ${comparisonLabel}`}
              icon={BarChart3}
              iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
              changePct={comparison?.averageBillChangePct}
            />
            <MetricCard
              title="Item Terjual"
              value={formatNumber(summary?.itemsSold || 0, 2)}
              detail="Jumlah item dari transaksi sukses"
              icon={ShoppingBag}
              iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            />
          </div>

          <SalesTrendChart
            report={salesTrendReport}
            mode={salesTrendMode}
            isLoading={isTrendLoading}
            errorMessage={trendErrorMessage}
            onModeChange={setSalesTrendMode}
          />

          <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {(report?.insights || []).map((insight) => (
              <InsightCard key={insight.key} insight={insight} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Payment Mix
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cash dan QRIS dari total penjualan
                  </p>
                </div>
                <CreditCard
                  size={20}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>

              <div className="space-y-4">
                {(report?.paymentBreakdown || []).map((row) => {
                  const share =
                    totalPaymentSales > 0
                      ? (row.totalSales / totalPaymentSales) * 100
                      : 0;
                  const Icon = row.method === "qris" ? CreditCard : Banknote;

                  return (
                    <div key={row.method}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          <Icon size={16} />
                          {paymentLabel(row.method)}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(row.totalSales)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {row.transactionCount} bill
                          </p>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={`h-2 rounded-full ${
                            row.method === "qris"
                              ? "bg-sky-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatNumber(share, 1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Produk Teratas
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Diurutkan berdasarkan rupiah terjual
                  </p>
                </div>
                <Package
                  size={20}
                  className="text-gray-400 dark:text-gray-500"
                />
              </div>

              {report?.topProducts.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        <th className="py-2 pr-3 font-semibold">Produk</th>
                        <th className="py-2 px-3 text-right font-semibold">
                          Qty
                        </th>
                        <th className="py-2 pl-3 text-right font-semibold">
                          Penjualan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topProducts.map((row) => (
                        <tr
                          key={`${row.productId}-${row.productName}`}
                          className="border-b border-gray-100 last:border-0 dark:border-gray-700"
                        >
                          <td className="py-3 pr-3 font-medium text-gray-900 dark:text-white">
                            {row.productName}
                          </td>
                          <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-300">
                            {formatNumber(row.quantitySold, 2)}
                          </td>
                          <td className="py-3 pl-3 text-right font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(row.totalSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyPanel message="Belum ada produk terjual di periode ini." />
              )}
            </section>

          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

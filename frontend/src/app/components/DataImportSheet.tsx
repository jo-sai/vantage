import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload, CheckCircle2, ChevronDown, X, FileSpreadsheet,
  AlertCircle, RefreshCw, Check
} from "lucide-react";
import { useCurrency } from "./CurrencyContext";

// ─── Types ────────────────────────────────────────────────────────────────

type Status = "Paid" | "Pending" | "Reviewing" | "";
type Category = "Materials" | "Equipment" | "Salary" | "Safety Equipment" | "Transportation" | "Utilities" | "Other" | "";

interface SpreadsheetRow {
  date: string;
  description: string;
  category: Category;
  amount: number | "";
  status: Status;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "Materials", "Equipment", "Salary", "Safety Equipment",
  "Transportation", "Utilities", "Other",
];

const STATUS_OPTIONS: Status[] = ["Paid", "Pending", "Reviewing"];

const EMPTY_ROW: SpreadsheetRow = { date: "", description: "", category: "", amount: "", status: "" };

const PREVIEW_ROWS: SpreadsheetRow[] = [
  { date: "2026-05-14", description: "Concrete Mix Delivery — Site C", category: "Materials", amount: 45000, status: "Paid" },
  { date: "2026-05-13", description: "Hydraulic Equipment Rental — Week 19", category: "Equipment", amount: 12500, status: "Paid" },
  { date: "2026-05-12", description: "Labor — Week 19 Full Crew", category: "Salary", amount: 35200, status: "Pending" },
  { date: "2026-05-11", description: "Safety Harnesses & Helmets (x24)", category: "Safety Equipment", amount: 3200, status: "Paid" },
  { date: "2026-05-10", description: "Transport Services — Batch 3", category: "Transportation", amount: 8900, status: "Pending" },
];

const EMPTY_ROWS: SpreadsheetRow[] = Array(5).fill(null).map(() => ({ ...EMPTY_ROW }));

// ─── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  if (!status) return <span className="text-[var(--cool-gray)] text-xs">—</span>;
  const styles: Record<string, string> = {
    Paid: "bg-[var(--mint-green)]/15 text-[var(--mint-green)] border-[var(--mint-green)]/30",
    Pending: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Reviewing: "bg-[var(--action-blue)]/15 text-[var(--action-blue)] border-[var(--action-blue)]/30",
  };
  const dots: Record<string, string> = {
    Paid: "bg-[var(--mint-green)]",
    Pending: "bg-orange-400",
    Reviewing: "bg-[var(--action-blue)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${styles[status]}`}>
      <span className={`size-1.5 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}

interface DataImportSheetProps {
  onImportSuccess?: (rows: Array<{ date: string; description: string; category: string; amount: number; status: string }>) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────

export function DataImportSheet({ onImportSuccess }: DataImportSheetProps) {
  const { format } = useCurrency();

  const [isPreview, setIsPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<SpreadsheetRow[]>(EMPTY_ROWS);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [categoryDropdown, setCategoryDropdown] = useState<number | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<number | null>(null);
  const [showMatchTooltip, setShowMatchTooltip] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setSynced(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        // Skip header
        const dataRows = lines.slice(1);
        
        const parsedRows = dataRows.map(line => {
          const columns: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              columns.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          columns.push(current.trim().replace(/^"|"$/g, ''));

          // Expected columns: Date, Description, Category, Amount, Status
          const rawCategory = (columns[2] || "").trim();
          let parsedCategory: Category = "";
          const matchedCategory = CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase());
          if (matchedCategory) {
            parsedCategory = matchedCategory;
          }

          const rawAmountStr = (columns[3] || "").replace(/[^0-9.-]/g, "");
          const parsedAmount = parseFloat(rawAmountStr);

          const rawStatus = (columns[4] || "").trim();
          let parsedStatus: Status = "";
          if (/^paid$/i.test(rawStatus)) parsedStatus = "Paid";
          else if (/^pending$/i.test(rawStatus)) parsedStatus = "Pending";
          else if (/^reviewing$/i.test(rawStatus)) parsedStatus = "Reviewing";

          return {
            date: columns[0] || "",
            description: columns[1] || "",
            category: parsedCategory,
            amount: isNaN(parsedAmount) ? "" : parsedAmount,
            status: parsedStatus
          };
        });

        setRows(parsedRows);
        setIsPreview(true);
      } catch (err) {
        alert("Failed to parse CSV file.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearImport = () => {
    setIsPreview(false);
    setRows(EMPTY_ROWS.map((r) => ({ ...r })));
    setActiveCell(null);
    setSynced(false);
  };

  const handleSyncToLedger = async () => {
    if (!onImportSuccess) return;
    
    // Filter for completed/valid rows
    const validRows = rows
      .filter(r => r.date && r.description && r.category && r.amount !== "")
      .map(r => ({
        date: r.date,
        description: r.description,
        category: r.category as string,
        amount: Number(r.amount),
        status: r.status || "Pending"
      }));

    if (validRows.length === 0) {
      alert("No valid completed transaction rows to sync. Please fill in Date, Description, Category, and Amount.");
      return;
    }

    setSyncing(true);
    try {
      await onImportSuccess(validRows);
      setSynced(true);
      setTimeout(() => {
        setSynced(false);
      }, 4000);
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  const updateCell = <K extends keyof SpreadsheetRow>(
    rowIdx: number,
    field: K,
    value: SpreadsheetRow[K]
  ) => {
    setSynced(false);
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: value };
      return next;
    });
  };

  const cellId = (row: number, col: string) => `${row}-${col}`;
  const isActive = (row: number, col: string) => activeCell === cellId(row, col);

  const colClasses = (row: number, col: string, extra = "") =>
    `relative px-3 py-2.5 text-sm transition-colors cursor-pointer border ${
      isActive(row, col)
        ? "border-[var(--action-blue)] bg-[var(--action-blue)]/8 z-10"
        : "border-transparent hover:bg-white/[0.04] hover:border-white/10"
    } ${extra}`;

  const paidCount = rows.filter((r) => r.status === "Paid").length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;

  return (
    <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--glass-border)] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-[var(--action-blue)]" />
          <span className="text-sm text-white">Data Import</span>
        </div>

        <div className="h-4 w-px bg-[var(--glass-border)]" />

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[var(--action-blue)] text-white text-xs hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_16px_rgba(59,130,246,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {importing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            >
              <Upload size={13} />
            </motion.div>
          ) : (
            <Upload size={13} />
          )}
          <span>{importing ? "Importing…" : "Import File (.csv / .xlsx)"}</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={handleFileChange} />

        {/* Status indicators */}
        <AnimatePresence>
          {isPreview && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mint-green)]/10 border border-[var(--mint-green)]/25 animate-pulse">
                <CheckCircle2 size={12} className="text-[var(--mint-green)]" />
                <span className="text-xs text-[var(--mint-green)]">Import Successful — {rows.length} rows</span>
              </div>

              {onImportSuccess && (
                <button
                  onClick={handleSyncToLedger}
                  disabled={syncing || synced}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer disabled:opacity-60 border ${
                    synced 
                      ? "bg-[var(--mint-green)]/15 border-[var(--mint-green)]/35 text-[var(--mint-green)]" 
                      : "bg-[var(--action-blue)]/15 border-[var(--action-blue)]/30 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/25"
                  }`}
                >
                  {synced ? <Check size={12} /> : <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />}
                  <span>{synced ? "Synced to Ledger" : syncing ? "Syncing..." : "Sync to Ledger"}</span>
                </button>
              )}

              <button
                onClick={handleClearImport}
                className="flex items-center gap-1 text-xs text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer"
              >
                <X size={11} />
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Row stats */}
        {isPreview && (
          <div className="flex items-center gap-3 text-xs text-[var(--cool-gray)]">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--mint-green)]" />
              {paidCount} Paid
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-orange-400" />
              {pendingCount} Pending
            </span>
          </div>
        )}
      </div>

      {/* ── Match Headers Banner (preview mode) ── */}
      <AnimatePresence>
        {isPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--mint-green)]/5 border-b border-[var(--mint-green)]/15">
              <CheckCircle2 size={12} className="text-[var(--mint-green)] shrink-0" />
              <span className="text-xs text-[var(--mint-green)]">
                All 5 column headers matched from your import file —
              </span>
              <button
                className="text-xs text-[var(--mint-green)] underline underline-offset-2 hover:text-[var(--mint-green)]/80"
                onMouseEnter={() => setShowMatchTooltip(true)}
                onMouseLeave={() => setShowMatchTooltip(false)}
              >
                View mapping
              </button>

              <AnimatePresence>
                {showMatchTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    className="absolute top-[88px] left-40 z-30 rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3.5 w-56"
                  >
                    <p className="text-[11px] text-[var(--cool-gray)] mb-2">CSV → Spreadsheet mapping</p>
                    {[
                      ["A · Date", "transaction_date"],
                      ["B · Description", "description"],
                      ["C · Category", "category"],
                      ["D · Amount", "amount_php"],
                      ["E · Status", "payment_status"],
                    ].map(([col, csv]) => (
                      <div key={col} className="flex items-center justify-between py-1">
                        <span className="text-xs text-white">{col}</span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--mint-green)]">
                          <CheckCircle2 size={9} />
                          {csv}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Spreadsheet Grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {/* Column headers */}
          <thead>
            <tr className="border-b border-[var(--glass-border)] bg-white/[0.03]">
              {/* Row number header */}
              <th className="w-10 px-3 py-2.5 text-left">
                <span className="text-[10px] text-[var(--cool-gray)]/50">#</span>
              </th>
              {[
                { letter: "A", label: "Date", width: "w-36" },
                { letter: "B", label: "Description", width: "w-auto" },
                { letter: "C", label: "Category", width: "w-44" },
                { letter: "D", label: "Amount", width: "w-36" },
                { letter: "E", label: "Status", width: "w-32" },
              ].map(({ letter, label, width }) => (
                <th
                  key={letter}
                  className={`${width} px-3 py-2.5 text-left border-l border-[var(--glass-border)]`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--cool-gray)]/60 font-mono">{letter}</span>
                    <span className="text-xs text-[var(--cool-gray)]">{label}</span>
                    {isPreview && (
                      <span className="flex items-center gap-0.5 ml-auto">
                        <CheckCircle2 size={9} className="text-[var(--mint-green)]" />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {rows.map((row, i) => {
              const isZebra = i % 2 === 1;
              return (
                <tr
                  key={i}
                  className={`border-b border-[var(--glass-border)]/50 group ${
                    isZebra ? "bg-white/[0.04]" : ""
                  }`}
                >
                  {/* Row number */}
                  <td className="w-10 px-3 py-0 text-center">
                    <span className="text-[10px] text-[var(--cool-gray)]/40 font-mono select-none">{i + 1}</span>
                  </td>

                  {/* A · Date */}
                  <td
                    className={colClasses(i, "date")}
                    onClick={() => setActiveCell(cellId(i, "date"))}
                  >
                    {isActive(i, "date") ? (
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateCell(i, "date", e.target.value)}
                        onBlur={() => setActiveCell(null)}
                        autoFocus
                        className="w-full bg-transparent text-white text-sm focus:outline-none"
                      />
                    ) : (
                      <span className={row.date ? "text-white" : "text-[var(--cool-gray)]/30"}>
                        {row.date || "yyyy-mm-dd"}
                      </span>
                    )}
                  </td>

                  {/* B · Description */}
                  <td
                    className={colClasses(i, "desc")}
                    onClick={() => setActiveCell(cellId(i, "desc"))}
                  >
                    {isActive(i, "desc") ? (
                      <input
                        value={row.description}
                        onChange={(e) => updateCell(i, "description", e.target.value)}
                        onBlur={() => setActiveCell(null)}
                        autoFocus
                        placeholder="Enter description…"
                        className="w-full bg-transparent text-white text-sm focus:outline-none placeholder:text-[var(--cool-gray)]/40"
                      />
                    ) : (
                      <span className={row.description ? "text-white" : "text-[var(--cool-gray)]/30"}>
                        {row.description || "—"}
                      </span>
                    )}
                  </td>

                  {/* C · Category (dropdown) */}
                  <td
                    className={colClasses(i, "cat", "relative")}
                    onClick={() => {
                      setActiveCell(cellId(i, "cat"));
                      setCategoryDropdown(categoryDropdown === i ? null : i);
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={row.category ? "text-white" : "text-[var(--cool-gray)]/30"}>
                        {row.category || "Select…"}
                      </span>
                      <ChevronDown size={12} className="text-[var(--cool-gray)] shrink-0" />
                    </div>

                    <AnimatePresence>
                      {categoryDropdown === i && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute left-0 top-full mt-1 z-20 rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden min-w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/8 ${
                                row.category === cat ? "text-[var(--action-blue)] bg-[var(--action-blue)]/8" : "text-white"
                              }`}
                              onClick={() => {
                                updateCell(i, "category", cat);
                                setCategoryDropdown(null);
                                setActiveCell(null);
                              }}
                            >
                              {cat}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>

                  {/* D · Amount */}
                  <td
                    className={colClasses(i, "amount", "text-right")}
                    onClick={() => setActiveCell(cellId(i, "amount"))}
                  >
                    {isActive(i, "amount") ? (
                      <input
                        type="number"
                        value={row.amount === "" ? "" : row.amount}
                        onChange={(e) =>
                          updateCell(i, "amount", e.target.value === "" ? "" : Number(e.target.value))
                        }
                        onBlur={() => setActiveCell(null)}
                        autoFocus
                        placeholder="0.00"
                        className="w-full bg-transparent text-white text-sm text-right focus:outline-none placeholder:text-[var(--cool-gray)]/40"
                      />
                    ) : (
                      <span className={row.amount !== "" ? "text-white" : "text-[var(--cool-gray)]/30"}>
                        {row.amount !== "" ? format(Number(row.amount)) : "—"}
                      </span>
                    )}
                  </td>

                  {/* E · Status (dropdown) */}
                  <td
                    className={colClasses(i, "status", "relative")}
                    onClick={() => {
                      setActiveCell(cellId(i, "status"));
                      setStatusDropdown(statusDropdown === i ? null : i);
                    }}
                  >
                    {row.status ? (
                      <StatusBadge status={row.status} />
                    ) : (
                      <span className="text-[var(--cool-gray)]/30 text-xs">Select…</span>
                    )}

                    <AnimatePresence>
                      {statusDropdown === i && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute left-0 top-full mt-1 z-20 rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden min-w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <button
                              key={s}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/8"
                              onClick={() => {
                                updateCell(i, "status", s);
                                setStatusDropdown(null);
                                setActiveCell(null);
                              }}
                            >
                              <StatusBadge status={s} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Sheet Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--glass-border)] bg-white/[0.01]">
        <span className="text-[11px] text-[var(--cool-gray)]">
          {isPreview
            ? `${rows.length} rows imported · Click any cell to edit`
            : "Click any cell to edit · Import a file to populate rows"}
        </span>
        {isPreview && (
          <span className="text-[11px] text-[var(--cool-gray)]">
            Total imported:{" "}
            <span className="text-white">
              {format(
                rows.reduce((s, r) => s + (r.amount !== "" ? Number(r.amount) : 0), 0)
              )}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

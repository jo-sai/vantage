import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Plus, Trash2, FileDown, Send, ChevronDown, Loader2,
} from "lucide-react";
import { useCurrency } from "./CurrencyContext";

// ─── Types ────────────────────────────────────────────────────────────────

interface Client {
  id: number;
  name: string;
  address: string;
}

interface LineItem {
  id: number;
  description: string;
  quantity: number | "";
  rate: number | "";
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CLIENTS: Client[] = [
  { id: 1, name: "BuildRight Supplies Co.", address: "123 Industrial Ave, Quezon City\nMetro Manila 1100, Philippines" },
  { id: 2, name: "TechEquip Rentals", address: "45 Bonifacio St, Makati City\nMetro Manila 1200, Philippines" },
  { id: 3, name: "Safety First Inc.", address: "78 Commerce Rd, Pasig City\nMetro Manila 1600, Philippines" },
  { id: 4, name: "PowerGrid Electric", address: "11 Energy Lane, Mandaluyong\nMetro Manila 1550, Philippines" },
  { id: 5, name: "TransLogistics LLC", address: "22 Harbor Blvd, Port Area\nManila 1018, Philippines" },
];

const VAT_RATE = 0.12;

function generateInvoiceNumber() {
  const num = Math.floor(Math.random() * 9000 + 1000);
  return `VAN-2026-${num}`;
}

const TODAY = new Date().toLocaleDateString("en-PH", {
  year: "numeric", month: "long", day: "numeric",
});

// ─── Component ────────────────────────────────────────────────────────────

export function InvoiceModal({ isOpen, onClose }: InvoiceModalProps) {
  const { format } = useCurrency();

  const [invoiceNumber] = useState(generateInvoiceNumber);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDropdown, setClientDropdown] = useState(false);
  const [billingAddress, setBillingAddress] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, description: "Labor Services", quantity: 1, rate: 35200 },
    { id: 2, description: "Equipment Rental", quantity: 3, rate: 4200 },
  ]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [pdfSent, setPdfSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedClient(null);
      setBillingAddress("");
      setLineItems([
        { id: 1, description: "Labor Services", quantity: 1, rate: 35200 },
        { id: 2, description: "Equipment Rental", quantity: 3, rate: 4200 },
      ]);
      setPdfSent(false);
      setEmailSent(false);
    }
  }, [isOpen]);

  // Auto-fill address when client is selected
  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setBillingAddress(client.address);
    setClientDropdown(false);
  };

  // ── Line item operations ──

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now(), description: "", quantity: 1, rate: "" },
    ]);
  };

  const removeLineItem = (id: number) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLineItem = <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // ── Calculations ──

  const lineTotal = (item: LineItem) => {
    const qty = item.quantity === "" ? 0 : Number(item.quantity);
    const rate = item.rate === "" ? 0 : Number(item.rate);
    return qty * rate;
  };

  const subtotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const vat = subtotal * VAT_RATE;
  const grandTotal = subtotal + vat;

  // ── Actions ──

  const handleGeneratePdf = () => {
    setGeneratingPdf(true);
    setTimeout(() => {
      setGeneratingPdf(false);
      setPdfSent(true);
    }, 1400);
  };

  const handleSendToClient = () => {
    if (!selectedClient) return;
    setSendingEmail(true);
    setTimeout(() => {
      setSendingEmail(false);
      setEmailSent(true);
    }, 1400);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="inv-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#0F1419]/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="inv-modal"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[760px] max-h-[90vh] flex flex-col relative">
              {/* Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/12 blur-xl opacity-80 pointer-events-none" />

              <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[0_0_60px_rgba(59,130,246,0.15)] flex flex-col overflow-hidden">

                {/* ── Invoice Header ── */}
                <div className="px-7 pt-6 pb-5 border-b border-[var(--glass-border)] flex items-start justify-between bg-white/[0.02]">
                  <div className="flex items-start gap-4">
                    {/* Vantage Logo */}
                    <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--action-blue)] to-[#2563EB] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] shrink-0">
                      <span className="text-white font-semibold">V</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--cool-gray)] tracking-[0.15em] uppercase">Invoice</span>
                        <span className="text-xs text-[var(--action-blue)] font-mono">{invoiceNumber}</span>
                      </div>
                      <p className="text-[11px] text-[var(--cool-gray)] mt-0.5">Vantage Construction Management</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--cool-gray)]">Date Issued</p>
                      <p className="text-xs text-white mt-0.5">{TODAY}</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="size-8 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/8 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

                  {/* Client + Billing Address row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Client dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">
                        Client Name <span className="text-[var(--action-blue)]">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setClientDropdown(!clientDropdown)}
                          className={`w-full h-10 px-3 rounded-lg bg-[var(--input-background)] flex items-center justify-between border text-sm transition-all ${
                            clientDropdown
                              ? "border-[var(--action-blue)]/50 ring-2 ring-[var(--action-blue)]/20"
                              : "border-[var(--glass-border)] hover:border-[var(--action-blue)]/30"
                          }`}
                        >
                          <span className={selectedClient ? "text-white" : "text-[var(--cool-gray)]"}>
                            {selectedClient?.name ?? "Select client…"}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-[var(--cool-gray)] transition-transform ${clientDropdown ? "rotate-180" : ""}`}
                          />
                        </button>

                        <AnimatePresence>
                          {clientDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.98 }}
                              transition={{ duration: 0.13 }}
                              className="absolute top-full mt-1.5 left-0 right-0 z-20 rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
                            >
                              {CLIENTS.map((client) => (
                                <button
                                  key={client.id}
                                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/8 ${
                                    selectedClient?.id === client.id
                                      ? "text-[var(--action-blue)] bg-[var(--action-blue)]/8"
                                      : "text-white"
                                  }`}
                                  onClick={() => selectClient(client)}
                                >
                                  {client.name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Billing address */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">Billing Address</label>
                      <textarea
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        placeholder="Auto-populated from client selection…"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-sm text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/35 resize-none transition-all"
                      />
                    </div>
                  </div>

                  {/* ── Line Items Table ── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-white/80 tracking-wide">Line Items</label>
                    </div>

                    {/* Table header */}
                    <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
                      <div className="grid grid-cols-[1fr_80px_120px_120px_36px] gap-0 bg-white/[0.03] border-b border-[var(--glass-border)]">
                        {["Item / Description", "Qty", "Rate", "Total", ""].map((h, i) => (
                          <div key={i} className={`px-3 py-2 text-xs text-[var(--cool-gray)] ${i >= 1 ? "text-right" : ""}`}>
                            {h}
                          </div>
                        ))}
                      </div>

                      {/* Line rows */}
                      {lineItems.map((item, idx) => {
                        const total = lineTotal(item);
                        return (
                          <div
                            key={item.id}
                            className={`grid grid-cols-[1fr_80px_120px_120px_36px] border-b border-[var(--glass-border)]/50 last:border-0 ${
                              idx % 2 === 1 ? "bg-white/[0.04]" : ""
                            }`}
                          >
                            {/* Description */}
                            <div className="px-3 py-2">
                              <input
                                value={item.description}
                                onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                placeholder="Item description…"
                                className="w-full bg-transparent text-sm text-white placeholder:text-[var(--cool-gray)]/40 focus:outline-none"
                              />
                            </div>

                            {/* Quantity */}
                            <div className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "quantity",
                                    e.target.value === "" ? "" : Number(e.target.value)
                                  )
                                }
                                className="w-full bg-transparent text-sm text-white text-right focus:outline-none"
                                min={1}
                              />
                            </div>

                            {/* Rate */}
                            <div className="px-3 py-2">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "rate",
                                    e.target.value === "" ? "" : Number(e.target.value)
                                  )
                                }
                                placeholder="0.00"
                                className="w-full bg-transparent text-sm text-white text-right focus:outline-none placeholder:text-[var(--cool-gray)]/30"
                              />
                            </div>

                            {/* Total */}
                            <div className="px-3 py-2 flex items-center justify-end">
                              <span className="text-sm text-white">{format(total)}</span>
                            </div>

                            {/* Delete */}
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => removeLineItem(item.id)}
                                disabled={lineItems.length <= 1}
                                className="size-6 rounded flex items-center justify-center text-[var(--cool-gray)] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add line */}
                    <button
                      onClick={addLineItem}
                      className="flex items-center gap-1.5 text-xs text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors"
                    >
                      <Plus size={13} />
                      Add line item
                    </button>
                  </div>

                  {/* ── Totals ── */}
                  <div className="ml-auto w-72 space-y-2 rounded-xl border border-[var(--glass-border)] p-4 bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--cool-gray)]">Subtotal</span>
                      <span className="text-sm text-white">{format(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--cool-gray)]">VAT (12%)</span>
                      <span className="text-sm text-white">{format(vat)}</span>
                    </div>
                    <div className="h-px bg-[var(--glass-border)]" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">Grand Total</span>
                      <span className="text-lg text-[var(--action-blue)] shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                        {format(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Success messages */}
                  <AnimatePresence>
                    {(pdfSent || emailSent) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-2"
                      >
                        {pdfSent && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--mint-green)]/10 border border-[var(--mint-green)]/25">
                            <FileDown size={12} className="text-[var(--mint-green)]" />
                            <span className="text-xs text-[var(--mint-green)]">
                              PDF generated — {invoiceNumber}.pdf ready to download
                            </span>
                          </div>
                        )}
                        {emailSent && selectedClient && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--mint-green)]/10 border border-[var(--mint-green)]/25">
                            <Send size={12} className="text-[var(--mint-green)]" />
                            <span className="text-xs text-[var(--mint-green)]">
                              Invoice sent to {selectedClient.name}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Footer Actions ── */}
                <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-[var(--glass-border)] bg-white/[0.01] shrink-0">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm text-[var(--cool-gray)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)] transition-all"
                  >
                    Close
                  </button>

                  <div className="flex items-center gap-3">
                    {/* Generate PDF */}
                    <button
                      onClick={handleGeneratePdf}
                      disabled={generatingPdf}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--action-blue)] text-sm text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {generatingPdf ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileDown size={14} />
                      )}
                      <span>{generatingPdf ? "Generating…" : "Generate PDF"}</span>
                    </button>

                    {/* Send to Client */}
                    <button
                      onClick={handleSendToClient}
                      disabled={!selectedClient || sendingEmail}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--mint-green)] text-sm text-[var(--deep-slate)] hover:bg-[var(--mint-green)]/90 active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {sendingEmail ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>{sendingEmail ? "Sending…" : "Send to Client"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, ClipboardCheck, Paperclip, ChevronRight, ChevronDown,
  Loader2, CheckCircle2, AlertTriangle, ArrowRight, Trash2,
} from "lucide-react";

interface ProgressReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    summary: string;
    status: "On Track" | "Delayed";
    attachments: string[];
  }) => void;
  sentToLabel: string; // "Ana Reyes · Team Leader" or "Org Admin"
  role: "Organization Admin" | "Team Leader" | "Employee";
}

const STATUS_OPTIONS: { value: "On Track" | "Delayed"; label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }[] = [
  {
    value: "On Track",
    label: "On Track",
    icon: CheckCircle2,
    color: "text-[var(--mint-green)]",
    bg: "bg-[var(--mint-green)]/10",
    border: "border-[var(--mint-green)]/50",
  },
  {
    value: "Delayed",
    label: "Delayed",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/50",
  },
];

export function ProgressReportModal({
  isOpen,
  onClose,
  onSubmit,
  sentToLabel,
  role,
}: ProgressReportModalProps) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"On Track" | "Delayed">("On Track");
  const [mockFiles, setMockFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSummary("");
    setStatus("On Track");
    setMockFiles([]);
    setSubmitting(false);
    setSummaryError(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileClick = () => {
    // Mock file picker — adds a placeholder filename
    const sampleFiles = [
      "site_photo_01.jpg",
      "progress_report.pdf",
      "inspection_checklist.xlsx",
      "equipment_log.jpg",
      "concrete_pour_log.pdf",
    ];
    const next = sampleFiles[mockFiles.length % sampleFiles.length];
    if (!mockFiles.includes(next)) {
      setMockFiles((prev) => [...prev, next]);
    }
  };

  const handleSubmit = () => {
    if (!summary.trim()) {
      setSummaryError(true);
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ summary: summary.trim(), status, attachments: mockFiles });
      reset();
    }, 1000);
  };

  const isEmployee = role === "Employee";
  const isLeader = role === "Team Leader";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="report-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-[#0F1419]/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="report-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[520px]">
              {/* Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-[var(--mint-green)]/10 blur-xl opacity-80 pointer-events-none" />

              <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[0_0_60px_rgba(16,185,129,0.12)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/30 flex items-center justify-center">
                      <ClipboardCheck size={17} className="text-[var(--mint-green)]" />
                    </div>
                    <div>
                      <h3 className="text-white">Progress Report</h3>
                      <p className="text-xs text-[var(--cool-gray)]">
                        {isEmployee ? "Submit your update to your team leader" : "Submit your team summary to Org Admin"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="size-8 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/8 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  {/* Work Summary */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">
                      Work Summary <span className="text-[var(--action-blue)]">*</span>
                    </label>
                    <textarea
                      value={summary}
                      onChange={(e) => {
                        setSummary(e.target.value);
                        if (summaryError) setSummaryError(false);
                      }}
                      rows={4}
                      placeholder={
                        isEmployee
                          ? "Describe your work today — tasks completed, progress made, blockers encountered..."
                          : "Provide a team-level summary — key milestones, blockers, and next steps..."
                      }
                      className={`w-full px-4 py-3 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] text-sm focus:outline-none focus:ring-2 resize-none transition-all ${
                        summaryError
                          ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                          : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                      }`}
                    />
                    {summaryError && (
                      <p className="text-[11px] text-[#EF4444]">Work summary is required.</p>
                    )}
                    <div className="flex justify-end">
                      <span className={`text-[10px] ${summary.length > 450 ? "text-amber-400" : "text-[var(--cool-gray)]"}`}>
                        {summary.length}/500
                      </span>
                    </div>
                  </div>

                  {/* Status Update */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">Status Update</label>
                    <div className="flex gap-3">
                      {STATUS_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatus(opt.value)}
                            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg border transition-all ${
                              active
                                ? `${opt.bg} ${opt.border} shadow-[0_0_14px_rgba(0,0,0,0.2)]`
                                : "bg-[var(--input-background)] border-[var(--glass-border)] hover:border-white/20"
                            }`}
                          >
                            <Icon size={14} className={active ? opt.color : "text-[var(--cool-gray)]"} />
                            <span className={`text-sm ${active ? "text-white" : "text-[var(--cool-gray)]"}`}>
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photos / Attachments */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">
                      Photos &amp; Attachments
                      <span className="ml-1.5 text-[var(--cool-gray)]">(optional)</span>
                    </label>

                    {/* File list */}
                    {mockFiles.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {mockFiles.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)]"
                          >
                            <Paperclip size={12} className="text-[var(--action-blue)] shrink-0" />
                            <span className="text-xs text-white flex-1 truncate">{file}</span>
                            <button
                              type="button"
                              onClick={() => setMockFiles((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-[var(--cool-gray)] hover:text-[#EF4444] transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleFileClick}
                      className="w-full h-10 rounded-lg bg-[var(--input-background)] border border-dashed border-[var(--glass-border)] hover:border-[var(--action-blue)]/40 text-[var(--cool-gray)] hover:text-white text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <Paperclip size={13} />
                      Add file or photo
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,.xlsx,.doc,.docx" />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-1 space-y-3">
                  {/* Routing label */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--action-blue)]/8 border border-[var(--action-blue)]/20">
                    <ArrowRight size={12} className="text-[var(--action-blue)] shrink-0" />
                    <p className="text-[11px] text-[var(--cool-gray)]">
                      This report will be sent to{" "}
                      <span className="text-white">{sentToLabel}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 rounded-lg text-sm text-[var(--cool-gray)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-5 py-2 rounded-lg bg-[var(--mint-green)] text-[var(--deep-slate)] hover:bg-[var(--mint-green)]/85 active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Submitting…</span>
                        </>
                      ) : (
                        <>
                          <ClipboardCheck size={13} />
                          <span>Submit Report</span>
                        </>
                      )}
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

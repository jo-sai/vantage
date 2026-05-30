import { useState } from "react";
import { X, FileText, Calendar, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCurrency } from "./CurrencyContext";

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: {
    name: string;
    date: string;
    progress: number;
    description?: string;
  };
}

// Deterministic demo cost in PHP per milestone, derived from name length so values stay stable.
function estimatedCostPhp(name: string): number {
  const base = 75000;
  const variance = (name.length * 12345) % 425000;
  return base + variance;
}

export function MilestoneModal({ isOpen, onClose, milestone }: MilestoneModalProps) {
  const [progress, setProgress] = useState(milestone.progress);
  const { format } = useCurrency();
  const costPhp = estimatedCostPhp(milestone.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--deep-slate)] border border-[var(--glass-border)] rounded-lg shadow-2xl z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <h3 className="text-white">Milestone Update</h3>
              <button
                onClick={onClose}
                className="size-8 rounded flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Milestone Info */}
              <div>
                <h4 className="text-white mb-2">{milestone.name}</h4>
                <div className="flex items-center gap-2 text-sm text-[var(--cool-gray)]">
                  <Calendar size={14} />
                  <span>{milestone.date}</span>
                </div>
                {milestone.description && (
                  <p className="text-sm text-[var(--cool-gray)] mt-3">{milestone.description}</p>
                )}
              </div>

              {/* Estimated Cost */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-[var(--glass-border)]">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 flex items-center justify-center">
                    <Wallet size={16} className="text-[var(--action-blue)]" />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--cool-gray)]">Estimated Cost</div>
                    <div className="text-sm text-white">{format(costPhp)}</div>
                  </div>
                </div>
                <span className="text-xs text-[var(--cool-gray)]">Live FX</span>
              </div>

              {/* Progress Slider */}
              <div>
                <label className="block text-sm text-[var(--cool-gray)] mb-3">
                  Manual Progress Update
                </label>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--action-blue)] [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--cool-gray)]">0%</span>
                    <span className="text-lg text-white">{progress}%</span>
                    <span className="text-xs text-[var(--cool-gray)]">100%</span>
                  </div>
                </div>
              </div>

              {/* Report Attachment */}
              <div>
                <label className="block text-sm text-[var(--cool-gray)] mb-3">
                  Report Attachment
                </label>
                <button className="w-full px-4 py-3 rounded border border-[var(--glass-border)] bg-white/5 hover:bg-white/10 transition-all flex items-center gap-3">
                  <FileText size={18} className="text-[var(--cool-gray)]" />
                  <span className="text-sm text-white">Attach Progress Report</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--glass-border)]">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Updating milestone:', milestone.name, 'to', progress, '%');
                  onClose();
                }}
                className="px-4 py-2 rounded bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all"
              >
                Save Update
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  text: string;
  timestamp: string;
}

interface Props {
  target: { name: string; day: number } | null;
  onClose: () => void;
}

export function EmployeeCommentSidebar({ target, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (target) {
      setComments([
        { id: "c1", text: "Materials delivered on schedule.", timestamp: "2h ago" },
        { id: "c2", text: "Crew ready for next phase.", timestamp: "30m ago" },
      ]);
    }
  }, [target]);

  const handleSend = () => {
    if (!input.trim()) return;
    setComments((prev) => [...prev, { id: `c-${Date.now()}`, text: input, timestamp: "now" }]);
    setInput("");
    toast.success("Comment posted", {
      style: {
        background: "var(--deep-slate)",
        border: "1px solid var(--mint-green)",
        color: "white",
      },
    });
  };

  return (
    <AnimatePresence>
      {target && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-16 bottom-0 w-96 border-l border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl z-40 flex flex-col"
        >
          <div className="p-6 border-b border-[var(--glass-border)] flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={16} className="text-[var(--mint-green)]" />
                <h3 className="text-white">Bar Comments</h3>
              </div>
              <p className="text-xs text-[var(--cool-gray)]">{target.name} · Day {target.day}</p>
            </div>
            <button
              onClick={onClose}
              className="size-8 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-white/5 border border-[var(--glass-border)]">
                <p className="text-sm text-white mb-1">{c.text}</p>
                <span className="text-xs text-[var(--cool-gray)]">{c.timestamp}</span>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-[var(--glass-border)]">
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white text-sm placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="size-9 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

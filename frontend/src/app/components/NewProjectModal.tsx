import { useState, useEffect } from "react";
import { X, Calendar, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface NewProjectData {
  name: string;
  start: number;
  end: number;
  generateGantt: boolean;
  location: string;
  dependsOnId?: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: NewProjectData) => void;
  maxDay: number;
  existingProjects: Array<{ id: string; name: string }>;
  title?: string;
}

export function NewProjectModal({ isOpen, onClose, onCreate, maxDay, existingProjects, title = "New Team Project" }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(10);
  const [generateGantt, setGenerateGantt] = useState(true);
  const [location, setLocation] = useState("Seattle");
  const [projectType, setProjectType] = useState<"independent" | "dependent">("independent");
  const [dependsOnId, setDependsOnId] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setStart(1);
      setEnd(10);
      setGenerateGantt(true);
      setLocation("Seattle");
      setProjectType("independent");
      setDependsOnId(existingProjects[0]?.id || "");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && existingProjects.length > 0) {
      const exists = existingProjects.some((p) => p.id === dependsOnId);
      if (!exists) {
        setDependsOnId(existingProjects[0].id);
      }
    }
  }, [isOpen, existingProjects, dependsOnId]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (start < 1 || end > maxDay || start >= end) {
      setError(`Start must be < End, both within 1 - ${maxDay}`);
      return;
    }
    if (projectType === "dependent" && !dependsOnId) {
      setError("Please select a precursor project dependency");
      return;
    }
    onCreate({ 
      name: name.trim(), 
      start, 
      end, 
      generateGantt, 
      location, 
      dependsOnId: projectType === "dependent" ? dependsOnId : undefined 
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--deep-slate)] border border-[var(--glass-border)] rounded-lg shadow-2xl z-50"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <h3 className="text-white">{title}</h3>
              <button
                onClick={onClose}
                className="size-8 rounded flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-[var(--cool-gray)] mb-2">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Foundation Reinforcement"
                  className="w-full px-3 py-2.5 rounded bg-white/5 border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)]/60 focus:outline-none focus:border-[var(--action-blue)] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--cool-gray)] mb-2">Project Location (City)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Manila, Paris, Houston"
                  className="w-full px-3 py-2.5 rounded bg-white/5 border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)]/60 focus:outline-none focus:border-[var(--action-blue)] transition-all text-sm"
                />
              </div>

              {/* Dependency Setup */}
              <div className="space-y-3">
                <label className="block text-sm text-[var(--cool-gray)]">Project Type & Dependency</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setProjectType("independent")}
                    className={`flex-1 py-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                      projectType === "independent"
                        ? "bg-[var(--action-blue)]/15 border-[var(--action-blue)] text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                        : "bg-white/5 border-[var(--glass-border)] text-[var(--cool-gray)] hover:text-white"
                    }`}
                  >
                    Independent Project
                  </button>
                  <button
                    type="button"
                    disabled={existingProjects.length === 0}
                    onClick={() => setProjectType("dependent")}
                    className={`flex-1 py-2 rounded-lg border text-center text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      projectType === "dependent"
                        ? "bg-[var(--action-blue)]/15 border-[var(--action-blue)] text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                        : "bg-white/5 border-[var(--glass-border)] text-[var(--cool-gray)] hover:text-white"
                    }`}
                  >
                    Dependent Project
                  </button>
                </div>
                {existingProjects.length === 0 && (
                  <span className="text-[10px] text-amber-500/80 block mt-1">
                    ⚠️ No existing projects available to set as a precursor.
                  </span>
                )}

                {projectType === "dependent" && existingProjects.length > 0 && (
                  <div className="mt-2">
                    <label className="block text-xs text-[var(--cool-gray)] mb-1.5">Precursor Project (Must finish first)</label>
                    <select
                      value={dependsOnId}
                      onChange={(e) => setDependsOnId(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[var(--deep-slate)] border border-[var(--glass-border)] text-white focus:outline-none focus:border-[var(--action-blue)] transition-all cursor-pointer text-sm"
                    >
                      {existingProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--cool-gray)] mb-2 flex items-center gap-2">
                    <Calendar size={14} /> Start Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxDay}
                    value={start}
                    onChange={(e) => setStart(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 rounded bg-white/5 border border-[var(--glass-border)] text-white focus:outline-none focus:border-[var(--action-blue)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--cool-gray)] mb-2 flex items-center gap-2">
                    <Calendar size={14} /> End Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxDay}
                    value={end}
                    onChange={(e) => setEnd(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 rounded bg-white/5 border border-[var(--glass-border)] text-white focus:outline-none focus:border-[var(--action-blue)] transition-all"
                  />
                </div>
              </div>

              <button
                onClick={() => setGenerateGantt(!generateGantt)}
                className="flex items-center gap-3 w-full p-3 rounded border border-[var(--glass-border)] bg-white/5 hover:bg-white/10 transition-all text-left"
              >
                {generateGantt ? (
                  <CheckSquare size={20} className="text-[var(--action-blue)] shrink-0" />
                ) : (
                  <Square size={20} className="text-[var(--cool-gray)] shrink-0" />
                )}
                <div>
                  <div className="text-sm text-white">Generate Gantt</div>
                  <div className="text-xs text-[var(--cool-gray)]">Render this project as a row in the timeline grid</div>
                </div>
              </button>

              {error && (
                <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--glass-border)]">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all"
              >
                Create Project
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

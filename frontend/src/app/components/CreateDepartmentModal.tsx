import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Building2, ChevronDown, Globe, Lock, Bell, Loader2 } from "lucide-react";
import { TEAM_LEADERS } from "../data/workspaceData";
import { OrgMember } from "./OrgContext";

export interface NewDepartmentData {
  name: string;
  assignedHead: string;
  isPrivate: boolean;
}

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: NewDepartmentData) => void;
  members?: OrgMember[];
}

export function CreateDepartmentModal({ isOpen, onClose, onConfirm, members = [] }: CreateDepartmentModalProps) {
  const [name, setName] = useState("");
  const [assignedHead, setAssignedHead] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; head?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setAssignedHead("");
      setIsPrivate(false);
      setErrors({});
      setSubmitting(false);
      setDropdownOpen(false);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const validate = () => {
    const errs: { name?: string; head?: string } = {};
    if (!name.trim()) errs.name = "Department name is required.";
    if (!assignedHead) errs.head = "Please assign a department head.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      onConfirm({ name: name.trim(), assignedHead, isPrivate });
      setSubmitting(false);
    }, 900);
  };

  const candidates = (members && members.length > 0 ? members : TEAM_LEADERS).map((m) => {
    if ("avatarGradient" in m) {
      return {
        id: m.id,
        name: m.name,
        initials: m.initials,
        gradient: m.avatarGradient,
        team: m.role || m.department || "Member",
      };
    }
    return {
      id: m.id,
      name: m.name,
      initials: m.initials,
      gradient: m.gradient,
      team: m.team,
    };
  });

  const selectedLeader = candidates.find((c) => c.id === assignedHead);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dept-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#0F1419]/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="dept-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[480px]">
              {/* Glow halo */}
              <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/15 blur-xl opacity-80 pointer-events-none" />

              <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[0_0_60px_rgba(59,130,246,0.18)] overflow-visible">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 flex items-center justify-center">
                      <Building2 size={17} className="text-[var(--action-blue)]" />
                    </div>
                    <div>
                      <h3 className="text-white">New Department</h3>
                      <p className="text-xs text-[var(--cool-gray)]">Configure workspace and assign a head</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="size-8 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/8 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  {/* Department Name */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">
                      Department Name <span className="text-[var(--action-blue)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                      }}
                      placeholder="e.g. Geotechnical, Civil Works, Finance"
                      className={`w-full h-11 px-4 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${
                        errors.name
                          ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                          : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                      }`}
                    />
                    {errors.name && (
                      <p className="text-[11px] text-[#EF4444]">{errors.name}</p>
                    )}
                  </div>

                  {/* Assign Head */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">
                      Assign Head <span className="text-[var(--action-blue)]">*</span>
                    </label>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className={`w-full h-11 px-4 rounded-lg bg-[var(--input-background)] flex items-center justify-between transition-all ${
                          errors.head
                            ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                            : "border border-[var(--glass-border)] hover:border-[var(--action-blue)]/40"
                        } ${dropdownOpen ? "ring-2 ring-[var(--action-blue)]/40 border-[var(--action-blue)]/40" : ""}`}
                      >
                        {selectedLeader ? (
                          <div className="flex items-center gap-2.5">
                            <div
                              className="size-6 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: selectedLeader.gradient }}
                            >
                              <span className="text-[10px] text-white">{selectedLeader.initials}</span>
                            </div>
                            <span className="text-sm text-white">{selectedLeader.name}</span>
                            <span className="text-xs text-[var(--cool-gray)]">· {selectedLeader.team}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--cool-gray)]">
                            {members && members.length > 0 ? "Select a Department Head…" : "Select a Team Leader…"}
                          </span>
                        )}
                        <ChevronDown
                          size={15}
                          className={`text-[var(--cool-gray)] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {dropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.14 }}
                            className="absolute top-full mt-1.5 left-0 right-0 z-20 rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
                          >
                            {candidates.map((leader) => (
                              <button
                                key={leader.id}
                                type="button"
                                onClick={() => {
                                  setAssignedHead(leader.id);
                                  setDropdownOpen(false);
                                  if (errors.head) setErrors((p) => ({ ...p, head: undefined }));
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                                  assignedHead === leader.id ? "bg-[var(--action-blue)]/10" : ""
                                }`}
                              >
                                <div
                                  className="size-7 rounded-full flex items-center justify-center shrink-0"
                                  style={{ background: leader.gradient }}
                                >
                                  <span className="text-[11px] text-white">{leader.initials}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{leader.name}</p>
                                  <p className="text-xs text-[var(--cool-gray)] truncate">{leader.team}</p>
                                </div>
                                {assignedHead === leader.id && (
                                  <div className="size-4 rounded-full bg-[var(--action-blue)] flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 10 10" className="size-2.5 fill-none stroke-white stroke-2">
                                      <polyline points="1,5 3.5,7.5 9,2" />
                                    </svg>
                                  </div>
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {errors.head && (
                      <p className="text-[11px] text-[#EF4444]">{errors.head}</p>
                    )}
                  </div>

                  {/* Privacy Toggle */}
                  <div className="space-y-2">
                    <label className="block text-xs text-white/80 tracking-wide">Visibility</label>
                    <div className="flex items-stretch gap-3">
                      {/* Public option */}
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`flex-1 flex flex-col items-start gap-2 p-4 rounded-xl border transition-all ${
                          !isPrivate
                            ? "bg-[var(--action-blue)]/10 border-[var(--action-blue)]/50 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
                            : "bg-[var(--input-background)] border-[var(--glass-border)] hover:border-white/20"
                        }`}
                      >
                        <div className={`size-8 rounded-lg flex items-center justify-center ${
                          !isPrivate ? "bg-[var(--action-blue)]/20" : "bg-white/5"
                        }`}>
                          <Globe size={15} className={!isPrivate ? "text-[var(--action-blue)]" : "text-[var(--cool-gray)]"} />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm ${!isPrivate ? "text-white" : "text-[var(--cool-gray)]"}`}>
                            Public to Org
                          </p>
                          <p className="text-[11px] text-[var(--cool-gray)] mt-0.5 leading-snug">
                            All members can see this workspace
                          </p>
                        </div>
                        <div className={`size-3.5 rounded-full border ml-auto self-start mt-0.5 ${
                          !isPrivate
                            ? "border-[var(--action-blue)] bg-[var(--action-blue)]"
                            : "border-[var(--glass-border)]"
                        }`}>
                          {!isPrivate && (
                            <div className="size-full rounded-full bg-white scale-[0.45] m-auto" style={{ margin: "auto" }} />
                          )}
                        </div>
                      </button>

                      {/* Private option */}
                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`flex-1 flex flex-col items-start gap-2 p-4 rounded-xl border transition-all ${
                          isPrivate
                            ? "bg-[var(--action-blue)]/10 border-[var(--action-blue)]/50 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
                            : "bg-[var(--input-background)] border-[var(--glass-border)] hover:border-white/20"
                        }`}
                      >
                        <div className={`size-8 rounded-lg flex items-center justify-center ${
                          isPrivate ? "bg-[var(--action-blue)]/20" : "bg-white/5"
                        }`}>
                          <Lock size={15} className={isPrivate ? "text-[var(--action-blue)]" : "text-[var(--cool-gray)]"} />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm ${isPrivate ? "text-white" : "text-[var(--cool-gray)]"}`}>
                            Private Team
                          </p>
                          <p className="text-[11px] text-[var(--cool-gray)] mt-0.5 leading-snug">
                            Admin and head only until members added
                          </p>
                        </div>
                        <div className={`size-3.5 rounded-full border ml-auto self-start mt-0.5 ${
                          isPrivate
                            ? "border-[var(--action-blue)] bg-[var(--action-blue)]"
                            : "border-[var(--glass-border)]"
                        }`}>
                          {isPrivate && (
                            <div className="size-full rounded-full bg-white scale-[0.45] m-auto" style={{ margin: "auto" }} />
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Sandbox notice for private */}
                    <AnimatePresence>
                      {isPrivate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20"
                        >
                          <Lock size={12} className="text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-amber-300 leading-relaxed">
                            Workspace sandboxing active — this department will be hidden from all
                            members until you manually add them.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--cool-gray)]">
                    <Bell size={11} />
                    <span>Head will be notified via email</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-sm text-[var(--cool-gray)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-5 py-2 rounded-lg bg-[var(--action-blue)] text-sm text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Creating…</span>
                        </>
                      ) : (
                        <>
                          <Building2 size={13} />
                          <span>Create &amp; Notify</span>
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

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UserPlus, Check, Loader2, Users } from "lucide-react";
import { OrgMember } from "./OrgContext";

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: OrgMember[];
  existingMemberIds: string[];
  onAdd: (memberIds: string[]) => void;
}

export function AddMembersModal({
  isOpen,
  onClose,
  members,
  existingMemberIds = [],
  onAdd,
}: AddMembersModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset selected state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setSubmitting(false);
    }
  }, [isOpen]);

  const candidates = members.filter((m) => !existingMemberIds.includes(m.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setTimeout(() => {
      onAdd(selectedIds);
      setSubmitting(false);
      onClose();
    }, 850);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="add-members-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#0F1419]/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            key="add-members-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[440px]">
              {/* Glow Halo */}
              <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/15 blur-xl opacity-80 pointer-events-none" />

              <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[0_0_60px_rgba(59,130,246,0.18)] overflow-hidden flex flex-col max-h-[520px]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[var(--glass-border)] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 flex items-center justify-center">
                      <UserPlus size={17} className="text-[var(--action-blue)]" />
                    </div>
                    <div>
                      <h3 className="text-white">Add Members</h3>
                      <p className="text-xs text-[var(--cool-gray)]">Invite users to this private workspace</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="size-8 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/8 transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body List */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
                  {candidates.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-[var(--glass-border)] rounded-xl px-4">
                      <Users size={28} className="text-[var(--cool-gray)]/30 mx-auto mb-3" />
                      <h4 className="text-sm text-white mb-1 font-medium">All members already added</h4>
                      <p className="text-xs text-[var(--cool-gray)] max-w-[240px] mx-auto leading-relaxed">
                        Every member of this organization is already a participant of this workspace.
                      </p>
                    </div>
                  ) : (
                    candidates.map((member) => {
                      const isSelected = selectedIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleSelect(member.id)}
                          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[var(--action-blue)]/12 border-[var(--action-blue)]/40 shadow-[0_0_16px_rgba(59,130,246,0.08)]"
                              : "bg-white/[0.015] border-[var(--glass-border)] hover:bg-white/5 hover:border-white/20"
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className="size-8.5 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                            style={{ background: member.avatarGradient }}
                          >
                            {member.initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-white truncate">
                              {member.name}
                            </span>
                            <span className="block text-[11px] text-[var(--cool-gray)] truncate mt-0.5">
                              {member.role} · {member.department}
                            </span>
                          </div>

                          {/* Checkbox circle */}
                          <div
                            className={`size-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                              isSelected
                                ? "bg-[var(--action-blue)] border-[var(--action-blue)]"
                                : "border-[var(--glass-border)] bg-black/20"
                            }`}
                          >
                            {isSelected && <Check size={11} className="text-white stroke-[3px]" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4.5 border-t border-[var(--glass-border)] shrink-0 flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--cool-gray)]">
                    {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""} selected
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--cool-gray)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)] transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={selectedIds.length === 0 || submitting}
                      className="px-4 py-2 rounded-lg bg-[var(--action-blue)] text-xs font-semibold text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Adding…</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={12} />
                          <span>Add to Room</span>
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

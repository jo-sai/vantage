import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Upload, Building2, HardHat, Wrench, Briefcase, Plus, Trash2, ArrowRight, Check } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { name: string; industry: string; invites: string[] }) => void;
}

const INDUSTRIES = [
  { id: "Construction", icon: HardHat },
  { id: "Engineering",  icon: Wrench },
  { id: "Management",   icon: Briefcase },
  { id: "Other",        icon: Building2 },
];

export function CreateOrgModal({ isOpen, onClose, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [logoName, setLogoName] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string>("");
  const [emailInput, setEmailInput] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  const reset = () => {
    setStep(1);
    setOrgName("");
    setLogoName(null);
    setIndustry("");
    setEmailInput("");
    setInvites([]);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const addInvite = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || invites.includes(trimmed)) return;
    setInvites((p) => [...p, trimmed]);
    setEmailInput("");
  };

  const canAdvance =
    (step === 1 && orgName.trim().length > 0) ||
    (step === 2 && industry !== "") ||
    step === 3;

  const handleNext = () => {
    if (step < 3) setStep((s) => s + 1);
    else {
      onComplete({ name: orgName.trim(), industry, invites });
      reset();
    }
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
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-[var(--deep-slate)] border border-[var(--glass-border)] rounded-lg shadow-2xl z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <div>
                <h3 className="text-white">Create Organization</h3>
                <p className="text-xs text-[var(--cool-gray)] mt-1">Step {step} of 3</p>
              </div>
              <button
                onClick={handleClose}
                className="size-8 rounded flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2 px-6 pt-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    n <= step ? "bg-[var(--action-blue)]" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <div className="p-6 min-h-[280px]">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-white mb-1">Name your organization</h4>
                    <p className="text-sm text-[var(--cool-gray)]">This will appear in the top navigation.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">Organization name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Construction Co."
                      className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">Logo (optional)</label>
                    <label className="block w-full px-4 py-6 rounded-lg border border-dashed border-[var(--glass-border)] bg-white/5 hover:bg-white/10 transition-all cursor-pointer text-center">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
                      />
                      <Upload size={18} className="text-[var(--action-blue)] mx-auto mb-2" />
                      <span className="text-sm text-white">{logoName ?? "Click to upload PNG or SVG"}</span>
                    </label>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-white mb-1">Select your industry</h4>
                    <p className="text-sm text-[var(--cool-gray)]">We'll tailor templates and dashboards.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {INDUSTRIES.map(({ id, icon: Icon }) => {
                      const active = industry === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setIndustry(id)}
                          className={`p-4 rounded-lg border text-left transition-all flex items-start gap-3 ${
                            active
                              ? "border-[var(--action-blue)] bg-[var(--action-blue)]/10 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                              : "border-[var(--glass-border)] bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className={`size-9 rounded-lg flex items-center justify-center ${
                            active ? "bg-[var(--action-blue)]/20 text-[var(--action-blue)]" : "bg-white/5 text-[var(--cool-gray)]"
                          }`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-white">{id}</div>
                          </div>
                          {active && <Check size={16} className="text-[var(--mint-green)]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-white mb-1">Invite your team</h4>
                    <p className="text-sm text-[var(--cool-gray)]">Add teammates by email — you can do this later, too.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())}
                      placeholder="teammate@company.com"
                      className="flex-1 h-10 px-4 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                    />
                    <button
                      onClick={addInvite}
                      disabled={!emailInput.trim()}
                      className="size-10 rounded-lg bg-[var(--action-blue)]/20 text-[var(--action-blue)] border border-[var(--action-blue)]/30 hover:bg-[var(--action-blue)]/30 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {invites.length === 0 ? (
                      <p className="text-xs text-[var(--cool-gray)]">No invites yet — that's okay.</p>
                    ) : invites.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between gap-3 p-2 pl-3 rounded-lg bg-white/5 border border-[var(--glass-border)]"
                      >
                        <span className="text-sm text-white truncate">{email}</span>
                        <button
                          onClick={() => setInvites((p) => p.filter((e) => e !== email))}
                          className="size-7 rounded flex items-center justify-center text-[var(--cool-gray)] hover:text-red-400 hover:bg-white/5 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-[var(--glass-border)]">
              <button
                onClick={() => (step > 1 ? setStep((s) => s - 1) : handleClose())}
                className="px-4 py-2 rounded text-white hover:bg-white/5 transition-all text-sm"
              >
                {step > 1 ? "Back" : "Cancel"}
              </button>
              <button
                onClick={handleNext}
                disabled={!canAdvance}
                className="px-5 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span>{step === 3 ? "Finish & Enter Vantage" : "Continue"}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

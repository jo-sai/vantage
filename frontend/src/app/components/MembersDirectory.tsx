import { useState } from "react";
import {
  ChevronDown, Check, ShieldAlert, Sparkles, Copy, Loader2, Key,
  Crown, Shield, Users, UserRound, RefreshCw, AlertTriangle, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useOrg } from "./OrgContext";
import { apiFetch } from "../data/api";
import { ROLE_META, type Role, useRole } from "./RoleContext";

// ─── Role Hierarchy Config ───────────────────────────────────────────────────

const ROLE_HIERARCHY: { role: Role; level: number; label: string; Icon: any; color: string; bg: string; border: string }[] = [
  {
    role: "Organization Owner",
    level: 4,
    label: "Org Owner",
    Icon: Crown,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/25",
  },
  {
    role: "Organization Admin",
    level: 3,
    label: "Org Admin",
    Icon: Shield,
    color: "text-[#3B82F6]",
    bg: "bg-[#3B82F6]/10",
    border: "border-[#3B82F6]/25",
  },
  {
    role: "Team Leader",
    level: 2,
    label: "Team Leader",
    Icon: Users,
    color: "text-[#10B981]",
    bg: "bg-[#10B981]/10",
    border: "border-[#10B981]/25",
  },
  {
    role: "Employee",
    level: 1,
    label: "Employee",
    Icon: UserRound,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
];

function getRoleConfig(role: Role) {
  return ROLE_HIERARCHY.find((r) => r.role === role) ?? ROLE_HIERARCHY[3];
}

function LevelBadge({ role }: { role: Role }) {
  const cfg = getRoleConfig(role);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <cfg.Icon size={8} />
      Lvl {cfg.level}
    </span>
  );
}

// ─── Ownership Transfer Confirmation Dialog ──────────────────────────────────

function OwnershipTransferDialog({
  memberName,
  onConfirm,
  onCancel,
}: {
  memberName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#0F1419]/80 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        className="relative w-full max-w-sm rounded-2xl bg-[rgba(26,31,44,0.98)] border border-red-500/30 p-6 shadow-[0_0_60px_rgba(239,68,68,0.2)] space-y-4"
      >
        {/* Warning header */}
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-0.5">Transfer Ownership</h3>
            <p className="text-xs text-white/50">This action cannot be undone easily.</p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15 text-sm text-white/70 leading-relaxed">
          You are about to transfer <span className="text-white font-medium">Org Owner</span> status to{" "}
          <span className="text-red-300 font-medium">{memberName}</span>. You will be
          downgraded to <span className="text-white">Org Admin</span> and will lose owner-level privileges.
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all text-xs font-semibold shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          >
            Yes, Transfer Ownership
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MembersDirectory() {
  const { activeOrg, refreshOrgs } = useOrg();
  const { role } = useRole();
  const viewerRole = role === "Organization Owner" ? "Owner" : (role === "Organization Admin" ? "Admin" : "Member");

  const [openId, setOpenId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);



  // ─── Invite Link Generator ───────────────────────────────────────────────

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch(`/workspaces/${activeOrg.id}/invites/generate`, {
        method: "POST",
      });
      if (res && res.success) {
        const url = res.inviteUrl || `http://localhost:5173/join/${res.code}`;
        setInviteUrl(url);
        setInviteCode(res.code || "");
        setInviteExpiresAt(res.expiresAt || "");
        toast.success("Invite Link Generated", {
          description: `Secure invitation link created. Expires in ${res.expiresInDays ?? 7} days.`,
          style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" },
        });
      }
    } catch (err: any) {
      toast.error("Generation Failed", { description: err.message || "Failed to generate invite code." });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to Clipboard", {
      description: "Invitation link copied. Share it with your team member.",
      style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
    });
  };

  const handleRegenerateInvite = () => {
    setInviteUrl("");
    setInviteCode("");
    setInviteExpiresAt("");
    handleGenerateInvite();
  };

  // ─── Role Promotion / Demotion ───────────────────────────────────────────

  const handleUpdateRole = async (userId: string, memberName: string, newDisplayRole: Role) => {
    // If Owner is assigning ownership, show confirmation dialog first
    if (viewerRole === "Owner" && newDisplayRole === "Organization Owner") {
      setOpenId(null);
      setTransferTarget({ id: userId, name: memberName });
      return;
    }

    await executeRoleUpdate(userId, newDisplayRole);
  };

  const executeRoleUpdate = async (userId: string, newDisplayRole: Role) => {
    setUpdatingId(userId);
    setOpenId(null);

    const roleMap: Record<Role, string> = {
      "Organization Owner": "OWNER",
      "Organization Admin": "ADMIN",
      "Team Leader": "TEAM_LEADER",
      "Employee": "EMPLOYEE",
    };
    const backendRole = roleMap[newDisplayRole] ?? "EMPLOYEE";

    try {
      const res = await apiFetch(`/workspaces/${activeOrg.id}/members/${userId}/role`, {
        method: "PUT",
        body: { role: backendRole },
      });

      if (res && res.success) {
        toast.success("Role Updated", {
          description: res.message || "Member role successfully updated.",
          style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" },
        });
        await refreshOrgs();
      }
    } catch (err: any) {
      toast.error("Action Prohibited", {
        description: err.message || "Failed to update role.",
        style: { background: "var(--deep-slate)", border: "1px solid #EF4444", color: "white" },
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── Permission Logic ────────────────────────────────────────────────────

  const isOptionDisabled = (memberCurrentRole: Role, optionRole: Role): boolean => {
    if (viewerRole === "Owner") return false; // Owner can set any role

    if (viewerRole === "Admin") {
      // Admin cannot assign Owner or Admin roles
      if (optionRole === "Organization Owner" || optionRole === "Organization Admin") return true;
      // Admin cannot change Owner or Admin members
      if (memberCurrentRole === "Organization Owner" || memberCurrentRole === "Organization Admin") return true;
      return false;
    }
    return true;
  };

  const isSwitcherDisabled = (memberCurrentRole: Role): boolean => {
    if (viewerRole === "Owner") return false;
    if (viewerRole === "Admin") {
      return memberCurrentRole === "Organization Owner" || memberCurrentRole === "Organization Admin";
    }
    return true;
  };

  // ─── Expiry formatter ────────────────────────────────────────────────────
  const formatExpiry = (isoDate: string) => {
    if (!isoDate) return "";
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  const getSixDigitCode = (fullCode: string) => {
    if (!fullCode) return "";
    const parts = fullCode.split("-");
    return parts[parts.length - 1];
  };
  const sixDigitCode = getSixDigitCode(inviteCode);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Ownership Transfer Confirmation Dialog */}
      <AnimatePresence>
        {transferTarget && (
          <OwnershipTransferDialog
            memberName={transferTarget.name}
            onConfirm={async () => {
              const target = transferTarget;
              setTransferTarget(null);
              await executeRoleUpdate(target.id, "Organization Owner");
            }}
            onCancel={() => setTransferTarget(null)}
          />
        )}
      </AnimatePresence>

      <div className="space-y-6">

        {/* ── Hierarchy Legend ── */}
        <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-4">
          <p className="text-[10px] text-[var(--cool-gray)] uppercase tracking-widest mb-3">Role Hierarchy</p>
          <div className="grid grid-cols-4 gap-2">
            {ROLE_HIERARCHY.slice().reverse().map((r) => (
              <div key={r.role} className={`p-3 rounded-xl border ${r.bg} ${r.border} text-center`}>
                <r.Icon size={14} className={`${r.color} mx-auto mb-1`} />
                <p className={`text-[9px] font-bold ${r.color}`}>LEVEL {r.level}</p>
                <p className="text-[9px] text-white/60 mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--cool-gray)]/60 mt-2 text-center">
            New members via invite link join as <span className="text-amber-400">Employee (Level 1)</span> automatically.
          </p>
        </div>

        {/* ── Admin Invite Link Generation Section ── */}
        {(viewerRole === "Owner" || viewerRole === "Admin") && (
          <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl text-white mb-1 flex items-center gap-2">
                  <Key size={18} className="text-[var(--action-blue)]" />
                  Admin Invite Link Generator
                </h2>
                <p className="text-xs text-[var(--cool-gray)]">
                  Create unique, secure invitation tokens mapped directly to this organization. Valid for 7 days.
                </p>
              </div>
            </div>

            {inviteUrl ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Option 1: Secure Invite Link */}
                  <div className="p-5 rounded-xl bg-white/[0.015] border border-[var(--glass-border)] flex flex-col justify-between space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div>
                      <span className="text-[10px] text-[var(--action-blue)] font-bold uppercase tracking-wider block mb-1 font-mono">Option 1: Secure Invite Link</span>
                      <p className="text-xs text-[var(--cool-gray)] leading-relaxed">
                        Perfect for instant messaging. Clicking this secure link will automatically process their authentication and direct-join them.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="flex-1 h-10 px-3.5 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-4 h-10 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold transition-all shrink-0 animate-fade-in"
                      >
                        {copied ? <Check size={14} className="text-[var(--mint-green)]" /> : <Copy size={14} />}
                        <span>{copied ? "Copied!" : "Copy Link"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: 6-Digit Join Code */}
                  <div className="p-5 rounded-xl bg-white/[0.015] border border-[var(--glass-border)] flex flex-col justify-between space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div>
                      <span className="text-[10px] text-[var(--mint-green)] font-bold uppercase tracking-wider block mb-1 font-mono">Option 2: 6-Digit Join Code</span>
                      <p className="text-xs text-[var(--cool-gray)] leading-relaxed">
                        Ideal for manual entry. Share this 6-character alphanumeric key which can be entered into the "Join Organization" modal.
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1.5">
                        {sixDigitCode.split("").map((char, index) => (
                          <div
                            key={index}
                            className="size-9 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] flex items-center justify-center text-sm font-mono font-bold text-white shadow-[0_0_12px_rgba(255,255,255,0.02)] transition-all hover:border-[var(--mint-green)]/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                          >
                            {char}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sixDigitCode);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                          toast.success("Copied to Clipboard", {
                            description: "6-Digit invitation code copied successfully.",
                            style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
                          });
                        }}
                        className="px-4 h-10 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold transition-all shrink-0"
                      >
                        {copiedCode ? <Check size={14} className="text-[var(--mint-green)]" /> : <Copy size={14} />}
                        <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer controls & expiry */}
                <div className="flex items-center justify-between border-t border-[var(--glass-border)]/40 pt-3">
                  <div className="flex items-center gap-2.5 text-[10px] text-[var(--cool-gray)]/60">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[var(--cool-gray)]">Full token: {inviteCode}</span>
                    {inviteExpiresAt && (
                      <span>• Expires {formatExpiry(inviteExpiresAt)}</span>
                    )}
                  </div>
                  <button
                    onClick={handleRegenerateInvite}
                    disabled={generating}
                    className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[var(--cool-gray)] hover:text-white hover:bg-white/10 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 text-xs font-semibold"
                  >
                    <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
                    <span>Regenerate Invite</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                disabled={generating}
                className="h-10 px-5 rounded-lg bg-[var(--action-blue)]/20 border border-[var(--action-blue)]/35 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Generate Invite Code &amp; Link
              </button>
            )}
          </div>
        )}

        {/* ── Members Directory Board ── */}
        <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] overflow-visible">
          <div className="p-6 border-b border-[var(--glass-border)] bg-white/[0.01]">
            <h2 className="text-xl text-white mb-2">Members Directory — {activeOrg.name}</h2>
            <p className="text-sm text-[var(--cool-gray)]">
              {viewerRole === "Owner"
                ? "As Org Owner, you have absolute control over all member roles including ownership transfer."
                : (viewerRole === "Admin"
                  ? "As Org Admin, you can promote Employees (L1) to Team Leaders (L2). Admin and Owner roles are locked."
                  : "As an Organization Member, you can view the complete roster of teammates in the workspace.")}
            </p>
          </div>

          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[var(--glass-border)] bg-white/[0.02]">
            <div className="col-span-4 text-sm text-[var(--cool-gray)] font-semibold">Member</div>
            <div className="col-span-2 text-sm text-[var(--cool-gray)] font-semibold">Level</div>
            <div className="col-span-2 text-sm text-[var(--cool-gray)] font-semibold">Status</div>
            <div className="col-span-4 text-sm text-[var(--cool-gray)] font-semibold">Designate Role</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--glass-border)]/40">
            {activeOrg.members.map((m, idx) => {
              let metaRole: Role = "Employee";
              if (
                m.role === "Organization Owner" ||
                m.role === "Organization Admin" ||
                m.role === "Team Leader" ||
                m.role === "Employee"
              ) {
                metaRole = m.role;
              }

              const roleConfig = getRoleConfig(metaRole);
              const meta = ROLE_META[metaRole] || ROLE_META["Employee"];
              const isOpen = openId === m.id;
              const isUpdating = updatingId === m.id;
              const disabled = isSwitcherDisabled(metaRole);

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-white/[0.03] transition-all ${
                    idx % 2 === 0 ? "bg-white/[0.015]" : ""
                  }`}
                >
                  {/* Member info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className={`size-9 rounded-full bg-gradient-to-br ${meta.gradient || "from-amber-400 to-orange-500"} flex items-center justify-center text-white text-xs font-semibold shrink-0`}
                    >
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white truncate block">{m.name}</span>
                      <span className="text-[10px] text-[var(--cool-gray)] truncate block">{m.department || "Operations"}</span>
                    </div>
                  </div>

                  {/* Level badge */}
                  <div className="col-span-2">
                    <LevelBadge role={metaRole} />
                  </div>

                  {/* Online status */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${m.online ? "bg-[var(--mint-green)]" : "bg-[var(--cool-gray)]/50"}`} />
                    <span className="text-xs text-[var(--cool-gray)]">{m.online ? "Online" : "Offline"}</span>
                  </div>

                  {/* Role dropdown */}
                  <div className="col-span-4 relative">
                    <button
                      onClick={() => !disabled && setOpenId(isOpen ? null : m.id)}
                      disabled={disabled || isUpdating}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--input-background)] border transition-all text-left ${
                        disabled
                          ? "opacity-50 cursor-not-allowed border-transparent text-[var(--cool-gray)]"
                          : "border-[var(--glass-border)] text-white hover:bg-white/10 cursor-pointer"
                      }`}
                    >
                      {isUpdating ? (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--cool-gray)]">
                          <Loader2 size={12} className="animate-spin" />
                          <span>Updating…</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <roleConfig.Icon size={12} className={roleConfig.color} />
                          <span className="text-xs font-medium">{roleConfig.label}</span>
                        </div>
                      )}
                      {!disabled && !isUpdating && <ChevronDown size={12} className="text-[var(--cool-gray)] shrink-0" />}
                    </button>

                    {/* Dropdown options */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-full mt-2 w-full rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-20 p-1.5 space-y-0.5"
                        >
                          {ROLE_HIERARCHY.map((r) => {
                            const optDisabled = isOptionDisabled(metaRole, r.role);
                            const isCurrent = r.role === metaRole;

                            return (
                              <button
                                key={r.role}
                                disabled={optDisabled}
                                onClick={() => handleUpdateRole(m.id, m.name, r.role)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-lg transition-all text-left ${
                                  optDisabled
                                    ? "opacity-30 cursor-not-allowed text-[var(--cool-gray)]"
                                    : isCurrent
                                    ? `${r.bg} ${r.border} border ${r.color} font-semibold`
                                    : "text-white hover:bg-white/5 cursor-pointer"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <r.Icon size={12} className={optDisabled ? "text-[var(--cool-gray)]" : r.color} />
                                  <div>
                                    <span className="block">{r.label}</span>
                                    <span className={`text-[9px] ${optDisabled ? "text-white/20" : "text-white/35"}`}>
                                      Level {r.level}
                                      {r.role === "Organization Owner" && viewerRole === "Owner" && !optDisabled
                                        ? " · Transfers ownership"
                                        : ""}
                                      {optDisabled ? " · Restricted" : ""}
                                    </span>
                                  </div>
                                </div>
                                {isCurrent && <Check size={11} className="text-[var(--mint-green)] shrink-0" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div className="px-6 py-3 border-t border-[var(--glass-border)] bg-white/[0.01] flex items-center gap-4">
            <span className="text-[10px] text-[var(--cool-gray)]">{activeOrg.members.length} member{activeOrg.members.length !== 1 ? "s" : ""} total</span>
            <span className="text-[10px] text-[var(--cool-gray)]/40">·</span>
            <span className="text-[10px] text-[var(--cool-gray)]">{activeOrg.members.filter(m => m.online).length} online</span>
            {viewerRole === "Owner" && (
              <>
                <span className="text-[10px] text-[var(--cool-gray)]/40">·</span>
                <span className="text-[10px] text-red-400/70 flex items-center gap-1">
                  <Crown size={8} />
                  Owner — Full access control
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

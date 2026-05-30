import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Check, Plus, Settings, X, Building2, Crown, Shield, User, Loader2, Sparkles
} from "lucide-react";
import { useOrg, type Org, type OrgMember } from "./OrgContext";
import { useRole, type Role, ROLE_META } from "./RoleContext";
import { apiFetch } from "../data/api";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────

function roleBadgeStyle(role: Role) {
  if (role === "Organization Owner")
    return "bg-red-500/15 text-red-400 border-red-500/30";
  if (role === "Organization Admin")
    return "bg-[var(--action-blue)]/15 text-[var(--action-blue)] border-[var(--action-blue)]/30";
  if (role === "Team Leader")
    return "bg-[var(--mint-green)]/15 text-[var(--mint-green)] border-[var(--mint-green)]/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

function roleShortLabel(role: Role) {
  if (role === "Organization Owner") return "Owner";
  if (role === "Organization Admin") return "Admin";
  if (role === "Team Leader") return "Lead";
  return "Employee";
}

function userRoleIcon(userRole: Org["userRole"]) {
  if (userRole === "Owner") return Crown;
  if (userRole === "Admin") return Shield;
  return User;
}

function userRoleStyle(userRole: Org["userRole"]) {
  if (userRole === "Owner") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (userRole === "Admin") return "bg-[var(--action-blue)]/15 text-[var(--action-blue)] border-[var(--action-blue)]/30";
  return "bg-white/8 text-[var(--cool-gray)] border-[var(--glass-border)]";
}

// ─── Sub-components ───────────────────────────────────────────────────────

function OrgRow({ org, isActive, onSelect }: {
  org: Org; isActive: boolean; onSelect: () => void;
}) {
  const Icon = userRoleIcon(org.userRole);
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group ${
        isActive
          ? "bg-[var(--action-blue)]/10 border-[var(--action-blue)]/40 shadow-[0_0_16px_rgba(59,130,246,0.12)]"
          : "bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-[var(--glass-border)]"
      }`}
    >
      {/* Org logo */}
      <div
        className={`size-9 rounded-xl bg-gradient-to-br ${org.logoGradient} flex items-center justify-center shrink-0 shadow-lg`}
      >
        <span className="text-white text-sm">{org.logoLetter}</span>
      </div>

      {/* Name + industry */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{org.name}</p>
        <p className="text-[10px] text-[var(--cool-gray)] truncate">{org.industry}</p>
      </div>

      {/* User-role badge */}
      <span
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border shrink-0 ${userRoleStyle(org.userRole)}`}
      >
        <Icon size={9} />
        {org.userRole}
      </span>

      {/* Active checkmark */}
      {isActive ? (
        <div className="size-5 rounded-full bg-[var(--action-blue)] flex items-center justify-center shrink-0">
          <Check size={11} className="text-white" />
        </div>
      ) : (
        <div className="size-5 rounded-full border border-[var(--glass-border)] shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </button>
  );
}

function MemberRow({ member, canManage, onManage }: {
  member: OrgMember; canManage: boolean; onManage: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
      {/* Avatar + online indicator */}
      <div className="relative shrink-0">
        <div
          className="size-8 rounded-full flex items-center justify-center text-[10px] text-white"
          style={{ background: member.avatarGradient }}
        >
          {member.initials}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#1A1F2C] ${
            member.online ? "bg-[var(--mint-green)]" : "bg-[var(--cool-gray)]/50"
          }`}
        />
      </div>

      {/* Name + dept */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">{member.name}</p>
        <p className="text-[10px] text-[var(--cool-gray)] truncate">{member.department}</p>
      </div>

      {/* Role badge */}
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] border shrink-0 ${roleBadgeStyle(member.role)}`}
      >
        {roleShortLabel(member.role)}
      </span>

      {/* Manage button (Admin only) */}
      {canManage && (
        <button
          onClick={onManage}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-[var(--cool-gray)] hover:text-white hover:bg-white/8 border border-transparent hover:border-[var(--glass-border)] transition-all shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Settings size={9} />
          Manage
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

interface WorkspaceSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function WorkspaceSwitcher({ isOpen, onClose, anchorRef }: WorkspaceSwitcherProps) {
  const { orgs, activeOrg, switchOrg, refreshOrgs } = useOrg();
  const { role } = useRole();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error("Validation Error", { description: "Please enter an invitation code." });
      return;
    }

    setJoining(true);
    try {
      const res = await apiFetch("/workspaces/join", {
        method: "POST",
        body: { code: inviteCode.trim() }
      });

      if (res && res.success) {
        toast.success("Joined Organization", {
          description: res.message || "Successfully linked to organization as Employee.",
          style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
        });

        // --- Custom Offline Demo Sync Resilience ---
        const token = localStorage.getItem("vantage_token") || "";
        if (token.startsWith("demo_offline_token_custom_")) {
          const wsData = res.data;
          if (wsData) {
            const displayMembers = (wsData.members || []).map((m: any) => {
              const u = m.user || m;
              const fullName = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.name || "Team Member");
              const initials = ((u.firstName?.charAt(0) || "") + (u.lastName?.charAt(0) || "")).toUpperCase() || "TM";
              return {
                id: u.id || "m-new",
                name: fullName,
                initials: initials,
                avatarGradient: "linear-gradient(135deg, #3B82F6, #06B6D4)",
                role: m.role === "OWNER" ? "Organization Owner" : (m.role === "ADMIN" ? "Organization Admin" : "Employee"),
                department: "Operations",
                online: true
              };
            });

            const newOrg = {
              id: wsData.id,
              name: wsData.name,
              shortName: wsData.shortName || wsData.name.slice(0, 5),
              logoGradient: wsData.logoGradient || "from-amber-400 to-orange-500",
              logoLetter: wsData.logoLetter || wsData.name.charAt(0).toUpperCase(),
              userRole: "Member",
              memberCount: wsData.memberCount || 1,
              industry: wsData.industry || "Construction",
              members: displayMembers
            };

            const stored = localStorage.getItem("vantage_custom_orgs");
            const parsed = stored ? JSON.parse(stored) : [];
            if (!parsed.some((o: any) => o.id === newOrg.id)) {
              parsed.push(newOrg);
              localStorage.setItem("vantage_custom_orgs", JSON.stringify(parsed));
            }
          }
        }

        setShowJoinModal(false);
        setInviteCode("");
        // Reload organizations dynamically
        await refreshOrgs();
        // Switch to the newly joined organization
        if (res.data && res.data.id) {
          switchOrg(res.data.id);
        }
        onClose();
      } else {
        toast.error("Failed to Join", { description: res.message || "Invalid or expired invitation code." });
      }
    } catch (err: any) {
      toast.error("Failed to Join", {
        description: err.message || "Invite code is invalid, expired, or has reached its maximum usage limit.",
        style: { background: "var(--deep-slate)", border: "1px solid #EF4444", color: "white" }
      });
    } finally {
      setJoining(false);
    }
  };

  const isAdmin = role === "Organization Admin" || role === "Organization Owner";

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  // Position the panel relative to the anchor button
  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const panelTop = anchorRect
    ? Math.max(12, anchorRect.top + anchorRect.height / 2 - 280)
    : 120;

  const handleSelectOrg = (orgId: string) => {
    onClose();
    switchOrg(orgId);
  };

  const handleManage = () => {
    onClose();
    navigate("/settings");
  };

  const switcherPortal = createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          key="workspace-switcher"
          initial={{ opacity: 0, x: -12, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            position: "fixed",
            left: 72,
            top: panelTop,
            zIndex: 9999,
            width: 328,
          }}
        >
          {/* Glow halo */}
          <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/12 blur-xl opacity-70 pointer-events-none" />

          <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-[20px] border border-[var(--glass-border)] shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[560px]">

            {/* ── Panel Header ── */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--glass-border)] bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-[var(--action-blue)]" />
                <span className="text-sm text-white">Workspace</span>
              </div>
              <button
                onClick={onClose}
                className="size-6 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/8 transition-all"
              >
                <X size={13} />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Organizations section ── */}
              <div className="px-3 pt-4 pb-3">
                <p className="text-[10px] text-[var(--cool-gray)] tracking-[0.1em] uppercase px-1 mb-2">
                  Your Organizations
                </p>
                <div className="space-y-1.5">
                  {orgs.map((org) => (
                    <OrgRow
                      key={org.id}
                      org={org}
                      isActive={org.id === activeOrg.id}
                      onSelect={() => handleSelectOrg(org.id)}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 mt-2 rounded-xl border border-dashed border-[var(--glass-border)] text-[var(--cool-gray)] hover:text-white hover:border-[var(--action-blue)]/40 hover:bg-[var(--action-blue)]/5 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span className="text-xs">Add New Organization</span>
                </button>
              </div>

              {/* ── Divider ── */}
              <div className="mx-3 h-px bg-[var(--glass-border)]" />

              {/* ── Members section ── */}
              <div className="px-3 pt-3 pb-4">
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-[10px] text-[var(--cool-gray)] tracking-[0.1em] uppercase">
                    Members — {activeOrg.name}
                  </p>
                  <span className="text-[10px] text-[var(--cool-gray)]">
                    {activeOrg.memberCount} total
                  </span>
                </div>

                <div className="space-y-0.5">
                  {activeOrg.members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      canManage={isAdmin}
                      onManage={handleManage}
                    />
                  ))}
                </div>

                {/* Online count */}
                <div className="flex items-center gap-2 mt-3 px-1">
                  <span className="size-1.5 rounded-full bg-[var(--mint-green)]" />
                  <span className="text-[10px] text-[var(--cool-gray)]">
                    {activeOrg.members.filter((m) => m.online).length} online now
                  </span>
                  <span className="text-[10px] text-[var(--cool-gray)]/40">·</span>
                  <span className="text-[10px] text-[var(--cool-gray)]">
                    {activeOrg.members.filter((m) => !m.online).length} offline
                  </span>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-3 border-t border-[var(--glass-border)] bg-white/[0.01] shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={`size-6 rounded-lg bg-gradient-to-br ${activeOrg.logoGradient} flex items-center justify-center shrink-0`}
                >
                  <span className="text-white text-[10px]">{activeOrg.logoLetter}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{activeOrg.name}</p>
                  <p className="text-[10px] text-[var(--cool-gray)]">{activeOrg.industry}</p>
                </div>
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${userRoleStyle(activeOrg.userRole)}`}
                >
                  {activeOrg.userRole}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  return (
    <>
      {switcherPortal}

      {createPortal(
        <AnimatePresence>
          {showJoinModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#0F1419]/80 backdrop-blur-md p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className="relative w-full max-w-md rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 shadow-2xl space-y-4"
              >
                <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-[var(--action-blue)]" size={18} />
                    <h3 className="text-md font-bold text-white">Join Organization</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowJoinModal(false);
                      setInviteCode("");
                    }}
                    className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleJoinOrg} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-[var(--cool-gray)] font-semibold uppercase">
                      Organization Invite Code
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g., ORG-ABC-123"
                      className="w-full h-10 px-3.5 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50 placeholder:text-[var(--cool-gray)]/45"
                    />
                    <span className="text-[10px] text-[var(--cool-gray)] leading-normal block">
                      Enter the unique token received from your administrator. You will automatically join as an Employee (Level 1).
                    </span>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[var(--glass-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowJoinModal(false);
                        setInviteCode("");
                      }}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-[var(--glass-border)] text-white hover:bg-white/10 transition-all text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={joining}
                      className="px-5 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {joining ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      <span>Join Organization</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

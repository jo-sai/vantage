import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { Users, Building2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useRole } from "../components/RoleContext";
import { CreateOrgModal } from "../components/CreateOrgModal";
import { apiFetch } from "../data/api";

// Demo invite codes → role + org name
const INVITE_CODES: Record<string, { org: string; role: "Team Leader" | "Employee" }> = {
  "ALPHA1": { org: "Acme Construction Co.", role: "Team Leader" },
  "WORK01": { org: "Acme Construction Co.", role: "Employee" },
  "DEMO99": { org: "Vantage Demo Org",       role: "Employee" },
};

export function Welcome() {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const [code, setCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState<{ org: string; role: string } | null>(null);

  const handleJoin = async () => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      toast.error("Invite code must be 6 characters", {
        style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
      });
      return;
    }

    // 1. Check offline demo codes first
    const match = INVITE_CODES[normalized];
    if (match) {
      setJoining({ org: match.org, role: match.role });
      setTimeout(() => {
        setRole(match.role);
        navigate("/");
      }, 1600);
      return;
    }

    // 2. Fallback to real API Join flow!
    setJoining({ org: "Organization", role: "Employee" });
    try {
      const res = await apiFetch("/workspaces/join", {
        method: "POST",
        body: { code: normalized }
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

        // Set default Employee role
        setRole("Employee");
        
        // Switch workspace and navigate
        if (res.data && res.data.id) {
          localStorage.setItem("vantage_active_workspace_id", res.data.id);
        }

        setTimeout(() => {
          setJoining(null);
          navigate("/");
        }, 1600);
      } else {
        setJoining(null);
        toast.error("Failed to Join", { 
          description: res.message || "Invalid or expired invitation code.",
          style: { background: "var(--deep-slate)", border: "1px solid #EF4444", color: "white" }
        });
      }
    } catch (err: any) {
      setJoining(null);
      toast.error("Failed to Join", {
        description: err.message || "Invite code is invalid or expired.",
        style: { background: "var(--deep-slate)", border: "1px solid #EF4444", color: "white" }
      });
    }
  };

  const handleCreateComplete = async (data: { name: string; industry: string; invites: string[] }) => {
    const token = localStorage.getItem("vantage_token") || "";
    const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "null");
    const firstName = storedUser?.firstName || "User";

    const buildLocalOrg = (wsId: string) => ({
      id: wsId,
      name: data.name,
      shortName: data.name.split(" ")[0],
      logoGradient: "from-purple-500 to-indigo-600",
      logoLetter: data.name.charAt(0).toUpperCase(),
      userRole: "Owner",
      memberCount: 1,
      industry: data.industry,
      members: [
        {
          id: "m-owner",
          name: `${firstName} ${storedUser?.lastName || ""}`,
          initials: (firstName.charAt(0) + (storedUser?.lastName?.charAt(0) || "")).toUpperCase(),
          avatarGradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
          role: "Organization Owner",
          department: "Executive",
          online: true,
        },
      ],
    });

    const isOffline = token.startsWith("demo_offline_token_custom_") || token.startsWith("demo_offline_token");

    if (!isOffline) {
      // Backend API user — rename the existing auto-created workspace with the user-chosen name
      const currentWsId = localStorage.getItem("vantage_active_workspace_id");
      try {
        if (currentWsId) {
          const res = await apiFetch(`/workspaces/${currentWsId}`, {
            method: "PATCH",
            body: { name: data.name },
          });
          if (res && res.success && res.data) {
            // Persist org locally so OrgContext reflects the new name immediately
            const freshOrg = buildLocalOrg(currentWsId);
            localStorage.setItem("vantage_custom_orgs", JSON.stringify([freshOrg]));
          }
        }
      } catch (err) {
        console.warn("Could not rename workspace via API, saving locally", err);
        const fallbackId = currentWsId || `${firstName.toLowerCase()}-studio`;
        const freshOrg = buildLocalOrg(fallbackId);
        localStorage.setItem("vantage_custom_orgs", JSON.stringify([freshOrg]));
      }
    } else {
      // Offline / demo token — persist org name in localStorage only
      const personalSlug = localStorage.getItem("vantage_active_workspace_id") || `${firstName.toLowerCase()}-studio`;
      const freshOrg = buildLocalOrg(personalSlug);
      localStorage.setItem("vantage_custom_orgs", JSON.stringify([freshOrg]));
      localStorage.setItem("vantage_active_workspace_id", personalSlug);
    }

    setRole("Organization Owner");
    toast.success(`Welcome to ${data.name}`, {
      description: `${data.industry} workspace created${data.invites.length ? ` · ${data.invites.length} invites sent` : ""}.`,
      style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" },
    });
    setShowCreate(false);
    setTimeout(() => navigate("/"), 400);
  };

  return (
    <div className="min-h-screen w-screen bg-[#0F1419] relative overflow-hidden flex items-center justify-center p-8">
      {/* Action Blue ambient glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-[420px] rounded-full bg-[var(--action-blue)]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-[420px] rounded-full bg-[var(--action-blue)]/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-[var(--action-blue)]/[0.07] blur-[140px]" />

      <div className="relative w-full max-w-5xl">
        {/* Brand */}
        <div className="flex flex-col items-center mb-12">
          <div className="size-14 rounded-xl bg-gradient-to-br from-[var(--action-blue)] to-[#2563EB] flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.45)] mb-5">
            <span className="text-white">V</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-[var(--glass-border)] mb-4">
            <Sparkles size={12} className="text-[var(--mint-green)]" />
            <span className="text-xs text-[var(--cool-gray)]">Account created</span>
          </div>
          <h1 className="text-white mb-3 text-center">Welcome to Vantage</h1>
          <p className="text-sm text-[var(--cool-gray)] text-center max-w-md">
            Let's get you set up. You can join an existing organization or create a new one from scratch.
          </p>
        </div>

        {/* Choice cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A — Join */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/20 blur-xl opacity-60" />
            <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-8 flex flex-col h-full">
              <div className="size-12 rounded-xl bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 flex items-center justify-center mb-6">
                <Users size={22} className="text-[var(--action-blue)]" />
              </div>
              <h3 className="text-white mb-2">Join an Organization</h3>
              <p className="text-sm text-[var(--cool-gray)] mb-6">
                Enter the 6-digit invite code or paste an invite link from your team admin.
              </p>

              <div className="space-y-3 mb-6">
                <label className="block text-xs text-[var(--cool-gray)]">Invite code or link</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. ALPHA1"
                  maxLength={6}
                  className="w-full h-11 px-4 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50 tracking-[0.2em] text-center"
                />
                <p className="text-xs text-[var(--cool-gray)]">
                  Demo codes: <span className="text-white">ALPHA1</span>, <span className="text-white">WORK01</span>, <span className="text-white">DEMO99</span>
                </p>
              </div>

              <button
                onClick={handleJoin}
                disabled={code.trim().length === 0}
                className="mt-auto w-full h-11 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 shadow-[0_0_24px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span>Join</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Card B — Create */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/20 blur-xl opacity-60" />
            <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-8 flex flex-col h-full">
              <div className="size-12 rounded-xl bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/30 flex items-center justify-center mb-6">
                <Building2 size={22} className="text-[var(--mint-green)]" />
              </div>
              <h3 className="text-white mb-2">Create an Organization</h3>
              <p className="text-sm text-[var(--cool-gray)] mb-6">
                Stand up a brand-new workspace. You'll become the Org Admin with full permissions.
              </p>

              <ul className="space-y-2 mb-8 text-sm text-[var(--cool-gray)]">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[var(--mint-green)]" />
                  Name your organization & upload a logo
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[var(--mint-green)]" />
                  Pick your industry
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[var(--mint-green)]" />
                  Invite your first teammates
                </li>
              </ul>

              <button
                onClick={() => setShowCreate(true)}
                className="mt-auto w-full h-11 rounded-lg bg-white/5 border border-[var(--glass-border)] text-white hover:bg-white/10 hover:border-[var(--action-blue)]/40 transition-all flex items-center justify-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Joining loading overlay */}
      <AnimatePresence>
        {joining && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1419]/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] px-10 py-8 flex flex-col items-center max-w-md text-center shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            >
              <Loader2 size={28} className="text-[var(--action-blue)] animate-spin mb-4" />
              <h3 className="text-white mb-1">Joining {joining.org}…</h3>
              <p className="text-sm text-[var(--cool-gray)]">
                Setting up your <span className="text-white">{joining.role}</span> view.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateOrgModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onComplete={handleCreateComplete}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
        }}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, LogIn, ShieldCheck, Users, Star
} from "lucide-react";
import { apiFetch } from "../data/api";

type JoinState = "loading" | "joining" | "success" | "error" | "not_logged_in" | "already_member";

export function JoinViaLink() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<JoinState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [orgName, setOrgName] = useState("");

  const isLoggedIn = Boolean(localStorage.getItem("vantage_token"));

  useEffect(() => {
    if (!code) {
      setState("error");
      setErrorMsg("No invitation code found in this link.");
      return;
    }

    if (!isLoggedIn) {
      // Show branded invite screen — user must log in first
      setTimeout(() => setState("not_logged_in"), 600);
      return;
    }

    // Auto-join flow: user is already authenticated
    setState("joining");
    const doJoin = async () => {
      try {
        const res = await apiFetch("/workspaces/join", {
          method: "POST",
          body: { code: code.trim() },
        });

        if (res && res.success) {
          setOrgName(res.data?.name || "the organization");
          setState("success");

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

          // Update active workspace to the newly joined one
          if (res.data?.id) {
            localStorage.setItem("vantage_active_workspace_id", res.data.id);
          }
          setTimeout(() => navigate("/"), 2800);
        } else {
          setState("error");
          setErrorMsg(res?.message || "Failed to join the organization.");
        }
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.toLowerCase().includes("already")) {
          setState("already_member");
          setTimeout(() => navigate("/"), 2200);
        } else if (msg.toLowerCase().includes("expired")) {
          setState("error");
          setErrorMsg("This invitation link has expired. Please ask your administrator to generate a new one.");
        } else {
          setState("error");
          setErrorMsg(msg || "Invalid or expired invitation code.");
        }
      }
    };

    doJoin();
  }, [code, isLoggedIn]);

  const handleLoginRedirect = () => {
    // Store invite code so Auth page can pick it up post-login
    if (code) sessionStorage.setItem("vantage_pending_invite_code", code);
    navigate(`/auth?inviteCode=${encodeURIComponent(code || "")}`);
  };

  return (
    <div className="min-h-screen w-screen bg-[#0F1419] relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient glow layers */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-[#3B82F6]/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-[#10B981]/15 blur-[130px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full bg-[#3B82F6]/[0.05] blur-[150px]" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center shadow-[0_0_32px_rgba(59,130,246,0.5)] mb-4">
            <span className="text-white font-semibold text-xl">V</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <Star size={10} className="text-[#10B981]" />
            <span className="text-[11px] text-white/50">Vantage — Organization Invite</span>
          </div>
        </div>

        {/* Glass card */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-[#3B82F6]/12 blur-xl opacity-60" />
          <div className="relative rounded-2xl bg-[rgba(255,255,255,0.04)] backdrop-blur-xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden p-8">
            <AnimatePresence mode="wait">

              {/* ─── LOADING / JOINING ─── */}
              {(state === "loading" || state === "joining") && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col items-center gap-5 py-8 text-center"
                >
                  <div className="size-16 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/25 flex items-center justify-center">
                    <Loader2 size={28} className="text-[#3B82F6] animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-white mb-1">
                      {state === "joining" ? "Joining Organization…" : "Validating Invite…"}
                    </h2>
                    <p className="text-sm text-white/50">
                      {state === "joining"
                        ? "Establishing your membership. Please wait."
                        : "Checking your invitation code."}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="size-1.5 rounded-full bg-[#3B82F6]"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─── NOT LOGGED IN ─── */}
              {state === "not_logged_in" && (
                <motion.div
                  key="not-logged-in"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#3B82F6]/8 border border-[#3B82F6]/20">
                    <div className="size-10 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-0.5">You've been invited to join</p>
                      <p className="text-sm text-white font-medium">a Vantage Organization</p>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-white mb-2">Accept Your Invitation</h2>
                    <p className="text-sm text-white/50 leading-relaxed">
                      You have been invited to collaborate on Vantage. Sign in or create an account to accept this invitation and join as an Employee.
                    </p>
                  </div>

                  {/* Invite code display */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/8">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Invite Code</p>
                    <p className="text-sm font-mono text-[#3B82F6]">{code}</p>
                  </div>

                  {/* Role hierarchy info */}
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest">Role Hierarchy</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Employee", level: 1, active: true, color: "from-amber-400 to-orange-500" },
                        { label: "Team Leader", level: 2, active: false, color: "from-[#10B981] to-emerald-500" },
                        { label: "Org Admin", level: 3, active: false, color: "from-[#3B82F6] to-purple-500" },
                        { label: "Org Owner", level: 4, active: false, color: "from-red-500 to-pink-600" },
                      ].map((r) => (
                        <div
                          key={r.level}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            r.active
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-white/[0.02] border-white/6 opacity-50"
                          }`}
                        >
                          <div className={`text-[9px] font-bold mb-0.5 ${r.active ? "text-amber-400" : "text-white/40"}`}>
                            LVL {r.level}
                          </div>
                          <div className={`text-[9px] ${r.active ? "text-amber-300" : "text-white/30"}`}>
                            {r.label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/35 text-center">You'll join as <span className="text-amber-400">Employee (Level 1)</span></p>
                  </div>

                  {/* Permission highlights */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8">
                      <ShieldCheck size={11} className="text-[#10B981]" />
                      <span className="text-[10px] text-white/50">Secure Token</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8">
                      <Users size={11} className="text-[#3B82F6]" />
                      <span className="text-[10px] text-white/50">Auto-assigned Role</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLoginRedirect}
                    className="w-full h-11 rounded-xl bg-[#3B82F6] text-white hover:bg-[#2563EB] active:scale-[0.98] shadow-[0_0_28px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <LogIn size={15} />
                    Sign In to Accept Invitation
                  </button>

                  <p className="text-center text-[11px] text-white/35">
                    Don't have an account?{" "}
                    <button onClick={handleLoginRedirect} className="text-[#3B82F6] hover:text-[#3B82F6]/80 transition-colors">
                      Create one free →
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ─── SUCCESS ─── */}
              {state === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center gap-5 py-8"
                >
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 14 }}
                    className="size-20 rounded-full bg-[#10B981]/12 border border-[#10B981]/30 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    <CheckCircle2 size={36} className="text-[#10B981]" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <h2 className="text-white mb-2">Welcome to the team!</h2>
                    <p className="text-sm text-white/50">
                      You've successfully joined <span className="text-white">{orgName}</span> as an{" "}
                      <span className="text-amber-400">Employee (Level 1)</span>.
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-2 text-xs text-white/40"
                  >
                    <Loader2 size={12} className="animate-spin" />
                    Redirecting to your dashboard…
                  </motion.div>
                </motion.div>
              )}

              {/* ─── ALREADY MEMBER ─── */}
              {state === "already_member" && (
                <motion.div
                  key="already-member"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center gap-5 py-8"
                >
                  <div className="size-16 rounded-full bg-[#3B82F6]/12 border border-[#3B82F6]/25 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-[#3B82F6]" />
                  </div>
                  <div>
                    <h2 className="text-white mb-2">You're already in!</h2>
                    <p className="text-sm text-white/50">You're already a member of this organization. Redirecting you to your dashboard…</p>
                  </div>
                  <Loader2 size={14} className="text-white/30 animate-spin" />
                </motion.div>
              )}

              {/* ─── ERROR ─── */}
              {state === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center gap-5 py-8"
                >
                  <div className="size-16 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-center justify-center">
                    <AlertCircle size={28} className="text-[#EF4444]" />
                  </div>
                  <div>
                    <h2 className="text-white mb-2">Invitation Failed</h2>
                    <p className="text-sm text-white/50 leading-relaxed max-w-xs">{errorMsg}</p>
                  </div>
                  <button
                    onClick={() => navigate("/auth")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-sm"
                  >
                    <ArrowRight size={14} />
                    Go to Dashboard
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/25 mt-6">
          © 2026 Vantage · Built for construction teams
        </p>
      </div>
    </div>
  );
}

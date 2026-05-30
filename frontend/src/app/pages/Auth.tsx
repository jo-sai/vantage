import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { useRole } from "../components/RoleContext";
import { apiFetch } from "../data/api";

type View = "login" | "register" | "success";

// Demo credentials for the login flow
const OWNER_DEMO_CREDENTIALS = { email: "owner@vantage.io", password: "vantage123" };
const DEMO_CREDENTIALS = { email: "admin@vantage.io", password: "vantage123" };
const EMPLOYEE_DEMO_CREDENTIALS = { email: "employee@vantage.io", password: "vantage123" };

export function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setRole } = useRole();

  // Check for a pending invite code from JoinViaLink redirect
  const pendingInviteCode = searchParams.get("inviteCode") || sessionStorage.getItem("vantage_pending_invite_code") || "";

  useEffect(() => {
    if (localStorage.getItem("vantage_token")) {
      navigate("/", { replace: true });
      return;
    }

    try {
      const customUsers = JSON.parse(localStorage.getItem("vantage_custom_users") || "[]");
      const nextUsers = customUsers.filter((u: any) => !u.email.toLowerCase().includes("lance") && !u.fullName.toLowerCase().includes("lance"));
      if (nextUsers.length !== customUsers.length) {
        localStorage.setItem("vantage_custom_users", JSON.stringify(nextUsers));
      }
    } catch { }
  }, [navigate]);

  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [inviteBanner, setInviteBanner] = useState(Boolean(pendingInviteCode));

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [emailErrorTooltip, setEmailErrorTooltip] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  const handleLogin = async () => {
    setLoginError(null);
    setEmailErrorTooltip(false);

    if (!loginEmail || !loginPassword) {
      setLoginError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // 1. Attempt to log in against the vantage-backend API
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: loginEmail, password: loginPassword },
      });

      if (res && res.success && res.data) {
        const { tokens, user, workspace } = res.data;
        localStorage.setItem("vantage_token", tokens.accessToken);
        localStorage.setItem("vantage_user", JSON.stringify(user));

        if (workspace) {
          localStorage.setItem("vantage_active_workspace_id", workspace.id);
          // Set role based on workspace role (backend returns uppercase enum values)
          const isOwner = ["OWNER"].includes(workspace.userRole);
          const isAdmin = ["ADMIN", "Owner", "Organization Admin"].includes(workspace.userRole);
          if (isOwner) setRole("Organization Owner");
          else if (isAdmin) setRole("Organization Admin");
          else setRole("Employee");
        } else {
          localStorage.setItem("vantage_active_workspace_id", "acme"); // Fallback org ID
          setRole("Organization Admin");
        }

        // If user arrived here from a /join/:code redirect, auto-accept the invite
        if (pendingInviteCode) {
          try {
            await apiFetch("/workspaces/join", {
              method: "POST",
              body: { code: pendingInviteCode }
            });
          } catch (_) {
            // Silently ignore — user may already be a member, or code expired
          }
          sessionStorage.removeItem("vantage_pending_invite_code");
        }

        setLoading(false);
        navigate("/");
        return;
      }
    } catch (apiError: any) {
      console.warn("⚠️ API Login failed. Falling back to local offline demo auth:", apiError.message);
    }

    // 2. Offline / Demo Fallback Mode
    setTimeout(() => {
      setLoading(false);
      const isOwnerDemo =
        loginEmail === OWNER_DEMO_CREDENTIALS.email && loginPassword === OWNER_DEMO_CREDENTIALS.password;
      const isDemo =
        loginEmail === DEMO_CREDENTIALS.email && loginPassword === DEMO_CREDENTIALS.password;
      const isEmployeeDemo =
        loginEmail === EMPLOYEE_DEMO_CREDENTIALS.email && loginPassword === EMPLOYEE_DEMO_CREDENTIALS.password;

      // Check for custom registered users persisted in browser localStorage
      const customUsers = JSON.parse(localStorage.getItem("vantage_custom_users") || "[]");
      const matchingCustomUser = customUsers.find(
        (u: any) => u.email.toLowerCase() === loginEmail.toLowerCase() && u.password === loginPassword
      );

      if (isOwnerDemo) {
        setRole("Organization Owner");
        localStorage.setItem("vantage_token", "demo_offline_token_owner");
        localStorage.setItem("vantage_active_workspace_id", "operations");
        localStorage.setItem(
          "vantage_user",
          JSON.stringify({
            email: "owner@vantage.io",
            firstName: "Vantage",
            lastName: "Owner",
            role: "OWNER",
          })
        );
        navigate("/");
      } else if (isDemo) {
        setRole("Organization Admin");
        localStorage.setItem("vantage_token", "demo_offline_token_admin");
        localStorage.setItem("vantage_active_workspace_id", "acme");
        navigate("/");
      } else if (isEmployeeDemo) {
        setRole("Employee");
        localStorage.setItem("vantage_token", "demo_offline_token_employee");
        localStorage.setItem("vantage_active_workspace_id", "vantage-demo");
        navigate("/");
      } else if (matchingCustomUser) {
        setRole(matchingCustomUser.role || "Organization Owner");
        localStorage.setItem("vantage_token", `demo_offline_token_custom_${matchingCustomUser.email}`);
        localStorage.setItem("vantage_active_workspace_id", matchingCustomUser.workspaceId || `${matchingCustomUser.fullName.split(" ")[0].toLowerCase()}-studio`);
        localStorage.setItem(
          "vantage_user",
          JSON.stringify({
            email: matchingCustomUser.email,
            firstName: matchingCustomUser.fullName.split(" ")[0] || "User",
            lastName: matchingCustomUser.fullName.split(" ").slice(1).join(" ") || "Vantage",
            role: "OWNER",
          })
        );
        navigate("/");
      } else {
        setLoginError("Invalid credentials. Please try again.");
        setEmailErrorTooltip(true);
        setTimeout(() => setEmailErrorTooltip(false), 4000);
      }
    }, 800);
  };

  const handleRegister = async () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = "Full name is required.";
    if (!workEmail.includes("@")) errors.workEmail = "Enter a valid work email.";
    if (password.length < 6) errors.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    if (!agreedToTerms) errors.terms = "You must agree to the Terms of Service.";

    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      return;
    }

    setRegisterErrors({});
    setLoading(true);

    try {
      // 1. Attempt backend registration
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: { email: workEmail, password, fullName },
      });

      if (res && res.success && res.data) {
        const { tokens, user, workspace } = res.data;
        localStorage.setItem("vantage_token", tokens.accessToken);
        localStorage.setItem("vantage_user", JSON.stringify(user));
        // Clear any stale org data from previous sessions
        localStorage.removeItem("vantage_custom_orgs");
        if (workspace) {
          localStorage.setItem("vantage_active_workspace_id", workspace.id);
        } else {
          localStorage.setItem("vantage_active_workspace_id", "acme");
        }
        // They are the creator/owner of the auto-created workspace
        setRole("Organization Owner");
        setLoading(false);
        setView("success");
        setTimeout(() => navigate("/welcome"), 2200);
        return;
      }
    } catch (apiError: any) {
      console.warn("⚠️ API Register failed. Falling back to local offline demo flow:", apiError.message);
    }

    // 2. Offline / Demo Fallback Mode
    setTimeout(() => {
      // Persist newly registered custom credentials in browser localStorage for offline session matching
      const customUsers = JSON.parse(localStorage.getItem("vantage_custom_users") || "[]");
      const userExists = customUsers.some((u: any) => u.email.toLowerCase() === workEmail.toLowerCase());

      const personalSlug = `${fullName.split(" ")[0].toLowerCase()}-studio`;
      if (!userExists) {
        customUsers.push({
          email: workEmail.toLowerCase(),
          password,
          fullName,
          role: "Organization Owner",
          workspaceId: personalSlug
        });
        localStorage.setItem("vantage_custom_users", JSON.stringify(customUsers));
      }

      setRole("Organization Owner");
      localStorage.setItem("vantage_token", `demo_offline_token_custom_${workEmail.toLowerCase()}`);
      localStorage.setItem("vantage_active_workspace_id", personalSlug);
      // Clear stale org data from any previous session
      localStorage.removeItem("vantage_custom_orgs");
      localStorage.setItem(
        "vantage_user",
        JSON.stringify({
          email: workEmail.toLowerCase(),
          firstName: fullName.split(" ")[0] || "User",
          lastName: fullName.split(" ").slice(1).join(" ") || "Vantage",
          role: "OWNER",
        })
      );

      setLoading(false);
      setView("success");
      setTimeout(() => navigate("/welcome"), 2200);
    }, 800);
  };

  const switchToRegister = () => {
    setLoginError(null);
    setEmailErrorTooltip(false);
    setView("register");
  };

  const switchToLogin = () => {
    setRegisterErrors({});
    setView("login");
  };

  return (
    <div className="min-h-screen w-screen bg-[#0F1419] relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-[var(--action-blue)]/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-[var(--action-blue)]/15 blur-[130px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full bg-[var(--action-blue)]/[0.06] blur-[150px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 size-[300px] rounded-full bg-[#10B981]/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-xl bg-gradient-to-br from-[var(--action-blue)] to-[#2563EB] flex items-center justify-center shadow-[0_0_32px_rgba(59,130,246,0.5)] mb-4">
            <span className="text-white font-semibold text-xl">V</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-[var(--glass-border)]">
            <Sparkles size={11} className="text-[var(--mint-green)]" />
            <span className="text-[11px] text-[var(--cool-gray)]">Construction Project Management</span>
          </div>
        </div>

        {/* Glass Card */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/15 blur-xl opacity-70" />
          <div className="relative rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-[0_0_60px_rgba(59,130,246,0.12)] overflow-hidden">
            <AnimatePresence mode="wait">
              {/* ─── LOGIN VIEW ─── */}
              {view === "login" && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="p-8"
                >
                  {/* Invite pending banner */}
                  {inviteBanner && pendingInviteCode && (
                    <div className="mb-5 p-3 rounded-xl bg-[#10B981]/8 border border-[#10B981]/25 flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-[#10B981]/15 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-[#10B981]" />
                      </div>
                      <div>
                        <p className="text-xs text-[#10B981] font-medium">Organization Invite Pending</p>
                        <p className="text-[10px] text-white/50">Sign in to automatically accept your invitation and join as Employee.</p>
                      </div>
                    </div>
                  )}

                  <div className="mb-7">
                    <h2 className="text-white mb-1">Sign in to Vantage</h2>
                    <p className="text-sm text-[var(--cool-gray)]">
                      Welcome back. Enter your credentials to continue.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Email Field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => {
                            setLoginEmail(e.target.value);
                            setLoginError(null);
                            setEmailErrorTooltip(false);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                          placeholder="you@company.com"
                          className={`w-full h-11 px-4 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${emailErrorTooltip
                            ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                            : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                            }`}
                        />
                        {/* Error Tooltip */}
                        <AnimatePresence>
                          {emailErrorTooltip && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.96 }}
                              transition={{ duration: 0.18 }}
                              className="absolute -top-9 left-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444]/90 backdrop-blur-sm border border-[#EF4444]/50 shadow-lg z-10"
                            >
                              <AlertCircle size={12} className="text-white shrink-0" />
                              <span className="text-xs text-white whitespace-nowrap">Invalid credentials</span>
                              {/* Tooltip arrow */}
                              <div className="absolute -bottom-1.5 left-4 size-3 bg-[#EF4444]/90 rotate-45 border-r border-b border-[#EF4444]/50" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs text-white/80 tracking-wide">
                          Password
                        </label>
                        <button
                          type="button"
                          className="text-xs text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value);
                            setLoginError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                          placeholder="••••••••"
                          className="w-full h-11 px-4 pr-11 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/40 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cool-gray)] hover:text-white transition-colors"
                        >
                          {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Inline error (non-tooltip) */}
                    <AnimatePresence>
                      {loginError && !emailErrorTooltip && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30"
                        >
                          <AlertCircle size={13} className="text-[#EF4444] shrink-0" />
                          <span className="text-xs text-[#EF4444]">{loginError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Demo hint */}
                    <div className="text-[11px] text-[var(--cool-gray)] space-y-0.5">
                      <p>Owner: <span className="text-white/60">owner@vantage.io</span> / <span className="text-white/60">vantage123</span></p>
                      <p>Admin: <span className="text-white/60">admin@vantage.io</span> / <span className="text-white/60">vantage123</span></p>
                      <p>Employee: <span className="text-white/60">employee@vantage.io</span> / <span className="text-white/60">vantage123</span></p>
                    </div>

                    {/* Login Button */}
                    <button
                      onClick={handleLogin}
                      disabled={loading}
                      className="w-full h-11 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_28px_rgba(59,130,246,0.45)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none mt-2"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "Login to Vantage"
                      )}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                    <span className="text-xs text-[var(--cool-gray)]">or</span>
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                  </div>

                  {/* Switch to Register */}
                  <p className="text-center text-sm text-[var(--cool-gray)]">
                    Don't have an account?{" "}
                    <button
                      onClick={switchToRegister}
                      className="text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors"
                    >
                      Create one.
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ─── REGISTER VIEW ─── */}
              {view === "register" && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="p-8"
                >
                  <div className="mb-7">
                    <h2 className="text-white mb-1">Create your account</h2>
                    <p className="text-sm text-[var(--cool-gray)]">
                      Get started with Vantage for free.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          setRegisterErrors((prev) => { const n = { ...prev }; delete n.fullName; return n; });
                        }}
                        placeholder="Maria Santos"
                        className={`w-full h-11 px-4 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${registerErrors.fullName
                          ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                          : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                          }`}
                      />
                      {registerErrors.fullName && (
                        <p className="text-[11px] text-[#EF4444]">{registerErrors.fullName}</p>
                      )}
                    </div>

                    {/* Work Email */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">Work Email</label>
                      <input
                        type="email"
                        value={workEmail}
                        onChange={(e) => {
                          setWorkEmail(e.target.value);
                          setRegisterErrors((prev) => { const n = { ...prev }; delete n.workEmail; return n; });
                        }}
                        placeholder="you@company.com"
                        className={`w-full h-11 px-4 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${registerErrors.workEmail
                          ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                          : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                          }`}
                      />
                      {registerErrors.workEmail && (
                        <p className="text-[11px] text-[#EF4444]">{registerErrors.workEmail}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setRegisterErrors((prev) => { const n = { ...prev }; delete n.password; return n; });
                          }}
                          placeholder="Min. 6 characters"
                          className={`w-full h-11 px-4 pr-11 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${registerErrors.password
                            ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                            : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cool-gray)] hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {registerErrors.password && (
                        <p className="text-[11px] text-[#EF4444]">{registerErrors.password}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs text-white/80 tracking-wide">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setRegisterErrors((prev) => { const n = { ...prev }; delete n.confirmPassword; return n; });
                          }}
                          placeholder="Repeat your password"
                          className={`w-full h-11 px-4 pr-11 rounded-lg bg-[var(--input-background)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 transition-all ${registerErrors.confirmPassword
                            ? "border-2 border-[#EF4444] focus:ring-[#EF4444]/30"
                            : "border border-[var(--glass-border)] focus:ring-[var(--action-blue)]/40"
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cool-gray)] hover:text-white transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {registerErrors.confirmPassword && (
                        <p className="text-[11px] text-[#EF4444]">{registerErrors.confirmPassword}</p>
                      )}
                    </div>

                    {/* Terms Checkbox */}
                    <div className="space-y-1">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative mt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => {
                              setAgreedToTerms(e.target.checked);
                              setRegisterErrors((prev) => { const n = { ...prev }; delete n.terms; return n; });
                            }}
                            className="sr-only"
                          />
                          <div
                            className={`size-4 rounded border transition-all ${agreedToTerms
                              ? "bg-[var(--action-blue)] border-[var(--action-blue)]"
                              : registerErrors.terms
                                ? "border-[#EF4444] bg-[var(--input-background)]"
                                : "border-[var(--glass-border)] bg-[var(--input-background)] group-hover:border-[var(--action-blue)]/60"
                              }`}
                          >
                            {agreedToTerms && (
                              <svg viewBox="0 0 12 12" className="size-full p-0.5 text-white fill-none stroke-current stroke-2">
                                <polyline points="1,6 4,9 11,2" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-[var(--cool-gray)] leading-relaxed">
                          I agree to the{" "}
                          <span className="text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors cursor-pointer">
                            Terms of Service
                          </span>{" "}
                          and{" "}
                          <span className="text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors cursor-pointer">
                            Privacy Policy
                          </span>
                        </span>
                      </label>
                      {registerErrors.terms && (
                        <p className="text-[11px] text-[#EF4444] pl-7">{registerErrors.terms}</p>
                      )}
                    </div>

                    {/* Create Account Button */}
                    <button
                      onClick={handleRegister}
                      disabled={loading}
                      className="w-full h-11 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-[0_0_28px_rgba(59,130,246,0.45)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none mt-2"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "Create Account"
                      )}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                    <span className="text-xs text-[var(--cool-gray)]">or</span>
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                  </div>

                  {/* Switch to Login */}
                  <p className="text-center text-sm text-[var(--cool-gray)]">
                    Already have an account?{" "}
                    <button
                      onClick={switchToLogin}
                      className="text-[var(--action-blue)] hover:text-[var(--action-blue)]/80 transition-colors"
                    >
                      Sign in.
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ─── SUCCESS STATE ─── */}
              {view === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="p-8 py-16 flex flex-col items-center text-center"
                >
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 14 }}
                    className="size-20 rounded-full bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    <CheckCircle2 size={36} className="text-[var(--mint-green)]" />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.25 }}
                  >
                    <h2 className="text-white mb-2">Account Created!</h2>
                    <p className="text-sm text-[var(--cool-gray)] max-w-xs">
                      Redirecting to setup…
                    </p>
                  </motion.div>

                  {/* Progress dots */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-1.5 mt-8"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="size-2 rounded-full bg-[var(--mint-green)]"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[var(--cool-gray)]/60 mt-6">
          © 2026 Vantage · Built for construction teams
        </p>
      </div>
    </div>
  );
}

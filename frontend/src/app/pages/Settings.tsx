import { useState, useEffect } from "react";
import { 
  Bell, Lock, Palette, User, Shield, Users, LogOut, 
  Sparkles, Monitor, Smartphone, Key, Copy, Check, RefreshCw, Crown
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { MembersDirectory } from "../components/MembersDirectory";
import { useRole } from "../components/RoleContext";
import { toast } from "sonner";
import { apiFetch } from "../data/api";

type Section = "profile" | "members" | "appearance" | "notifications" | "security";

export function Settings() {
  const navigate = useNavigate();
  const { role } = useRole();
  const isAdmin = role === "Organization Admin" || role === "Organization Owner";
  const isOwner = role === "Organization Owner";
  const [section, setSection] = useState<Section>(isAdmin ? "members" : "profile");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // --- Profile states ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await apiFetch("/auth/me");
      if (res && res.success && res.data) {
        const u = res.data;
        setFirstName(u.firstName || "");
        setLastName(u.lastName || "");
        setEmail(u.email || "");
        setAccountHolderName(u.accountHolderName || "");
        setAccountNumber(u.accountNumber || "");
        
        const standardBanks = ["GCash", "PayMaya / Maya", "BDO Unibank", "Bank of the Philippine Islands (BPI)", "UnionBank of the Philippines", "Metrobank"];
        if (u.bankName) {
          if (standardBanks.includes(u.bankName)) {
            setBankName(u.bankName);
            setCustomBankName("");
          } else {
            setBankName("Custom");
            setCustomBankName(u.bankName);
          }
        } else {
          setBankName("");
          setCustomBankName("");
        }
      }
    } catch (e) {
      console.error("Failed to load user profile:", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const finalBank = bankName === "Custom" ? customBankName : bankName;
      const res = await apiFetch("/auth/me", {
        method: "PATCH",
        body: {
          firstName,
          lastName,
          accountHolderName,
          bankName: finalBank,
          accountNumber
        }
      });
      if (res && res.success) {
        toast.success("Profile saved", {
          description: "Your user profile and payout configurations are updated.",
          style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
        });
        
        // Also update local storage if user is stored there
        const storedUser = localStorage.getItem("vantage_user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.firstName = firstName;
            parsed.lastName = lastName;
            localStorage.setItem("vantage_user", JSON.stringify(parsed));
          } catch {}
        }
        
        fetchProfile();
      }
    } catch (e: any) {
      toast.error("Save failed", {
        description: e.message || "Could not save your changes."
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // --- Theme & Appearance state ---
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem("vantage_theme_color") || "#3B82F6";
  });
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem("vantage_font_size") || "16");
  });

  // --- Notifications state ---
  const [emailReports, setEmailReports] = useState(() => {
    const saved = localStorage.getItem("vantage_notif_email");
    return saved === null ? true : saved === "true";
  });
  const [viberSync, setViberSync] = useState(() => {
    const saved = localStorage.getItem("vantage_notif_viber");
    return saved === null ? true : saved === "true";
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    const saved = localStorage.getItem("vantage_notif_sound");
    return saved === null ? false : saved === "true";
  });

  // --- Security state ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tfaActive, setTfaActive] = useState(() => {
    return localStorage.getItem("vantage_security_2fa") === "true";
  });
  const [generatedApiKey, setGeneratedApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "59, 130, 246";
  };

  const applyAppearanceSettings = (color: string, size: number) => {
    document.documentElement.style.setProperty("--action-blue", color);
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--ring", `rgba(${hexToRgb(color)}, 0.5)`);
    document.documentElement.style.setProperty("--font-size", `${size}px`);
    localStorage.setItem("vantage_theme_color", color);
    localStorage.setItem("vantage_font_size", size.toString());
  };

  useEffect(() => {
    applyAppearanceSettings(themeColor, fontSize);
  }, [themeColor, fontSize]);

  const navBtn = (active: boolean) =>
    `w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
      active
        ? "bg-[var(--action-blue)] text-white"
        : "text-[var(--cool-gray)] hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="h-full p-8 overflow-auto">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white mb-2">Settings</h1>
          <p className="text-[var(--cool-gray)]">Manage your account and application preferences</p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Settings Navigation */}
          <div className="col-span-3">
            <nav className="flex flex-col gap-2">
              <button onClick={() => setSection("profile")} className={navBtn(section === "profile")}>
                <User size={18} />
                <span>Profile</span>
              </button>
              <button onClick={() => setSection("members")} className={navBtn(section === "members")}>
                <Users size={18} />
                <span>Organization Members</span>
                {isOwner && (
                  <Crown size={12} className="ml-auto text-amber-400" />
                )}
              </button>
              <button onClick={() => setSection("appearance")} className={navBtn(section === "appearance")}>
                <Palette size={18} />
                <span>Appearance</span>
              </button>
              <button onClick={() => setSection("notifications")} className={navBtn(section === "notifications")}>
                <Bell size={18} />
                <span>Notifications</span>
              </button>
              <button onClick={() => setSection("security")} className={navBtn(section === "security")}>
                <Shield size={18} />
                <span>Security</span>
              </button>
              
              <div className="my-2 border-t border-[var(--glass-border)]" />
              
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-red-400 font-medium"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </nav>
          </div>

          {/* Settings Content */}
          <div className="col-span-9 flex flex-col gap-6">
            {section === "members" && <MembersDirectory />}

            {section === "profile" && (
              <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6">
                <h2 className="text-xl text-white mb-6">Profile Information</h2>

                <div className="flex items-center gap-6 mb-8">
                  <div className="size-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold font-mono">
                    {firstName.charAt(0)}{lastName.charAt(0)}
                  </div>
                  <div>
                    <button className="px-4 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all text-sm mb-2">
                      Change Avatar
                    </button>
                    <p className="text-xs text-[var(--cool-gray)]">JPG, GIF or PNG. Max size of 800K</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 text-left">
                  <div>
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--cool-gray)] mb-2">Active Role</label>
                    <input
                      type="text"
                      value={role}
                      readOnly
                      className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)]/50 backdrop-blur-sm border border-[var(--glass-border)] text-[var(--cool-gray)] opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* ── Payout & Bank Details ── */}
                <div className="mt-8 pt-8 border-t border-[var(--glass-border)] space-y-6 text-left">
                  <div>
                    <h3 className="text-lg text-white mb-1">Payout &amp; Direct Deposit Details</h3>
                    <p className="text-xs text-[var(--cool-gray)]">Provide your preferred bank account or mobile wallet parameters where salaries should be remitted.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm text-[var(--cool-gray)] mb-2">Account Holder Name</label>
                      <input
                        type="text"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                      />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm text-[var(--cool-gray)] mb-2">Bank / Wallet Name</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50 text-xs"
                      >
                        <option value="">-- Select Bank/Wallet --</option>
                        <option value="GCash">GCash</option>
                        <option value="PayMaya / Maya">PayMaya / Maya</option>
                        <option value="BDO Unibank">BDO Unibank</option>
                        <option value="Bank of the Philippine Islands (BPI)">Bank of the Philippine Islands (BPI)</option>
                        <option value="UnionBank of the Philippines">UnionBank of the Philippines</option>
                        <option value="Metrobank">Metrobank</option>
                        <option value="Custom">Custom / Other</option>
                      </select>
                    </div>

                    {bankName === "Custom" && (
                      <div className="col-span-2">
                        <label className="block text-sm text-[var(--cool-gray)] mb-2">Specify Custom Bank/Wallet</label>
                        <input
                          type="text"
                          value={customBankName}
                          onChange={(e) => setCustomBankName(e.target.value)}
                          placeholder="e.g. Landbank of the Philippines"
                          className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                        />
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="block text-sm text-[var(--cool-gray)] mb-2">Account Number / Mobile Number</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. 1092837465 or 09171234567"
                        className="w-full h-10 px-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || loadingProfile}
                    className="px-6 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}

            {section === "appearance" && (
              <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6 space-y-6">
                <div>
                  <h2 className="text-xl text-white mb-1">Appearance Settings</h2>
                  <p className="text-xs text-[var(--cool-gray)]">Customize application themes, primary color accents, and display typography scale.</p>
                </div>

                {/* Theme Accents */}
                <div className="space-y-3">
                  <label className="block text-sm text-[var(--cool-gray)] font-medium">Theme Accents</label>
                  <div className="flex items-center gap-4">
                    {[
                      { name: "Vantage Slate (Blue)", value: "#3B82F6" },
                      { name: "Ocean Breeze (Teal)", value: "#06B6D4" },
                      { name: "Forest Emerald (Green)", value: "#10B981" },
                      { name: "Midnight Violet (Purple)", value: "#8B5CF6" }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => setThemeColor(theme.value)}
                        className={`group relative size-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          themeColor === theme.value ? "ring-2 ring-white ring-offset-2 ring-offset-[#0F1419]" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: theme.value }}
                        title={theme.name}
                      >
                        {themeColor === theme.value && <Check size={16} className="text-white drop-shadow" />}
                      </button>
                    ))}
                    
                    {/* Custom Color Input Picker */}
                    <div className="h-10 w-px bg-[var(--glass-border)]" />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="size-8 rounded-lg cursor-pointer bg-transparent border-0"
                        title="Pick Custom Accent Color"
                      />
                      <span className="text-xs font-mono text-white bg-white/5 border border-[var(--glass-border)] px-2 py-1 rounded">
                        {themeColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Display Scale (Font Sizing) */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm text-[var(--cool-gray)] font-medium">Display Font Scale</label>
                    <span className="text-xs font-mono text-[var(--action-blue)] font-bold">{fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[var(--cool-gray)]">A</span>
                    <input
                      type="range"
                      min="14"
                      max="18"
                      step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--action-blue)]"
                    />
                    <span className="text-lg text-white font-bold">A</span>
                  </div>
                  <p className="text-[10px] text-[var(--cool-gray)]">Adjust typography constraints. Changes apply dynamically across workspaces, Gantt timeline, and finance ledgers.</p>
                </div>

                {/* Save Options */}
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      applyAppearanceSettings(themeColor, fontSize);
                      toast.success("Appearance saved", {
                        description: "Color themes and text scales updated successfully.",
                        style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
                      });
                    }}
                    className="px-6 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 transition-all text-xs font-bold cursor-pointer"
                  >
                    Apply Theme Settings
                  </button>
                </div>
              </div>
            )}

            {section === "notifications" && (
              <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6 space-y-6">
                <div>
                  <h2 className="text-xl text-white mb-1">Notification Center</h2>
                  <p className="text-xs text-[var(--cool-gray)]">Configure which alerts and digests you receive inside the dashboard and linked agents.</p>
                </div>

                <div className="space-y-4">
                  {/* Email Summaries Switch */}
                  <div className="flex items-start justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className="space-y-1 text-left">
                      <span className="text-sm font-semibold text-white">Email Digest Summaries</span>
                      <p className="text-[10px] text-[var(--cool-gray)]">Receive weekly compiled payroll adjustment updates and treasury cash flow margin sheets.</p>
                    </div>
                    <button
                      onClick={() => setEmailReports(!emailReports)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        emailReports ? "bg-[var(--action-blue)]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          emailReports ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Viber Sync Switch */}
                  <div className="flex items-start justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className="space-y-1 text-left">
                      <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                        Viber Mobile Field Alerts
                        <span className="text-[9px] text-[var(--mint-green)] bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/35 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Linked Agent</span>
                      </span>
                      <p className="text-[10px] text-[var(--cool-gray)]">Alert active field managers via synced messaging threads immediately when a weather delay is logged.</p>
                    </div>
                    <button
                      onClick={() => setViberSync(!viberSync)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        viberSync ? "bg-[var(--action-blue)]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          viberSync ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Desktop Activity Alerts Switch */}
                  <div className="flex items-start justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className="space-y-1 text-left">
                      <span className="text-sm font-semibold text-white">In-App Banner Activity Sounds</span>
                      <p className="text-[10px] text-[var(--cool-gray)]">Trigger audio feedback chimes and toast banner overlays whenever comments or reports arrive.</p>
                    </div>
                    <button
                      onClick={() => setSoundAlerts(!soundAlerts)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        soundAlerts ? "bg-[var(--action-blue)]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          soundAlerts ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Save Options */}
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      localStorage.setItem("vantage_notif_email", emailReports.toString());
                      localStorage.setItem("vantage_notif_viber", viberSync.toString());
                      localStorage.setItem("vantage_notif_sound", soundAlerts.toString());
                      toast.success("Preferences Saved", {
                        description: "Notification filters updated and persisted in sandbox storage.",
                        style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
                      });
                    }}
                    className="px-6 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 transition-all text-xs font-bold cursor-pointer"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {section === "security" && (
              <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6 space-y-6">
                <div>
                  <h2 className="text-xl text-white mb-1">Security &amp; Credentials</h2>
                  <p className="text-xs text-[var(--cool-gray)]">Change active passwords, check connected active sessions, and generate developer tokens.</p>
                </div>

                <div className="grid grid-cols-2 gap-6 items-start">
                  
                  {/* Left Side: Change Password */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Lock size={15} />
                      Modify Password
                    </h3>
                    
                    <div className="space-y-3 text-xs text-left">
                      <div className="space-y-1">
                        <label className="block text-[var(--cool-gray)] font-semibold uppercase">Old Password</label>
                        <input
                          type="password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="block text-[var(--cool-gray)] font-semibold uppercase">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none"
                        />
                        {newPassword && (
                          <div className="mt-1.5 flex gap-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              newPassword.length < 6 ? "w-1/3 bg-red-500" : newPassword.length < 10 ? "w-2/3 bg-amber-500" : "w-full bg-[var(--mint-green)]"
                            }`} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[var(--cool-gray)] font-semibold uppercase">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={() => {
                          if (!oldPassword || !newPassword || !confirmPassword) {
                            alert("Please fill in all credentials fields.");
                            return;
                          }
                          if (newPassword !== confirmPassword) {
                            alert("New passwords do not match.");
                            return;
                          }
                          if (newPassword.length < 8) {
                            alert("New password must be at least 8 characters long.");
                            return;
                          }
                          
                          setOldPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                          toast.success("Credentials Updated", {
                            description: "Your login credentials successfully refreshed and validated.",
                            style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
                          });
                        }}
                        className="w-full h-10 rounded-lg bg-[var(--action-blue)] text-white font-semibold flex items-center justify-center hover:bg-[var(--action-blue)]/85 active:scale-[0.98] transition-all cursor-pointer shadow-md mt-2"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/* Right Side: Active Sessions & Developer tokens */}
                  <div className="space-y-6 border-l border-[var(--glass-border)] pl-6 text-left">
                    {/* Active Sessions */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Monitor size={15} />
                        Connected Sessions
                      </h3>
                      
                      <div className="space-y-2 text-[11px] text-white">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.015] border border-white/5">
                          <div className="flex items-center gap-2">
                            <Monitor size={14} className="text-[var(--action-blue)] shrink-0" />
                            <div>
                              <span className="font-semibold block">Vantage Chrome Client (Active)</span>
                              <span className="text-[9px] text-[var(--cool-gray)]">Windows 11 · Manila, PH</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.015] border border-white/5 opacity-80">
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-purple-400 shrink-0" />
                            <div>
                              <span className="font-semibold block">Viber Sync Field Agent</span>
                              <span className="text-[9px] text-[var(--cool-gray)]">Linux Sandbox · Vancouver, CA</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Developer Tokens */}
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Key size={15} />
                        Sandbox API Keys
                      </h3>
                      <p className="text-[10px] text-[var(--cool-gray)]">Generate localized mock tokens for CLI integrations or automatic webhooks.</p>
                      
                      {generatedApiKey ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={generatedApiKey}
                            className="flex-1 h-9 px-3 rounded bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white font-mono"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedApiKey);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                              toast.success("Token Copied", {
                                description: "Sandbox authorization token copied to clipboard.",
                                style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" }
                              });
                            }}
                            className="px-3 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
                          >
                            {copied ? <Check size={14} className="text-[var(--mint-green)]" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const randStr = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
                            setGeneratedApiKey(`vt_live_${randStr}`);
                            toast.success("Token Generated", {
                              description: "Developer API Token compiled for this session.",
                              style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" }
                            });
                          }}
                          className="w-full h-9 rounded bg-[var(--action-blue)]/20 border border-[var(--action-blue)]/35 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles size={12} />
                          Generate Sandbox API Token
                        </button>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1419]/75 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 shadow-2xl"
            >
              <h3 className="text-white text-lg font-medium mb-2">Confirm Log Out</h3>
              <p className="text-sm text-[var(--cool-gray)] mb-6 leading-relaxed">
                Are you sure you want to sign out of Design Vantage? You will need to log back in to access your projects and workspaces.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-[var(--glass-border)] text-white hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("vantage_token");
                    localStorage.removeItem("vantage_user");
                    localStorage.removeItem("vantage_active_workspace_id");
                    navigate("/auth");
                  }}
                  className="px-4 py-2 rounded-lg bg-[#EF4444] text-white hover:bg-[#EF4444]/80 shadow-[0_0_24px_rgba(239,68,68,0.25)] transition-all text-sm font-medium"
                >
                  Yes, Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

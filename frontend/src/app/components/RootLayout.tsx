import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Outlet, NavLink, useNavigate, Navigate } from "react-router";
import { Auth } from "../pages/Auth";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Briefcase,
  Users,
  Calendar,
  DollarSign,
  Settings,
  Search,
  Bell,
  Check,
  Loader2,
  LogOut,
  X,
  Trash2,
  Info,
  FileText,
  Building2,
} from "lucide-react";
import { useRole, ROLE_META, Role } from "./RoleContext";
import { CurrencySelector } from "./CurrencySelector";
import { useOrg } from "./OrgContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const ALL_ROLES: Role[] = ["Organization Owner", "Organization Admin", "Team Leader", "Employee"];

function RoleBadge() {
  const { role } = useRole();
  const meta = ROLE_META[role];

  // Dynamically extract logged-in user details if available
  const customUser = (() => {
    try {
      const userStr = localStorage.getItem("vantage_user");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (e) {
      console.error("Failed to parse vantage_user from localStorage", e);
    }
    return null;
  })();

  const userInitials = customUser
    ? (((customUser.firstName?.charAt(0) || "") + (customUser.lastName?.charAt(0) || "")).toUpperCase() || "U")
    : meta.initials;

  const userLabel = customUser
    ? `${customUser.firstName} ${customUser.lastName}`
    : meta.label;

  return (
    <div
      className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-[var(--glass-border)] ring-2 ${meta.ring}`}
      title={`Active role: ${role}`}
    >
      <span className={`size-8 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white text-xs`}>
        {userInitials}
      </span>
      <span className="text-xs text-white">{userLabel}</span>
    </div>
  );
}

function LayoutInner() {
  const { role } = useRole();
  const { activeOrg, switching } = useOrg();
  const showFinances = role === "Organization Admin" || role === "Organization Owner" || role === "Finance Admin";

  const [showSwitcher, setShowSwitcher] = useState(false);
  const usersButtonRef = useRef<HTMLButtonElement>(null);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const orgName = activeOrg?.name || "Vantage";
    const orgId = activeOrg?.id || "default";

    // 1. Fetch real workspaces from LocalStorage
    let localDepts = [];
    try {
      const saved = localStorage.getItem(`vantage_departments_${orgId}`);
      if (saved) {
        localDepts = JSON.parse(saved);
      }
    } catch (e) {}
    
    // Fallback if none created
    const firstDeptName = localDepts[0]?.name || "Operations";

    // 2. Fetch real members from activeOrg
    const members = activeOrg?.members || [];
    const memberName1 = members[0]?.name || "Administrator";
    const memberName2 = members[1]?.name || members[0]?.name || "Sarah Chen";

    setNotifications([
      {
        id: `${orgId}_1`,
        title: "New Report Submitted",
        message: `${memberName2} submitted a progress report for review in ${orgName}.`,
        time: "10m ago",
        type: "report",
        read: false
      },
      {
        id: `${orgId}_2`,
        title: "Workspace Initialized",
        message: `The "${firstDeptName}" department was successfully created for ${orgName}.`,
        time: "1h ago",
        type: "dept",
        read: false
      },
      {
        id: `${orgId}_3`,
        title: "Payroll Prepared",
        message: `Payroll adjustments for ${memberName1} are ready for review in ${orgName}.`,
        time: "3h ago",
        type: "payroll",
        read: false
      },
      {
        id: `${orgId}_4`,
        title: "System Deployed",
        message: `Multi-currency and ledger sync modules are now active in the "${orgName}" portal.`,
        time: "1d ago",
        type: "system",
        read: true
      }
    ]);
  }, [activeOrg?.id, activeOrg?.name, activeOrg?.members]);

  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);

  // Close notifications popover on click outside
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        bellMenuRef.current && !bellMenuRef.current.contains(target) &&
        bellButtonRef.current && !bellButtonRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `size-10 rounded-lg flex items-center justify-center transition-all ${
      isActive
        ? "bg-[var(--action-blue)] text-white shadow-lg shadow-blue-500/30"
        : "text-[var(--cool-gray)] hover:text-white hover:bg-white/5"
    }`;

  return (
    <div className="h-screen w-screen flex bg-[#0F1419] overflow-hidden">
      {/* Global Sidebar */}
      <aside className="w-16 bg-[var(--deep-slate)] border-r border-[var(--glass-border)] flex flex-col items-center py-6">
        <div className="mb-12">
          {/* Active org logo */}
          <div
            className={`size-10 rounded-lg bg-gradient-to-br ${activeOrg.logoGradient} flex items-center justify-center shadow-lg`}
            title={activeOrg.name}
          >
            <span className="text-white font-semibold">{activeOrg.logoLetter}</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-6">
          <NavLink to="/" end className={navItemClass}>
            <Briefcase size={20} />
          </NavLink>

          <NavLink to="/timeline" className={navItemClass}>
            <Calendar size={20} />
          </NavLink>

          {showFinances && (
            <NavLink to="/finances" className={navItemClass}>
              <DollarSign size={20} />
            </NavLink>
          )}

          <button
            ref={usersButtonRef}
            onClick={() => setShowSwitcher((s) => !s)}
            className={`size-10 rounded-lg flex items-center justify-center transition-all ${
              showSwitcher
                ? "bg-[var(--action-blue)]/20 text-[var(--action-blue)] ring-1 ring-[var(--action-blue)]/40"
                : "text-[var(--cool-gray)] hover:text-white hover:bg-white/5"
            }`}
            title="Workspace Switcher"
          >
            <Users size={20} />
          </button>

          <NavLink to="/settings" className={navItemClass}>
            <Settings size={20} />
          </NavLink>
        </nav>
      </aside>

      {/* Workspace Switcher popover */}
      <WorkspaceSwitcher
        isOpen={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        anchorRef={usersButtonRef}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="relative z-30 h-16 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex items-center px-6 gap-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--cool-gray)]">{activeOrg.shortName}</span>
            <span className="text-[var(--cool-gray)]">/</span>
            <span className="text-white">Dashboard</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cool-gray)]" size={18} />
            <input
              type="text"
              placeholder="Search files, teams, or invoices"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
            />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              ref={bellButtonRef}
              onClick={() => setShowNotifications(s => !s)}
              className={`relative size-10 rounded-lg flex items-center justify-center transition-all ${
                showNotifications
                  ? "bg-[var(--action-blue)]/20 text-[var(--action-blue)] ring-1 ring-[var(--action-blue)]/40"
                  : "text-[var(--cool-gray)] hover:text-white hover:bg-white/5"
              }`}
              title="Workspace Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
              )}
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  ref={bellMenuRef}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2.5 w-80 rounded-2xl bg-[var(--deep-slate)] border border-[var(--glass-border)] shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden z-[9999]"
                >
                  {/* Glow halo */}
                  <div className="absolute -inset-1 rounded-2xl bg-[var(--action-blue)]/5 blur-xl opacity-70 pointer-events-none" />

                  {/* Header */}
                  <div className="relative flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-[var(--action-blue)]" />
                      <span className="text-sm font-semibold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--action-blue)]/20 text-[var(--action-blue)] text-[9px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-[10px] text-[var(--cool-gray)] hover:text-white transition-all font-medium cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="relative max-h-[360px] overflow-y-auto divide-y divide-[var(--glass-border)]/30">
                    {notifications.length > 0 ? (
                      notifications.map((n) => {
                        let IconComponent = Info;
                        let iconColorClass = "text-blue-400 bg-blue-500/10";
                        if (n.type === "report") {
                          IconComponent = FileText;
                          iconColorClass = "text-[#10B981] bg-[#10B981]/10";
                        } else if (n.type === "dept") {
                          IconComponent = Building2;
                          iconColorClass = "text-purple-400 bg-purple-500/10";
                        } else if (n.type === "payroll") {
                          IconComponent = DollarSign;
                          iconColorClass = "text-amber-400 bg-amber-500/10";
                        }

                        return (
                          <div
                            key={n.id}
                            onClick={() => markAsRead(n.id)}
                            className={`flex gap-3 p-3.5 text-left transition-all hover:bg-white/[0.03] cursor-pointer relative group ${
                              !n.read ? "bg-white/[0.015]" : ""
                            }`}
                          >
                            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconColorClass}`}>
                              <IconComponent size={15} />
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex justify-between items-start gap-1 mb-0.5">
                                <span className={`text-xs font-semibold truncate block ${!n.read ? "text-white" : "text-[var(--cool-gray)]"}`}>
                                  {n.title}
                                </span>
                                <span className="text-[9px] text-[var(--cool-gray)]/50 shrink-0 font-mono mt-0.5">{n.time}</span>
                              </div>
                              <p className={`text-[10px] leading-relaxed line-clamp-2 ${!n.read ? "text-white/80" : "text-[var(--cool-gray)]/70"}`}>
                                {n.message}
                              </p>
                            </div>

                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!n.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(n.id);
                                  }}
                                  title="Mark as Read"
                                  className="size-5 rounded bg-white/5 border border-white/10 hover:bg-[var(--action-blue)]/20 hover:text-white flex items-center justify-center text-[var(--cool-gray)] transition-all cursor-pointer"
                                >
                                  <Check size={11} />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNotification(n.id);
                                }}
                                title="Clear Alert"
                                className="size-5 rounded bg-white/5 border border-white/10 hover:bg-[#EF4444]/20 hover:text-white flex items-center justify-center text-[var(--cool-gray)] transition-all cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </div>

                            {!n.read && (
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-[var(--action-blue)] shadow-[0_0_8px_var(--action-blue)]" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 flex flex-col items-center justify-center gap-2.5 text-center">
                        <div className="size-10 rounded-full bg-white/5 border border-[var(--glass-border)] flex items-center justify-center text-[var(--cool-gray)]">
                          <Bell size={16} className="opacity-50" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">All caught up!</p>
                          <p className="text-[10px] text-[var(--cool-gray)]">No new system or workspace notifications.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Currency Selector */}
          <CurrencySelector />

          {/* Role Badge / Switcher */}
          <RoleBadge />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--deep-slate)",
            border: "1px solid var(--glass-border)",
            color: "white",
          },
        }}
      />

      {/* Switching Workspace overlay */}
      <AnimatePresence>
        {switching && (
          <motion.div
            key="switching-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9998] bg-[#0F1419]/80 backdrop-blur-xl flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[0_0_80px_rgba(0,0,0,0.6)] px-10 py-8 flex flex-col items-center gap-5"
            >
              {/* Org logo */}
              <div
                className={`size-14 rounded-2xl bg-gradient-to-br ${activeOrg.logoGradient} flex items-center justify-center shadow-xl`}
              >
                <span className="text-white text-xl">{activeOrg.logoLetter}</span>
              </div>

              {/* Spinner */}
              <Loader2 size={24} className="animate-spin text-[var(--action-blue)]" />

              {/* Label */}
              <div className="text-center">
                <p className="text-sm text-white mb-1">Switching workspace…</p>
                <p className="text-xs text-[var(--cool-gray)]">{activeOrg.name}</p>
              </div>

              {/* Animated progress bar */}
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--action-blue)] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.4, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RootLayout() {
  const { refreshOrgs } = useOrg();

  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : "59, 130, 246";
    };

    const color = localStorage.getItem("vantage_theme_color") || "#3B82F6";
    const size = parseInt(localStorage.getItem("vantage_font_size") || "16");

    document.documentElement.style.setProperty("--action-blue", color);
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--ring", `rgba(${hexToRgb(color)}, 0.5)`);
    document.documentElement.style.setProperty("--font-size", `${size}px`);

    const token = localStorage.getItem("vantage_token");
    if (token) {
      refreshOrgs();
    }
  }, [refreshOrgs]);

  const token = localStorage.getItem("vantage_token");
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return <LayoutInner />;
}

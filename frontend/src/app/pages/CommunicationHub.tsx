import { useState, useRef, useEffect } from "react";
import {
  FileText, CheckCircle, MessageCircle, Paperclip, Send,
  PanelRightClose, PanelRightOpen, Plus, ClipboardCheck, Lock,
  Pin, AlertCircle, CheckSquare, Square, ChevronDown, ChevronUp,
  Megaphone, LayoutList, Circle, UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { useRole } from "../components/RoleContext";
import { useOrg } from "../components/OrgContext";
import { motion, AnimatePresence } from "motion/react";
import { WorkspaceItem } from "../components/WorkspaceItem";
import { ChatMessage } from "../components/ChatMessage";
import { CreateDepartmentModal, NewDepartmentData } from "../components/CreateDepartmentModal";
import { ProgressReportModal } from "../components/ProgressReportModal";
import { AddMembersModal } from "../components/AddMembersModal";
import {
  departments as seedDepartments,
  workspaceContent,
  Department,
  DEPT_COLORS,
  TEAM_LEADERS,
} from "../data/workspaceData";
import { seedSubmissions, Submission } from "../data/reportData";
import { chatMessages } from "../data/chatData";
import { apiFetch } from "../data/api";

// ─── Types ──────────────────────────────────────────────────────────────
interface AnnouncementItem {
  id: number;
  title: string;
  department: string;
  date: string;
  urgent: boolean;
  pinned: boolean;
  content: string;
}

function makeEmptyContent(deptName: string) {
  return {
    announcements: [
      {
        id: Date.now(),
        title: `${deptName} workspace created`,
        department: deptName,
        date: new Date().toISOString().slice(0, 10),
        urgent: false,
        pinned: true,
        content: "This department was just created. Add members to get started.",
      } as AnnouncementItem,
    ],
    reports: [] as typeof workspaceContent.operations.reports,
  };
}

// Seed announcements — attach pinned:true to all seeded ones
function seedAnnouncements(): Record<string, AnnouncementItem[]> {
  const result: Record<string, AnnouncementItem[]> = {};
  for (const [key, val] of Object.entries(workspaceContent)) {
    result[key] = val.announcements.map((a) => ({ ...a, pinned: true }));
  }
  return result;
}

// ─── Component ──────────────────────────────────────────────────────────
export function CommunicationHub() {
  const { role, assignedDepartment } = useRole();
  const { activeOrg } = useOrg();
  const workspaceId = activeOrg?.id || "operations";
  const DEMO_WORKSPACES = ["operations", "acme", "vantage-demo", "buildright"];
  const isDemoWorkspace = DEMO_WORKSPACES.includes(workspaceId);
  const isAdmin = role === "Organization Admin" || role === "Organization Owner";
  const isTeamLeader = role === "Team Leader";
  const isEmployee = role === "Employee";

  // Dynamically resolve active logged-in user profile details
  const [currentUserProfile] = useState(() => {
    try {
      const userStr = localStorage.getItem("vantage_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.firstName) {
          return {
            firstName: u.firstName,
            lastName: u.lastName || "",
          };
        }
      }
    } catch (e) {
      console.error("Failed to parse vantage_user from localStorage", e);
    }
    // Standard mock fallback based on the active role
    return {
      firstName: isEmployee ? "Rachel" : isTeamLeader ? "Ana" : "Admin",
      lastName: isEmployee ? "Green" : isTeamLeader ? "Reyes" : "Vantage",
    };
  });

  const isDemo = DEMO_WORKSPACES.includes(workspaceId);

  // Dynamic departments
  const [allDepartments, setAllDepartments] = useState<Department[]>(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) return seedDepartments;
    const orgId = localStorage.getItem("vantage_active_workspace_id");
    if (!orgId) return [];
    const saved = localStorage.getItem(`vantage_departments_${orgId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [dynamicContent, setDynamicContent] = useState<
    Record<string, ReturnType<typeof makeEmptyContent>>
  >({});

  const visibleDepartments = allDepartments.filter((d) => {
    if (isAdmin) return true;
    if (!d.isPrivate) return true; // Public chatrooms are visible to ALL members of the organization!
    // Private chatrooms require explicit allowed members inclusion or assigned department mapping
    const userObj = JSON.parse(localStorage.getItem("vantage_user") || "{}");
    const isAllowed = d.allowedMembers?.includes(userObj.id);
    return d.id === assignedDepartment || isAllowed;
  });

  const [activeWorkspace, setActiveWorkspace] = useState<string>(() => {
    if (visibleDepartments.length > 0) {
      return visibleDepartments[0].id;
    }
    return isAdmin ? "operations" : (assignedDepartment || "");
  });

  useEffect(() => {
    if (visibleDepartments.length > 0) {
      if (!visibleDepartments.some((d) => d.id === activeWorkspace)) {
        setActiveWorkspace(visibleDepartments[0].id);
      }
    } else {
      setActiveWorkspace("");
    }
  }, [role, assignedDepartment, visibleDepartments, activeWorkspace]);

  // ── Announcements state ──────────────────────────────────────────────
  const [localAnnouncements, setLocalAnnouncements] = useState<Record<string, AnnouncementItem[]>>(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) return seedAnnouncements();
    const orgId = localStorage.getItem("vantage_active_workspace_id");
    if (!orgId) return {};
    const saved = localStorage.getItem(`vantage_announcements_${orgId}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  // Save Announcements scoped by orgId
  useEffect(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    const orgId = localStorage.getItem("vantage_active_workspace_id");
    if (!isDemo && orgId) {
      localStorage.setItem(`vantage_announcements_${orgId}`, JSON.stringify(localAnnouncements));
    }
  }, [localAnnouncements, activeOrg?.id]);

  // New announcement form
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");
  const [announceUrgent, setAnnounceUrgent] = useState(false);
  const [announcePinned, setAnnouncePinned] = useState(true);

  const handlePostAnnouncement = () => {
    if (!announceTitle.trim()) return;
    const newItem: AnnouncementItem = {
      id: Date.now(),
      title: announceTitle.trim(),
      department: activeWorkspace,
      date: new Date().toISOString().slice(0, 10),
      urgent: announceUrgent,
      pinned: announcePinned,
      content: announceContent.trim() || "No additional details provided.",
    };
    setLocalAnnouncements((prev) => {
      const existing = prev[activeWorkspace] ?? [];
      const updated = announcePinned
        ? [newItem, ...existing]
        : [...existing, newItem];
      return { ...prev, [activeWorkspace]: updated };
    });
    setAnnounceTitle("");
    setAnnounceContent("");
    setAnnounceUrgent(false);
    setAnnouncePinned(true);
    setShowAnnounceForm(false);
    toast.success("Announcement posted", {
      description: announceUrgent ? "Marked as Urgent." : "Visible to all workspace members.",
      style: { background: "var(--deep-slate)", border: "1px solid var(--action-blue)", color: "white" },
    });
  };

  const toggleRead = (id: number) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Submissions state ────────────────────────────────────────────────
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) {
      const saved = localStorage.getItem("vantage_submissions");
      return saved ? JSON.parse(saved) : seedSubmissions;
    }
    return [];
  });

  useEffect(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) {
      localStorage.setItem("vantage_submissions", JSON.stringify(allSubmissions));
    }
  }, [allSubmissions]);

  // Fetch Progress Reports from backend when not in demo mode
  useEffect(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) return;

    const orgId = activeOrg?.id;
    if (!orgId) return;

    let isMounted = true;
    apiFetch(`/reports/${orgId}`)
      .then((res) => {
        if (isMounted && res && res.success) {
          const userObj = JSON.parse(localStorage.getItem("vantage_user") || "{}");
          const mapped = res.data.map((r: any) => ({
            id: r.id,
            author: r.author.id === userObj.id
              ? `You (${r.author.firstName} ${r.author.lastName})`
              : `${r.author.firstName} ${r.author.lastName}`,
            initials: ((r.author.firstName?.charAt(0) || "") + (r.author.lastName?.charAt(0) || "")).toUpperCase() || "U",
            avatarGradient: r.author.role === "EMPLOYEE"
              ? "linear-gradient(135deg, #22C55E, #10B981)"
              : r.author.role === "TEAM_LEADER"
              ? "linear-gradient(135deg, #3B82F6, #2563EB)"
              : "linear-gradient(135deg, #8B5CF6, #6D28D9)",
            department: r.department,
            summary: r.summary,
            status: r.status,
            date: new Date(r.createdAt).toISOString().slice(0, 10),
            time: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            attachments: r.attachments,
            reviewed: r.reviewed,
            sentTo: r.sentTo || "Org Admin",
            submitterRole: r.submitterRole,
            isOwn: r.author.id === userObj.id,
          }));
          setAllSubmissions(mapped);
        }
      })
      .catch((err) => console.error("Failed to load reports", err));

    return () => {
      isMounted = false;
    };
  }, [activeOrg?.id]);

  const [showReportModal, setShowReportModal] = useState(false);

  const currentDept = allDepartments.find((d) => d.id === activeWorkspace);
  const activeDeptLeader = (activeOrg?.members?.find((m) => m.id === currentDept?.assignedHead)) || TEAM_LEADERS.find(
    (l) => l.team.toLowerCase() === (currentDept?.name ?? "").toLowerCase()
  );
  const sentToLabel = isAdmin
    ? "All Workspace Members"
    : isEmployee
    ? activeDeptLeader
      ? `${activeDeptLeader.name} · ${"role" in activeDeptLeader ? activeDeptLeader.role : "Team Leader"}`
      : "Team Leader"
    : "Org Admin";

  const handleSubmitReport = async (data: { summary: string; status: "On Track" | "Delayed"; attachments: string[] }) => {
    const senderName = `${currentUserProfile.firstName} ${currentUserProfile.lastName}`.trim();
    const initials = ((currentUserProfile.firstName?.charAt(0) || "") + (currentUserProfile.lastName?.charAt(0) || "")).toUpperCase() || "U";
    
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) {
      const newSub: Submission = {
        id: Date.now(),
        author: `You (${senderName})`,
        initials: initials,
        avatarGradient: isEmployee
          ? "linear-gradient(135deg, #22C55E, #10B981)"
          : isTeamLeader
          ? "linear-gradient(135deg, #3B82F6, #2563EB)"
          : "linear-gradient(135deg, #8B5CF6, #6D28D9)",
        department: activeWorkspace,
        summary: data.summary,
        status: data.status,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: data.attachments.length,
        reviewed: false,
        sentTo: sentToLabel,
        submitterRole: isEmployee ? "Employee" : "Team Leader",
        isOwn: true,
      };
      const updated = [newSub, ...allSubmissions];
      setAllSubmissions(updated);
      localStorage.setItem("vantage_submissions", JSON.stringify(updated));
    } else {
      const orgId = activeOrg?.id;
      if (!orgId) return;

      try {
        const res = await apiFetch(`/reports/${orgId}`, {
          method: "POST",
          body: {
            department: activeWorkspace,
            summary: data.summary,
            status: data.status,
            attachments: data.attachments.length,
            sentTo: sentToLabel,
          }
        });
        if (res && res.success) {
          const r = res.data;
          const newSubMapped: Submission = {
            id: r.id,
            author: `You (${senderName})`,
            initials: initials,
            avatarGradient: isEmployee
              ? "linear-gradient(135deg, #22C55E, #10B981)"
              : isTeamLeader
              ? "linear-gradient(135deg, #3B82F6, #2563EB)"
              : "linear-gradient(135deg, #8B5CF6, #6D28D9)",
            department: r.department,
            summary: r.summary,
            status: r.status,
            date: new Date(r.createdAt).toISOString().slice(0, 10),
            time: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            attachments: r.attachments,
            reviewed: r.reviewed,
            sentTo: r.sentTo,
            submitterRole: r.submitterRole,
            isOwn: true,
          };
          setAllSubmissions((prev) => [newSubMapped, ...prev]);
        }
      } catch (err) {
        toast.error("Failed to submit progress report");
      }
    }

    setShowReportModal(false);
    setSidebarTab("submissions");
    toast.success("Report submitted", {
      description: `Sent to ${sentToLabel}.`,
      style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" },
    });
  };

  // Tiered filtering for submissions tab
  const visibleSubmissions = allSubmissions
    .filter((s) => {
      if (isAdmin) return s.department === activeWorkspace;
      if (isTeamLeader) return s.department === activeWorkspace;
      return s.department === activeWorkspace && s.isOwn;
    })
    .sort((a, b) => b.id - a.id); // most recent first (id is timestamp for new ones)

  // ── Sidebar tab state ────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<"briefs" | "submissions">("briefs");

  // ── Other state ──────────────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showTLTooltip, setShowTLTooltip] = useState(false);

  const handleAddMembers = (newMemberIds: string[]) => {
    const updated = allDepartments.map((d) => {
      if (d.id === activeWorkspace) {
        const currentMembers = d.allowedMembers || [];
        const nextMembers = Array.from(new Set([...currentMembers, ...newMemberIds]));
        return {
          ...d,
          allowedMembers: nextMembers,
          count: (d.count || 1) + newMemberIds.length,
        };
      }
      return d;
    });

    setAllDepartments(updated);

    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    const orgId = localStorage.getItem("vantage_active_workspace_id");
    if (!isDemo && orgId) {
      localStorage.setItem(`vantage_departments_${orgId}`, JSON.stringify(updated));
    }

    toast.success("Members Added", {
      description: `Successfully added ${newMemberIds.length} member(s) to this private workspace.`,
      style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" },
    });
  };
  const tlTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Dynamic Chat Persister state mapping
  const [allChats, setAllChats] = useState<any>(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    const saved = localStorage.getItem("vantage_chats");
    if (saved) return JSON.parse(saved);
    return isDemo ? chatMessages : {};
  });

  const [chatMessagesList, setChatMessagesList] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Fetch Chat History from backend when not in demo mode
  useEffect(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    if (isDemo) {
      setChatMessagesList(allChats[activeWorkspace] ?? []);
      return;
    }

    if (!activeWorkspace) {
      setChatMessagesList([]);
      return;
    }

    const orgId = activeOrg?.id;
    if (!orgId) return;

    let isMounted = true;

    const fetchChats = () => {
      apiFetch(`/messages/${orgId}/${activeWorkspace}`)
        .then((res) => {
          if (isMounted && res && res.success) {
            const userObj = JSON.parse(localStorage.getItem("vantage_user") || "{}");
            const mapped = res.data.map((m: any) => ({
              id: m.id,
              author: `${m.author.firstName} ${m.author.lastName}`,
              avatar: m.author.role === "EMPLOYEE"
                ? "bg-gradient-to-br from-amber-400 to-orange-500"
                : m.author.role === "TEAM_LEADER"
                ? "bg-gradient-to-br from-[var(--mint-green)] to-emerald-500"
                : "bg-gradient-to-br from-[var(--action-blue)] to-purple-500",
              message: m.content,
              timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isCurrentUser: m.author.id === userObj.id,
              isActive: true,
            }));
            setChatMessagesList((current) => {
              if (JSON.stringify(current) === JSON.stringify(mapped)) return current;
              return mapped;
            });
          }
        })
        .catch((err) => console.error("Failed to load messages", err))
        .finally(() => {
          if (isMounted) setLoadingChats(false);
        });
    };

    setLoadingChats(true);
    fetchChats();
    const interval = setInterval(fetchChats, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeWorkspace, activeOrg?.id]);
  
  // Persist messages across sessions/logouts
  useEffect(() => {
    localStorage.setItem("vantage_chats", JSON.stringify(allChats));
  }, [allChats]);

  // Custom Reply State matching screenshot specs
  const [replyingToMessage, setReplyingToMessage] = useState<{ author: string; text: string } | null>(null);

  // Automatically scroll message feed when workspace changes or a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeWorkspace, allChats]);

  const handleSendMessage = async () => {
    const contentText = messageInput.trim();
    if (!contentText) return;

    let formattedMessage = contentText;
    if (replyingToMessage) {
      formattedMessage = `Replying to @${replyingToMessage.author}: "${replyingToMessage.text}"\n\n${contentText}`;
    }

    const isDemo = DEMO_WORKSPACES.includes(activeOrg?.id || "operations");
    if (isDemo) {
      const senderName = `${currentUserProfile.firstName} ${currentUserProfile.lastName}`.trim();
      const avatarGradient = isEmployee
        ? "bg-gradient-to-br from-amber-400 to-orange-500"
        : isTeamLeader
        ? "bg-gradient-to-br from-[var(--mint-green)] to-emerald-500"
        : "bg-gradient-to-br from-[var(--action-blue)] to-purple-500";

      const newMessage = {
        id: Date.now(),
        author: senderName,
        avatar: avatarGradient,
        message: formattedMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isCurrentUser: true,
        isActive: true,
      };

      setAllChats((prev: any) => {
        const workspaceKey = activeWorkspace;
        const existing = prev[workspaceKey] ?? [];
        const updated = {
          ...prev,
          [workspaceKey]: [...existing, newMessage],
        };
        localStorage.setItem("vantage_chats", JSON.stringify(updated));
        return updated;
      });
    } else {
      const orgId = activeOrg?.id;
      if (!orgId) return;

      try {
        const res = await apiFetch(`/messages/${orgId}/${activeWorkspace}`, {
          method: "POST",
          body: {
            content: formattedMessage,
          }
        });
        if (res && res.success) {
          const m = res.data;
          const newMsgMapped = {
            id: m.id,
            author: `${m.author.firstName} ${m.author.lastName}`,
            avatar: m.author.role === "EMPLOYEE"
              ? "bg-gradient-to-br from-amber-400 to-orange-500"
              : m.author.role === "TEAM_LEADER"
              ? "bg-gradient-to-br from-[var(--mint-green)] to-emerald-500"
              : "bg-gradient-to-br from-[var(--action-blue)] to-purple-500",
            message: m.content,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isCurrentUser: true,
            isActive: true,
          };
          setChatMessagesList((prev) => [...prev, newMsgMapped]);
        }
      } catch (err) {
        toast.error("Failed to send message");
      }
    }

    setMessageInput("");
    setReplyingToMessage(null); // Clear reply context
  };

  const handleCreateDepartment = (data: NewDepartmentData) => {
    const colorIndex = allDepartments.length % DEPT_COLORS.length;
    const id = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const userObj = JSON.parse(localStorage.getItem("vantage_user") || "{}");
    const newDept: Department = {
      id, name: data.name, count: 1,
      color: DEPT_COLORS[colorIndex],
      isPrivate: data.isPrivate, assignedHead: data.assignedHead, isNew: true,
      allowedMembers: data.isPrivate ? [userObj.id, data.assignedHead].filter(Boolean) : [],
    };
    const updated = [...allDepartments, newDept];
    setAllDepartments(updated);
    setDynamicContent((prev) => ({ ...prev, [id]: makeEmptyContent(data.name) }));
    
    setLocalAnnouncements((prev) => {
      const updatedAnnouncements = {
        ...prev,
        [id]: [makeEmptyContent(data.name).announcements[0] as AnnouncementItem],
      };
      const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
      const orgId = localStorage.getItem("vantage_active_workspace_id");
      if (!isDemo && orgId) {
        localStorage.setItem(`vantage_announcements_${orgId}`, JSON.stringify(updatedAnnouncements));
      }
      return updatedAnnouncements;
    });

    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    const orgId = localStorage.getItem("vantage_active_workspace_id");
    if (!isDemo && orgId) {
      localStorage.setItem(`vantage_departments_${orgId}`, JSON.stringify(updated));
    }

    setShowCreateModal(false);
    setActiveWorkspace(id);
    toast.success(`"${data.name}" department created`, {
      description: data.isPrivate ? "Sandboxed — only you and the head can see this." : "Visible to all org members.",
      style: { background: "var(--deep-slate)", border: "1px solid var(--action-blue)", color: "white" },
    });
  };

  const activeDeptName = allDepartments.find((d) => d.id === activeWorkspace)?.name ?? "Workspace";
  const activeDept = allDepartments.find((d) => d.id === activeWorkspace);
  const activeAnnouncements = localAnnouncements[activeWorkspace] ?? [];
  const unreadCount = activeAnnouncements.filter((a) => !readIds.has(a.id)).length;
  const activeChatMessages = chatMessagesList;

  return (
    <div className="h-full flex">
      {/* ── Left Panel ───────────────────────────────────────────────── */}
      <aside className="w-72 border-r border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-6 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-white">Workspaces</h2>
          {isEmployee ? null : isAdmin ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="size-8 rounded-lg flex items-center justify-center bg-[var(--action-blue)]/20 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/35 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all"
              title="Create Department"
            >
              <Plus size={16} />
            </button>
          ) : (
            <div
              className="relative"
              onMouseEnter={() => {
                if (tlTooltipTimer.current) clearTimeout(tlTooltipTimer.current);
                setShowTLTooltip(true);
              }}
              onMouseLeave={() => {
                tlTooltipTimer.current = setTimeout(() => setShowTLTooltip(false), 120);
              }}
            >
              <button
                disabled
                className="size-8 rounded-lg flex items-center justify-center bg-[var(--action-blue)]/10 text-[var(--action-blue)]/40 opacity-50 cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
              <AnimatePresence>
                {showTLTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 z-30 w-56"
                  >
                    <div className="relative rounded-xl bg-[#1A1F2C] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3.5 py-2.5">
                      <div className="absolute -top-1.5 right-3 size-3 bg-[#1A1F2C] border-l border-t border-[var(--glass-border)] rotate-45" />
                      <div className="flex items-start gap-2">
                        <Lock size={11} className="text-[var(--cool-gray)] mt-0.5 shrink-0" />
                        <p className="text-[11px] text-[var(--cool-gray)] leading-relaxed">
                          Only Organization Admins can create new departments.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto">
          {visibleDepartments.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[var(--glass-border)] rounded-xl px-4">
              <Lock size={20} className="text-[var(--cool-gray)]/40 mx-auto mb-2" />
              <p className="text-[11px] text-[var(--cool-gray)]">No active workspaces.</p>
            </div>
          ) : (
            visibleDepartments.map((dept) => (
              <div key={dept.id} className="relative">
                <WorkspaceItem
                  name={dept.name}
                  count={dept.count}
                  color={dept.color}
                  isActive={activeWorkspace === dept.id}
                  onClick={() => setActiveWorkspace(dept.id)}
                />
                {dept.isNew && dept.isPrivate && isAdmin && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25">
                    <Lock size={9} className="text-amber-400" />
                    <span className="text-[9px] text-amber-400">Private</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Center Panel ─────────────────────────────────────────────── */}
      {visibleDepartments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-12 bg-gradient-to-b from-transparent to-white/[0.02]">
          <div className="max-w-md w-full text-center p-8 rounded-2xl bg-white/[0.03] border border-[var(--glass-border)] shadow-2xl backdrop-blur-md">
            <div className="size-16 rounded-2xl bg-[var(--action-blue)]/10 text-[var(--action-blue)] flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-pulse">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Initialize Your Workspace</h3>
            <p className="text-sm text-[var(--cool-gray)] mb-8 leading-relaxed">
              This organization is a clean slate. Create your first team workspace to begin chatting, sharing documents, and tracking team daily progress logs.
            </p>
            {isAdmin ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-xl bg-[var(--action-blue)] hover:bg-[var(--action-blue)]/80 text-white font-semibold text-sm shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.45)] transition-all flex items-center gap-2 mx-auto"
              >
                <Plus size={18} />
                <span>Create First Workspace</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 justify-center text-amber-400 bg-amber-500/10 border border-amber-500/25 px-4 py-2.5 rounded-lg text-xs">
                <AlertCircle size={14} />
                <span>Contact your Organization Admin to initialize the workspaces.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="h-16 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white">{activeDeptName} Team Conversation</h2>
                    {activeDept?.isNew && activeDept.isPrivate && isAdmin && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/25 text-[10px] text-amber-400">
                        <Lock size={9} /> Sandboxed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--cool-gray)]">
                    {activeChatMessages.filter((m) => m.isActive).length} members active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Add Members — Visible on Private Workspaces for Admins and Team Leaders */}
                {activeDept?.isPrivate && (isAdmin || isTeamLeader) && (
                  <button
                    onClick={() => setShowAddMembersModal(true)}
                    className="px-4 py-2 rounded-lg bg-[var(--action-blue)]/20 text-[var(--action-blue)] border border-[var(--action-blue)]/30 hover:bg-[var(--action-blue)]/35 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus size={16} />
                    <span>Add Members</span>
                  </button>
                )}
                {/* Report Progress — Visible to Employees and Team Leaders */}
                {(isEmployee || isTeamLeader) && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="px-4 py-2 rounded-lg bg-[var(--mint-green)] text-[var(--deep-slate)] hover:bg-[var(--mint-green)]/90 shadow-[0_0_20px_rgba(52,211,153,0.35)] transition-all flex items-center gap-2"
                  >
                    <ClipboardCheck size={18} />
                    <span>Report Progress</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="size-10 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all"
                >
                  {showSidebar ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWorkspace}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-y-auto p-6"
              >
                <div className="max-w-4xl mx-auto">
                  {loadingChats ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
                      <div className="size-8 rounded-full border-2 border-white/10 border-t-white animate-spin mb-3" />
                      <p className="text-xs text-[var(--cool-gray)]">Loading conversation...</p>
                    </div>
                  ) : activeChatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <MessageCircle size={40} className="text-[var(--cool-gray)]/20 mb-3" />
                      <p className="text-sm text-white font-medium">No messages in this workspace yet.</p>
                      <p className="text-xs text-[var(--cool-gray)] max-w-xs mt-1 leading-relaxed">
                        Send a message below to start the conversation with your team!
                      </p>
                    </div>
                  ) : (
                    activeChatMessages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        id={msg.id}
                        author={msg.author}
                        avatar={msg.avatar}
                        message={msg.message}
                        timestamp={msg.timestamp}
                        isCurrentUser={msg.isCurrentUser}
                        isActive={msg.isActive}
                        onReply={(author, text) => {
                          setReplyingToMessage({ author, text });
                        }}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Chat Input */}
            <div className="border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4 shrink-0">
              
              {/* Reply Status Bar Matching Screenshot Specs */}
              <AnimatePresence>
                {replyingToMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="max-w-4xl mx-auto mb-6 flex justify-end relative"
                  >
                    <div className="relative max-w-[85%] mr-4">
                      {/* The main capsule bubble */}
                      <div className="bg-[#2E3747] border border-white/5 px-7 py-4 rounded-[30px] text-white text-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)] select-none">
                        <p className="break-all pr-16 leading-relaxed text-gray-300 font-normal tracking-wide">
                          {replyingToMessage.text}
                        </p>
                      </div>
                      
                      {/* Overlapping Reply Button & Sent Status */}
                      <div className="absolute right-4 bottom-0 translate-y-1/2 flex flex-col items-end z-20">
                        <button
                          onClick={() => {
                            if (messageInput.trim()) {
                              handleSendMessage();
                            } else {
                              toast.error("Type a message to reply", {
                                style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
                              });
                            }
                          }}
                          className="px-6 py-2.5 rounded-full bg-[#5D9CEC] hover:bg-[#4A89E3] text-white font-semibold text-xs shadow-[0_4px_14px_rgba(93,156,236,0.4)] active:scale-95 transition-all cursor-pointer select-none"
                        >
                          Reply
                        </button>
                      </div>
                      
                      {/* Dismiss button */}
                      <button
                        onClick={() => setReplyingToMessage(null)}
                        className="absolute -top-2 -left-2 size-6 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center text-xs hover:bg-black/90 transition-all cursor-pointer z-30"
                        title="Cancel Reply"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="max-w-4xl mx-auto flex items-end gap-3">
                <button className="size-10 rounded-lg flex items-center justify-center text-[var(--cool-gray)] hover:text-white hover:bg-white/5 transition-all">
                  <Paperclip size={20} />
                </button>
                <div className="flex-1">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Send a message to the team or attach a progress photo..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--input-background)] backdrop-blur-sm border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/50"
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="size-10 rounded-lg flex items-center justify-center bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </main>

          {/* ── Right Sidebar ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {showSidebar && (
              <motion.aside
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-96 border-l border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex flex-col shrink-0"
              >
                {/* Sidebar tab bar - Visible to all workspace participants */}
                <div className="flex items-center gap-1 p-4 border-b border-[var(--glass-border)] shrink-0">
                  <button
                    onClick={() => setSidebarTab("briefs")}
                    className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm transition-all ${
                      sidebarTab === "briefs"
                        ? "bg-[var(--action-blue)]/15 text-white border border-[var(--action-blue)]/30"
                        : "text-[var(--cool-gray)] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Megaphone size={13} />
                    <span>Briefs</span>
                    {unreadCount > 0 && (
                      <span className="size-4 rounded-full bg-[var(--action-blue)] text-white text-[9px] flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setSidebarTab("submissions")}
                    className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm transition-all ${
                      sidebarTab === "submissions"
                        ? "bg-[var(--action-blue)]/15 text-white border border-[var(--action-blue)]/30"
                        : "text-[var(--cool-gray)] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <LayoutList size={13} />
                    <span>Submissions</span>
                    {visibleSubmissions.filter((s) => !s.reviewed).length > 0 && (
                      <span className="size-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">
                        {visibleSubmissions.filter((s) => !s.reviewed).length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <AnimatePresence mode="wait">

                    {/* ── BRIEFS TAB ─────────────────────────────────────── */}
                    {sidebarTab === "briefs" && (
                      <motion.div
                        key="briefs"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="p-5"
                      >
                        {/* Section header */}
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm text-[var(--cool-gray)]">Pinned Announcements</h4>
                          {(isAdmin || isTeamLeader) && (
                            <button
                              onClick={() => setShowAnnounceForm((v) => !v)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--action-blue)]/15 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/25 transition-all text-xs"
                            >
                              {showAnnounceForm ? <ChevronUp size={12} /> : <Plus size={12} />}
                              {showAnnounceForm ? "Collapse" : "New"}
                            </button>
                          )}
                        </div>

                        {/* ── Announcement creator (Admin / Leader) ── */}
                        <AnimatePresence>
                          {showAnnounceForm && (isAdmin || isTeamLeader) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mb-4 overflow-hidden"
                            >
                              <div className="p-4 rounded-xl bg-[var(--action-blue)]/8 border border-[var(--action-blue)]/20 space-y-3">
                                <input
                                  type="text"
                                  value={announceTitle}
                                  onChange={(e) => setAnnounceTitle(e.target.value)}
                                  placeholder="Announcement title…"
                                  className="w-full h-9 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/40 transition-all"
                                />
                                <textarea
                                  value={announceContent}
                                  onChange={(e) => setAnnounceContent(e.target.value)}
                                  placeholder="Details (optional)…"
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white placeholder:text-[var(--cool-gray)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)]/40 resize-none transition-all"
                                />

                                {/* Toggles row */}
                                <div className="flex items-center gap-3">
                                  {/* Pin to Top */}
                                  <button
                                    type="button"
                                    onClick={() => setAnnouncePinned((v) => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                                      announcePinned
                                        ? "bg-[var(--action-blue)]/15 border-[var(--action-blue)]/40 text-[var(--action-blue)]"
                                        : "bg-transparent border-[var(--glass-border)] text-[var(--cool-gray)] hover:border-white/20"
                                    }`}
                                  >
                                    <Pin size={11} className={announcePinned ? "fill-current" : ""} />
                                    Pin to Top
                                  </button>

                                  {/* Urgent */}
                                  <button
                                    type="button"
                                    onClick={() => setAnnounceUrgent((v) => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                                      announceUrgent
                                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                                        : "bg-transparent border-[var(--glass-border)] text-[var(--cool-gray)] hover:border-white/20"
                                    }`}
                                  >
                                    <AlertCircle size={11} />
                                    Urgent
                                  </button>

                                  {/* Post button */}
                                  <button
                                    onClick={handlePostAnnouncement}
                                    disabled={!announceTitle.trim()}
                                    className="ml-auto px-3 py-1 rounded-lg bg-[var(--action-blue)] text-white text-xs hover:bg-[var(--action-blue)]/85 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Post
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── Announcement list ── */}
                        <div className="space-y-3">
                          {activeAnnouncements.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                              <Megaphone size={28} className="text-[var(--cool-gray)]/30" />
                              <p className="text-xs text-[var(--cool-gray)]">No announcements yet.</p>
                            </div>
                          ) : (
                            activeAnnouncements.map((a) => {
                              const isUnread = !readIds.has(a.id);
                              return (
                                <div
                                  key={a.id}
                                  className={`relative p-4 rounded-lg border transition-all ${
                                    isUnread
                                      ? "bg-white/5 border-[var(--glass-border)]"
                                      : "bg-white/[0.02] border-[var(--glass-border)]/50"
                                  }`}
                                >
                                  {/* Unread dot */}
                                  {isUnread && (
                                    <span className="absolute top-3 right-3 size-2 rounded-full bg-[var(--action-blue)] shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                                  )}

                                  <div className="flex items-start gap-2 mb-2 pr-4">
                                    {a.urgent && (
                                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/30 shrink-0">
                                        Urgent
                                      </span>
                                    )}
                                    {a.pinned && (
                                      <span className="px-2 py-0.5 rounded-full bg-[var(--action-blue)]/15 text-[var(--action-blue)] text-xs border border-[var(--action-blue)]/25 flex items-center gap-1 shrink-0">
                                        <Pin size={9} className="fill-current" /> Pinned
                                      </span>
                                    )}
                                    <span className="text-xs text-[var(--cool-gray)] ml-auto shrink-0">{a.date}</span>
                                  </div>
                                  <h5 className="text-sm text-white mb-1">{a.title}</h5>
                                  <p className="text-xs text-[var(--cool-gray)] line-clamp-2">{a.content}</p>

                                  {/* Employee: Mark as Read checkbox */}
                                  {isEmployee && (
                                    <button
                                      onClick={() => toggleRead(a.id)}
                                      className="flex items-center gap-2 mt-3 text-xs transition-colors group"
                                    >
                                      {readIds.has(a.id) ? (
                                        <>
                                          <CheckSquare size={13} className="text-[var(--mint-green)]" />
                                          <span className="text-[var(--mint-green)]">Marked as read</span>
                                        </>
                                      ) : (
                                        <>
                                          <Square size={13} className="text-[var(--cool-gray)] group-hover:text-white" />
                                          <span className="text-[var(--cool-gray)] group-hover:text-white">Mark as read</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* ── SUBMISSIONS TAB ────────────────────────────────── */}
                    {sidebarTab === "submissions" && (
                      <motion.div
                        key="submissions"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18 }}
                        className="p-5"
                      >
                        <div className="flex items-center justify-between mb-5">
                          <h4 className="text-sm text-[var(--cool-gray)]">
                            {isEmployee ? "My Submissions" : isTeamLeader ? "Team Submissions" : "All Submissions"}
                          </h4>
                          <span className="text-[11px] text-[var(--cool-gray)] bg-white/5 px-2 py-0.5 rounded-full border border-[var(--glass-border)]">
                            {visibleSubmissions.length} total
                          </span>
                        </div>

                        {visibleSubmissions.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <LayoutList size={32} className="text-[var(--cool-gray)]/30" />
                            <p className="text-sm text-[var(--cool-gray)]">No submissions yet.</p>
                            {(isEmployee || isTeamLeader) && (
                              <p className="text-xs text-[var(--cool-gray)]/60 max-w-[180px]">
                                Submit your first progress report using the button above.
                              </p>
                            )}
                          </div>
                        ) : (
                          /* Chronological timeline */
                          <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute left-4 top-4 bottom-4 w-px bg-[var(--glass-border)]" />

                            <div className="space-y-5">
                              {visibleSubmissions.map((sub, idx) => (
                                <div key={sub.id} className="relative pl-12">
                                  {/* Avatar on timeline */}
                                  <div
                                    className="absolute left-0 top-0 size-9 rounded-full border-2 border-[#0F1419] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.4)]"
                                    style={{ background: sub.avatarGradient }}
                                  >
                                    <span className="text-[10px] text-white">{sub.initials}</span>
                                  </div>

                                  {/* Card */}
                                  <div className="p-3.5 rounded-xl bg-white/5 border border-[var(--glass-border)] hover:border-[var(--action-blue)]/30 transition-all">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{sub.author}</p>
                                        <p className="text-[10px] text-[var(--cool-gray)]">
                                          {sub.date} · {sub.time}
                                        </p>
                                      </div>
                                      {/* Reviewed / Pending badge */}
                                      {sub.reviewed ? (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/30 shrink-0">
                                          <CheckCircle size={10} className="text-[var(--mint-green)]" />
                                          <span className="text-[10px] text-[var(--mint-green)]">Reviewed</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 shrink-0">
                                          <Circle size={8} className="text-orange-400 fill-orange-400" />
                                          <span className="text-[10px] text-orange-400">Pending</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Summary */}
                                    <p className="text-xs text-[var(--cool-gray)] line-clamp-2 mb-2.5">
                                      {sub.summary}
                                    </p>

                                    {/* Footer row */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Status badge */}
                                      <span
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${
                                          sub.status === "On Track"
                                            ? "bg-[var(--mint-green)]/10 border-[var(--mint-green)]/30 text-[var(--mint-green)]"
                                            : "bg-amber-400/10 border-amber-400/30 text-amber-400"
                                        }`}
                                      >
                                        {sub.status === "On Track" ? (
                                          <CheckCircle size={9} />
                                        ) : (
                                          <AlertCircle size={9} />
                                        )}
                                        {sub.status}
                                      </span>

                                      {/* Attachments */}
                                      {sub.attachments > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--cool-gray)]">
                                          <FileText size={10} />
                                          {sub.attachments} file{sub.attachments !== 1 ? "s" : ""}
                                        </span>
                                      )}

                                      {/* Sent to */}
                                      <span className="flex items-center gap-1 text-[10px] text-[var(--cool-gray)] ml-auto">
                                        → {sub.sentTo}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <CreateDepartmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateDepartment}
        members={activeOrg?.members || []}
      />

      <ProgressReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
        sentToLabel={sentToLabel}
        role={role}
      />

      <AddMembersModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        members={activeOrg?.members || []}
        existingMemberIds={activeDept?.allowedMembers || []}
        onAdd={handleAddMembers}
      />
    </div>
  );
}

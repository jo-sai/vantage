import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import type { Role } from "./RoleContext";
import { apiFetch } from "../data/api";

// ─── Types ────────────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  name: string;
  initials: string;
  avatarGradient: string;
  role: Role;
  department: string;
  online: boolean;
}

export interface Org {
  id: string;
  name: string;
  shortName: string;
  logoGradient: string;
  logoLetter: string;
  userRole: "Owner" | "Admin" | "Member";
  memberCount: number;
  industry: string;
  members: OrgMember[];
}

interface OrgContextValue {
  orgs: Org[];
  activeOrg: Org;
  switching: boolean;
  switchOrg: (id: string) => void;
  refreshOrgs: () => Promise<void>;
}

// ─── Org data ─────────────────────────────────────────────────────────────

const ORGS: Org[] = [
  {
    id: "acme",
    name: "Acme Construction Co.",
    shortName: "Acme",
    logoGradient: "from-[#3B82F6] to-[#2563EB]",
    logoLetter: "A",
    userRole: "Owner",
    memberCount: 24,
    industry: "Commercial Construction",
    members: [
      {
        id: "m1", name: "Sarah Chen", initials: "SC",
        avatarGradient: "linear-gradient(135deg, #22C55E, #14B8A6)",
        role: "Organization Admin", department: "Engineering", online: true,
      },
      {
        id: "m2", name: "Marcus Thompson", initials: "MT",
        avatarGradient: "linear-gradient(135deg, #3B82F6, #06B6D4)",
        role: "Team Leader", department: "Operations", online: true,
      },
      {
        id: "m3", name: "Elena Rodriguez", initials: "ER",
        avatarGradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
        role: "Team Leader", department: "Marketing", online: false,
      },
      {
        id: "m4", name: "David Kim", initials: "DK",
        avatarGradient: "linear-gradient(135deg, #EAB308, #F97316)",
        role: "Employee", department: "Engineering", online: true,
      },
      {
        id: "m5", name: "James Wilson", initials: "JW",
        avatarGradient: "linear-gradient(135deg, #F97316, #EF4444)",
        role: "Employee", department: "Operations", online: false,
      },
      {
        id: "m6", name: "Priya Patel", initials: "PP",
        avatarGradient: "linear-gradient(135deg, #EC4899, #F43F5E)",
        role: "Employee", department: "Finance", online: true,
      },
    ],
  },
  {
    id: "vantage-demo",
    name: "Vantage Demo Org",
    shortName: "Vantage",
    logoGradient: "from-[#10B981] to-emerald-600",
    logoLetter: "V",
    userRole: "Admin",
    memberCount: 8,
    industry: "Infrastructure",
    members: [
      {
        id: "vd1", name: "Lena Park", initials: "LP",
        avatarGradient: "linear-gradient(135deg, #10B981, #059669)",
        role: "Organization Admin", department: "Project Management", online: true,
      },
      {
        id: "vd2", name: "Carlos Mendez", initials: "CM",
        avatarGradient: "linear-gradient(135deg, #3B82F6, #4F46E5)",
        role: "Team Leader", department: "Site Safety", online: true,
      },
      {
        id: "vd3", name: "Aisha Okonkwo", initials: "AO",
        avatarGradient: "linear-gradient(135deg, #F59E0B, #EF4444)",
        role: "Employee", department: "Architecture", online: false,
      },
      {
        id: "vd4", name: "Tom Reeves", initials: "TR",
        avatarGradient: "linear-gradient(135deg, #8B5CF6, #EC4899)",
        role: "Employee", department: "Architecture", online: true,
      },
    ],
  },
  {
    id: "buildright",
    name: "BuildRight Group",
    shortName: "BuildRight",
    logoGradient: "from-purple-500 to-violet-600",
    logoLetter: "B",
    userRole: "Member",
    memberCount: 15,
    industry: "Residential Construction",
    members: [
      {
        id: "br1", name: "Patricia Vong", initials: "PV",
        avatarGradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
        role: "Organization Admin", department: "Design", online: false,
      },
      {
        id: "br2", name: "Nathan Osei", initials: "NO",
        avatarGradient: "linear-gradient(135deg, #06B6D4, #3B82F6)",
        role: "Team Leader", department: "Construction", online: true,
      },
      {
        id: "br3", name: "Maya Singh", initials: "MS",
        avatarGradient: "linear-gradient(135deg, #F43F5E, #EC4899)",
        role: "Employee", department: "Quality Control", online: true,
      },
      {
        id: "br4", name: "Eric Tran", initials: "ET",
        avatarGradient: "linear-gradient(135deg, #22C55E, #10B981)",
        role: "Employee", department: "Design", online: false,
      },
    ],
  },
];

// ─── Context ──────────────────────────────────────────────────────────────

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>(() => {
    const token = localStorage.getItem("vantage_token");
    if (!token) return ORGS;

    const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "null");
    const userEmail = storedUser?.email || "";
    const isDemoUser = ["owner@vantage.io", "admin@vantage.io", "employee@vantage.io", "finance@vantage.io"].includes(userEmail.toLowerCase()) ||
                       ["demo_offline_token_owner", "demo_offline_token_admin", "demo_offline_token_employee"].includes(token);
    
    if (isDemoUser) return ORGS;

    // If user has already created/named an org (via Welcome screen), use that
    const savedCustomOrgs = localStorage.getItem("vantage_custom_orgs");
    if (savedCustomOrgs) {
      try {
        const parsed = JSON.parse(savedCustomOrgs);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Org[];
      } catch {}
    }

    // Otherwise show an empty placeholder org — no name yet, user needs to go through Welcome
    const storedWsId = localStorage.getItem("vantage_active_workspace_id") || "operations";
    const firstName = storedUser?.firstName || "User";
    const freshOrg: Org = {
      id: storedWsId,
      name: `${firstName}'s Vantage Studio`,
      shortName: firstName,
      logoGradient: "from-purple-500 to-indigo-600",
      logoLetter: firstName.charAt(0).toUpperCase(),
      userRole: "Owner",
      memberCount: 1,
      industry: "Technology",
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
    };
    return [freshOrg];
  });
  const [activeOrgId, setActiveOrgId] = useState(() => {
    return localStorage.getItem("vantage_active_workspace_id") || "acme";
  });
  const [switching, setSwitching] = useState(false);

  const refreshOrgs = useCallback(async () => {
    const token = localStorage.getItem("vantage_token");
    if (!token) {
      setOrgs(ORGS);
      return;
    }

    const isCustomOffline = token.startsWith("demo_offline_token_custom_");
    if (isCustomOffline) {
      const stored = localStorage.getItem("vantage_custom_orgs");
      if (stored) {
        const parsed = JSON.parse(stored);
        setOrgs(parsed);
        const activeExists = parsed.some((o: any) => o.id === activeOrgId);
        if (!activeExists && parsed.length > 0) {
          setActiveOrgId(parsed[0].id);
          localStorage.setItem("vantage_active_workspace_id", parsed[0].id);
        }
      } else {
        const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "null");
        const firstName = storedUser?.firstName || "User";
        const personalSlug = localStorage.getItem("vantage_active_workspace_id") || `${firstName.toLowerCase()}-studio`;
        const freshOrg: Org = {
          id: personalSlug,
          name: `${firstName}'s Vantage Studio`,
          shortName: firstName,
          logoGradient: "from-purple-500 to-indigo-600",
          logoLetter: firstName.charAt(0).toUpperCase(),
          userRole: "Owner",
          memberCount: 1,
          industry: "Commercial Construction",
          members: [
            {
              id: "m-owner",
              name: `${firstName} ${storedUser?.lastName || ""}`,
              initials: (firstName.charAt(0) + (storedUser?.lastName?.charAt(0) || "")).toUpperCase(),
              avatarGradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
              role: "Organization Owner",
              department: "Executive",
              online: true
            }
          ]
        };
        const initialCustomOrgs = [freshOrg];
        localStorage.setItem("vantage_custom_orgs", JSON.stringify(initialCustomOrgs));
        setOrgs(initialCustomOrgs);
        setActiveOrgId(personalSlug);
      }
      return;
    }

    try {
      const res = await apiFetch("/workspaces");
      if (res && res.success && res.data && res.data.length > 0) {
        const mappedOrgs = await Promise.all(
          res.data.map(async (ws: any) => {
            let membersList = [];
            try {
              const memRes = await apiFetch(`/workspaces/${ws.id}/members`);
              if (memRes && memRes.success) {
                membersList = memRes.data;
              }
            } catch (err) {
              console.error("Failed to load members for workspace", ws.id, err);
            }

            const displayMembers = membersList.map((m: any) => {
              const u = m.user;
              const fullName = `${u.firstName} ${u.lastName}`;
              const initials = ((u.firstName?.charAt(0) || "") + (u.lastName?.charAt(0) || "")).toUpperCase() || "U";
              
              let displayRole: Role = "Employee";
              if (m.role === "OWNER") displayRole = "Organization Owner" as Role;
              else if (m.role === "ADMIN") displayRole = "Organization Admin" as Role;
              else if (m.role === "TEAM_LEADER") displayRole = "Team Leader" as Role;

              const gradients = [
                "linear-gradient(135deg, #22C55E, #14B8A6)",
                "linear-gradient(135deg, #3B82F6, #06B6D4)",
                "linear-gradient(135deg, #A855F7, #7C3AED)",
                "linear-gradient(135deg, #EAB308, #F97316)",
                "linear-gradient(135deg, #F97316, #EF4444)",
              ];
              const hash = u.id ? u.id.charCodeAt(0) % gradients.length : 0;

              return {
                id: u.id,
                name: fullName,
                initials: initials,
                avatarGradient: gradients[hash],
                role: displayRole,
                department: "Operations",
                online: true,
              };
            });

            let userRole: "Owner" | "Admin" | "Member" = "Member";
            if (ws.userRole === "OWNER" || ws.userRole === "Owner") userRole = "Owner";
            else if (ws.userRole === "ADMIN" || ws.userRole === "Admin") userRole = "Admin";

            const logoLetter = ws.name.charAt(0).toUpperCase() || "O";
            const gradients = [
              "from-[#3B82F6] to-[#2563EB]",
              "from-[#10B981] to-emerald-600",
              "from-purple-500 to-violet-600",
              "from-pink-500 to-rose-600",
            ];
            const hash = ws.id.charCodeAt(0) % gradients.length;

            return {
              id: ws.id,
              name: ws.name,
              shortName: ws.name.split(" ")[0],
              logoGradient: gradients[hash],
              logoLetter: logoLetter,
              userRole: userRole,
              memberCount: displayMembers.length || 1,
              industry: "Technology",
              members: displayMembers,
            };
          })
        );

        setOrgs(mappedOrgs);

        // Auto-select first workspace if active ID is missing
        const activeExists = mappedOrgs.some((o) => o.id === activeOrgId);
        if (!activeExists && mappedOrgs.length > 0) {
          setActiveOrgId(mappedOrgs[0].id);
          localStorage.setItem("vantage_active_workspace_id", mappedOrgs[0].id);
        }
      } else {
        // API returned no data — build a synthetic org from the stored workspace ID
        // so downstream calls (invite generation, member listing) use the correct real ID.
        const storedWsId = localStorage.getItem("vantage_active_workspace_id") || "operations";
        const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "null");
        const storedRoleRaw = storedUser?.role || "EMPLOYEE";
        let storedUserRole: "Owner" | "Admin" | "Member" = "Member";
        if (storedRoleRaw === "OWNER") storedUserRole = "Owner";
        else if (storedRoleRaw === "ADMIN") storedUserRole = "Admin";

        // Also check the vantage_role key set by the UI
        const uiRole = localStorage.getItem("vantage_role") || "";
        if (uiRole === "Organization Owner") storedUserRole = "Owner";
        else if (uiRole === "Organization Admin") storedUserRole = "Admin";

        const fallbackOrg: Org = {
          id: storedWsId,
          name: "Operations Workspace",
          shortName: "Operations",
          logoGradient: "from-[#3B82F6] to-[#2563EB]",
          logoLetter: "O",
          userRole: storedUserRole,
          memberCount: 1,
          industry: "Technology",
          members: [],
        };
        setOrgs([fallbackOrg]);
        setActiveOrgId(storedWsId);

        // Retry once after a delay — the first API call may have triggered
        // membership auto-provisioning via require_tenant resilience
        setTimeout(() => refreshOrgs(), 1500);
      }
    } catch (e) {
      console.error("Failed to fetch workspaces, falling back", e);
      const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "null");
      const userEmail = storedUser?.email || "";
      const isDemoUser = ["owner@vantage.io", "admin@vantage.io", "employee@vantage.io", "finance@vantage.io"].includes(userEmail.toLowerCase()) ||
                         ["demo_offline_token_owner", "demo_offline_token_admin", "demo_offline_token_employee"].includes(token);
      
      if (isDemoUser) {
        setOrgs(ORGS);
      } else {
        const storedWsId = localStorage.getItem("vantage_active_workspace_id") || "operations";
        const firstName = storedUser?.firstName || "User";
        const fallbackOrg: Org = {
          id: storedWsId,
          name: `${firstName}'s Vantage Studio`,
          shortName: firstName,
          logoGradient: "from-purple-500 to-indigo-600",
          logoLetter: firstName.charAt(0).toUpperCase(),
          userRole: "Owner",
          memberCount: 1,
          industry: "Technology",
          members: [
            {
              id: "m-owner",
              name: `${firstName} ${storedUser?.lastName || ""}`,
              initials: (firstName.charAt(0) + (storedUser?.lastName?.charAt(0) || "")).toUpperCase(),
              avatarGradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
              role: "Organization Owner",
              department: "Executive",
              online: true
            }
          ],
        };
        setOrgs([fallbackOrg]);
        setActiveOrgId(storedWsId);
      }
    }
  }, [activeOrgId]);

  useEffect(() => {
    refreshOrgs();
  }, []); // Run on mount

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0] ?? ORGS[0];

  const switchOrg = useCallback(
    (id: string) => {
      if (id === activeOrgId) return;
      setSwitching(true);
      setTimeout(() => {
        setActiveOrgId(id);
        localStorage.setItem("vantage_active_workspace_id", id);
        setSwitching(false);
      }, 1600);
    },
    [activeOrgId]
  );

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, switching, switchOrg, refreshOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

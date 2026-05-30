import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useOrg } from "./OrgContext";

export type Role = "Organization Owner" | "Organization Admin" | "Team Leader" | "Employee";

export const ROLE_META: Record<Role, { initials: string; label: string; gradient: string; ring: string }> = {
  "Organization Owner": {
    initials: "OW",
    label: "Org Owner",
    gradient: "from-red-500 to-pink-600",
    ring: "ring-red-500/60",
  },
  "Organization Admin": {
    initials: "OA",
    label: "Org Admin",
    gradient: "from-[var(--action-blue)] to-purple-500",
    ring: "ring-[var(--action-blue)]/60",
  },
  "Team Leader": {
    initials: "TL",
    label: "Team Leader",
    gradient: "from-[var(--mint-green)] to-emerald-500",
    ring: "ring-[var(--mint-green)]/60",
  },
  "Employee": {
    initials: "EM",
    label: "Employee",
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-400/60",
  },
};

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  // For Team Leader: list of team names they own. Used to gate edit visibility.
  ownTeams: string[];
  // For Employee: the single team they are assigned to.
  assignedTeam: string;
  // Department channel id (matches workspaceData ids) for Team Leader / Employee scoping.
  assignedDepartment: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function resolveRoleFromLocalStorage(): Role {
  const token = localStorage.getItem("vantage_token");
  if (!token) return "Employee";

  if (token === "demo_offline_token_owner") {
    return "Organization Owner";
  } else if (token === "demo_offline_token_admin") {
    return "Organization Admin";
  } else if (token === "demo_offline_token_employee") {
    return "Employee";
  }

  try {
    const userStr = localStorage.getItem("vantage_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      const r = user.role;
      if (r === "OWNER" || r === "Organization Owner") return "Organization Owner";
      if (r === "ADMIN" || r === "Organization Admin") return "Organization Admin";
      if (r === "CREATOR" || r === "Team Leader") return "Team Leader";
      if (r === "CLIENT" || r === "EMPLOYEE" || r === "Employee") return "Employee";
    }
  } catch (e) {
    console.error("Failed to parse user role from localStorage", e);
  }

  return "Organization Admin"; // Default fallback
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => resolveRoleFromLocalStorage());
  const { activeOrg } = useOrg();

  const [ownTeams, setOwnTeams] = useState<string[]>(["Team Alpha"]);
  const [assignedTeam, setAssignedTeam] = useState<string>("Team Alpha");
  const [assignedDepartment, setAssignedDepartment] = useState<string>("operations");

  useEffect(() => {
    if (activeOrg) {
      const storedUser = JSON.parse(localStorage.getItem("vantage_user") || "{}");
      const currentMember = activeOrg.members?.find(
        (m) => m.id === storedUser.id || (storedUser.firstName && m.name.toLowerCase().includes(storedUser.firstName.toLowerCase()))
      );
      
      let dept = "Operations";
      if (currentMember) {
        setRoleState(currentMember.role);
        dept = currentMember.department || "Operations";
      } else if (activeOrg.userRole) {
        let mappedRole: Role = "Employee";
        if (activeOrg.userRole === "Owner") mappedRole = "Organization Owner";
        else if (activeOrg.userRole === "Admin") mappedRole = "Organization Admin";
        setRoleState(mappedRole);
        dept = activeOrg.members?.[0]?.department || "Operations";
      }

      setAssignedTeam(dept);
      setOwnTeams([dept]);
      setAssignedDepartment(dept.toLowerCase());
    }
  }, [activeOrg]);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    try {
      const userStr = localStorage.getItem("vantage_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        let mappedRoleStr = "EMPLOYEE";
        if (newRole === "Organization Owner") mappedRoleStr = "OWNER";
        else if (newRole === "Organization Admin") mappedRoleStr = "ADMIN";
        else if (newRole === "Team Leader") mappedRoleStr = "CREATOR";
        else if (newRole === "Employee") mappedRoleStr = "CLIENT";
        user.role = mappedRoleStr;
        localStorage.setItem("vantage_user", JSON.stringify(user));
      }
      localStorage.setItem("vantage_role", newRole);
    } catch {}
  };

  useEffect(() => {
    const handleStorageChange = () => {
      setRoleState(resolveRoleFromLocalStorage());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, ownTeams, assignedTeam, assignedDepartment }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

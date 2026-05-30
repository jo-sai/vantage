import { useState, useEffect } from "react";
import { ChevronRight, CloudRain, AlertTriangle, Plus, ChevronDown, ToggleLeft, ToggleRight, RotateCcw } from "lucide-react";
import { SegmentedControl } from "../components/SegmentedControl";
import { MilestoneModal } from "../components/MilestoneModal";
import { NewProjectModal, NewProjectData } from "../components/NewProjectModal";
import { CustomProjectRow, CustomProject } from "../components/CustomProjectRow";
import { organizationProjects, teamWorkspaces, daysInTimeline } from "../data/timelineData";
import { useRole } from "../components/RoleContext";
import { useOrg } from "../components/OrgContext";
import { EmployeeCommentSidebar } from "../components/EmployeeCommentSidebar";
import { WeatherMonitor } from "../components/WeatherMonitor";
import { apiFetch } from "../data/api";

type ViewMode = "Organization Master" | "Team Workspaces";
type TeamName = string;

export function Timeline() {
  const { role, ownTeams, assignedTeam } = useRole();
  const { activeOrg } = useOrg();
  const workspaceId = activeOrg?.id || "operations";
  const DEMO_WORKSPACES = ["operations", "acme", "vantage-demo", "buildright"];
  const isDemoWorkspace = DEMO_WORKSPACES.includes(workspaceId);
  const isEmployee = role === "Employee";
  const isAdmin = role === "Organization Admin" || role === "Organization Owner";
  const isTeamLeader = role === "Team Leader";

  // Dynamically build allTeams from the active organization's departments
  const activeOrgDepartments = Array.from(
    new Set([
      ...(activeOrg?.members || []).map((m) => m.department),
      ...(() => {
        const saved = localStorage.getItem(`vantage_departments_${activeOrg?.id}`);
        if (saved) {
          try {
            return JSON.parse(saved).map((d: any) => d.name);
          } catch {}
        }
        return [];
      })()
    ])
  ).filter(Boolean) as string[];

  const allTeams: TeamName[] = activeOrgDepartments.length > 0 ? activeOrgDepartments : ["Team Alpha", "Team Beta", "Team Gamma"];

  const visibleTeams: TeamName[] = isAdmin
    ? allTeams
    : isTeamLeader
      ? (allTeams.filter((t) => ownTeams.includes(t)) as TeamName[])
      : (allTeams.filter((t) => t === assignedTeam) as TeamName[]);

  const defaultTeam: TeamName = (visibleTeams[0] ?? allTeams[0] ?? "Team Alpha") as TeamName;

  // Employees cannot see the org-wide roll-up; force Team Workspaces
  const [viewMode, setViewMode] = useState<ViewMode>(
    isEmployee ? "Team Workspaces" : "Organization Master"
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamName>(defaultTeam);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ name: string; day: number } | null>(null);
  const canEditTeam =
    isAdmin || (isTeamLeader && ownTeams.includes(selectedTeam));

  // Slider Drag & Confirmation States
  const [sliderDrag, setSliderDrag] = useState<{ itemId: string | number; progress: number } | null>(null);
  const [pendingOverride, setPendingOverride] = useState<{
    itemType: "project" | "phase";
    itemId: string | number;
    name: string;
    newProgress: number;
    originalProgress: number;
    duration: number;
  } | null>(null);

  const getSnappedProgress = (val: number, duration: number): number => {
    if (duration <= 0) return val;
    const stepValue = 100 / duration;
    const dayIndex = Math.round(val / stepValue);
    return Math.min(100, Math.max(0, Math.round(dayIndex * stepValue)));
  };

  // Keep selectedTeam in the visible set if role changes
  useEffect(() => {
    if (!visibleTeams.includes(selectedTeam)) {
      setSelectedTeam(defaultTeam);
    }
    if (isEmployee && viewMode !== "Team Workspaces") {
      setViewMode("Team Workspaces");
    }
  }, [role, visibleTeams]);

  // Load custom projects scoped by workspaceId with localStorage
  const [customOrgProjects, setCustomOrgProjects] = useState<CustomProject[]>(() => {
    const saved = localStorage.getItem(`vantage_gantt_custom_org_projects_${workspaceId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [customProjects, setCustomProjects] = useState<Record<string, CustomProject[]>>(() => {
    const saved = localStorage.getItem(`vantage_gantt_custom_projects_${workspaceId}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [syncToOrgMap, setSyncToOrgMap] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`vantage_gantt_sync_to_org_map_${workspaceId}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Save custom org projects to localStorage whenever they change
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(customOrgProjects));
    }
  }, [customOrgProjects, workspaceId]);

  // Save custom team projects to localStorage whenever they change
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(customProjects));
    }
  }, [customProjects, workspaceId]);

  // Save syncToOrgMap to localStorage whenever they change
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem(`vantage_gantt_sync_to_org_map_${workspaceId}`, JSON.stringify(syncToOrgMap));
    }
  }, [syncToOrgMap, workspaceId]);

  // Keep selectedTeam reset when workspaceId changes
  useEffect(() => {
    setSelectedTeam(defaultTeam);
  }, [workspaceId]);

  // Update states when workspaceId changes
  useEffect(() => {
    const savedOrg = localStorage.getItem(`vantage_gantt_custom_org_projects_${workspaceId}`);
    setCustomOrgProjects(savedOrg ? JSON.parse(savedOrg) : []);

    const savedTeam = localStorage.getItem(`vantage_gantt_custom_projects_${workspaceId}`);
    setCustomProjects(savedTeam ? JSON.parse(savedTeam) : {});

    const savedSync = localStorage.getItem(`vantage_gantt_sync_to_org_map_${workspaceId}`);
    setSyncToOrgMap(savedSync ? JSON.parse(savedSync) : {});
  }, [workspaceId]);

  const [creationLevel, setCreationLevel] = useState<"org" | "team">("team");

  // Load static timeline data into local React states for overrides
  const [orgProjectsState, setOrgProjectsState] = useState(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    return isDemo ? organizationProjects.map(p => ({ ...p, isOverridden: false })) : [];
  });
  const [teamWorkspacesState, setTeamWorkspacesState] = useState(() => {
    const isDemo = ["operations", "acme", "vantage-demo", "buildright"].includes(localStorage.getItem("vantage_active_workspace_id") || "operations");
    const base = isDemo ? teamWorkspaces : {
      "Team Alpha": { phases: [], weatherImpacts: [] },
      "Team Beta": { phases: [], weatherImpacts: [] },
      "Team Gamma": { phases: [], weatherImpacts: [] },
    };
    const copy = JSON.parse(JSON.stringify(base));
    Object.keys(copy).forEach(team => {
      copy[team as TeamName].phases = copy[team as TeamName].phases.map((p: any) => ({ ...p, isOverridden: false }));
    });
    return copy;
  });

  const [loadedOverrides, setLoadedOverrides] = useState<Array<{ itemType: string; itemId: string; progress: number }>>([]);
  const [loadedShifts, setLoadedShifts] = useState<Array<{ id: string; targetDay: number; shiftAmount: number }>>([]);
  const [pendingDelayDay, setPendingDelayDay] = useState<number | null>(null);

  // Master function to apply both timeline shifts and progress overrides to React states
  const applyTimelineUpdates = (
    shifts: Array<{ targetDay: number }>,
    overrides: Array<{ itemType: string; itemId: string; progress: number }>
  ) => {
    const baseProjects = isDemoWorkspace ? organizationProjects : [];
    const baseWorkspaces = isDemoWorkspace ? teamWorkspaces : {
      "Team Alpha": { phases: [], weatherImpacts: [] },
      "Team Beta": { phases: [], weatherImpacts: [] },
      "Team Gamma": { phases: [], weatherImpacts: [] },
    };

    let shiftedProjects = baseProjects.map(p => ({ ...p, isOverridden: false }));
    let shiftedWorkspaces = JSON.parse(JSON.stringify(baseWorkspaces));

    const sortedShifts = [...shifts].map(s => s.targetDay).sort((a, b) => a - b);

    for (const targetDay of sortedShifts) {
      // Shift projects
      shiftedProjects = shiftedProjects.map(project => {
        const start = project.start;
        const duration = project.duration;
        const end = start + duration - 1;

        if (start >= targetDay) {
          return { ...project, start: start + 1 };
        } else if (start < targetDay && end >= targetDay) {
          return { ...project, duration: duration + 1 };
        }
        return project;
      });

      // Shift phases & milestones
      Object.keys(shiftedWorkspaces).forEach(team => {
        shiftedWorkspaces[team].phases = shiftedWorkspaces[team].phases.map((phase: any) => {
          const start = phase.start;
          const duration = phase.duration;
          const end = start + duration - 1;

          let updatedStart = start;
          let updatedDuration = duration;

          if (start >= targetDay) {
            updatedStart = start + 1;
          } else if (start < targetDay && end >= targetDay) {
            updatedDuration = duration + 1;
          }

          const updatedMilestones = phase.milestones.map((m: any) => {
            if (m.day >= targetDay) {
              return { ...m, day: m.day + 1 };
            }
            return m;
          });

          return {
            ...phase,
            start: updatedStart,
            duration: updatedDuration,
            milestones: updatedMilestones
          };
        });
      });
    }

    // Apply progress overrides
    setOrgProjectsState(shiftedProjects.map(p => {
      const ov = overrides.find(o => o.itemType === "project" && String(o.itemId) === String(p.id));
      return ov ? { ...p, progress: ov.progress, isOverridden: true } : p;
    }));

    setTeamWorkspacesState(() => {
      const copy = JSON.parse(JSON.stringify(shiftedWorkspaces));
      Object.keys(copy).forEach(team => {
        copy[team as TeamName].phases = copy[team as TeamName].phases.map((p: any) => {
          const ov = overrides.find(o => o.itemType === "phase" && String(o.itemId) === String(p.id));
          return ov ? { ...p, progress: ov.progress, isOverridden: true } : p;
        });
      });
      return copy;
    });
  };

  // Fetch overrides and custom projects on mount or when active team/workspace switches, with automatic polling
  useEffect(() => {
    let isMounted = true;

    const loadData = async (silent = false) => {
      // 1. Load from localStorage first (for robust offline demo persistence)
      const localOverridesStr = localStorage.getItem(`vantage_gantt_overrides_${workspaceId}`);
      const localOverrides = localOverridesStr ? JSON.parse(localOverridesStr) : [];
      
      const localShiftsStr = localStorage.getItem(`vantage_gantt_shifts_${workspaceId}`);
      const localShifts = localShiftsStr ? JSON.parse(localShiftsStr) : [];

      const localCustomOrgStr = localStorage.getItem(`vantage_gantt_custom_org_projects_${workspaceId}`);
      const localCustomOrg = localCustomOrgStr ? JSON.parse(localCustomOrgStr) : [];

      const localCustomTeamStr = localStorage.getItem(`vantage_gantt_custom_projects_${workspaceId}`);
      const localCustomTeam = localCustomTeamStr ? JSON.parse(localCustomTeamStr) : {};

      const localSyncMapStr = localStorage.getItem(`vantage_gantt_sync_to_org_map_${workspaceId}`);
      const localSyncMap = localSyncMapStr ? JSON.parse(localSyncMapStr) : {};

      if (!silent && isMounted) {
        setLoadedOverrides(localOverrides);
        setLoadedShifts(localShifts);
        setCustomOrgProjects(localCustomOrg);
        setCustomProjects(localCustomTeam);
        setSyncToOrgMap(localSyncMap);
        applyTimelineUpdates(localShifts, localOverrides);
      }

      // 2. Fetch from backend API
      try {
        let latestOverrides = localOverrides;
        try {
          const res = await apiFetch(`/projects/timeline/overrides/${workspaceId}`);
          if (isMounted && res && res.success && res.data) {
            latestOverrides = res.data;
            localStorage.setItem(`vantage_gantt_overrides_${workspaceId}`, JSON.stringify(latestOverrides));
          }
        } catch (e) {
          if (!silent) console.warn("Failed to fetch overrides from backend, using local cache", e);
        }

        let latestShifts = localShifts;
        try {
          const res = await apiFetch(`/projects/timeline/shifts/${workspaceId}`);
          if (isMounted && res && res.success && res.data) {
            latestShifts = res.data;
            localStorage.setItem(`vantage_gantt_shifts_${workspaceId}`, JSON.stringify(latestShifts));
          }
        } catch (e) {
          if (!silent) console.warn("Failed to fetch shifts from backend, using local cache", e);
        }

        const isDemo = DEMO_WORKSPACES.includes(workspaceId);
        if (!isDemo) {
          try {
            const res = await apiFetch(`/projects/timeline/custom/${workspaceId}`);
            if (isMounted && res && res.success && typeof res.data === "string") {
              try {
                const customData = JSON.parse(res.data);
                if (customData) {
                  const parsedOrg = customData.customOrgProjects || [];
                  const parsedTeam = customData.customProjects || {};
                  const parsedSync = customData.syncToOrgMap || {};

                  const dbOrgStr = JSON.stringify(parsedOrg);
                  const dbTeamStr = JSON.stringify(parsedTeam);
                  const dbSyncStr = JSON.stringify(parsedSync);

                  const localOrgStr = JSON.stringify(localCustomOrg);
                  const localTeamStr = JSON.stringify(localCustomTeam);
                  const localSyncStr = JSON.stringify(localSyncMap);

                  if (dbOrgStr !== localOrgStr) {
                    localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, dbOrgStr);
                    setCustomOrgProjects(parsedOrg);
                  }
                  if (dbTeamStr !== localTeamStr) {
                    localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, dbTeamStr);
                    setCustomProjects(parsedTeam);
                  }
                  if (dbSyncStr !== localSyncStr) {
                    localStorage.setItem(`vantage_gantt_sync_to_org_map_${workspaceId}`, dbSyncStr);
                    setSyncToOrgMap(parsedSync);
                  }
                }
              } catch (parseError) {
                console.error("Failed to parse custom gantt data JSON from backend:", parseError);
              }
            }
          } catch (e) {
            if (!silent) console.warn("Failed to fetch custom projects from backend, using local cache", e);
          }
        }

        if (isMounted) {
          setLoadedOverrides(latestOverrides);
          setLoadedShifts(latestShifts);
          applyTimelineUpdates(latestShifts, latestOverrides);
        }
      } catch (e) {
        if (!silent) console.error("Error during satellite sync:", e);
      }
    };

    loadData(false);
    const interval = setInterval(() => loadData(true), 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedTeam, workspaceId]);

  // Frontend manual override handler function
  const handleUpdateProgressOverride = async (itemType: "project" | "phase", itemId: string | number, newProgress: number) => {
    // 1. Optimistic local updates
    const nextOverrides = loadedOverrides.filter(o => !(o.itemType === itemType && String(o.itemId) === String(itemId)));
    nextOverrides.push({ itemType, itemId: String(itemId), progress: newProgress });
    setLoadedOverrides(nextOverrides);
    applyTimelineUpdates(loadedShifts, nextOverrides);

    // 2. Persist in localStorage
    localStorage.setItem(`vantage_gantt_overrides_${workspaceId}`, JSON.stringify(nextOverrides));

    // 3. Persist in database
    try {
      await apiFetch(`/projects/timeline/overrides/${workspaceId}`, {
        method: "POST",
        body: {
          itemType,
          itemId: String(itemId),
          progress: newProgress
        }
      });
    } catch (e) {
      console.error("Failed to persist timeline override to database:", e);
    }
  };

  const handleSliderDrag = (itemId: string | number, val: number, duration: number) => {
    const snapped = getSnappedProgress(val, duration);
    setSliderDrag({ itemId, progress: snapped });
  };

  const handleSliderRelease = (
    itemType: "project" | "phase",
    itemId: string | number,
    name: string,
    originalProgress: number,
    duration: number
  ) => {
    if (!sliderDrag || sliderDrag.itemId !== itemId) return;
    const newProgress = sliderDrag.progress;
    
    // Only prompt confirmation if progress actually changed
    if (newProgress === originalProgress) {
      setSliderDrag(null);
      return;
    }
    
    setPendingOverride({
      itemType,
      itemId,
      name,
      newProgress,
      originalProgress,
      duration
    });
  };

  const handleRevertProgress = async (itemType: "project" | "phase", itemId: string | number) => {
    // 1. Revert local state
    const nextOverrides = loadedOverrides.filter(o => !(o.itemType === itemType && String(o.itemId) === String(itemId)));
    setLoadedOverrides(nextOverrides);
    applyTimelineUpdates(loadedShifts, nextOverrides);

    // 2. Persist in localStorage
    localStorage.setItem(`vantage_gantt_overrides_${workspaceId}`, JSON.stringify(nextOverrides));

    // 3. Revert in DB
    try {
      await apiFetch(`/projects/timeline/overrides/${workspaceId}/${itemType}/${itemId}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.error("Failed to clear timeline override:", e);
    }
  };

  const handleDelayWork = async (day: number) => {
    // 1. Optimistic updates
    const tempId = `temp-${Date.now()}`;
    const nextShifts = [...loadedShifts, { id: tempId, targetDay: day, shiftAmount: 1 }];
    setLoadedShifts(nextShifts);
    applyTimelineUpdates(nextShifts, loadedOverrides);

    // 2. Persist in localStorage
    localStorage.setItem(`vantage_gantt_shifts_${workspaceId}`, JSON.stringify(nextShifts));

    // 3. Persist in database
    try {
      const res = await apiFetch(`/projects/timeline/shifts/${workspaceId}`, {
        method: "POST",
        body: {
          targetDay: day,
          shiftAmount: 1
        }
      });
      if (res && res.success && res.data) {
        const savedShift = res.data;
        setLoadedShifts(prev => prev.map(s => s.id === tempId ? { ...s, id: savedShift.id } : s));
      }
    } catch (e) {
      console.error("Failed to persist timeline shift in database:", e);
    }
  };

  const handleClearDelayWork = async (shiftId: string) => {
    // 1. Optimistic updates
    const nextShifts = loadedShifts.filter(s => s.id !== shiftId);
    setLoadedShifts(nextShifts);
    applyTimelineUpdates(nextShifts, loadedOverrides);

    // 2. Persist in localStorage
    localStorage.setItem(`vantage_gantt_shifts_${workspaceId}`, JSON.stringify(nextShifts));

    // 3. Delete in database
    try {
      await apiFetch(`/projects/timeline/shifts/${workspaceId}/${shiftId}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.error("Failed to clear timeline shift in database:", e);
    }
  };

  const [liveWeatherImpacts, setLiveWeatherImpacts] = useState<Array<{ day: number; severity: "medium" | "high"; description: string }>>([]);
  const [weatherSiteName, setWeatherSiteName] = useState<string>("Seattle");

  const currentTeamData = (() => {
    if (teamWorkspacesState[selectedTeam]) {
      return teamWorkspacesState[selectedTeam];
    }
    const teamIndex = allTeams.indexOf(selectedTeam);
    if (teamIndex === 0 && teamWorkspacesState["Team Alpha"]) return teamWorkspacesState["Team Alpha"];
    if (teamIndex === 1 && teamWorkspacesState["Team Beta"]) return teamWorkspacesState["Team Beta"];
    if (teamIndex === 2 && teamWorkspacesState["Team Gamma"]) return teamWorkspacesState["Team Gamma"];
    return { phases: [], weatherImpacts: [] };
  })();

  const activeWeatherImpacts = [
    ...(currentTeamData.weatherImpacts || []),
    ...liveWeatherImpacts.filter(l => !(currentTeamData.weatherImpacts || []).some(w => w.day === l.day))
  ];

  const syncCustomProjectsToBackend = async (
    orgProj: CustomProject[],
    teamProj: Record<string, CustomProject[]>,
    syncMap: Record<string, boolean>
  ) => {
    const isDemo = DEMO_WORKSPACES.includes(workspaceId);
    if (isDemo) return;
    try {
      await apiFetch(`/projects/timeline/custom/${workspaceId}`, {
        method: "POST",
        body: {
          ganttCustomData: JSON.stringify({
            customOrgProjects: orgProj,
            customProjects: teamProj,
            syncToOrgMap: syncMap
          })
        }
      });
    } catch (e) {
      console.error("Failed to sync custom projects to database:", e);
    }
  };

  const handleToggleSyncToOrgMaster = (val: boolean) => {
    const nextSyncMap = { ...syncToOrgMap, [selectedTeam]: val };
    setSyncToOrgMap(nextSyncMap);
    localStorage.setItem(`vantage_gantt_sync_to_org_map_${workspaceId}`, JSON.stringify(nextSyncMap));
    syncCustomProjectsToBackend(customOrgProjects, customProjects, nextSyncMap);
  };

  const handleCreateProject = (data: NewProjectData) => {
    if (!data.generateGantt) return;
    
    let precursorEndDay = 0;
    let dependsOnName = "";
    
    if (data.dependsOnId) {
      if (creationLevel === "org") {
        const stdParent = orgProjectsState.find(p => String(p.id) === data.dependsOnId);
        if (stdParent) {
          precursorEndDay = stdParent.start + stdParent.duration - 1;
          dependsOnName = stdParent.name;
        } else {
          const custParent = customOrgProjects.find(p => p.id === data.dependsOnId);
          if (custParent) {
            precursorEndDay = custParent.start + custParent.duration - 1;
            dependsOnName = custParent.name;
          }
        }
      } else {
        const stdParent = currentTeamData.phases.find((p: any) => String(p.id) === data.dependsOnId);
        if (stdParent) {
          precursorEndDay = stdParent.start + stdParent.duration - 1;
          dependsOnName = stdParent.name;
        } else {
          const custParent = (customProjects[selectedTeam] || []).find(p => p.id === data.dependsOnId);
          if (custParent) {
            precursorEndDay = custParent.start + custParent.duration - 1;
            dependsOnName = custParent.name;
          }
        }
      }
    }

    const duration = Math.max(1, data.end - data.start);
    const start = data.dependsOnId ? Math.max(data.start, precursorEndDay + 1) : data.start;

    const newProject: CustomProject = {
      id: `cp-${Date.now()}`,
      name: data.name,
      start,
      duration,
      generateGantt: data.generateGantt,
      subTasks: [],
      location: data.location,
      dependsOnId: data.dependsOnId,
      dependsOnName: dependsOnName || undefined,
    };

    if (creationLevel === "org") {
      const nextOrg = [...customOrgProjects, newProject];
      setCustomOrgProjects(nextOrg);
      localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(nextOrg));
      syncCustomProjectsToBackend(nextOrg, customProjects, syncToOrgMap);
    } else {
      const nextTeam = {
        ...customProjects,
        [selectedTeam]: [...(customProjects[selectedTeam] || []), newProject],
      };
      setCustomProjects(nextTeam);
      localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(nextTeam));
      syncCustomProjectsToBackend(customOrgProjects, nextTeam, syncToOrgMap);
    }

    setWeatherSiteName(data.location);
  };

  const handleAddSubTask = (projectId: string) => {
    if (customOrgProjects.some(p => p.id === projectId)) {
      const nextOrg = customOrgProjects.map((p) => {
        if (p.id !== projectId) return p;
        const idx = p.subTasks.length + 1;
        const subDuration = Math.min(3, Math.max(1, Math.floor(p.duration / 3)));
        const offset = Math.min(p.duration - subDuration, (p.subTasks.length * subDuration) % p.duration);
        return {
          ...p,
          subTasks: [
            ...p.subTasks,
            {
              id: `st-${Date.now()}-${idx}`,
              name: `Sub-task ${idx}`,
              start: p.start + offset,
              duration: subDuration,
            },
          ],
        };
      });
      setCustomOrgProjects(nextOrg);
      localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(nextOrg));
      syncCustomProjectsToBackend(nextOrg, customProjects, syncToOrgMap);
    } else {
      const nextTeam = { ...customProjects };
      Object.keys(nextTeam).forEach((team) => {
        if ((nextTeam[team] || []).some(p => p.id === projectId)) {
          nextTeam[team] = nextTeam[team].map((p) => {
            if (p.id !== projectId) return p;
            const idx = p.subTasks.length + 1;
            const subDuration = Math.min(3, Math.max(1, Math.floor(p.duration / 3)));
            const offset = Math.min(p.duration - subDuration, (p.subTasks.length * subDuration) % p.duration);
            return {
              ...p,
              subTasks: [
                ...p.subTasks,
                {
                  id: `st-${Date.now()}-${idx}`,
                  name: `Sub-task ${idx}`,
                  start: p.start + offset,
                  duration: subDuration,
                },
              ],
            };
          });
        }
      });
      setCustomProjects(nextTeam);
      localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(nextTeam));
      syncCustomProjectsToBackend(customOrgProjects, nextTeam, syncToOrgMap);
    }
  };

  const handleUpdateSubTask = (projectId: string, subTaskId: string, newStart: number) => {
    if (customOrgProjects.some(p => p.id === projectId)) {
      const nextOrg = customOrgProjects.map((p) =>
        p.id === projectId
          ? { ...p, subTasks: p.subTasks.map((s) => (s.id === subTaskId ? { ...s, start: newStart } : s)) }
          : p
      );
      setCustomOrgProjects(nextOrg);
      localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(nextOrg));
      syncCustomProjectsToBackend(nextOrg, customProjects, syncToOrgMap);
    } else {
      const nextTeam = { ...customProjects };
      Object.keys(nextTeam).forEach((team) => {
        if ((nextTeam[team] || []).some(p => p.id === projectId)) {
          nextTeam[team] = nextTeam[team].map((p) =>
            p.id === projectId
              ? { ...p, subTasks: p.subTasks.map((s) => (s.id === subTaskId ? { ...s, start: newStart } : s)) }
              : p
          );
        }
      });
      setCustomProjects(nextTeam);
      localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(nextTeam));
      syncCustomProjectsToBackend(customOrgProjects, nextTeam, syncToOrgMap);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    const nextOrg = customOrgProjects.filter((p) => p.id !== projectId);
    const nextTeam = { ...customProjects };
    Object.keys(nextTeam).forEach((team) => {
      nextTeam[team] = (nextTeam[team] || []).filter((p) => p.id !== projectId);
    });

    setCustomOrgProjects(nextOrg);
    setCustomProjects(nextTeam);
    
    localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(nextOrg));
    localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(nextTeam));
    syncCustomProjectsToBackend(nextOrg, nextTeam, syncToOrgMap);
  };

  const handleDeleteSubTask = (projectId: string, subTaskId: string) => {
    const nextOrg = customOrgProjects.map((p) =>
      p.id === projectId
        ? { ...p, subTasks: p.subTasks.filter((s) => s.id !== subTaskId) }
        : p
    );
    const nextTeam = { ...customProjects };
    Object.keys(nextTeam).forEach((team) => {
      nextTeam[team] = (nextTeam[team] || []).map((p) =>
        p.id === projectId
          ? { ...p, subTasks: p.subTasks.filter((s) => s.id !== subTaskId) }
          : p
      );
    });

    setCustomOrgProjects(nextOrg);
    setCustomProjects(nextTeam);

    localStorage.setItem(`vantage_gantt_custom_org_projects_${workspaceId}`, JSON.stringify(nextOrg));
    localStorage.setItem(`vantage_gantt_custom_projects_${workspaceId}`, JSON.stringify(nextTeam));
    syncCustomProjectsToBackend(nextOrg, nextTeam, syncToOrgMap);
  };

  return (
    <div className="min-h-full flex flex-col p-8 space-y-8 overflow-y-visible">
      {/* Header */}
      <div className="p-6 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shrink-0 relative z-30">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white mb-2">Timeline & Monitoring</h1>
            <p className="text-sm text-[var(--cool-gray)]">
              {viewMode === "Organization Master"
                ? "Organization-wide project overview and critical path analysis"
                : `Granular execution tracking for ${selectedTeam}`}
            </p>
          </div>

          {viewMode === "Organization Master" && isAdmin && (
            <button
              onClick={() => {
                setCreationLevel("org");
                setShowNewProjectModal(true);
              }}
              className="px-4 py-2 rounded bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              <span>New Org Project</span>
            </button>
          )}

          {viewMode === "Team Workspaces" && canEditTeam && (
            <button
              onClick={() => {
                setCreationLevel("team");
                setShowNewProjectModal(true);
              }}
              className="px-4 py-2 rounded bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              <span>New Team Project</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Toggle — hidden for Employees */}
          {!isEmployee && (
            <SegmentedControl
              options={["Organization Master", "Team Workspaces"]}
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
            />
          )}

          {/* Team Selector (only visible in Team Workspaces mode) */}
          {viewMode === "Team Workspaces" && (
            <div className="relative">
              <button
                onClick={() => visibleTeams.length > 1 && setShowTeamDropdown(!showTeamDropdown)}
                disabled={visibleTeams.length <= 1}
                className="px-4 py-2 rounded-lg bg-white/5 border border-[var(--glass-border)] text-white hover:bg-white/10 transition-all flex items-center gap-3 disabled:cursor-default disabled:hover:bg-white/5"
              >
                <span>{selectedTeam}</span>
                {visibleTeams.length > 1 && (
                  <ChevronDown size={16} className="text-[var(--cool-gray)]" />
                )}
              </button>

              {showTeamDropdown && visibleTeams.length > 1 && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-lg bg-[var(--deep-slate)] border border-[var(--glass-border)] shadow-xl z-50">
                  {visibleTeams.map((team) => (
                    <button
                      key={team}
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowTeamDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-all ${
                        selectedTeam === team ? 'text-[var(--action-blue)]' : 'text-white'
                      } first:rounded-t-lg last:rounded-b-lg`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Weather Station Integration */}
      <div className="shrink-0">
        <WeatherMonitor 
          onWeatherImpactsChange={(impacts) => setLiveWeatherImpacts(impacts)} 
          selectedSiteName={weatherSiteName}
          onSiteNameChange={(name) => setWeatherSiteName(name)}
        />
      </div>

      {/* Gantt Chart Container */}
      <div className="overflow-x-auto overflow-y-visible shrink-0 pb-8">
        <div className="min-w-max">
          {viewMode === "Organization Master" ? (
            <OrganizationMasterView 
              orgProjects={orgProjectsState}
              customOrgProjects={[
                ...customOrgProjects,
                ...allTeams.filter(team => syncToOrgMap[team]).flatMap(team => customProjects[team] || [])
              ]}
              onAddSubTask={handleAddSubTask}
              onUpdateSubTask={handleUpdateSubTask}
              canEdit={isAdmin}
              isEmployee={isEmployee}
              onComment={(name, day) => setCommentTarget({ name, day })}
              sliderDrag={sliderDrag}
              onSliderDrag={handleSliderDrag}
              onSliderRelease={handleSliderRelease}
              onRevertProgress={handleRevertProgress}
              activeWeatherImpacts={activeWeatherImpacts}
              loadedShifts={loadedShifts}
              onDelayClick={(day) => setPendingDelayDay(day)}
              onClearDelayClick={handleClearDelayWork}
              onDeleteProject={handleDeleteProject}
              onDeleteSubTask={handleDeleteSubTask}
            />
          ) : (
            <TeamWorkspaceView
              teamName={selectedTeam}
              teamData={currentTeamData}
              onMilestoneClick={(milestone) => setSelectedMilestone(milestone)}
              customProjects={customProjects[selectedTeam] || []}
              onAddSubTask={handleAddSubTask}
              onUpdateSubTask={handleUpdateSubTask}
              canEdit={canEditTeam}
              isEmployee={isEmployee}
              onComment={(name, day) => setCommentTarget({ name, day })}
              activeWeatherImpacts={activeWeatherImpacts}
              sliderDrag={sliderDrag}
              onSliderDrag={handleSliderDrag}
              onSliderRelease={handleSliderRelease}
              onRevertProgress={handleRevertProgress}
              loadedShifts={loadedShifts}
              onDelayClick={(day) => setPendingDelayDay(day)}
              onClearDelayClick={handleClearDelayWork}
              onDeleteProject={handleDeleteProject}
              onDeleteSubTask={handleDeleteSubTask}
              syncToOrgMaster={!!syncToOrgMap[selectedTeam]}
              onToggleSyncToOrgMaster={handleToggleSyncToOrgMaster}
            />
          )}
        </div>
      </div>

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreate={handleCreateProject}
        maxDay={daysInTimeline}
        title={creationLevel === "org" ? "New Org Project" : "New Team Project"}
        existingProjects={
          creationLevel === "org"
            ? [
                ...orgProjectsState.map(p => ({ id: String(p.id), name: p.name })),
                ...customOrgProjects.map(p => ({ id: p.id, name: p.name }))
              ]
            : [
                ...currentTeamData.phases.map((p: any) => ({ id: String(p.id), name: p.name })),
                ...(customProjects[selectedTeam] || []).map(p => ({ id: p.id, name: p.name }))
              ]
        }
      />

      {/* Milestone Modal */}
      {selectedMilestone && (
        <MilestoneModal
          isOpen={!!selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          milestone={selectedMilestone}
        />
      )}

      {/* Employee Comment Sidebar */}
      {isEmployee && (
        <EmployeeCommentSidebar
          target={commentTarget}
          onClose={() => setCommentTarget(null)}
        />
      )}

      {/* Confirmation Modal */}
      {pendingOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-xl border border-white/10 bg-[#151926]/95 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--action-blue)]/20 text-[var(--action-blue)]">
                <RotateCcw size={20} className="animate-spin-slow" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirm Progress Update</h3>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-[var(--cool-gray)] leading-relaxed">
                Are you sure you want to update the progress of <strong className="text-white">{pendingOverride.name}</strong> to <strong className="text-white">{pendingOverride.newProgress}%</strong>?
              </p>
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/5 text-xs text-[var(--cool-gray)] space-y-2">
                <div className="flex justify-between">
                  <span>Original Progress:</span>
                  <span className="text-white font-medium">{pendingOverride.originalProgress}%</span>
                </div>
                <div className="flex justify-between">
                  <span>New Progress:</span>
                  <span className="text-[var(--mint-green)] font-semibold">{pendingOverride.newProgress}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Equivalent Completion:</span>
                  <span className="text-white font-medium">
                    {Math.round((pendingOverride.newProgress / 100) * pendingOverride.duration)} of {pendingOverride.duration} scheduled days
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setSliderDrag(null);
                  setPendingOverride(null);
                }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleUpdateProgressOverride(
                    pendingOverride.itemType,
                    pendingOverride.itemId,
                    pendingOverride.newProgress
                  );
                  setSliderDrag(null);
                  setPendingOverride(null);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all text-sm font-medium"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weather Shift Confirmation Modal */}
      {pendingDelayDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg p-6 rounded-xl border border-white/10 bg-[#151926]/95 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertTriangle size={20} className="animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">Trigger +1 Day Timeline Shift</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-[var(--cool-gray)] leading-relaxed">
                You are executing a manual schedule adjustment on <strong className="text-white">Day {pendingDelayDay}</strong> based on severe weather risks.
                This will shift the schedule of all active or downstream tasks intersecting or starting after Day {pendingDelayDay} by exactly <strong className="text-[var(--mint-green)]">+1 day</strong>.
              </p>

              <div className="border border-white/5 bg-white/[0.02] rounded-lg overflow-hidden">
                <div className="px-3.5 py-2 border-b border-white/5 bg-white/5 text-[10px] uppercase font-bold text-[var(--cool-gray)] tracking-wider">
                  Downstream Impact Preview
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-white/5 px-3.5 py-1 text-xs">
                  {(() => {
                    const affected: Array<{ name: string; oldStart: number; oldDuration: number; type: "shift" | "extend" }> = [];
                    
                    if (viewMode === "Organization Master") {
                      orgProjectsState.forEach(project => {
                        const start = project.start;
                        const duration = project.duration;
                        const end = start + duration - 1;
                        if (start >= pendingDelayDay) {
                          affected.push({ name: project.name, oldStart: start, oldDuration: duration, type: "shift" });
                        } else if (start < pendingDelayDay && end >= pendingDelayDay) {
                          affected.push({ name: project.name, oldStart: start, oldDuration: duration, type: "extend" });
                        }
                      });
                    } else {
                      currentTeamData.phases.forEach((phase: any) => {
                        const start = phase.start;
                        const duration = phase.duration;
                        const end = start + duration - 1;
                        if (start >= pendingDelayDay) {
                          affected.push({ name: phase.name, oldStart: start, oldDuration: duration, type: "shift" });
                        } else if (start < pendingDelayDay && end >= pendingDelayDay) {
                          affected.push({ name: phase.name, oldStart: start, oldDuration: duration, type: "extend" });
                        }
                      });
                    }

                    if (affected.length === 0) {
                      return (
                        <div className="py-4 text-center text-[var(--cool-gray)] italic">
                          No downstream tasks are active or scheduled after Day {pendingDelayDay}.
                        </div>
                      );
                    }

                    return affected.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                        <span className="font-semibold text-white truncate max-w-[180px]">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-[var(--cool-gray)] line-through">
                            Day {item.oldStart}-{item.oldStart + item.oldDuration - 1}
                          </span>
                          <span className="text-[10px] text-white">➔</span>
                          <span className="text-[10px] font-bold text-[var(--mint-green)]">
                            {item.type === "shift" 
                              ? `Day ${item.oldStart + 1}-${item.oldStart + item.oldDuration}`
                              : `Day ${item.oldStart}-${item.oldStart + item.oldDuration}`
                            }
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] border font-medium ${
                            item.type === 'shift' 
                              ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' 
                              : 'bg-orange-500/10 border-orange-500/25 text-orange-400'
                          }`}>
                            {item.type === "shift" ? "Shifted +1" : "Extended +1"}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingDelayDay(null)}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelayWork(pendingDelayDay);
                  setPendingDelayDay(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)] transition-all text-sm font-medium cursor-pointer"
              >
                Confirm Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrganizationMasterViewProps {
  orgProjects: Array<any>;
  customOrgProjects: CustomProject[];
  onAddSubTask: (projectId: string) => void;
  onUpdateSubTask: (projectId: string, subTaskId: string, start: number) => void;
  canEdit: boolean;
  isEmployee: boolean;
  onComment: (name: string, day: number) => void;
  sliderDrag: { itemId: string | number; progress: number } | null;
  onSliderDrag: (itemId: string | number, val: number, duration: number) => void;
  onSliderRelease: (itemType: "project" | "phase", itemId: string | number, name: string, originalProgress: number, duration: number) => void;
  onRevertProgress: (itemType: "project" | "phase", itemId: string | number) => void;
  activeWeatherImpacts: Array<{ day: number; severity: "medium" | "high"; description: string }>;
  loadedShifts: Array<{ id: string; targetDay: number; shiftAmount: number }>;
  onDelayClick: (day: number) => void;
  onClearDelayClick: (shiftId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteSubTask: (projectId: string, subTaskId: string) => void;
}

function OrganizationMasterView({
  orgProjects,
  customOrgProjects,
  onAddSubTask,
  onUpdateSubTask,
  canEdit,
  isEmployee,
  onComment,
  sliderDrag,
  onSliderDrag,
  onSliderRelease,
  onRevertProgress,
  activeWeatherImpacts,
  loadedShifts,
  onDelayClick,
  onClearDelayClick,
  onDeleteProject,
  onDeleteSubTask,
}: OrganizationMasterViewProps) {
  return (
    <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-[var(--glass-border)]">
        <div className="w-96 shrink-0 p-4 border-r border-[var(--glass-border)]">
          <span className="text-sm text-[var(--cool-gray)]">Project Name</span>
        </div>
        <div className="flex-1 flex">
          {Array.from({ length: daysInTimeline }, (_, i) => {
            const day = i + 1;
            const hasWeather = activeWeatherImpacts.some(w => w.day === day);
            const activeShift = loadedShifts.find(s => s.targetDay === day);

            return (
              <div
                key={day}
                className={`flex-1 min-w-[40px] p-2 border-r border-[var(--glass-border)] text-center relative ${
                  hasWeather ? 'bg-red-500/10' : ''
                } ${activeShift ? 'bg-orange-500/10' : ''}`}
              >
                <span className="text-xs text-[var(--cool-gray)]">{day}</span>
                {hasWeather && (
                  <div className="absolute top-1 right-1">
                    <CloudRain size={12} className="text-orange-400" />
                  </div>
                )}
                {hasWeather && canEdit && (
                  activeShift ? (
                    <button
                      onClick={() => onClearDelayClick(activeShift.id)}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-orange-600 text-[7px] text-white hover:bg-orange-700 transition-colors font-bold select-none cursor-pointer"
                      title="Clear Timeline Shift"
                    >
                      Shifted
                    </button>
                  ) : (
                    <button
                      onClick={() => onDelayClick(day)}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-red-500 text-[7px] text-white hover:bg-red-600 transition-colors font-bold select-none cursor-pointer"
                      title="Delay subsequent work by +1 Day"
                    >
                      Delay
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Rows */}
      {orgProjects.map((project, index) => (
        <div
          key={project.id}
          className={`flex ${index % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}
        >
          {/* Project Info */}
          <div className="w-96 shrink-0 p-4 border-r border-[var(--glass-border)] flex items-center gap-3">
            <ChevronRight size={16} className="text-[var(--cool-gray)] shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
              <div className="text-sm font-semibold text-white truncate" title={project.name}>
                {project.name}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {project.isCriticalPath && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 font-medium">
                    Critical Path
                  </span>
                )}
                <span className="text-[11px] text-[var(--cool-gray)] shrink-0 font-medium">
                  {project.subTaskCount} sub-task{project.subTaskCount !== 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Progress Override Slider (for Org Admin edit overrides) */}
              {canEdit ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderDrag && sliderDrag.itemId === project.id ? sliderDrag.progress : project.progress}
                    onChange={(e) => onSliderDrag(project.id, parseInt(e.target.value), project.duration)}
                    onMouseUp={() => onSliderRelease("project", project.id, project.name, project.progress, project.duration)}
                    onTouchEnd={() => onSliderRelease("project", project.id, project.name, project.progress, project.duration)}
                    className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--action-blue)]"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-white font-semibold">
                      {sliderDrag && sliderDrag.itemId === project.id ? sliderDrag.progress : project.progress}%
                    </span>
                    {project.isOverridden && (
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold shrink-0 uppercase tracking-wider animate-pulse" title="Manually Set Override">
                          Manual
                        </span>
                        <button
                          onClick={() => onRevertProgress("project", project.id)}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors p-0.5 rounded hover:bg-white/5 flex items-center justify-center"
                          title="Revert Manual Override"
                        >
                          <RotateCcw size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        project.isCriticalPath ? 'bg-amber-400' : 'bg-[var(--mint-green)]'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-[var(--cool-gray)] font-semibold">{project.progress}%</span>
                    {project.isOverridden && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold shrink-0 uppercase tracking-wider" title="Manually Set Override">
                        Manual
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Bar - Roll-up */}
          <div className="flex-1 relative flex">
            {Array.from({ length: daysInTimeline }, (_, i) => {
              const day = i + 1;
              const isInProject = day >= project.start && day < project.start + project.duration;
              const hasWeather = activeWeatherImpacts.some(w => w.day === day);
              const activeShift = loadedShifts.some(s => s.targetDay === day);

              return (
                <div
                  key={day}
                  className={`flex-1 min-w-[40px] border-r border-[var(--glass-border)] ${
                    activeShift ? 'bg-orange-500/[0.05]' : hasWeather ? 'bg-red-500/[0.05]' : ''
                  }`}
                >
                  {isInProject && (
                    <div className="h-full p-2.5">
                      <div
                        className={`h-full rounded-sm ${
                          project.isCriticalPath
                            ? 'bg-amber-500/60 border border-amber-400'
                            : 'bg-[var(--action-blue)]/60 border border-[var(--action-blue)]'
                        } relative group cursor-pointer`}
                        style={{ borderWidth: '1px' }}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="px-3 py-2 rounded bg-[var(--deep-slate)] border border-[var(--glass-border)] whitespace-nowrap shadow-xl">
                            <div className="text-xs text-white">Day {day}</div>
                            <div className="text-xs text-[var(--cool-gray)]">Progress: {sliderDrag && sliderDrag.itemId === project.id ? sliderDrag.progress : project.progress}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom Org Projects */}
      {customOrgProjects.map((p) => (
        <CustomProjectRow
          key={p.id}
          project={p}
          daysInTimeline={daysInTimeline}
          onAddSubTask={onAddSubTask}
          onUpdateSubTask={onUpdateSubTask}
          canEdit={canEdit}
          isEmployee={isEmployee}
          onComment={onComment}
          onDeleteProject={onDeleteProject}
          onDeleteSubTask={onDeleteSubTask}
        />
      ))}

      {/* Legend */}
      <div className="border-t border-[var(--glass-border)] p-4 flex items-center gap-6 bg-white/[0.02]">
        <span className="text-sm text-[var(--cool-gray)]">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="size-4 rounded-sm bg-[var(--action-blue)]/60 border border-[var(--action-blue)]"></div>
          <span className="text-xs text-white">Standard Project</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-4 rounded-sm bg-amber-500/60 border border-amber-400"></div>
          <span className="text-xs text-white">Critical Path</span>
        </div>
      </div>
    </div>
  );
}

interface TeamWorkspaceViewProps {
  teamName: string;
  teamData: any;
  onMilestoneClick: (milestone: any) => void;
  customProjects: CustomProject[];
  onAddSubTask: (projectId: string) => void;
  onUpdateSubTask: (projectId: string, subTaskId: string, start: number) => void;
  canEdit: boolean;
  isEmployee: boolean;
  onComment: (name: string, day: number) => void;
  activeWeatherImpacts: Array<{ day: number; severity: "medium" | "high"; description: string }>;
  sliderDrag: { itemId: string | number; progress: number } | null;
  onSliderDrag: (itemId: string | number, val: number, duration: number) => void;
  onSliderRelease: (itemType: "project" | "phase", itemId: string | number, name: string, originalProgress: number, duration: number) => void;
  onRevertProgress: (itemType: "project" | "phase", itemId: string | number) => void;
  loadedShifts: Array<{ id: string; targetDay: number; shiftAmount: number }>;
  onDelayClick: (day: number) => void;
  onClearDelayClick: (shiftId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteSubTask: (projectId: string, subTaskId: string) => void;
  syncToOrgMaster: boolean;
  onToggleSyncToOrgMaster: (val: boolean) => void;
}

function TeamWorkspaceView({
  teamName,
  teamData,
  onMilestoneClick,
  customProjects,
  onAddSubTask,
  onUpdateSubTask,
  canEdit,
  isEmployee,
  onComment,
  activeWeatherImpacts,
  sliderDrag,
  onSliderDrag,
  onSliderRelease,
  onRevertProgress,
  loadedShifts,
  onDelayClick,
  onClearDelayClick,
  onDeleteProject,
  onDeleteSubTask,
  syncToOrgMaster,
  onToggleSyncToOrgMaster,
}: TeamWorkspaceViewProps) {
  return (
    <div className="space-y-6">
      {/* Sync Toggle */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-[var(--glass-border)]">
        <button
          onClick={() => onToggleSyncToOrgMaster(!syncToOrgMaster)}
          className="flex items-center gap-2"
        >
          {syncToOrgMaster ? (
            <ToggleRight size={24} className="text-[var(--action-blue)]" />
          ) : (
            <ToggleLeft size={24} className="text-[var(--cool-gray)]" />
          )}
        </button>
        <div>
          <span className="text-sm text-white">Sync to Org Master</span>
          <p className="text-xs text-[var(--cool-gray)]">
            {syncToOrgMaster ? 'This project is visible in organization overview' : 'Internal team goals only'}
          </p>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] overflow-hidden">
        {/* Header */}
        <div className="flex border-b border-[var(--glass-border)]">
          <div className="w-96 shrink-0 p-4 border-r border-[var(--glass-border)]">
            <span className="text-sm text-[var(--cool-gray)]">Construction Phase</span>
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: daysInTimeline }, (_, i) => {
              const day = i + 1;
              const hasWeather = activeWeatherImpacts.some(w => w.day === day);
              const activeShift = loadedShifts.find(s => s.targetDay === day);

              return (
                <div
                  key={day}
                  className={`flex-1 min-w-[40px] p-2 border-r border-[var(--glass-border)] text-center relative ${
                    hasWeather ? 'bg-red-500/10' : ''
                  } ${activeShift ? 'bg-orange-500/10' : ''}`}
                >
                  <span className="text-xs text-[var(--cool-gray)]">{day}</span>
                  {hasWeather && (
                    <div className="absolute top-1 right-1">
                      <CloudRain size={12} className="text-orange-400" />
                    </div>
                  )}
                  {hasWeather && canEdit && (
                    activeShift ? (
                      <button
                        onClick={() => onClearDelayClick(activeShift.id)}
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-orange-600 text-[7px] text-white hover:bg-orange-700 transition-colors font-bold select-none cursor-pointer"
                        title="Clear Timeline Shift"
                      >
                        Shifted
                      </button>
                    ) : (
                      <button
                        onClick={() => onDelayClick(day)}
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-red-500 text-[7px] text-white hover:bg-red-600 transition-colors font-bold select-none cursor-pointer"
                        title="Delay subsequent work by +1 Day"
                      >
                        Delay
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase Rows */}
        {teamData.phases.map((phase: any, index: number) => (
          <div
            key={phase.id}
            className={`flex ${index % 2 === 0 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}
          >
            {/* Phase Info */}
            <div className="w-96 shrink-0 p-4 border-r border-[var(--glass-border)] flex items-center gap-3">
              <ChevronRight size={16} className="text-[var(--cool-gray)] shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
                <div className="text-sm font-semibold text-white truncate" title={phase.name}>
                  {phase.name}
                </div>
                
                {/* Progress Slider (for Team Leader / Org Admin overrides) */}
                {canEdit ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderDrag && sliderDrag.itemId === phase.id ? sliderDrag.progress : phase.progress}
                      onChange={(e) => onSliderDrag(phase.id, parseInt(e.target.value), phase.duration)}
                      onMouseUp={() => onSliderRelease("phase", phase.id, phase.name, phase.progress, phase.duration)}
                      onTouchEnd={() => onSliderRelease("phase", phase.id, phase.name, phase.progress, phase.duration)}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--mint-green)]"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-white font-semibold">
                        {sliderDrag && sliderDrag.itemId === phase.id ? sliderDrag.progress : phase.progress}%
                      </span>
                      {phase.isOverridden && (
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold shrink-0 uppercase tracking-wider animate-pulse" title="Manually Set Override">
                            Manual
                          </span>
                          <button
                            onClick={() => onRevertProgress("phase", phase.id)}
                            className="text-indigo-400 hover:text-indigo-300 transition-colors p-0.5 rounded hover:bg-white/5 flex items-center justify-center"
                            title="Revert Manual Override"
                          >
                            <RotateCcw size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--mint-green)] rounded-full transition-all"
                        style={{ width: `${phase.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-[var(--cool-gray)] font-semibold">{phase.progress}%</span>
                      {phase.isOverridden && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold shrink-0 uppercase tracking-wider" title="Manually Set Override">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Bar */}
            <div className="flex-1 relative flex">
              {Array.from({ length: daysInTimeline }, (_, i) => {
                const day = i + 1;
                const isInPhase = day >= phase.start && day < phase.start + phase.duration;
                const hasWeatherImpact = activeWeatherImpacts.some(w => w.day === day && isInPhase);
                const milestone = phase.milestones.find(m => m.day === day);
                const hasWeather = activeWeatherImpacts.some(w => w.day === day);
                const activeShift = loadedShifts.some(s => s.targetDay === day);

                return (
                  <div
                    key={day}
                    className={`flex-1 min-w-[40px] border-r border-[var(--glass-border)] ${
                      activeShift ? 'bg-orange-500/[0.05]' : hasWeather ? 'bg-red-500/[0.05]' : ''
                    } ${hasWeatherImpact ? 'bg-red-500/20' : ''}`}
                  >
                    {isInPhase && (
                      <div className="h-full p-2.5 relative">
                        {/* Phase Bar */}
                        <div
                          className={`h-full rounded-sm ${
                            hasWeatherImpact
                              ? 'bg-orange-500/60 border border-orange-400 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)]'
                              : 'bg-[var(--action-blue)]/60 border border-[var(--action-blue)]'
                          } relative group cursor-pointer`}
                          style={{ borderWidth: '1px' }}
                        >
                          {hasWeatherImpact && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <AlertTriangle size={14} className="text-white" />
                            </div>
                          )}
                        </div>

                        {/* Milestone Diamond */}
                        {milestone && (
                          <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                            onClick={() => onMilestoneClick({
                              name: milestone.name,
                              date: `Day ${milestone.day}`,
                              progress: milestone.progress,
                              description: milestone.description
                            })}
                          >
                            <div className="relative group">
                              <div className={`size-4 rotate-45 ${
                                milestone.progress === 100
                                  ? 'bg-[var(--mint-green)] border-2 border-[var(--mint-green)]'
                                  : milestone.progress > 0
                                    ? 'bg-[var(--action-blue)] border-2 border-[var(--action-blue)]'
                                    : 'bg-white/20 border-2 border-white/40'
                              } shadow-lg hover:scale-125 transition-transform`}></div>

                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="px-3 py-2 rounded bg-[var(--deep-slate)] border border-[var(--glass-border)] whitespace-nowrap shadow-xl">
                                  <div className="text-xs text-white">{milestone.name}</div>
                                  <div className="text-xs text-[var(--cool-gray)]">{milestone.progress}% complete</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom Projects */}
        {customProjects.map((p) => (
          <CustomProjectRow
            key={p.id}
            project={p}
            daysInTimeline={daysInTimeline}
            onAddSubTask={onAddSubTask}
            onUpdateSubTask={onUpdateSubTask}
            canEdit={canEdit}
            isEmployee={isEmployee}
            onComment={onComment}
            onDeleteProject={onDeleteProject}
            onDeleteSubTask={onDeleteSubTask}
          />
        ))}

        {/* Legend */}
        <div className="border-t border-[var(--glass-border)] p-4 flex items-center gap-6 bg-white/[0.02]">
          <span className="text-sm text-[var(--cool-gray)]">Legend:</span>
          <div className="flex items-center gap-2">
            <div className="size-4 rounded-sm bg-[var(--action-blue)]/60 border border-[var(--action-blue)]"></div>
            <span className="text-xs text-white">On Schedule</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-4 rounded-sm bg-orange-500/60 border border-orange-400 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)]"></div>
            <span className="text-xs text-white">Weather Lag</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rotate-45 bg-[var(--mint-green)] border-2 border-[var(--mint-green)]"></div>
            <span className="text-xs text-white">Milestone Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rotate-45 bg-[var(--action-blue)] border-2 border-[var(--action-blue)]"></div>
            <span className="text-xs text-white">Milestone In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rotate-45 bg-white/20 border-2 border-white/40"></div>
            <span className="text-xs text-white">Milestone Pending</span>
          </div>
        </div>
      </div>

      {/* Weather Impact Summary */}
      <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30">
        <div className="flex items-center gap-3 mb-3">
          <CloudRain size={18} className="text-orange-400" />
          <h4 className="text-white">Weather Impact Analysis</h4>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {activeWeatherImpacts.map((impact, idx) => (
            <div key={idx} className="p-3 rounded bg-white/5 border border-[var(--glass-border)]">
              <div className="text-sm text-white mb-1">Day {impact.day}</div>
              <div className={`text-xs ${impact.severity === 'high' ? 'text-red-400' : 'text-orange-400'}`}>
                {impact.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

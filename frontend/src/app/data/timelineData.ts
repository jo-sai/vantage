export const organizationProjects = [
  {
    id: 1,
    name: "Project Site A - Residential Complex",
    start: 1,
    duration: 45,
    progress: 65,
    isCriticalPath: true,
    subTaskCount: 12
  },
  {
    id: 2,
    name: "Public Market Retrofitting",
    start: 10,
    duration: 35,
    progress: 48,
    isCriticalPath: true,
    subTaskCount: 8
  },
  {
    id: 3,
    name: "Office Tower - Downtown",
    start: 20,
    duration: 50,
    progress: 30,
    isCriticalPath: false,
    subTaskCount: 15
  },
  {
    id: 4,
    name: "Industrial Warehouse Expansion",
    start: 5,
    duration: 40,
    progress: 72,
    isCriticalPath: false,
    subTaskCount: 10
  },
  {
    id: 5,
    name: "Community Center Construction",
    start: 25,
    duration: 42,
    progress: 18,
    isCriticalPath: true,
    subTaskCount: 11
  }
];

export const teamWorkspaces = {
  "Team Alpha": {
    phases: [
      {
        id: 1,
        name: "Site Preparation",
        start: 5,
        duration: 8,
        progress: 100,
        milestones: [
          { id: "m1", name: "Ground Breaking", day: 5, progress: 100, description: "Initial site clearing completed" }
        ]
      },
      {
        id: 2,
        name: "Structural Framework",
        start: 13,
        duration: 15,
        progress: 75,
        milestones: [
          { id: "m2", name: "Foundation Complete", day: 20, progress: 100, description: "All foundation work completed and inspected" },
          { id: "m3", name: "Frame Assembly", day: 28, progress: 60, description: "Main structural frame assembly in progress" }
        ]
      },
      {
        id: 3,
        name: "MEP Installation",
        start: 22,
        duration: 18,
        progress: 40,
        milestones: [
          { id: "m4", name: "Electrical Rough-In", day: 32, progress: 45, description: "Electrical conduit and wiring installation" }
        ]
      },
      {
        id: 4,
        name: "Interior Finishing",
        start: 35,
        duration: 12,
        progress: 15,
        milestones: [
          { id: "m5", name: "Drywall Complete", day: 42, progress: 0, description: "Drywall installation and finishing" }
        ]
      },
      {
        id: 5,
        name: "Final Inspection",
        start: 45,
        duration: 5,
        progress: 0,
        milestones: [
          { id: "m6", name: "Project Handover", day: 50, progress: 0, description: "Final inspection and client handover" }
        ]
      }
    ],
    weatherImpacts: [
      { day: 18, severity: "high", description: "Heavy rain - 2 day delay" },
      { day: 19, severity: "high", description: "Storm warning - work suspended" },
      { day: 26, severity: "medium", description: "Light rain - reduced capacity" },
      { day: 38, severity: "medium", description: "Wind advisory - exterior work paused" }
    ]
  },
  "Team Beta": {
    phases: [
      {
        id: 6,
        name: "Demolition & Removal",
        start: 3,
        duration: 6,
        progress: 100,
        milestones: [
          { id: "m7", name: "Demo Complete", day: 9, progress: 100, description: "All demolition work completed" }
        ]
      },
      {
        id: 7,
        name: "Foundation Repair",
        start: 10,
        duration: 10,
        progress: 85,
        milestones: [
          { id: "m8", name: "Structural Assessment", day: 15, progress: 100, description: "Foundation integrity verified" }
        ]
      },
      {
        id: 8,
        name: "Retrofitting Work",
        start: 20,
        duration: 20,
        progress: 55,
        milestones: [
          { id: "m9", name: "Seismic Upgrade", day: 30, progress: 70, description: "Seismic reinforcement installation" }
        ]
      },
      {
        id: 9,
        name: "Systems Modernization",
        start: 35,
        duration: 15,
        progress: 25,
        milestones: []
      }
    ],
    weatherImpacts: [
      { day: 12, severity: "medium", description: "Rain - outdoor work delayed" },
      { day: 28, severity: "high", description: "Severe weather alert" }
    ]
  },
  "Team Gamma": {
    phases: [
      {
        id: 10,
        name: "Foundation & Piling",
        start: 8,
        duration: 12,
        progress: 90,
        milestones: [
          { id: "m10", name: "Piling Complete", day: 15, progress: 100, description: "All foundation piling completed" }
        ]
      },
      {
        id: 11,
        name: "Steel Frame Erection",
        start: 20,
        duration: 18,
        progress: 60,
        milestones: [
          { id: "m11", name: "Level 10 Complete", day: 28, progress: 75, description: "10th floor structural completion" },
          { id: "m12", name: "Topping Out", day: 38, progress: 40, description: "Final beam placement ceremony" }
        ]
      },
      {
        id: 12,
        name: "Curtain Wall Installation",
        start: 30,
        duration: 16,
        progress: 35,
        milestones: []
      },
      {
        id: 13,
        name: "Core & Shell Completion",
        start: 42,
        duration: 14,
        progress: 10,
        milestones: [
          { id: "m13", name: "MEP Commissioning", day: 50, progress: 0, description: "All building systems tested" }
        ]
      }
    ],
    weatherImpacts: [
      { day: 22, severity: "high", description: "High winds - crane operations suspended" },
      { day: 23, severity: "high", description: "Continued wind warning" },
      { day: 35, severity: "medium", description: "Rain delay" }
    ]
  }
};

export const daysInTimeline = 60;

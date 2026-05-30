export interface Department {
  id: string;
  name: string;
  count: number;
  color: string;
  isPrivate?: boolean;
  assignedHead?: string;
  isNew?: boolean;
  allowedMembers?: string[];
}

export const DEPT_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

export interface TeamLeader {
  id: string;
  name: string;
  initials: string;
  team: string;
  gradient: string;
}

export const TEAM_LEADERS: TeamLeader[] = [
  {
    id: "tl-reyes",
    name: "Ana Reyes",
    initials: "AR",
    team: "Operations",
    gradient: "linear-gradient(135deg, #3B82F6, #2563EB)",
  },
  {
    id: "tl-santos",
    name: "Carlos Santos",
    initials: "CS",
    team: "Engineering",
    gradient: "linear-gradient(135deg, #10B981, #059669)",
  },
  {
    id: "tl-dela-cruz",
    name: "Maria Dela Cruz",
    initials: "MD",
    team: "Marketing",
    gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
  },
  {
    id: "tl-garcia",
    name: "Jose Garcia",
    initials: "JG",
    team: "Geotechnical",
    gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
  },
  {
    id: "tl-tan",
    name: "Patricia Tan",
    initials: "PT",
    team: "Civil Works",
    gradient: "linear-gradient(135deg, #EF4444, #DC2626)",
  },
];

export const departments: Department[] = [
  { id: "operations", name: "Operations", count: 12, color: "bg-blue-500" },
  { id: "marketing", name: "Marketing", count: 8, color: "bg-purple-500" },
  { id: "engineering", name: "Engineering", count: 15, color: "bg-green-500" },
];

export const workspaceContent = {
  operations: {
    announcements: [
      {
        id: 1,
        title: "Q2 Project Kickoff - All Hands Required",
        department: "Operations",
        date: "2026-05-14",
        urgent: true,
        content: "Mandatory attendance for quarterly planning session. Review materials in advance."
      },
      {
        id: 2,
        title: "New Safety Protocol Updates",
        department: "Operations",
        date: "2026-05-13",
        urgent: true,
        content: "Updated OSHA compliance requirements effective immediately."
      }
    ],
    reports: [
      {
        id: 1,
        author: "Marcus Thompson",
        department: "Operations",
        title: "Material Delivery Update - Week 20",
        date: "2026-05-14 08:15",
        attachments: 2,
        reviewed: false
      },
      {
        id: 2,
        author: "James Wilson",
        department: "Operations",
        title: "Site Inspection Report - Building C",
        date: "2026-05-13 15:30",
        attachments: 5,
        reviewed: false
      },
      {
        id: 3,
        author: "Rachel Green",
        department: "Operations",
        title: "Equipment Utilization Analysis",
        date: "2026-05-13 11:20",
        attachments: 1,
        reviewed: true
      }
    ]
  },
  marketing: {
    announcements: [
      {
        id: 3,
        title: "Brand Refresh Campaign Launch",
        department: "Marketing",
        date: "2026-05-14",
        urgent: false,
        content: "New brand guidelines are live. All teams should review the updated assets."
      }
    ],
    reports: [
      {
        id: 4,
        author: "Elena Rodriguez",
        department: "Marketing",
        title: "Client Feedback Summary - May",
        date: "2026-05-13 16:45",
        attachments: 1,
        reviewed: true
      },
      {
        id: 5,
        author: "Michael Chen",
        department: "Marketing",
        title: "Social Media Performance Q2",
        date: "2026-05-13 10:00",
        attachments: 3,
        reviewed: false
      },
      {
        id: 6,
        author: "Sophie Martinez",
        department: "Marketing",
        title: "Lead Generation Campaign Results",
        date: "2026-05-12 14:30",
        attachments: 2,
        reviewed: true
      }
    ]
  },
  engineering: {
    announcements: [
      {
        id: 4,
        title: "Code Review Standards Update",
        department: "Engineering",
        date: "2026-05-14",
        urgent: true,
        content: "New peer review requirements for all production deployments effective immediately."
      }
    ],
    reports: [
      {
        id: 7,
        author: "Sarah Chen",
        department: "Engineering",
        title: "Foundation Inspection Report - Building A",
        date: "2026-05-14 09:30",
        attachments: 3,
        reviewed: false
      },
      {
        id: 8,
        author: "David Kim",
        department: "Engineering",
        title: "Equipment Maintenance Log",
        date: "2026-05-13 14:20",
        attachments: 4,
        reviewed: true
      },
      {
        id: 9,
        author: "Lisa Wang",
        department: "Engineering",
        title: "Structural Load Testing Results",
        date: "2026-05-13 09:15",
        attachments: 6,
        reviewed: false
      },
      {
        id: 10,
        author: "Tom Anderson",
        department: "Engineering",
        title: "API Performance Optimization Report",
        date: "2026-05-12 16:00",
        attachments: 2,
        reviewed: true
      }
    ]
  }
};

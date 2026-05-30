import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from sqlalchemy import UniqueConstraint

# --- Enums ---

class Role(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    TEAM_LEADER = "TEAM_LEADER"
    EMPLOYEE = "EMPLOYEE"
    FINANCE_ADMIN = "FINANCE_ADMIN"
    # Legacy aliases kept for backward compatibility
    CREATOR = "CREATOR"
    CLIENT = "CLIENT"

class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    UNPAID = "UNPAID"
    TRIALING = "TRIALING"

class AssetType(str, Enum):
    IMAGE = "IMAGE"
    VECTOR = "VECTOR"
    FONT = "FONT"
    VIDEO = "VIDEO"
    DOCUMENT = "DOCUMENT"

class ReportStatus(str, Enum):
    ON_TRACK = "On Track"
    DELAYED = "Delayed"

# --- Models ---

class User(SQLModel, table=True):
    __tablename__ = "User"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(unique=True, index=True)
    passwordHash: str
    firstName: str
    lastName: str
    avatarUrl: Optional[str] = None
    role: Role = Field(default=Role.CREATOR)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Bank/Payout Details
    accountHolderName: Optional[str] = Field(default=None, nullable=True)
    bankName: Optional[str] = Field(default=None, nullable=True)
    accountNumber: Optional[str] = Field(default=None, nullable=True)

    # Relationships
    memberships: List["WorkspaceMember"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    comments: List["Comment"] = Relationship(back_populates="user")
    createdAssets: List["Asset"] = Relationship(back_populates="createdBy")
    messages: List["Message"] = Relationship(back_populates="author")
    reports: List["ProgressReport"] = Relationship(back_populates="author")


class Workspace(SQLModel, table=True):
    __tablename__ = "Workspace"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    logoUrl: Optional[str] = None
    stripeCustomerId: Optional[str] = Field(default=None, unique=True, nullable=True)
    ganttCustomData: Optional[str] = Field(default=None, nullable=True)
    chatDepartmentsData: Optional[str] = Field(default=None, nullable=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    members: List["WorkspaceMember"] = Relationship(back_populates="workspace", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    projects: List["Project"] = Relationship(back_populates="workspace", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    subscription: Optional["Subscription"] = Relationship(back_populates="workspace", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class WorkspaceMember(SQLModel, table=True):
    __tablename__ = "WorkspaceMember"
    __table_args__ = (
        UniqueConstraint("workspaceId", "userId", name="WorkspaceMember_workspaceId_userId_key"),
    )
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(foreign_key="Workspace.id", index=True)
    userId: str = Field(foreign_key="User.id", index=True)
    role: Role = Field(default=Role.CREATOR)
    joinedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    workspace: Workspace = Relationship(back_populates="members")
    user: User = Relationship(back_populates="memberships")

class Project(SQLModel, table=True):
    __tablename__ = "Project"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(foreign_key="Workspace.id", index=True)
    name: str
    description: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    workspace: Workspace = Relationship(back_populates="projects")
    boards: List["Board"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    assets: List["Asset"] = Relationship(back_populates="project")

class Board(SQLModel, table=True):
    __tablename__ = "Board"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    projectId: str = Field(foreign_key="Project.id", index=True)
    name: str
    canvasData: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    version: int = Field(default=1)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Project = Relationship(back_populates="boards")
    versions: List["BoardVersion"] = Relationship(back_populates="board", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    comments: List["Comment"] = Relationship(back_populates="board", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class BoardVersion(SQLModel, table=True):
    __tablename__ = "BoardVersion"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    boardId: str = Field(foreign_key="Board.id", index=True)
    canvasData: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    version: int
    createdBy: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    board: Board = Relationship(back_populates="versions")

class Asset(SQLModel, table=True):
    __tablename__ = "Asset"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    projectId: Optional[str] = Field(default=None, foreign_key="Project.id", nullable=True)
    name: str
    fileUrl: str
    fileSize: int
    mimeType: str
    type: AssetType
    createdById: str = Field(foreign_key="User.id")
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Optional[Project] = Relationship(back_populates="assets")
    createdBy: User = Relationship(back_populates="createdAssets")

class Comment(SQLModel, table=True):
    __tablename__ = "Comment"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    boardId: str = Field(foreign_key="Board.id", index=True)
    userId: str = Field(foreign_key="User.id")
    content: str
    posX: Optional[float] = None
    posY: Optional[float] = None
    elementId: Optional[str] = None
    parentId: Optional[str] = Field(default=None, foreign_key="Comment.id", nullable=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    board: Board = Relationship(back_populates="comments")
    user: User = Relationship(back_populates="comments")

class Subscription(SQLModel, table=True):
    __tablename__ = "Subscription"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(foreign_key="Workspace.id", unique=True)
    stripeSubscriptionId: str = Field(unique=True)
    stripePriceId: str
    status: SubscriptionStatus
    trialStart: Optional[datetime] = None
    trialEnd: Optional[datetime] = None
    currentPeriodStart: datetime
    currentPeriodEnd: datetime
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    workspace: Workspace = Relationship(back_populates="subscription")


class Message(SQLModel, table=True):
    """Chat message within a department channel in a workspace."""
    __tablename__ = "Message"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    channel: str = Field(index=True)  # e.g. "operations", "marketing", "engineering"
    userId: str = Field(foreign_key="User.id", index=True)
    content: str
    replyToId: Optional[str] = Field(default=None, foreign_key="Message.id", nullable=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    author: "User" = Relationship(back_populates="messages")


class ProgressReport(SQLModel, table=True):
    """Progress report / daily submission made by an employee or team leader."""
    __tablename__ = "ProgressReport"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    authorId: str = Field(foreign_key="User.id", index=True)
    department: str  # e.g. "operations", "engineering", "marketing"
    summary: str
    status: ReportStatus = Field(default=ReportStatus.ON_TRACK)
    attachments: int = Field(default=0)
    reviewed: bool = Field(default=False)
    # Who this report is addressed to (display string for now)
    sentTo: Optional[str] = Field(default=None)
    submitterRole: str = Field(default="Employee")  # "Employee" | "Team Leader"
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    author: "User" = Relationship(back_populates="reports")


class GanttProgressOverride(SQLModel, table=True):
    """Saves manual overrides to task and project progress values inside the Gantt chart."""
    __tablename__ = "GanttProgressOverride"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    itemType: str  # "project" (Org level) or "phase" (Team level)
    itemId: str = Field(index=True)
    progress: int = Field(default=0, ge=0, le=100)
    isOverridden: bool = Field(default=True)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class GanttTimelineShift(SQLModel, table=True):
    """Saves manual timeline delays/shifts (+1 day shifts) on a specific day in the Gantt chart."""
    __tablename__ = "GanttTimelineShift"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    targetDay: int = Field(...)
    shiftAmount: int = Field(default=1)
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class PayrollAdjustment(SQLModel, table=True):
    """Stores overtime and tardiness adjustments logged by Team Leaders or Org Admins."""
    __tablename__ = "PayrollAdjustment"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    employeeId: str = Field(index=True)
    employeeName: str = Field(...)
    team: str = Field(index=True) # e.g. "Team Alpha"
    workHours: float = Field(default=160.0)
    overtimeHours: float = Field(default=0.0)
    tardinessMinutes: float = Field(default=0.0)
    bonus: float = Field(default=0.0)
    baseRate: float = Field(...) # Hourly rate or Base salary monthly rate
    isSalaried: bool = Field(default=False)
    period: str = Field(...) # e.g. "May 2026"
    isLocked: bool = Field(default=False)
    updatedBy: str = Field(...) # Name of logger
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class PayrollExpenseLog(SQLModel, table=True):
    """Logs gross payouts, taxes, and fees as expenses in the financial system."""
    __tablename__ = "PayrollExpenseLog"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    period: str = Field(...)
    totalGrossPay: float = Field(...)
    totalNetPay: float = Field(...)
    employerTaxContribution: float = Field(...)
    processingFees: float = Field(...)
    bankLedgerDeducted: float = Field(...)
    status: str = Field(default="pending") # "pending" | "paid"
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class FinancialTransaction(SQLModel, table=True):
    """Stores manual or imported financial transactions (materials, equipment, utilities, salary, etc.)."""
    __tablename__ = "FinancialTransaction"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(index=True)
    date: str = Field(...)
    description: str = Field(...)
    category: str = Field(...)
    amount: float = Field(...)
    status: str = Field(...) # "Paid" | "Pending" | "Reviewing"
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class OrganizationInvite(SQLModel, table=True):
    """Stores generated organization invitation codes/links."""
    __tablename__ = "OrganizationInvite"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspaceId: str = Field(foreign_key="Workspace.id", index=True)
    code: str = Field(unique=True, index=True) # e.g. ORG-ABC-123 or secure token
    createdBy: str = Field(foreign_key="User.id")
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    expiresAt: Optional[datetime] = None




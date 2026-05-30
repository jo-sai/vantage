from fastapi import APIRouter, Depends, Path
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import List, Optional

from app.database import get_db
from app.auth.dependencies import require_tenant, TenantContext, get_current_user
from app.models import ProgressReport, User, Role, ReportStatus
from app.errors import NotFoundException, ForbiddenException

router = APIRouter()

# --- Request Schemas ---

class SubmitReportRequest(BaseModel):
    department: str = Field(..., description="Department channel, e.g. 'operations'")
    summary: str = Field(..., min_length=1, description="Report summary text")
    status: ReportStatus = Field(default=ReportStatus.ON_TRACK, description="Progress status")
    attachments: int = Field(default=0, ge=0, description="Number of attachments")
    sentTo: Optional[str] = Field(default=None, description="Display string for recipient, e.g. 'Ana Reyes · Team Leader'")


# --- Response Helpers ---

def _serialize_report(report: ProgressReport, author: User) -> dict:
    """Serialize a ProgressReport into a JSON-safe response dict."""
    return {
        "id": report.id,
        "workspaceId": report.workspaceId,
        "department": report.department,
        "summary": report.summary,
        "status": report.status,
        "attachments": report.attachments,
        "reviewed": report.reviewed,
        "sentTo": report.sentTo,
        "submitterRole": report.submitterRole,
        "createdAt": report.createdAt.isoformat() + "Z",
        "author": {
            "id": author.id,
            "firstName": author.firstName,
            "lastName": author.lastName,
            "email": author.email,
            "avatarUrl": author.avatarUrl,
            "role": author.role,
        }
    }


# --- Routes ---

@router.get("/{workspaceId}")
async def list_reports(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
):
    """
    Lists progress reports scoped to the active workspace.

    Access rules:
    - ADMIN: sees all reports across all departments.
    - TEAM_LEADER: sees all reports (submitted by employees and fellow team leaders).
    - EMPLOYEE: sees only their own submitted reports.
    """
    statement = select(ProgressReport).where(
        ProgressReport.workspaceId == tenant.workspace_id
    ).order_by(ProgressReport.createdAt.desc())

    all_reports = db.exec(statement).all()

    # Filter based on role
    if current_user.role in (Role.ADMIN, Role.OWNER, Role.TEAM_LEADER):
        visible = all_reports
    else:
        # Employee: only own reports
        visible = [r for r in all_reports if r.authorId == current_user.id]

    result = []
    for report in visible:
        author = db.get(User, report.authorId)
        if author:
            result.append(_serialize_report(report, author))

    return {"success": True, "data": result}


@router.post("/{workspaceId}")
async def submit_report(
    payload: SubmitReportRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
):
    """
    Submits a progress report on behalf of the authenticated user.
    Automatically tags the submitter role based on the user's workspace role.
    """
    # Derive submitter role label from user role
    if current_user.role == Role.OWNER:
        submitter_role = "Owner"
    elif current_user.role == Role.ADMIN:
        submitter_role = "Admin"
    elif current_user.role == Role.TEAM_LEADER:
        submitter_role = "Team Leader"
    else:
        submitter_role = "Employee"

    report = ProgressReport(
        workspaceId=tenant.workspace_id,
        authorId=current_user.id,
        department=payload.department,
        summary=payload.summary,
        status=payload.status,
        attachments=payload.attachments,
        sentTo=payload.sentTo,
        submitterRole=submitter_role,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "message": "Progress report submitted successfully",
        "data": _serialize_report(report, current_user)
    }


@router.patch("/{workspaceId}/{reportId}/review")
async def mark_reviewed(
    workspaceId: str = Path(..., description="Target workspace ID"),
    reportId: str = Path(..., description="Report ID to mark as reviewed"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
):
    """
    Marks a progress report as reviewed. Only accessible by ADMIN or TEAM_LEADER roles.
    """
    if current_user.role not in (Role.ADMIN, Role.OWNER, Role.TEAM_LEADER):
        raise ForbiddenException("Only owners, admins, and team leaders can mark reports as reviewed")

    report = db.get(ProgressReport, reportId)
    if not report or report.workspaceId != tenant.workspace_id:
        raise NotFoundException("Report not found in this workspace")

    report.reviewed = True
    db.add(report)
    db.commit()
    db.refresh(report)

    author = db.get(User, report.authorId)
    return {
        "success": True,
        "message": "Report marked as reviewed",
        "data": _serialize_report(report, author)
    }

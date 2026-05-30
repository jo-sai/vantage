from fastapi import APIRouter, Depends, Path
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from datetime import datetime
from app.database import get_db
from app.auth.dependencies import require_tenant, TenantContext
from app.models import Role, GanttProgressOverride, GanttTimelineShift
from app.errors import ForbiddenException

router = APIRouter()

# --- Request Schemas ---

class OverrideProgressRequest(BaseModel):
    itemType: str = Field(..., description="'project' or 'phase'")
    itemId: str = Field(..., description="ID of the project or phase")
    progress: int = Field(..., ge=0, le=100, description="Override progress percent")


class CreateTimelineShiftRequest(BaseModel):
    targetDay: int = Field(..., ge=1, le=100, description="The Gantt day index triggered")
    shiftAmount: int = Field(default=1, description="Day shift amount, e.g. 1")


# --- Routes ---

@router.get("/overrides/{workspaceId}")
async def get_progress_overrides(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Retrieves all manual progress overrides made within the active workspace tenant.
    Ensures strict tenant isolation logic.
    """
    stmt = select(GanttProgressOverride).where(
        GanttProgressOverride.workspaceId == tenant.workspace_id
    )
    overrides = db.exec(stmt).all()
    return {
        "success": True,
        "data": overrides
    }

@router.post("/overrides/{workspaceId}")
async def update_progress_override(
    payload: OverrideProgressRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Saves or updates a manual progress override value.
    Enforces strict role-based access controls based on the scope:
    - Org Admins (ADMIN) can edit anything.
    - Team Leaders (TEAM_LEADER) can only edit team-level phases.
    - Employees (EMPLOYEE) cannot make overrides.
    """
    user_role = tenant.role
    
    # 1. Enforce Role boundaries:
    if payload.itemType == "project":
        if user_role not in [Role.ADMIN, Role.OWNER]:
            raise ForbiddenException("Only Organization Admins and Owners are authorized to override organization-level project progress")
    elif payload.itemType == "phase":
        if user_role not in [Role.ADMIN, Role.OWNER, Role.TEAM_LEADER]:
            raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to override team phase progress")
    else:
        from app.errors import BadRequestException
        raise BadRequestException("Invalid override itemType. Must be 'project' or 'phase'.")

    # 2. Query for existing record to execute an Upsert (Update or Insert)
    stmt = select(GanttProgressOverride).where(
        GanttProgressOverride.workspaceId == tenant.workspace_id,
        GanttProgressOverride.itemType == payload.itemType,
        GanttProgressOverride.itemId == payload.itemId
    )
    existing = db.exec(stmt).first()
    
    if existing:
        existing.progress = payload.progress
        existing.isOverridden = True
        existing.updatedAt = datetime.utcnow()
        db.add(existing)
    else:
        new_override = GanttProgressOverride(
            workspaceId=tenant.workspace_id,
            itemType=payload.itemType,
            itemId=payload.itemId,
            progress=payload.progress,
            isOverridden=True
        )
        db.add(new_override)
        
    db.commit()
    
    return {
        "success": True,
        "message": "Gantt progress override persisted successfully"
    }


@router.delete("/overrides/{workspaceId}/{itemType}/{itemId}")
async def delete_progress_override(
    workspaceId: str = Path(..., description="Target workspace ID"),
    itemType: str = Path(..., description="'project' or 'phase'"),
    itemId: str = Path(..., description="ID of the project or phase"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Deletes a manual progress override record to revert back to default automatic calculated progress.
    Enforces strict role-based checks.
    """
    user_role = tenant.role
    
    # 1. Enforce Role boundaries:
    if itemType == "project":
        if user_role not in [Role.ADMIN, Role.OWNER]:
            raise ForbiddenException("Only Organization Admins and Owners are authorized to revert organization-level project progress")
    elif itemType == "phase":
        if user_role not in [Role.ADMIN, Role.OWNER, Role.TEAM_LEADER]:
            raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to revert team phase progress")
    else:
        from app.errors import BadRequestException
        raise BadRequestException("Invalid override itemType. Must be 'project' or 'phase'.")

    # 2. Query and delete override
    stmt = select(GanttProgressOverride).where(
        GanttProgressOverride.workspaceId == tenant.workspace_id,
        GanttProgressOverride.itemType == itemType,
        GanttProgressOverride.itemId == itemId
    )
    existing = db.exec(stmt).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {
            "success": True,
            "message": "Gantt progress override cleared successfully"
        }
    
    return {
        "success": True,
        "message": "No manual override existed for this item"
    }


@router.get("/shifts/{workspaceId}")
async def get_timeline_shifts(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Retrieves all manual timeline shifts (delays) made within the active workspace tenant.
    """
    stmt = select(GanttTimelineShift).where(
        GanttTimelineShift.workspaceId == tenant.workspace_id
    )
    shifts = db.exec(stmt).all()
    return {
        "success": True,
        "data": shifts
    }

@router.post("/shifts/{workspaceId}")
async def create_timeline_shift(
    payload: CreateTimelineShiftRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Saves a new manual timeline delay shift (+1 day) triggered by a weather event.
    Enforces that only Org Admins and Team Leaders are authorized.
    """
    user_role = tenant.role
    if user_role not in [Role.ADMIN, Role.OWNER, Role.TEAM_LEADER]:
        raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to trigger timeline delays")
        
    new_shift = GanttTimelineShift(
        workspaceId=tenant.workspace_id,
        targetDay=payload.targetDay,
        shiftAmount=payload.shiftAmount
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    
    return {
        "success": True,
        "message": "Timeline shift persisted successfully",
        "data": new_shift
    }

@router.delete("/shifts/{workspaceId}/{shiftId}")
async def delete_timeline_shift(
    workspaceId: str = Path(..., description="Target workspace ID"),
    shiftId: str = Path(..., description="ID of the shift to delete"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Deletes a manual timeline delay shift (reverting the +1 day shift).
    Enforces role boundaries.
    """
    user_role = tenant.role
    if user_role not in [Role.ADMIN, Role.OWNER, Role.TEAM_LEADER]:
        raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to clear timeline delays")
        
    stmt = select(GanttTimelineShift).where(
        GanttTimelineShift.workspaceId == tenant.workspace_id,
        GanttTimelineShift.id == shiftId
    )
    existing = db.exec(stmt).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {
            "success": True,
            "message": "Timeline shift cleared successfully"
        }
    
    return {
        "success": True,
        "message": "No such timeline shift found"
    }



import random
import secrets
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Path
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models import Workspace, WorkspaceMember, User, Role, OrganizationInvite
from app.errors import (
    NotFoundException, ForbiddenException, ConflictException, BadRequestException
)

router = APIRouter()

INVITE_EXPIRY_DAYS = 7

# --- Request Schemas ---

class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Workspace name")

class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, description="New workspace name")


class InviteMemberRequest(BaseModel):
    email: str = Field(..., description="Email of the user to invite")
    role: Role = Field(default=Role.EMPLOYEE, description="Role to assign to the invited member")

class JoinWorkspaceRequest(BaseModel):
    code: str = Field(..., description="Organization Invite Code (e.g. ORG-ABC-123)")

class UpdateMemberRoleRequest(BaseModel):
    role: Role = Field(..., description="Target role to assign")


# --- Response Helpers ---

def _serialize_workspace(ws: Workspace, user_role: Role) -> dict:
    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "logoUrl": ws.logoUrl,
        "createdAt": ws.createdAt.isoformat() + "Z",
        "userRole": user_role,
    }

def _serialize_member(member: WorkspaceMember, user: User) -> dict:
    return {
        "id": member.id,
        "workspaceId": member.workspaceId,
        "role": member.role,
        "joinedAt": member.joinedAt.isoformat() + "Z",
        "user": {
            "id": user.id,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "email": user.email,
            "avatarUrl": user.avatarUrl,
        }
    }


# --- Routes ---

@router.get("")
async def list_my_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all workspaces the authenticated user is a member of.
    """
    statement = select(WorkspaceMember).where(WorkspaceMember.userId == current_user.id)
    memberships = db.exec(statement).all()

    result = []
    for m in memberships:
        ws = db.get(Workspace, m.workspaceId)
        if ws:
            result.append(_serialize_workspace(ws, m.role))

    return {"success": True, "data": result}


@router.post("")
async def create_workspace(
    payload: CreateWorkspaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new workspace. Accessible to ADMIN and TEAM_LEADER roles only.
    The creator is automatically joined as ADMIN of the new workspace.
    """
    if current_user.role not in (Role.OWNER, Role.ADMIN, Role.TEAM_LEADER):
        raise ForbiddenException("Only owners, admins, and team leaders can create new workspaces")

    slug = f"{payload.name.lower().replace(' ', '-')}-{random.randint(1000, 9999)}"

    try:
        workspace = Workspace(name=payload.name, slug=slug)
        db.add(workspace)
        db.flush()

        member = WorkspaceMember(
            workspaceId=workspace.id,
            userId=current_user.id,
            role=Role.OWNER
        )
        db.add(member)

        # Promote creator's global role to OWNER
        current_user.role = Role.OWNER
        db.add(current_user)

        db.commit()
        db.refresh(workspace)
    except Exception as e:
        db.rollback()
        raise BadRequestException(f"Workspace creation failed: {str(e)}")

    return {
        "success": True,
        "message": "Workspace created successfully",
        "data": _serialize_workspace(workspace, Role.OWNER)
    }


@router.patch("/{workspaceId}")
async def update_workspace(
    payload: UpdateWorkspaceRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates a workspace's name. Restricted to OWNER or ADMIN members of that workspace.
    """
    workspace = db.get(Workspace, workspaceId)
    if not workspace:
        raise NotFoundException("Workspace not found")

    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        raise ForbiddenException("You are not a member of this workspace")
    if caller_membership.role not in (Role.OWNER, Role.ADMIN):
        raise ForbiddenException("Only owners and admins can update workspace details")

    if payload.name is not None:
        workspace.name = payload.name

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return {
        "success": True,
        "message": "Workspace updated successfully",
        "data": _serialize_workspace(workspace, caller_membership.role)
    }

@router.get("/{workspaceId}/members")
async def list_members(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists all members in a workspace. The requesting user must be a member.
    """
    # Assert the calling user is a member of this workspace
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        # Resilience: auto-provision OWNER/ADMIN users who lack a membership record
        if current_user.role in (Role.OWNER, Role.ADMIN):
            caller_membership = WorkspaceMember(
                workspaceId=workspaceId,
                userId=current_user.id,
                role=current_user.role
            )
            db.add(caller_membership)
            db.commit()
            db.refresh(caller_membership)
        else:
            raise ForbiddenException("You are not a member of this workspace")

    stmt = select(WorkspaceMember).where(WorkspaceMember.workspaceId == workspaceId)
    memberships = db.exec(stmt).all()

    result = []
    for m in memberships:
        user = db.get(User, m.userId)
        if user:
            result.append(_serialize_member(m, user))

    return {"success": True, "data": result}


@router.post("/{workspaceId}/members")
async def invite_member(
    payload: InviteMemberRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Invites an existing user (by email) to a workspace.
    Only ADMIN or TEAM_LEADER members of the workspace can invite others.
    """
    # Assert caller is an admin/TL in this workspace
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        raise ForbiddenException("You are not a member of this workspace")
    if caller_membership.role not in (Role.OWNER, Role.ADMIN, Role.TEAM_LEADER):
        raise ForbiddenException("Only owners, admins, and team leaders can invite members")

    # Find the user by email
    user_stmt = select(User).where(User.email == payload.email)
    target_user = db.exec(user_stmt).first()
    if not target_user:
        raise NotFoundException(f"No user found with email: {payload.email}")

    # Check if already a member
    existing_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == target_user.id
    )
    if db.exec(existing_stmt).first():
        raise ConflictException("This user is already a member of the workspace")

    new_member = WorkspaceMember(
        workspaceId=workspaceId,
        userId=target_user.id,
        role=payload.role
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    return {
        "success": True,
        "message": "Member invited successfully",
        "data": _serialize_member(new_member, target_user)
    }


@router.delete("/{workspaceId}/members/{userId}")
async def remove_member(
    workspaceId: str = Path(..., description="Target workspace ID"),
    userId: str = Path(..., description="User ID to remove from workspace"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Removes a member from a workspace. Only ADMIN members can remove others.
    Members can also remove themselves (leave workspace).
    """
    # Assert caller is a member
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        raise ForbiddenException("You are not a member of this workspace")

    is_self_removal = userId == current_user.id
    if not is_self_removal and caller_membership.role not in (Role.OWNER, Role.ADMIN):
        raise ForbiddenException("Only owners and admins can remove other members")

    target_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == userId
    )
    target_membership = db.exec(target_stmt).first()
    if not target_membership:
        raise NotFoundException("Member not found in this workspace")

    db.delete(target_membership)
    db.commit()

    return {"success": True, "message": "Member removed from workspace", "data": {"userId": userId}}


@router.post("/join")
async def join_workspace(
    payload: JoinWorkspaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validates the invite code and joins the user to the organization with default role EMPLOYEE.
    """
    invite_code = payload.code.strip().upper()
    invite = db.exec(
        select(OrganizationInvite).where(OrganizationInvite.code == invite_code)
    ).first()
    
    # Suffix matching resilience for 6-character short code option (e.g. YYYYYY)
    if not invite and len(invite_code) == 6:
        all_invites = db.exec(select(OrganizationInvite)).all()
        for candidate_invite in all_invites:
            if candidate_invite.code.upper().endswith(invite_code):
                invite = candidate_invite
                break
    
    if not invite:
        raise NotFoundException("Invalid invitation code. Please check the code and try again.")
    
    # Enforce expiry: reject if older than INVITE_EXPIRY_DAYS
    if invite.expiresAt and datetime.utcnow() > invite.expiresAt:
        raise BadRequestException("This invitation link has expired. Please ask your admin to generate a new one.")
        
    # Check if user is already a member
    existing = db.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspaceId == invite.workspaceId,
            WorkspaceMember.userId == current_user.id
        )
    ).first()
    
    if existing:
        raise ConflictException("You are already a member of this organization.")
        
    workspace = db.get(Workspace, invite.workspaceId)
    if not workspace:
        raise NotFoundException("Organization associated with this invite code was not found.")
        
    # Link user to organization as EMPLOYEE (Level 1 — baseline role)
    new_member = WorkspaceMember(
        workspaceId=invite.workspaceId,
        userId=current_user.id,
        role=Role.EMPLOYEE
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    # Clean up auto-created personal workspace if they are joining an invite
    # Find all memberships of the current user
    user_memberships = db.exec(
        select(WorkspaceMember).where(WorkspaceMember.userId == current_user.id)
    ).all()
    
    for mem in user_memberships:
        if mem.workspaceId == invite.workspaceId:
            continue
        
        # Check if the other workspace has only this user
        other_members = db.exec(
            select(WorkspaceMember).where(WorkspaceMember.workspaceId == mem.workspaceId)
        ).all()
        
        if len(other_members) == 1 and mem.role == Role.OWNER:
            other_ws = db.get(Workspace, mem.workspaceId)
            if other_ws:
                # Delete the other workspace member first to avoid FK constraint violations
                db.delete(mem)
                db.delete(other_ws)
                db.commit()
    
    return {
        "success": True,
        "message": f"Successfully joined {workspace.name}!",
        "data": _serialize_workspace(workspace, Role.EMPLOYEE)
    }


@router.post("/{workspaceId}/invites/generate")
async def generate_invite(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a unique, secure invitation token and URL for the organization.
    Restricted strictly to Org Admin or Org Owner members of the workspace.
    """
    # Verify workspace exists
    workspace = db.get(Workspace, workspaceId)
    if not workspace:
        raise NotFoundException("Organization not found")

    # Check caller membership and role
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()

    # Resilience: if no membership found but user has OWNER/ADMIN role on their User model,
    # auto-provision their workspace membership so they are not incorrectly rejected.
    if not caller_membership:
        if current_user.role in (Role.OWNER, Role.ADMIN):
            caller_membership = WorkspaceMember(
                workspaceId=workspaceId,
                userId=current_user.id,
                role=current_user.role
            )
            db.add(caller_membership)
            db.commit()
            db.refresh(caller_membership)
        else:
            raise ForbiddenException("You are not a member of this organization")
        
    if caller_membership.role not in (Role.OWNER, Role.ADMIN):
        raise ForbiddenException("Restricted strictly to Org Admins or Org Owners.")
        
    prefix = workspace.slug[:3].upper() if len(workspace.slug) >= 3 else workspace.slug.upper()
    
    # Try to generate a unique code
    max_attempts = 10
    code = ""
    for _ in range(max_attempts):
        rand_str = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        candidate = f"ORG-{prefix}-{rand_str}"
        existing = db.exec(
            select(OrganizationInvite).where(OrganizationInvite.code == candidate)
        ).first()
        if not existing:
            code = candidate
            break
            
    if not code:
        raise BadRequestException("Could not generate a unique invite code. Please try again.")
        
    # Set expiry date (7 days from now)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_EXPIRY_DAYS)
    
    # Create the invite record with expiry
    invite = OrganizationInvite(
        workspaceId=workspaceId,
        code=code,
        createdBy=current_user.id,
        expiresAt=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    invite_url = f"http://localhost:5173/join/{code}"
    
    return {
        "success": True,
        "code": code,
        "inviteUrl": invite_url,
        "expiresAt": expires_at.isoformat() + "Z",
        "expiresInDays": INVITE_EXPIRY_DAYS
    }


@router.put("/{workspaceId}/members/{userId}/role")
async def update_member_role(
    payload: UpdateMemberRoleRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    userId: str = Path(..., description="Member User ID to update"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enforces strict, multi-tiered security boundaries for role promotions and demotions.
    """
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        # Resilience: auto-provision OWNER/ADMIN users who lack a membership record
        if current_user.role in (Role.OWNER, Role.ADMIN):
            caller_membership = WorkspaceMember(
                workspaceId=workspaceId,
                userId=current_user.id,
                role=current_user.role
            )
            db.add(caller_membership)
            db.commit()
            db.refresh(caller_membership)
        else:
            raise ForbiddenException("You are not a member of this organization")

    target_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == userId
    )
    target_membership = db.exec(target_stmt).first()
    if not target_membership:
        raise NotFoundException("Member not found in this organization")

    role_levels = {
        Role.EMPLOYEE: 1,
        Role.CLIENT: 1,
        Role.TEAM_LEADER: 2,
        Role.CREATOR: 2,
        Role.FINANCE_ADMIN: 2,
        Role.ADMIN: 3,
        Role.OWNER: 4
    }

    caller_level = role_levels.get(caller_membership.role, 1)
    target_current_level = role_levels.get(target_membership.role, 1)
    target_new_level = role_levels.get(payload.role, 1)

    if caller_membership.role == Role.OWNER:
        if payload.role == Role.OWNER:
            if userId == current_user.id:
                raise BadRequestException("You are already the owner of this organization")
            target_membership.role = Role.OWNER
            caller_membership.role = Role.ADMIN
            db.add(target_membership)
            db.add(caller_membership)
            db.commit()
            db.refresh(target_membership)
            db.refresh(caller_membership)
            return {
                "success": True,
                "message": "Ownership successfully transferred.",
                "data": _serialize_member(target_membership, db.get(User, userId))
            }
        else:
            target_membership.role = payload.role
            db.add(target_membership)
            db.commit()
            db.refresh(target_membership)
            return {
                "success": True,
                "message": f"Role updated to {payload.role.value} successfully.",
                "data": _serialize_member(target_membership, db.get(User, userId))
            }

    elif caller_membership.role == Role.ADMIN:
        if target_new_level >= 3:
            raise ForbiddenException("Org Admins cannot promote anyone to Admin or Owner.")
            
        if target_current_level == 1 and target_new_level == 2:
            pass
        elif target_current_level == 2 and target_new_level == 1:
            pass
        elif target_current_level == target_new_level:
            pass
        else:
            raise ForbiddenException("Org Admins can only promote Employees to Team Leaders or demote Team Leaders to Employees.")

        if target_current_level >= caller_level:
            raise ForbiddenException("You cannot demote members who match or exceed your own rank.")

        target_membership.role = payload.role
        db.add(target_membership)
        db.commit()
        db.refresh(target_membership)
        return {
            "success": True,
            "message": f"Role updated to {payload.role.value} successfully.",
            "data": _serialize_member(target_membership, db.get(User, userId))
        }

    else:
        raise ForbiddenException("Only Org Owners and Org Admins can manage member roles.")


class SaveChatDepartmentsRequest(BaseModel):
    chatDepartmentsData: str = Field(..., description="JSON string containing chat departments/channels")


@router.get("/chat-departments/{workspaceId}")
async def get_chat_departments(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the entire custom chat departments/channels JSON dataset for this workspace.
    Ensures strict tenant isolation.
    """
    # 1. Assert the calling user is a member of this workspace
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        if current_user.role in (Role.OWNER, Role.ADMIN):
            caller_membership = WorkspaceMember(
                workspaceId=workspaceId,
                userId=current_user.id,
                role=current_user.role
            )
            db.add(caller_membership)
            db.commit()
            db.refresh(caller_membership)
        else:
            raise ForbiddenException("You are not a member of this organization")

    workspace = db.get(Workspace, workspaceId)
    if not workspace:
        raise NotFoundException("Workspace not found")

    return {
        "success": True,
        "data": workspace.chatDepartmentsData
    }


@router.post("/chat-departments/{workspaceId}")
async def save_chat_departments(
    payload: SaveChatDepartmentsRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Persists the custom chat departments/channels JSON dataset for this workspace.
    Restricted to Owners, Admins, and Team Leaders.
    """
    # 1. Assert caller is an admin/owner/TL in this workspace
    caller_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == workspaceId,
        WorkspaceMember.userId == current_user.id
    )
    caller_membership = db.exec(caller_stmt).first()
    if not caller_membership:
        if current_user.role in (Role.OWNER, Role.ADMIN):
            caller_membership = WorkspaceMember(
                workspaceId=workspaceId,
                userId=current_user.id,
                role=current_user.role
            )
            db.add(caller_membership)
            db.commit()
            db.refresh(caller_membership)
        else:
            raise ForbiddenException("You are not a member of this organization")

    if caller_membership.role not in (Role.OWNER, Role.ADMIN, Role.TEAM_LEADER):
        raise ForbiddenException("Only owners, admins, and team leaders can manage chat channels.")

    workspace = db.get(Workspace, workspaceId)
    if not workspace:
        raise NotFoundException("Workspace not found")

    workspace.chatDepartmentsData = payload.chatDepartmentsData
    db.add(workspace)
    db.commit()

    return {
        "success": True,
        "message": "Chat departments saved successfully"
    }

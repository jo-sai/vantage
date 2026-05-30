from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel, Field
import random
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import User, Workspace, WorkspaceMember, Role, OrganizationInvite
from app.auth.service import AuthService
from app.auth.dependencies import get_current_user
from app.errors import ConflictException, UnauthorizedException, BadRequestException

router = APIRouter()

# --- Request Schemas ---

class RegisterRequest(BaseModel):
    email: str = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    fullName: str = Field(..., description="Full name of user")
    role: Optional[Role] = Role.EMPLOYEE
    inviteCode: Optional[str] = None

class LoginRequest(BaseModel):
    email: str = Field(..., description="Email address")
    password: str = Field(..., description="Password")

class UpdateProfileRequest(BaseModel):
    firstName: Optional[str] = Field(default=None, min_length=1)
    lastName: Optional[str] = Field(default=None, min_length=1)
    avatarUrl: Optional[str] = Field(default=None)
    accountHolderName: Optional[str] = Field(default=None)
    bankName: Optional[str] = Field(default=None)
    accountNumber: Optional[str] = Field(default=None)


# --- Helper ---

def _build_user_response(user: User, workspace: Optional[dict], access_token: str, refresh_token: str) -> dict:
    """Builds the standard auth response envelope that Auth.tsx expects."""
    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "firstName": user.firstName,
                "lastName": user.lastName,
                "avatarUrl": user.avatarUrl,
                "accountHolderName": user.accountHolderName,
                "bankName": user.bankName,
                "accountNumber": user.accountNumber,
            },
            "workspace": workspace,
            "tokens": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
            }
        }
    }


# --- Routes ---

@router.post("/register")
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user and automatically provisions an isolated Workspace tenant
    for them inside an atomic transaction, unless an invite code is provided.
    """
    # 1. Assert unique email
    existing_user = db.exec(select(User).where(User.email == payload.email)).first()
    if existing_user:
        raise ConflictException("An account with this email address already exists")

    # Parse full name parts
    name_parts = payload.fullName.strip().split(" ")
    first_name = name_parts[0] if name_parts[0] else "User"
    last_name = "Vantage" if len(name_parts) <= 1 else " ".join(name_parts[1:])

    # 2. Setup transaction to register and provision default workspace or join organization
    try:
        user_role = Role.OWNER
        invited_workspace = None
        invite = None
        
        if payload.inviteCode:
            invite_code = payload.inviteCode.strip().upper()
            invite = db.exec(
                select(OrganizationInvite).where(OrganizationInvite.code == invite_code)
            ).first()
            
            # Suffix matching resilience for 6-character short code option
            if not invite and len(invite_code) == 6:
                all_invites = db.exec(select(OrganizationInvite)).all()
                for candidate_invite in all_invites:
                    if candidate_invite.code.upper().endswith(invite_code):
                        invite = candidate_invite
                        break
            
            if not invite:
                raise BadRequestException("Invalid invitation code. Please check the code and try again.")
            
            if invite.expiresAt and datetime.utcnow() > invite.expiresAt:
                raise BadRequestException("This invitation link has expired. Please ask your admin to generate a new one.")
                
            invited_workspace = db.get(Workspace, invite.workspaceId)
            if not invited_workspace:
                raise BadRequestException("Organization associated with this invite code was not found.")
                
            user_role = Role.EMPLOYEE

        user = User(
            email=payload.email,
            passwordHash=AuthService.hash_password(payload.password),
            firstName=first_name,
            lastName=last_name,
            role=user_role
        )
        db.add(user)
        db.flush()

        if invited_workspace:
            member = WorkspaceMember(
                workspaceId=invited_workspace.id,
                userId=user.id,
                role=Role.EMPLOYEE
            )
            db.add(member)
            db.commit()

            db.refresh(user)
            db.refresh(invited_workspace)
            
            workspace_data = {
                "id": invited_workspace.id,
                "name": invited_workspace.name,
                "slug": invited_workspace.slug,
                "userRole": member.role,
            }
        else:
            org_name = f"{first_name}'s Vantage Studio"
            org_slug = f"{first_name.lower()}-{random.randint(1000, 9999)}"

            workspace = Workspace(name=org_name, slug=org_slug)
            db.add(workspace)
            db.flush()

            member = WorkspaceMember(
                workspaceId=workspace.id,
                userId=user.id,
                role=Role.OWNER
            )
            db.add(member)
            db.commit()

            db.refresh(user)
            db.refresh(workspace)
            
            workspace_data = {
                "id": workspace.id,
                "name": workspace.name,
                "slug": workspace.slug,
                "userRole": member.role,
            }
    except Exception as e:
        db.rollback()
        if isinstance(e, BadRequestException):
            raise e
        raise BadRequestException(f"User registration and provisioning failed: {str(e)}")

    # 3. Generate Auth Tokens
    user_payload = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "firstName": user.firstName,
        "lastName": user.lastName,
    }
    access_token = AuthService.generate_access_token(user_payload)
    refresh_token = AuthService.generate_refresh_token(user.id)

    workspace_data = {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "userRole": member.role,
    }

    return _build_user_response(user, workspace_data, access_token, refresh_token)


@router.post("/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user credentials and returns session tokens with default Workspace metadata.
    """
    # 1. Fetch user by email
    user = db.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        raise UnauthorizedException("Invalid email or password")

    # 2. Verify hashed credentials
    if not AuthService.verify_password(payload.password, user.passwordHash):
        raise UnauthorizedException("Invalid email or password")

    # 3. Resolve default workspace membership
    workspace = None
    memberships = db.exec(
        select(WorkspaceMember).where(WorkspaceMember.userId == user.id)
    ).all()

    if memberships:
        default_membership = memberships[0]
        linked_workspace = db.get(Workspace, default_membership.workspaceId)
        if linked_workspace:
            workspace = {
                "id": linked_workspace.id,
                "name": linked_workspace.name,
                "slug": linked_workspace.slug,
                "userRole": default_membership.role,
            }

    # 4. Generate Auth Tokens
    user_payload = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "firstName": user.firstName,
        "lastName": user.lastName,
    }
    access_token = AuthService.generate_access_token(user_payload)
    refresh_token = AuthService.generate_refresh_token(user.id)

    return _build_user_response(user, workspace, access_token, refresh_token)


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user's profile from the JWT context.
    """
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "firstName": current_user.firstName,
            "lastName": current_user.lastName,
            "avatarUrl": current_user.avatarUrl,
            "accountHolderName": current_user.accountHolderName,
            "bankName": current_user.bankName,
            "accountNumber": current_user.accountNumber,
            "createdAt": current_user.createdAt.isoformat() + "Z",
        }
    }


@router.patch("/me")
async def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates the authenticated user's profile (name, avatar URL, payout/bank details).
    """
    if payload.firstName is not None:
        current_user.firstName = payload.firstName
    if payload.lastName is not None:
        current_user.lastName = payload.lastName
    if payload.avatarUrl is not None:
        current_user.avatarUrl = payload.avatarUrl
    if payload.accountHolderName is not None:
        current_user.accountHolderName = payload.accountHolderName
    if payload.bankName is not None:
        current_user.bankName = payload.bankName
    if payload.accountNumber is not None:
        current_user.accountNumber = payload.accountNumber

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "message": "Profile updated successfully",
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "firstName": current_user.firstName,
            "lastName": current_user.lastName,
            "avatarUrl": current_user.avatarUrl,
            "accountHolderName": current_user.accountHolderName,
            "bankName": current_user.bankName,
            "accountNumber": current_user.accountNumber,
        }
    }

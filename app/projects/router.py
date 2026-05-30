from fastapi import APIRouter, Depends, Path
from sqlmodel import Session
from pydantic import BaseModel, Field
from typing import List, Optional

from app.database import get_db
from app.auth.dependencies import require_tenant, TenantContext
from app.projects.service import ProjectService
from app.errors import BadRequestException

router = APIRouter()

# --- Request Schemas ---

class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the design project")
    description: Optional[str] = Field(default=None, description="Optional description of project")

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, description="Updated project name")
    description: Optional[str] = Field(default=None, description="Updated project description")

# --- Routes ---

@router.post("/{workspaceId}")
async def create_project(
    payload: CreateProjectRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Creates a new design project inside the specified workspace tenant.
    Enforces strict logical tenant boundary verification.
    """
    project = ProjectService.create_project(
        db=db,
        workspace_id=tenant.workspace_id,
        name=payload.name,
        description=payload.description
    )
    return {
        "success": True,
        "message": "Project created successfully",
        "data": project
    }

@router.get("/{workspaceId}")
async def list_projects(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Lists all design projects and board structures within the active workspace tenant.
    """
    projects = ProjectService.list_projects(db=db, workspace_id=tenant.workspace_id)
    return {
        "success": True,
        "data": projects
    }

@router.get("/{workspaceId}/{projectId}")
async def get_project(
    workspaceId: str = Path(..., description="Target workspace ID"),
    projectId: str = Path(..., description="Target project ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Retrieves a single design project inside the active workspace tenant.
    """
    project = ProjectService.get_project_by_id(
        db=db,
        workspace_id=tenant.workspace_id,
        project_id=projectId
    )
    return {
        "success": True,
        "data": project
    }

@router.put("/{workspaceId}/{projectId}")
async def update_project(
    payload: UpdateProjectRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    projectId: str = Path(..., description="Target project ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Updates the project parameters within the tenant isolation boundaries.
    """
    if payload.name is None and payload.description is None:
        raise BadRequestException("At least one field ('name' or 'description') must be provided for update")
        
    project = ProjectService.update_project(
        db=db,
        workspace_id=tenant.workspace_id,
        project_id=projectId,
        name=payload.name,
        description=payload.description
    )
    return {
        "success": True,
        "message": "Project updated successfully",
        "data": project
    }

@router.delete("/{workspaceId}/{projectId}")
async def delete_project(
    workspaceId: str = Path(..., description="Target workspace ID"),
    projectId: str = Path(..., description="Target project ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Cascades deletes a project and all associated board assets within the active workspace.
    """
    project = ProjectService.delete_project(
        db=db,
        workspace_id=tenant.workspace_id,
        project_id=projectId
    )
    return {
        "success": True,
        "message": "Project and child canvas boards deleted successfully",
        "data": {
            "id": project.id,
            "name": project.name
        }
    }

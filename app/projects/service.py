from sqlmodel import Session, select
from typing import List, Optional
from app.models import Project, Board
from app.errors import NotFoundException

class ProjectService:
    @staticmethod
    def create_project(db: Session, workspace_id: str, name: str, description: Optional[str] = None) -> Project:
        """
        Create a new design project inside a specific workspace tenant.
        Auto-provisions a default board canvas using a database transaction.
        """
        try:
            # 1. Create the project
            project = Project(
                workspaceId=workspace_id,
                name=name,
                description=description
            )
            db.add(project)
            db.flush()  # Populate project.id to bind default board
            
            # 2. Provision default initial Board (the design canvas)
            default_board = Board(
                projectId=project.id,
                name="Main Board",
                canvasData={
                    "layers": [],
                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                    "assets": []
                },
                version=1
            )
            db.add(default_board)
            db.commit()
            
            db.refresh(project)
            return project
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def list_projects(db: Session, workspace_id: str) -> List[Project]:
        """
        List all projects within a specific workspace tenant, including nested boards.
        """
        statement = select(Project).where(Project.workspaceId == workspace_id).order_by(Project.createdAt.desc())
        return db.exec(statement).all()

    @staticmethod
    def get_project_by_id(db: Session, workspace_id: str, project_id: str) -> Project:
        """
        Retrieve a single project by ID, strictly isolating it within the active tenant workspace.
        """
        statement = select(Project).where(Project.id == project_id, Project.workspaceId == workspace_id)
        project = db.exec(statement).first()
        if not project:
            raise NotFoundException("Project not found in this workspace tenant")
        return project

    @staticmethod
    def update_project(db: Session, workspace_id: str, project_id: str, name: Optional[str] = None, description: Optional[str] = None) -> Project:
        """
        Update a project's parameters within the tenant isolation boundaries.
        """
        project = ProjectService.get_project_by_id(db, workspace_id, project_id)
        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete_project(db: Session, workspace_id: str, project_id: str) -> Project:
        """
        Delete a project and cascade purge all of its child boards, assets, and comments.
        """
        project = ProjectService.get_project_by_id(db, workspace_id, project_id)
        db.delete(project)
        db.commit()
        return project

from fastapi import APIRouter, Depends, Path
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.auth.dependencies import require_tenant, TenantContext, get_current_user
from app.models import Message, User
from app.errors import NotFoundException, ForbiddenException

router = APIRouter()

# --- Request Schemas ---

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Message content")
    replyToId: Optional[str] = Field(default=None, description="Optional ID of the message being replied to")


# --- Response Helpers ---

def _serialize_message(msg: Message, author: User) -> dict:
    """Serialize a Message model into a JSON-safe response dict."""
    return {
        "id": msg.id,
        "workspaceId": msg.workspaceId,
        "channel": msg.channel,
        "content": msg.content,
        "replyToId": msg.replyToId,
        "createdAt": msg.createdAt.isoformat() + "Z",
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

@router.get("/{workspaceId}/{channel}")
async def list_messages(
    workspaceId: str = Path(..., description="Target workspace ID"),
    channel: str = Path(..., description="Department channel slug, e.g. 'operations'"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
):
    """
    Fetches all messages in a specific department channel for the active workspace.
    Messages are returned in chronological order (oldest first).
    """
    statement = (
        select(Message)
        .where(Message.workspaceId == tenant.workspace_id, Message.channel == channel)
        .order_by(Message.createdAt)
    )
    messages = db.exec(statement).all()

    # Batch-load authors
    result = []
    for msg in messages:
        author = db.get(User, msg.userId)
        if author:
            result.append(_serialize_message(msg, author))

    return {"success": True, "data": result}


@router.post("/{workspaceId}/{channel}")
async def send_message(
    payload: SendMessageRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    channel: str = Path(..., description="Department channel slug"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
):
    """
    Sends a new message to a department channel within the active workspace.
    Supports optional reply threading via replyToId.
    """
    # Validate reply target exists if provided
    if payload.replyToId:
        reply_target = db.get(Message, payload.replyToId)
        if not reply_target:
            raise NotFoundException("Reply target message not found")

    message = Message(
        workspaceId=tenant.workspace_id,
        channel=channel,
        userId=current_user.id,
        content=payload.content,
        replyToId=payload.replyToId,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return {
        "success": True,
        "message": "Message sent successfully",
        "data": _serialize_message(message, current_user)
    }


@router.delete("/{workspaceId}/{channel}/{messageId}")
async def delete_message(
    workspaceId: str = Path(..., description="Target workspace ID"),
    channel: str = Path(..., description="Department channel slug"),
    messageId: str = Path(..., description="Message ID to delete"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes a message. Users can only delete their own messages.
    Admins can delete any message in their workspace.
    """
    from app.models import Role
    message = db.get(Message, messageId)
    if not message or message.workspaceId != tenant.workspace_id:
        raise NotFoundException("Message not found")

    # Only the author, an admin, or the owner can delete the message
    if message.userId != current_user.id and current_user.role not in (Role.ADMIN, Role.OWNER):
        raise ForbiddenException("You can only delete your own messages")

    db.delete(message)
    db.commit()

    return {"success": True, "message": "Message deleted successfully", "data": {"id": messageId}}

from pydantic import BaseModel, Field
from datetime import datetime


class FriendRequestCreate(BaseModel):
    addressee_id: str


class FriendshipOut(BaseModel):
    id: str
    requester_id: str
    addressee_id: str
    status: str
    created_at: datetime
    updated_at: datetime


class FriendOut(BaseModel):
    id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    total_xp: int
    top_gauge: int | None = None
    top_sector: str | None = None


class FriendRequestOut(BaseModel):
    friendship_id: str
    user: "FriendOut"
    created_at: datetime


class ReactionCount(BaseModel):
    emoji: str
    count: int


class ActivityFeedItem(BaseModel):
    id: str
    user_id: str
    username: str | None = None
    avatar_url: str | None = None
    activity_type: str
    metadata: dict
    created_at: datetime
    reactions: list[ReactionCount] = []
    my_reaction: str | None = None


class ReactionCreate(BaseModel):
    emoji: str = Field(..., pattern=r'^(fire|brain|clap|rocket|flex|bullseye)$')


class InviteLinkOut(BaseModel):
    link: str
    username: str

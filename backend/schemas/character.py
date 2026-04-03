import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CharacterCreate(BaseModel):
    name: str
    char_class: str
    level: int = 1
    max_hp: int


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    char_class: Optional[str] = None
    level: Optional[int] = None
    max_hp: Optional[int] = None
    current_hp: Optional[int] = None
    status: Optional[str] = None


class CharacterResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    char_class: str
    level: int
    max_hp: int
    current_hp: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

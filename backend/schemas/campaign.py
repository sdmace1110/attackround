import uuid
from datetime import datetime

from pydantic import BaseModel


class CampaignCreate(BaseModel):
    name: str


class CampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    dm_user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}

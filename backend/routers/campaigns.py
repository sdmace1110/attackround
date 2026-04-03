import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.campaign import Campaign
from models.character import Character
from schemas.campaign import CampaignCreate, CampaignResponse
from schemas.character import CharacterCreate, CharacterResponse, CharacterUpdate
from utils.auth import get_current_dm

router = APIRouter(tags=["campaigns"])


@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> list[CampaignResponse]:
    result = await db.execute(
        select(Campaign).where(Campaign.dm_user_id == dm_id).order_by(Campaign.created_at)
    )
    return [CampaignResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> CampaignResponse:
    campaign = Campaign(name=payload.name, dm_user_id=dm_id)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}/characters", response_model=list[CharacterResponse])
async def list_characters(
    campaign_id: uuid.UUID,
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> list[CharacterResponse]:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.dm_user_id == dm_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    result = await db.execute(
        select(Character)
        .where(Character.campaign_id == campaign_id)
        .order_by(Character.created_at)
    )
    return [CharacterResponse.model_validate(c) for c in result.scalars().all()]


@router.post(
    "/campaigns/{campaign_id}/characters",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_character(
    campaign_id: uuid.UUID,
    payload: CharacterCreate,
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> CharacterResponse:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.dm_user_id == dm_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    character = Character(
        campaign_id=campaign_id,
        name=payload.name,
        char_class=payload.char_class,
        level=payload.level,
        max_hp=payload.max_hp,
        current_hp=payload.max_hp,  # new characters start at full HP
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return CharacterResponse.model_validate(character)


@router.patch("/characters/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: uuid.UUID,
    payload: CharacterUpdate,
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> CharacterResponse:
    result = await db.execute(
        select(Character)
        .join(Campaign, Character.campaign_id == Campaign.id)
        .where(Character.id == character_id, Campaign.dm_user_id == dm_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, field, value)

    await db.commit()
    await db.refresh(character)
    return CharacterResponse.model_validate(character)


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: uuid.UUID,
    dm_id: Annotated[uuid.UUID, Depends(get_current_dm)],
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Character)
        .join(Campaign, Character.campaign_id == Campaign.id)
        .where(Character.id == character_id, Campaign.dm_user_id == dm_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    await db.delete(character)
    await db.commit()

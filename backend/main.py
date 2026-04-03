from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.campaigns import router as campaigns_router

app = FastAPI(title="D&D Combat Tracker API")

app.include_router(auth_router)
app.include_router(campaigns_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
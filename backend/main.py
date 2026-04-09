from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from database import init_db, get_db, create_default_user, SessionLocal, run_migrations
from routes import meals, templates, progress, stats, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    
    # Run migrations to add any new columns
    run_migrations()
    
    # Create default user
    db = SessionLocal()
    try:
        create_default_user(db)
    finally:
        db.close()
    
    # Only create local upload dirs when not running on Vercel
    if not os.getenv("VERCEL"):
        os.makedirs("uploads/meals", exist_ok=True)
        os.makedirs("uploads/progress", exist_ok=True)
    
    yield


app = FastAPI(
    title="Calorie Coach API",
    description="AI-powered calorie tracking with gamification",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for local dev only (Vercel uses Blob storage)
if not os.getenv("VERCEL"):
    try:
        app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    except RuntimeError:
        pass  # uploads dir not yet created on first start

# Include routers
app.include_router(meals.router, prefix="/api/meals", tags=["Meals"])
app.include_router(templates.router, prefix="/api/templates", tags=["Meal Templates"])
app.include_router(progress.router, prefix="/api/progress", tags=["Progress Tracking"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "app": "Calorie Coach API"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

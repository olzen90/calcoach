from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
import os

from database import get_db, User, MealEntry, MealTemplate, ProgressPhoto, ExerciseConfig
from services.image_service import delete_image

router = APIRouter()


class UserProfile(BaseModel):
    name: str
    age: Optional[int]
    weight_kg: Optional[float]
    gender: Optional[str]


class GoalSettings(BaseModel):
    daily_calorie_goal: int
    calorie_focus_mode: str  # "daily" or "weekly"
    protein_goal_g: int
    carbs_goal_g: int
    fat_goal_g: int
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300


class AISettings(BaseModel):
    base_prompt: Optional[str]


class TDEECalculation(BaseModel):
    age: int
    weight_kg: float
    height_cm: float
    gender: str  # "male" or "female"
    activity_level: str  # "sedentary", "light", "moderate", "active", "very_active"
    goal: str  # "cut", "maintain", "bulk"


class TDEEResult(BaseModel):
    bmr: int
    tdee: int
    recommended_calories: int
    recommended_protein_g: int
    recommended_carbs_g: int
    recommended_fat_g: int
    recommended_sugar_g: int
    recommended_fiber_g: int
    recommended_sodium_mg: int


class FullSettings(BaseModel):
    id: int
    name: str
    age: Optional[int]
    weight_kg: Optional[float]
    gender: Optional[str]
    daily_calorie_goal: int
    calorie_focus_mode: str
    protein_goal_g: int
    carbs_goal_g: int
    fat_goal_g: int
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300
    base_prompt: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StorageInfo(BaseModel):
    meal_photos_count: int
    meal_photos_size_mb: float
    progress_photos_count: int
    progress_photos_size_mb: float
    total_size_mb: float


def get_user(db: Session) -> User:
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/", response_model=FullSettings)
async def get_settings(db: Session = Depends(get_db)):
    """Get all user settings."""
    user = get_user(db)
    user_dict = {
        "id": user.id,
        "name": user.name,
        "age": user.age,
        "weight_kg": user.weight_kg,
        "gender": user.gender,
        "daily_calorie_goal": user.daily_calorie_goal,
        "calorie_focus_mode": user.calorie_focus_mode,
        "protein_goal_g": user.protein_goal_g,
        "carbs_goal_g": user.carbs_goal_g,
        "fat_goal_g": user.fat_goal_g,
        "sugar_goal_g": user.sugar_goal_g or 50,
        "fiber_goal_g": user.fiber_goal_g or 30,
        "sodium_goal_mg": user.sodium_goal_mg or 2300,
        "base_prompt": user.base_prompt,
        "created_at": user.created_at,
    }
    return FullSettings(**user_dict)


@router.put("/profile", response_model=FullSettings)
async def update_profile(profile: UserProfile, db: Session = Depends(get_db)):
    """Update user profile settings."""
    user = get_user(db)
    
    user.name = profile.name
    if profile.age is not None:
        user.age = profile.age
    if profile.weight_kg is not None:
        user.weight_kg = profile.weight_kg
    if profile.gender is not None:
        user.gender = profile.gender
    
    db.commit()
    db.refresh(user)
    
    return await get_settings(db)


@router.put("/goals", response_model=FullSettings)
async def update_goals(goals: GoalSettings, db: Session = Depends(get_db)):
    """Update calorie and macro goals."""
    user = get_user(db)
    
    if goals.calorie_focus_mode not in ["daily", "weekly"]:
        raise HTTPException(status_code=400, detail="Invalid calorie focus mode")
    
    user.daily_calorie_goal = goals.daily_calorie_goal
    user.calorie_focus_mode = goals.calorie_focus_mode
    user.protein_goal_g = goals.protein_goal_g
    user.carbs_goal_g = goals.carbs_goal_g
    user.fat_goal_g = goals.fat_goal_g
    user.sugar_goal_g = goals.sugar_goal_g
    user.fiber_goal_g = goals.fiber_goal_g
    user.sodium_goal_mg = goals.sodium_goal_mg
    
    db.commit()
    db.refresh(user)
    
    return await get_settings(db)


@router.put("/ai", response_model=FullSettings)
async def update_ai_settings(settings: AISettings, db: Session = Depends(get_db)):
    """Update AI coach settings."""
    user = get_user(db)

    if settings.base_prompt is not None:
        user.base_prompt = settings.base_prompt

    db.commit()
    db.refresh(user)

    return await get_settings(db)


@router.post("/calculate-tdee", response_model=TDEEResult)
async def calculate_tdee(data: TDEECalculation):
    """Calculate TDEE and recommended macros based on user data."""
    
    # Mifflin-St Jeor Equation for BMR
    if data.gender.lower() == "male":
        bmr = (10 * data.weight_kg) + (6.25 * data.height_cm) - (5 * data.age) + 5
    else:
        bmr = (10 * data.weight_kg) + (6.25 * data.height_cm) - (5 * data.age) - 161
    
    # Activity multipliers
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    multiplier = activity_multipliers.get(data.activity_level, 1.55)
    tdee = int(bmr * multiplier)
    
    # Adjust for goal
    if data.goal == "cut":
        recommended_calories = tdee - 500  # 500 cal deficit
    elif data.goal == "bulk":
        recommended_calories = tdee + 300  # 300 cal surplus
    else:
        recommended_calories = tdee
    
    # Calculate macros
    # Protein: 1g per lb of body weight (for recomp/muscle building)
    protein_g = int(data.weight_kg * 2.2)  # Convert kg to lbs, then 1g per lb
    
    # Fat: 25% of calories
    fat_calories = recommended_calories * 0.25
    fat_g = int(fat_calories / 9)
    
    # Carbs: Remaining calories
    protein_calories = protein_g * 4
    carb_calories = recommended_calories - protein_calories - fat_calories
    carbs_g = int(carb_calories / 4)
    
    # Sugar: ~10% of total calories (WHO recommendation)
    sugar_calories = recommended_calories * 0.10
    sugar_g = int(sugar_calories / 4)  # 4 cal per gram
    
    # Fiber: 14g per 1000 calories (general guideline)
    fiber_g = int((recommended_calories / 1000) * 14)
    fiber_g = max(fiber_g, 25)  # Minimum 25g
    
    # Sodium: 2300mg is the general limit, lower for cut
    if data.goal == "cut":
        sodium_mg = 2000  # Slightly lower for water retention
    else:
        sodium_mg = 2300
    
    return TDEEResult(
        bmr=int(bmr),
        tdee=tdee,
        recommended_calories=recommended_calories,
        recommended_protein_g=protein_g,
        recommended_carbs_g=max(carbs_g, 50),  # Minimum 50g carbs
        recommended_fat_g=fat_g,
        recommended_sugar_g=sugar_g,
        recommended_fiber_g=fiber_g,
        recommended_sodium_mg=sodium_mg
    )


@router.get("/storage", response_model=StorageInfo)
async def get_storage_info(db: Session = Depends(get_db)):
    """Get storage usage information."""
    user = get_user(db)

    meal_count = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.image_path.isnot(None)
    ).count()

    progress_count = db.query(ProgressPhoto).filter(
        ProgressPhoto.user_id == user.id
    ).count()

    return StorageInfo(
        meal_photos_count=meal_count,
        meal_photos_size_mb=0.0,
        progress_photos_count=progress_count,
        progress_photos_size_mb=0.0,
        total_size_mb=0.0,
    )


@router.delete("/photos/meals")
async def clear_meal_photos(
    older_than_days: int = 30,
    db: Session = Depends(get_db)
):
    """Delete meal photos older than specified days to save storage."""
    user = get_user(db)
    
    from datetime import date, timedelta
    cutoff_date = date.today() - timedelta(days=older_than_days)
    
    # Get meals with photos older than cutoff
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date < cutoff_date,
        MealEntry.image_path.isnot(None)
    ).all()
    
    deleted_count = 0
    for meal in meals:
        if meal.image_path:
            await delete_image(meal.image_path)
            deleted_count += 1
        meal.image_path = None
    
    db.commit()
    
    return {
        "status": "completed",
        "deleted_count": deleted_count,
        "cutoff_date": str(cutoff_date)
    }


@router.delete("/photos/progress")
async def clear_progress_photos(
    older_than_days: int = 90,
    db: Session = Depends(get_db)
):
    """Delete progress photos older than specified days to save storage."""
    user = get_user(db)
    
    from datetime import date, timedelta
    cutoff_date = date.today() - timedelta(days=older_than_days)
    
    photos = db.query(ProgressPhoto).filter(
        ProgressPhoto.user_id == user.id,
        ProgressPhoto.date < cutoff_date
    ).all()
    
    deleted_count = 0
    for photo in photos:
        for path in [photo.front_image_path, photo.side_image_path]:
            if path:
                await delete_image(path)
                deleted_count += 1
        db.delete(photo)
    
    db.commit()
    
    return {
        "status": "completed",
        "deleted_count": deleted_count,
        "cutoff_date": str(cutoff_date)
    }


@router.post("/reset-base-prompt")
async def reset_base_prompt(db: Session = Depends(get_db)):
    """Reset the AI base prompt to default."""
    user = get_user(db)
    
    # Only the personality/behavior part - JSON format is hardcoded in the AI service
    default_prompt = """You are a helpful and encouraging nutrition coach. When analyzing food, be supportive and give helpful tips in your notes. Be encouraging and supportive!"""
    
    user.base_prompt = default_prompt
    db.commit()
    
    return {"status": "reset", "base_prompt": default_prompt}


@router.get("/dashboard")
async def get_settings_dashboard(db: Session = Depends(get_db)):
    """Single endpoint for SettingsView: settings + exercises + storage + favorites."""
    user = get_user(db)

    settings_data = await get_settings(db)
    storage_data = await get_storage_info(db)

    exercises_list = db.query(ExerciseConfig).filter(
        ExerciseConfig.user_id == user.id,
        ExerciseConfig.is_active == True
    ).order_by(ExerciseConfig.display_order).all()

    favorites_list = db.query(MealTemplate).filter(
        MealTemplate.user_id == user.id
    ).order_by(MealTemplate.use_count.desc()).all()

    return {
        "settings": settings_data,
        "exercises": [{"id": e.id, "name": e.name, "display_order": e.display_order, "is_active": e.is_active} for e in exercises_list],
        "storage": storage_data,
        "favorites": [{
            "id": f.id, "name": f.name, "description": f.description,
            "calories": f.calories, "protein_g": f.protein_g, "carbs_g": f.carbs_g,
            "fat_g": f.fat_g, "sugar_g": f.sugar_g or 0, "fiber_g": f.fiber_g or 0,
            "sodium_mg": f.sodium_mg or 0, "breakdown": f.breakdown, "emoji": f.emoji,
            "use_count": f.use_count, "auto_log": f.auto_log, "created_at": f.created_at.isoformat()
        } for f in favorites_list]
    }

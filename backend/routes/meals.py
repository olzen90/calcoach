from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, time
from pydantic import BaseModel
import os
import json

from database import get_db, MealEntry, User, DailyStats, MealTemplate, WeightLog, MeasurementLog, LiftLog, ExerciseConfig, ChatMessage, AutoLogHistory
from services.openai_service import analyze_food
from services.image_service import save_image

router = APIRouter()


class MealCreate(BaseModel):
    description: str
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None
    sugar_g: Optional[int] = None
    fiber_g: Optional[int] = None
    sodium_mg: Optional[int] = None


class MealUpdate(BaseModel):
    description: Optional[str] = None
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    sugar_g: Optional[int] = None
    fiber_g: Optional[int] = None
    sodium_mg: Optional[int] = None
    fat_g: Optional[int] = None
    hunger_rating: Optional[int] = None


class MealResponse(BaseModel):
    id: int
    date: date
    time: Optional[time]
    description: Optional[str]
    original_description: Optional[str] = None
    image_path: Optional[str]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    sugar_g: float = 0
    fiber_g: float = 0
    sodium_mg: float = 0
    emoji: Optional[str] = "🍽️"
    ai_response: Optional[str]
    breakdown: Optional[str] = None  # JSON string with AI's reasoning
    hunger_rating: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DayTotals(BaseModel):
    date: date
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_sugar_g: float = 0
    total_fiber_g: float = 0
    total_sodium_mg: float = 0
    calorie_goal: int
    protein_goal_g: int
    carbs_goal_g: int
    fat_goal_g: int
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300
    calories_remaining: float
    protein_remaining_g: float
    meals: List[MealResponse]


def get_user(db: Session) -> User:
    """Get the default user (single-user app)."""
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def update_daily_stats(db: Session, user_id: int, meal_date: date):
    """Recalculate daily stats after meal changes."""
    # Get all meals for the day
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user_id,
        MealEntry.date == meal_date
    ).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    # Get or create daily stats
    stats = db.query(DailyStats).filter(
        DailyStats.user_id == user_id,
        DailyStats.date == meal_date
    ).first()
    
    if not stats:
        stats = DailyStats(user_id=user_id, date=meal_date)
        db.add(stats)
    
    stats.total_calories = total_calories
    stats.total_protein_g = total_protein
    stats.total_carbs_g = total_carbs
    stats.total_fat_g = total_fat
    stats.total_sugar_g = total_sugar
    stats.total_fiber_g = total_fiber
    stats.total_sodium_mg = total_sodium
    
    # Check streak conditions
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        # Tracking streak: logged >= 50% of daily goal
        stats.tracking_streak_maintained = total_calories >= (user.daily_calorie_goal * 0.5)
        
        # Goal streak: stayed within 110% of daily goal
        stats.goal_streak_maintained = total_calories <= (user.daily_calorie_goal * 1.1)
    
    db.commit()


@router.get("/today", response_model=DayTotals)
async def get_today_meals(db: Session = Depends(get_db)):
    """Get all meals and totals for today."""
    user = get_user(db)
    today = date.today()
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == today
    ).order_by(MealEntry.created_at.desc()).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    return DayTotals(
        date=today,
        total_calories=total_calories,
        total_protein_g=total_protein,
        total_carbs_g=total_carbs,
        total_fat_g=total_fat,
        total_sugar_g=total_sugar,
        total_fiber_g=total_fiber,
        total_sodium_mg=total_sodium,
        calorie_goal=user.daily_calorie_goal,
        protein_goal_g=user.protein_goal_g,
        carbs_goal_g=user.carbs_goal_g,
        fat_goal_g=user.fat_goal_g,
        sugar_goal_g=user.sugar_goal_g or 50,
        fiber_goal_g=user.fiber_goal_g or 30,
        sodium_goal_mg=user.sodium_goal_mg or 2300,
        calories_remaining=max(0, user.daily_calorie_goal - total_calories),
        protein_remaining_g=max(0, user.protein_goal_g - total_protein),
        meals=[MealResponse.model_validate(m) for m in meals]
    )


@router.get("/date/{meal_date}", response_model=DayTotals)
async def get_meals_by_date(meal_date: date, db: Session = Depends(get_db)):
    """Get all meals and totals for a specific date."""
    user = get_user(db)
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == meal_date
    ).order_by(MealEntry.created_at.desc()).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    return DayTotals(
        date=meal_date,
        total_calories=total_calories,
        total_protein_g=total_protein,
        total_carbs_g=total_carbs,
        total_fat_g=total_fat,
        total_sugar_g=total_sugar,
        total_fiber_g=total_fiber,
        total_sodium_mg=total_sodium,
        calorie_goal=user.daily_calorie_goal,
        protein_goal_g=user.protein_goal_g,
        carbs_goal_g=user.carbs_goal_g,
        fat_goal_g=user.fat_goal_g,
        sugar_goal_g=user.sugar_goal_g or 50,
        fiber_goal_g=user.fiber_goal_g or 30,
        sodium_goal_mg=user.sodium_goal_mg or 2300,
        calories_remaining=max(0, user.daily_calorie_goal - total_calories),
        protein_remaining_g=max(0, user.protein_goal_g - total_protein),
        meals=[MealResponse.model_validate(m) for m in meals]
    )


@router.post("/analyze")
async def analyze_and_log_meal(
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    preview: bool = Form(False),
    local_time: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Analyze food with AI and optionally log the meal.
    
    If preview=true, only returns the analysis without saving to database.
    local_time: User's local time in HH:MM format (from browser).
    """
    user = get_user(db)
    
    if not user.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")
    
    # Save image if provided
    image_path = None
    if image:
        image_path = await save_image(image, "meals")
    
    # Fetch user's saved favorites to include in AI context (including breakdown)
    templates = db.query(MealTemplate).filter(MealTemplate.user_id == user.id).all()
    favorites = []
    for t in templates:
        fav = {
            "name": t.name,
            "calories": t.calories,
            "protein_g": t.protein_g,
            "carbs_g": t.carbs_g,
            "fat_g": t.fat_g,
            "sugar_g": t.sugar_g or 0,
            "fiber_g": t.fiber_g or 0,
            "sodium_mg": t.sodium_mg or 0
        }
        # Include breakdown if available - AI should use this exact breakdown
        if t.breakdown:
            try:
                fav["breakdown"] = json.loads(t.breakdown)
            except:
                pass
        favorites.append(fav)
    
    # Fetch today's meals for editing context
    today = date.today()
    todays_meal_entries = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == today
    ).order_by(MealEntry.created_at.desc()).all()
    
    todays_meals = []
    for m in todays_meal_entries:
        meal_dict = {
            "id": m.id,
            "description": m.description,
            "original_description": m.original_description,
            "calories": m.calories,
            "protein_g": m.protein_g,
            "carbs_g": m.carbs_g,
            "fat_g": m.fat_g,
            "sugar_g": m.sugar_g or 0,
            "fiber_g": m.fiber_g or 0,
            "sodium_mg": m.sodium_mg or 0
        }
        if m.breakdown:
            try:
                meal_dict["breakdown"] = json.loads(m.breakdown)
            except Exception:
                pass
        todays_meals.append(meal_dict)
    
    # Calculate today's totals for AI context
    todays_totals = {
        'calories': sum(m['calories'] for m in todays_meals),
        'protein_g': sum(m['protein_g'] for m in todays_meals),
        'carbs_g': sum(m['carbs_g'] for m in todays_meals),
        'fat_g': sum(m['fat_g'] for m in todays_meals),
    }
    
    # Analyze with AI
    try:
        analysis = await analyze_food(
            api_key=user.openai_api_key,
            description=description,
            image_path=image_path,
            base_prompt=user.base_prompt,
            calorie_goal=user.daily_calorie_goal,
            protein_goal=user.protein_goal_g,
            carbs_goal=user.carbs_goal_g,
            fat_goal=user.fat_goal_g,
            favorites=favorites,
            todays_meals=todays_meals,
            todays_totals=todays_totals
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
    
    entry_type = analysis.get("entry_type", "meal")
    
    # Handle different entry types
    if entry_type == "weight":
        # Log weight
        weight_log = WeightLog(
            user_id=user.id,
            date=date.today(),
            weight_kg=analysis.get("weight_kg", 0)
        )
        db.add(weight_log)
        db.commit()
        db.refresh(weight_log)
        
        return {
            "entry_type": "weight",
            "entry": {
                "id": weight_log.id,
                "weight_kg": weight_log.weight_kg,
                "date": str(weight_log.date)
            },
            "analysis": analysis
        }
    
    elif entry_type == "measurement":
        # Log measurement
        measurement_log = MeasurementLog(
            user_id=user.id,
            date=date.today(),
            waist_cm=analysis.get("waist_cm", 0)
        )
        db.add(measurement_log)
        db.commit()
        db.refresh(measurement_log)
        
        return {
            "entry_type": "measurement",
            "entry": {
                "id": measurement_log.id,
                "waist_cm": measurement_log.waist_cm,
                "date": str(measurement_log.date)
            },
            "analysis": analysis
        }
    
    elif entry_type == "lift":
        # Find or create exercise
        exercise_name = analysis.get("exercise_name", "").strip()
        exercise = db.query(ExerciseConfig).filter(
            ExerciseConfig.user_id == user.id,
            ExerciseConfig.name.ilike(f"%{exercise_name}%")
        ).first()
        
        if not exercise:
            # Create new exercise config
            exercise = ExerciseConfig(
                user_id=user.id,
                name=exercise_name.title(),
                is_active=True
            )
            db.add(exercise)
            db.commit()
            db.refresh(exercise)
        
        # Log the lift
        lift_log = LiftLog(
            user_id=user.id,
            exercise_id=exercise.id,
            date=date.today(),
            weight_kg=analysis.get("weight_kg", 0),
            reps=analysis.get("reps", 0)
        )
        db.add(lift_log)
        db.commit()
        db.refresh(lift_log)
        
        return {
            "entry_type": "lift",
            "entry": {
                "id": lift_log.id,
                "exercise_name": exercise.name,
                "weight_kg": lift_log.weight_kg,
                "reps": lift_log.reps,
                "date": str(lift_log.date)
            },
            "analysis": analysis
        }
    
    elif entry_type == "edit":
        # Edit an existing meal
        meal_id = analysis.get("meal_id", 0)
        updates = analysis.get("updates", {})
        
        meal = db.query(MealEntry).filter(
            MealEntry.id == meal_id,
            MealEntry.user_id == user.id,
            MealEntry.date == today
        ).first()
        
        if not meal:
            raise HTTPException(status_code=404, detail=f"Meal with ID {meal_id} not found in today's meals")
        
        # Apply updates
        if "calories" in updates and updates["calories"] is not None:
            meal.calories = int(updates["calories"])
        if "protein_g" in updates and updates["protein_g"] is not None:
            meal.protein_g = int(updates["protein_g"])
        if "carbs_g" in updates and updates["carbs_g"] is not None:
            meal.carbs_g = int(updates["carbs_g"])
        if "fat_g" in updates and updates["fat_g"] is not None:
            meal.fat_g = int(updates["fat_g"])
        if "sugar_g" in updates and updates["sugar_g"] is not None:
            meal.sugar_g = int(updates["sugar_g"])
        if "fiber_g" in updates and updates["fiber_g"] is not None:
            meal.fiber_g = int(updates["fiber_g"])
        if "sodium_mg" in updates and updates["sodium_mg"] is not None:
            meal.sodium_mg = int(updates["sodium_mg"])
        if "description" in updates and updates["description"]:
            meal.description = updates["description"]
        
        # Update breakdown if provided
        new_breakdown = analysis.get("breakdown", [])
        if new_breakdown:
            meal.breakdown = json.dumps(new_breakdown)
        
        db.commit()
        db.refresh(meal)
        
        # Update daily stats
        update_daily_stats(db, user.id, today)
        
        return {
            "entry_type": "edit",
            "meal": MealResponse.model_validate(meal),
            "analysis": analysis
        }
    
    elif entry_type == "merge":
        keep_meal_id = analysis.get("keep_meal_id", 0)
        delete_meal_ids = analysis.get("delete_meal_ids", [])
        updates = analysis.get("updates", {})

        keep_meal = db.query(MealEntry).filter(
            MealEntry.id == keep_meal_id,
            MealEntry.user_id == user.id,
            MealEntry.date == today
        ).first()

        if not keep_meal:
            raise HTTPException(status_code=404, detail=f"Meal with ID {keep_meal_id} not found in today's meals")

        # Apply combined nutrient updates
        if "calories" in updates and updates["calories"] is not None:
            keep_meal.calories = int(updates["calories"])
        if "protein_g" in updates and updates["protein_g"] is not None:
            keep_meal.protein_g = float(updates["protein_g"])
        if "carbs_g" in updates and updates["carbs_g"] is not None:
            keep_meal.carbs_g = float(updates["carbs_g"])
        if "fat_g" in updates and updates["fat_g"] is not None:
            keep_meal.fat_g = float(updates["fat_g"])
        if "sugar_g" in updates and updates["sugar_g"] is not None:
            keep_meal.sugar_g = float(updates["sugar_g"])
        if "fiber_g" in updates and updates["fiber_g"] is not None:
            keep_meal.fiber_g = float(updates["fiber_g"])
        if "sodium_mg" in updates and updates["sodium_mg"] is not None:
            keep_meal.sodium_mg = int(updates["sodium_mg"])
        if "description" in updates and updates["description"]:
            keep_meal.description = updates["description"]

        new_breakdown = analysis.get("breakdown", [])
        if new_breakdown:
            keep_meal.breakdown = json.dumps(new_breakdown)

        # Delete the meals that were merged into the kept one
        for del_id in delete_meal_ids:
            del_meal = db.query(MealEntry).filter(
                MealEntry.id == del_id,
                MealEntry.user_id == user.id,
                MealEntry.date == today
            ).first()
            if del_meal:
                if del_meal.image_path and os.path.exists(del_meal.image_path):
                    os.remove(del_meal.image_path)
                db.delete(del_meal)

        db.commit()
        db.refresh(keep_meal)

        update_daily_stats(db, user.id, today)

        return {
            "entry_type": "merge",
            "meal": MealResponse.model_validate(keep_meal),
            "deleted_ids": delete_meal_ids,
            "analysis": analysis
        }

    elif entry_type == "question":
        # Save user's question
        user_message = ChatMessage(
            user_id=user.id,
            date=date.today(),
            role="user",
            content=description
        )
        db.add(user_message)
        
        # Save AI's answer
        ai_message = ChatMessage(
            user_id=user.id,
            date=date.today(),
            role="assistant",
            content=analysis.get("answer", "I'm not sure how to answer that.")
        )
        db.add(ai_message)
        db.commit()
        db.refresh(user_message)
        db.refresh(ai_message)
        
        return {
            "entry_type": "question",
            "user_message": {
                "id": user_message.id,
                "role": "user",
                "content": user_message.content,
                "created_at": user_message.created_at.isoformat()
            },
            "assistant_message": {
                "id": ai_message.id,
                "role": "assistant",
                "content": ai_message.content,
                "created_at": ai_message.created_at.isoformat()
            },
            "analysis": analysis
        }
    
    else:
        # Default: meal entry
        # Use AI-generated food_name as the description (cleaner headline)
        # Store original user input separately for reference
        breakdown = analysis.get("breakdown", [])
        breakdown_json = json.dumps(breakdown) if breakdown else None
        
        # If preview mode, return analysis without saving
        if preview:
            return {
                "entry_type": "meal",
                "preview": True,
                "meal": {
                    "description": analysis.get("food_name", description),
                    "original_description": description,
                    "image_path": image_path,
                    "calories": analysis.get("calories", 0),
                    "protein_g": analysis.get("protein_g", 0),
                    "carbs_g": analysis.get("carbs_g", 0),
                    "fat_g": analysis.get("fat_g", 0),
                    "sugar_g": analysis.get("sugar_g", 0),
                    "fiber_g": analysis.get("fiber_g", 0),
                    "sodium_mg": analysis.get("sodium_mg", 0),
                    "emoji": analysis.get("emoji", "🍽️"),
                    "breakdown": breakdown
                },
                "analysis": analysis
            }
        
        # Failsafe: Don't log meals with 0 calories AND 0 protein (likely AI parse failure)
        calories = analysis.get("calories", 0)
        protein = analysis.get("protein_g", 0)
        if calories == 0 and protein == 0:
            raise HTTPException(
                status_code=422, 
                detail="Could not analyze this meal. The AI returned 0 calories and 0 protein. Please try rephrasing or add more detail about what you ate."
            )
        
        # Parse time: priority is AI-extracted time > user's local time > server time
        meal_time = datetime.now().time()  # Fallback to server time
        
        # First, try to use user's local time from browser (correct timezone)
        if local_time and isinstance(local_time, str):
            try:
                parsed = datetime.strptime(local_time, "%H:%M")
                meal_time = parsed.time()
            except ValueError:
                pass
        
        # If AI extracted a specific time from the description, use that instead
        ai_time = analysis.get("time")
        if ai_time and isinstance(ai_time, str):
            try:
                parsed = datetime.strptime(ai_time, "%H:%M")
                meal_time = parsed.time()
            except ValueError:
                pass  # Keep local_time or server time if parsing fails
        
        meal = MealEntry(
            user_id=user.id,
            date=date.today(),
            time=meal_time,
            description=analysis.get("food_name", description),
            original_description=description,
            image_path=image_path,
            calories=analysis.get("calories", 0),
            protein_g=analysis.get("protein_g", 0),
            carbs_g=analysis.get("carbs_g", 0),
            fat_g=analysis.get("fat_g", 0),
            sugar_g=analysis.get("sugar_g", 0),
            fiber_g=analysis.get("fiber_g", 0),
            sodium_mg=analysis.get("sodium_mg", 0),
            emoji=analysis.get("emoji", "🍽️"),
            ai_response=str(analysis),
            breakdown=breakdown_json
        )
        
        db.add(meal)
        db.commit()
        db.refresh(meal)
        
        # Update daily stats
        update_daily_stats(db, user.id, date.today())
        
        return {
            "entry_type": "meal",
            "meal": MealResponse.model_validate(meal),
            "analysis": analysis
        }


@router.post("/quick", response_model=MealResponse)
async def log_quick_meal(meal_data: MealCreate, db: Session = Depends(get_db)):
    """Log a meal without AI analysis (manual entry or from template)."""
    user = get_user(db)
    
    meal = MealEntry(
        user_id=user.id,
        date=date.today(),
        time=datetime.now().time(),
        description=meal_data.description,
        calories=meal_data.calories or 0,
        protein_g=meal_data.protein_g or 0,
        carbs_g=meal_data.carbs_g or 0,
        fat_g=meal_data.fat_g or 0,
        sugar_g=meal_data.sugar_g or 0,
        fiber_g=meal_data.fiber_g or 0,
        sodium_mg=meal_data.sodium_mg or 0
    )
    
    db.add(meal)
    db.commit()
    db.refresh(meal)
    
    # Update daily stats
    update_daily_stats(db, user.id, date.today())
    
    return meal


@router.put("/{meal_id}", response_model=MealResponse)
async def update_meal(meal_id: int, meal_data: MealUpdate, db: Session = Depends(get_db)):
    """Update an existing meal entry."""
    user = get_user(db)
    
    meal = db.query(MealEntry).filter(
        MealEntry.id == meal_id,
        MealEntry.user_id == user.id
    ).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    # Update fields
    if meal_data.description is not None:
        meal.description = meal_data.description
    if meal_data.calories is not None:
        meal.calories = meal_data.calories
    if meal_data.protein_g is not None:
        meal.protein_g = meal_data.protein_g
    if meal_data.carbs_g is not None:
        meal.carbs_g = meal_data.carbs_g
    if meal_data.fat_g is not None:
        meal.fat_g = meal_data.fat_g
    if meal_data.hunger_rating is not None:
        meal.hunger_rating = meal_data.hunger_rating
    
    db.commit()
    db.refresh(meal)
    
    # Update daily stats
    update_daily_stats(db, user.id, meal.date)
    
    return meal


@router.delete("/{meal_id}")
async def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    """Delete a meal entry."""
    user = get_user(db)
    
    meal = db.query(MealEntry).filter(
        MealEntry.id == meal_id,
        MealEntry.user_id == user.id
    ).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    meal_date = meal.date
    
    # Delete image file if exists
    if meal.image_path and os.path.exists(meal.image_path):
        os.remove(meal.image_path)
    
    db.delete(meal)
    db.commit()
    
    # Update daily stats
    update_daily_stats(db, user.id, meal_date)
    
    return {"status": "deleted"}


@router.post("/{meal_id}/hunger", response_model=MealResponse)
async def set_hunger_rating(meal_id: int, rating: int, db: Session = Depends(get_db)):
    """Set hunger rating for a meal (1=still hungry, 2=satisfied, 3=very full)."""
    if rating not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Rating must be 1, 2, or 3")
    
    user = get_user(db)
    
    meal = db.query(MealEntry).filter(
        MealEntry.id == meal_id,
        MealEntry.user_id == user.id
    ).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    meal.hunger_rating = rating
    db.commit()
    db.refresh(meal)
    
    return meal


@router.get("/feed/today")
async def get_today_feed(db: Session = Depends(get_db)):
    """Get combined feed of meals and chat messages for today, sorted by time."""
    user = get_user(db)
    today = date.today()
    
    # Get today's meals
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == today
    ).all()
    
    # Get today's chat messages
    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user.id,
        ChatMessage.date == today
    ).all()
    
    # Build combined feed
    feed = []
    
    for meal in meals:
        # Use meal's time field for sorting (when the meal was eaten)
        # Combine date + time into a datetime for proper sorting
        meal_datetime = datetime.combine(meal.date, meal.time) if meal.time else meal.created_at
        feed.append({
            "type": "meal",
            "id": meal.id,
            "sort_time": meal_datetime.isoformat(),
            "created_at": meal.created_at.isoformat(),
            "data": MealResponse.model_validate(meal).model_dump()
        })
    
    for msg in messages:
        feed.append({
            "type": "chat",
            "id": msg.id,
            "sort_time": msg.created_at.isoformat(),
            "created_at": msg.created_at.isoformat(),
            "data": {
                "role": msg.role,
                "content": msg.content
            }
        })
    
    # Sort by meal time (not created_at) so manually timestamped meals appear in correct order
    # Using ascending sort so oldest/earliest comes first in the array
    feed.sort(key=lambda x: (x["sort_time"], x["id"]))
    
    # Calculate totals
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    return {
        "date": str(today),
        "feed": feed,
        "totals": {
            "calories": total_calories,
            "protein_g": total_protein,
            "carbs_g": total_carbs,
            "fat_g": total_fat,
            "sugar_g": total_sugar,
            "fiber_g": total_fiber,
            "sodium_mg": total_sodium
        },
        "goals": {
            "calorie_goal": user.daily_calorie_goal,
            "protein_goal_g": user.protein_goal_g,
            "carbs_goal_g": user.carbs_goal_g,
            "fat_goal_g": user.fat_goal_g,
            "sugar_goal_g": user.sugar_goal_g or 50,
            "fiber_goal_g": user.fiber_goal_g or 30,
            "sodium_goal_mg": user.sodium_goal_mg or 2300
        }
    }


@router.post("/auto-log-favorites")
async def auto_log_favorites(db: Session = Depends(get_db)):
    """
    Auto-log all favorites marked with auto_log=True for today.
    Only creates entries if they haven't been auto-logged today yet.
    Uses AutoLogHistory to track processed templates (won't re-log if user deletes).
    """
    user = get_user(db)
    today = date.today()
    
    # Get all templates with auto_log enabled
    auto_log_templates = db.query(MealTemplate).filter(
        MealTemplate.user_id == user.id,
        MealTemplate.auto_log == True
    ).all()
    
    if not auto_log_templates:
        return {"status": "ok", "message": "No auto-log favorites configured", "logged": []}
    
    # Check which templates have already been processed today (via history table)
    # This persists even if user deletes the meal entry
    existing_history = db.query(AutoLogHistory).filter(
        AutoLogHistory.user_id == user.id,
        AutoLogHistory.date == today
    ).all()
    
    already_processed_ids = {h.template_id for h in existing_history}
    
    # Create meal entries for templates not yet processed
    logged_meals = []
    for template in auto_log_templates:
        if template.id in already_processed_ids:
            continue  # Skip if already processed today (even if meal was deleted)
        
        meal = MealEntry(
            user_id=user.id,
            date=today,
            time=datetime.now().time(),
            description=f"[Auto] {template.name}",
            original_description=template.name,
            calories=template.calories,
            protein_g=template.protein_g,
            carbs_g=template.carbs_g,
            fat_g=template.fat_g,
            sugar_g=template.sugar_g or 0,
            fiber_g=template.fiber_g or 0,
            sodium_mg=template.sodium_mg or 0,
            emoji=template.emoji or "🔄",
            ai_response=f"Auto-logged from saved favorite: {template.name}",
            breakdown=template.breakdown
        )
        db.add(meal)
        
        # Record in history so it won't be re-logged even if deleted
        history_entry = AutoLogHistory(
            user_id=user.id,
            template_id=template.id,
            date=today
        )
        db.add(history_entry)
        
        logged_meals.append({
            "name": template.name,
            "calories": template.calories,
            "protein_g": template.protein_g
        })
        
        # Increment use count
        template.use_count += 1
    
    if logged_meals:
        db.commit()
        # Update daily stats
        update_daily_stats(db, user.id, today)
    
    return {
        "status": "ok",
        "message": f"Auto-logged {len(logged_meals)} favorite(s)" if logged_meals else "All auto-log favorites already logged today",
        "logged": logged_meals
    }

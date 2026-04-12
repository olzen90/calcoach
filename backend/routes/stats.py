from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta
import json
import os
import openai
from collections import defaultdict
from pydantic import BaseModel

from database import get_db, User, MealEntry, DailyStats, StreakStatus, WeightLog
from services.openai_service import get_food_emoji

# Simple in-memory cache for health assessments: key -> result
_assessment_cache: dict = {}

router = APIRouter()


class DailySummary(BaseModel):
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
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300
    tracking_streak_maintained: bool
    goal_streak_maintained: bool


class WeeklySummary(BaseModel):
    week_start: date
    week_end: date
    total_calories: float
    avg_daily_calories: float
    total_protein_g: float
    avg_daily_protein_g: float
    total_carbs_g: float = 0
    avg_daily_carbs_g: float = 0
    total_fat_g: float = 0
    avg_daily_fat_g: float = 0
    total_sugar_g: float = 0
    avg_daily_sugar_g: float = 0
    total_fiber_g: float = 0
    avg_daily_fiber_g: float = 0
    total_sodium_mg: float = 0
    avg_daily_sodium_mg: float = 0
    days_tracked: int
    days_on_goal: int
    calorie_goal_weekly: int
    protein_goal_g: int = 150
    carbs_goal_g: int = 250
    fat_goal_g: int = 65
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300


class MonthlySummary(BaseModel):
    month: str
    year: int
    total_calories: float
    avg_daily_calories: float
    total_protein_g: float
    avg_daily_protein_g: float
    total_carbs_g: float = 0
    avg_daily_carbs_g: float = 0
    total_fat_g: float = 0
    avg_daily_fat_g: float = 0
    total_sugar_g: float = 0
    avg_daily_sugar_g: float = 0
    total_fiber_g: float = 0
    avg_daily_fiber_g: float = 0
    total_sodium_mg: float = 0
    avg_daily_sodium_mg: float = 0
    days_tracked: int
    days_on_goal: int
    protein_goal_g: int = 150
    carbs_goal_g: int = 250
    fat_goal_g: int = 65
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300


class StreakInfo(BaseModel):
    tracking_streak_count: int
    goal_streak_count: int
    best_tracking_streak: int
    best_goal_streak: int
    tracking_at_risk: bool  # True if not logged enough today
    goal_at_risk: bool  # True if over calorie limit today


class HungerPattern(BaseModel):
    avg_rating_by_protein: dict  # {"high": 2.8, "medium": 2.2, "low": 1.5}
    avg_rating_by_meal_size: dict  # {"large": 2.9, "medium": 2.4, "small": 1.8}
    total_ratings: int


class CustomRangeSummary(BaseModel):
    start_date: date
    end_date: date
    total_days: int
    total_calories: float
    avg_daily_calories: float
    total_protein_g: float
    avg_daily_protein_g: float
    total_carbs_g: float
    avg_daily_carbs_g: float
    total_fat_g: float
    avg_daily_fat_g: float
    total_sugar_g: float = 0
    avg_daily_sugar_g: float = 0
    total_fiber_g: float = 0
    avg_daily_fiber_g: float = 0
    total_sodium_mg: float = 0
    avg_daily_sodium_mg: float = 0
    days_tracked: int
    days_on_goal: int
    calorie_goal: int
    protein_goal_g: int
    sugar_goal_g: int = 50
    fiber_goal_g: int = 30
    sodium_goal_mg: int = 2300
    daily_breakdown: List[DailySummary] = []


class FullStats(BaseModel):
    today: DailySummary
    this_week: WeeklySummary
    this_month: MonthlySummary
    streaks: StreakInfo
    hunger_patterns: Optional[HungerPattern]
    daily_history: List[DailySummary]
    weekly_trajectory: Optional[dict] = None
    latest_weight_kg: Optional[float] = None
    protein_per_kg: Optional[float] = None


def get_user(db: Session) -> User:
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_week_dates(target_date: date):
    """Get the start (Monday) and end (Sunday) of the week containing target_date."""
    start = target_date - timedelta(days=target_date.weekday())
    end = start + timedelta(days=6)
    return start, end


@router.get("/today", response_model=DailySummary)
async def get_today_stats(db: Session = Depends(get_db)):
    """Get statistics for today."""
    user = get_user(db)
    today = date.today()
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == today
    ).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    tracking_maintained = total_calories >= (user.daily_calorie_goal * 0.5)
    goal_maintained = total_calories <= (user.daily_calorie_goal * 1.1)
    
    return DailySummary(
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
        sugar_goal_g=user.sugar_goal_g,
        fiber_goal_g=user.fiber_goal_g,
        sodium_goal_mg=user.sodium_goal_mg,
        tracking_streak_maintained=tracking_maintained,
        goal_streak_maintained=goal_maintained
    )


@router.get("/week", response_model=WeeklySummary)
async def get_week_stats(
    week_offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get statistics for a week. week_offset=0 is current week, -1 is last week, etc."""
    user = get_user(db)
    target_date = date.today() + timedelta(weeks=week_offset)
    week_start, week_end = get_week_dates(target_date)
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= week_start,
        MealEntry.date <= week_end
    ).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    # Get unique days with entries
    days_with_entries = set(m.date for m in meals)
    days_tracked = len(days_with_entries)
    
    # Count days where goal was met
    days_on_goal = 0
    for d in days_with_entries:
        day_meals = [m for m in meals if m.date == d]
        day_calories = sum(m.calories or 0 for m in day_meals)
        if day_calories <= (user.daily_calorie_goal * 1.1):
            days_on_goal += 1
    
    denom = max(days_tracked, 1)
    avg_daily = total_calories // denom
    avg_protein = total_protein // denom
    avg_carbs = total_carbs // denom
    avg_fat = total_fat // denom
    avg_sugar = total_sugar // denom
    avg_fiber = total_fiber // denom
    avg_sodium = total_sodium // denom
    
    return WeeklySummary(
        week_start=week_start,
        week_end=week_end,
        total_calories=total_calories,
        avg_daily_calories=avg_daily,
        total_protein_g=total_protein,
        avg_daily_protein_g=avg_protein,
        total_carbs_g=total_carbs,
        avg_daily_carbs_g=avg_carbs,
        total_fat_g=total_fat,
        avg_daily_fat_g=avg_fat,
        total_sugar_g=total_sugar,
        avg_daily_sugar_g=avg_sugar,
        total_fiber_g=total_fiber,
        avg_daily_fiber_g=avg_fiber,
        total_sodium_mg=total_sodium,
        avg_daily_sodium_mg=avg_sodium,
        days_tracked=days_tracked,
        days_on_goal=days_on_goal,
        calorie_goal_weekly=user.daily_calorie_goal * 7,
        protein_goal_g=user.protein_goal_g,
        carbs_goal_g=user.carbs_goal_g,
        fat_goal_g=user.fat_goal_g,
        sugar_goal_g=user.sugar_goal_g,
        fiber_goal_g=user.fiber_goal_g,
        sodium_goal_mg=user.sodium_goal_mg
    )


@router.get("/month", response_model=MonthlySummary)
async def get_month_stats(
    month_offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get statistics for a month. month_offset=0 is current month, -1 is last month, etc."""
    user = get_user(db)
    
    today = date.today()
    target_month = today.month + month_offset
    target_year = today.year
    
    while target_month <= 0:
        target_month += 12
        target_year -= 1
    while target_month > 12:
        target_month -= 12
        target_year += 1
    
    month_start = date(target_year, target_month, 1)
    if target_month == 12:
        month_end = date(target_year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(target_year, target_month + 1, 1) - timedelta(days=1)
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= month_start,
        MealEntry.date <= month_end
    ).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    days_with_entries = set(m.date for m in meals)
    days_tracked = len(days_with_entries)
    
    days_on_goal = 0
    for d in days_with_entries:
        day_meals = [m for m in meals if m.date == d]
        day_calories = sum(m.calories or 0 for m in day_meals)
        if day_calories <= (user.daily_calorie_goal * 1.1):
            days_on_goal += 1
    
    denom = max(days_tracked, 1)
    avg_daily = total_calories // denom
    avg_protein = total_protein // denom
    avg_carbs = total_carbs // denom
    avg_fat = total_fat // denom
    avg_sugar = total_sugar // denom
    avg_fiber = total_fiber // denom
    avg_sodium = total_sodium // denom
    
    return MonthlySummary(
        month=month_start.strftime("%B"),
        year=target_year,
        total_calories=total_calories,
        avg_daily_calories=avg_daily,
        total_protein_g=total_protein,
        avg_daily_protein_g=avg_protein,
        total_carbs_g=total_carbs,
        avg_daily_carbs_g=avg_carbs,
        total_fat_g=total_fat,
        avg_daily_fat_g=avg_fat,
        total_sugar_g=total_sugar,
        avg_daily_sugar_g=avg_sugar,
        total_fiber_g=total_fiber,
        avg_daily_fiber_g=avg_fiber,
        total_sodium_mg=total_sodium,
        avg_daily_sodium_mg=avg_sodium,
        days_tracked=days_tracked,
        days_on_goal=days_on_goal,
        protein_goal_g=user.protein_goal_g,
        carbs_goal_g=user.carbs_goal_g,
        fat_goal_g=user.fat_goal_g,
        sugar_goal_g=user.sugar_goal_g,
        fiber_goal_g=user.fiber_goal_g,
        sodium_goal_mg=user.sodium_goal_mg
    )


@router.get("/custom-range", response_model=CustomRangeSummary)
async def get_custom_range_stats(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """Get statistics for a custom date range."""
    user = get_user(db)
    
    # Ensure start_date is before end_date
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    
    # Calculate total days in range
    total_days = (end_date - start_date).days + 1
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= start_date,
        MealEntry.date <= end_date
    ).all()
    
    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    
    # Get unique days with entries
    days_with_entries = set(m.date for m in meals)
    days_tracked = len(days_with_entries)
    
    # Count days where goal was met
    days_on_goal = 0
    for d in days_with_entries:
        day_meals = [m for m in meals if m.date == d]
        day_calories = sum(m.calories or 0 for m in day_meals)
        if day_calories <= (user.daily_calorie_goal * 1.1):
            days_on_goal += 1
    
    avg_daily_calories = total_calories // max(days_tracked, 1)
    avg_daily_protein = total_protein // max(days_tracked, 1)
    avg_daily_carbs = total_carbs // max(days_tracked, 1)
    avg_daily_fat = total_fat // max(days_tracked, 1)
    avg_daily_sugar = total_sugar // max(days_tracked, 1)
    avg_daily_fiber = total_fiber // max(days_tracked, 1)
    avg_daily_sodium = total_sodium // max(days_tracked, 1)
    
    # Build daily breakdown
    daily_breakdown = []
    current = start_date
    while current <= end_date:
        day_meals = [m for m in meals if m.date == current]
        day_calories = sum(m.calories or 0 for m in day_meals)
        day_protein = sum(m.protein_g or 0 for m in day_meals)
        day_carbs = sum(m.carbs_g or 0 for m in day_meals)
        day_fat = sum(m.fat_g or 0 for m in day_meals)
        day_sugar = sum(m.sugar_g or 0 for m in day_meals)
        day_fiber = sum(m.fiber_g or 0 for m in day_meals)
        day_sodium = sum(m.sodium_mg or 0 for m in day_meals)
        
        daily_breakdown.append(DailySummary(
            date=current,
            total_calories=day_calories,
            total_protein_g=day_protein,
            total_carbs_g=day_carbs,
            total_fat_g=day_fat,
            total_sugar_g=day_sugar,
            total_fiber_g=day_fiber,
            total_sodium_mg=day_sodium,
            calorie_goal=user.daily_calorie_goal,
            protein_goal_g=user.protein_goal_g,
            sugar_goal_g=user.sugar_goal_g,
            fiber_goal_g=user.fiber_goal_g,
            sodium_goal_mg=user.sodium_goal_mg,
            tracking_streak_maintained=day_calories >= (user.daily_calorie_goal * 0.5),
            goal_streak_maintained=day_calories <= (user.daily_calorie_goal * 1.1)
        ))
        current += timedelta(days=1)
    
    return CustomRangeSummary(
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        total_calories=total_calories,
        avg_daily_calories=avg_daily_calories,
        total_protein_g=total_protein,
        avg_daily_protein_g=avg_daily_protein,
        total_carbs_g=total_carbs,
        avg_daily_carbs_g=avg_daily_carbs,
        total_fat_g=total_fat,
        avg_daily_fat_g=avg_daily_fat,
        total_sugar_g=total_sugar,
        avg_daily_sugar_g=avg_daily_sugar,
        total_fiber_g=total_fiber,
        avg_daily_fiber_g=avg_daily_fiber,
        total_sodium_mg=total_sodium,
        avg_daily_sodium_mg=avg_daily_sodium,
        days_tracked=days_tracked,
        days_on_goal=days_on_goal,
        calorie_goal=user.daily_calorie_goal,
        protein_goal_g=user.protein_goal_g,
        sugar_goal_g=user.sugar_goal_g,
        fiber_goal_g=user.fiber_goal_g,
        sodium_goal_mg=user.sodium_goal_mg,
        daily_breakdown=daily_breakdown
    )


@router.get("/streaks", response_model=StreakInfo)
async def get_streak_info(db: Session = Depends(get_db)):
    """Get current streak information - calculated dynamically from data."""
    user = get_user(db)
    today = date.today()
    
    # Get today's meals to check if tracking is at risk
    today_meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date == today
    ).all()
    
    today_calories = sum(m.calories or 0 for m in today_meals)
    
    # Tracking at risk if haven't logged 50% of goal yet
    tracking_at_risk = today_calories < (user.daily_calorie_goal * 0.5)
    
    # Goal at risk if already over 110% of goal
    goal_at_risk = today_calories > (user.daily_calorie_goal * 1.1)
    
    # Check today's status
    today_tracking_maintained = today_calories >= (user.daily_calorie_goal * 0.5)
    today_goal_maintained = today_calories <= (user.daily_calorie_goal * 1.1) and today_calories > 0
    
    # Get all daily stats ordered by date descending
    daily_stats = db.query(DailyStats).filter(
        DailyStats.user_id == user.id,
        DailyStats.date < today
    ).order_by(DailyStats.date.desc()).all()
    
    # Create a dict for quick lookup
    stats_by_date = {s.date: s for s in daily_stats}
    
    # Count consecutive tracking days from yesterday backwards
    tracking_streak = 0
    check_date = today - timedelta(days=1)
    
    while check_date in stats_by_date:
        stats = stats_by_date[check_date]
        if stats.tracking_streak_maintained:
            tracking_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    # Add today if it qualifies
    if today_tracking_maintained:
        tracking_streak += 1
    
    # Count consecutive goal days from yesterday backwards
    goal_streak = 0
    check_date = today - timedelta(days=1)
    
    while check_date in stats_by_date:
        stats = stats_by_date[check_date]
        if stats.goal_streak_maintained:
            goal_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    # Add today if it qualifies
    if today_goal_maintained:
        goal_streak += 1
    
    # Calculate best streaks from all historical data
    best_tracking = 0
    best_goal = 0
    current_tracking_run = 0
    current_goal_run = 0
    
    all_stats = db.query(DailyStats).filter(
        DailyStats.user_id == user.id
    ).order_by(DailyStats.date.asc()).all()
    
    for stats in all_stats:
        if stats.tracking_streak_maintained:
            current_tracking_run += 1
            best_tracking = max(best_tracking, current_tracking_run)
        else:
            current_tracking_run = 0
        
        if stats.goal_streak_maintained:
            current_goal_run += 1
            best_goal = max(best_goal, current_goal_run)
        else:
            current_goal_run = 0
    
    # Include today in best calculation if it qualifies
    if today_tracking_maintained:
        current_tracking_run += 1
        best_tracking = max(best_tracking, current_tracking_run)
    if today_goal_maintained:
        current_goal_run += 1
        best_goal = max(best_goal, current_goal_run)
    
    return StreakInfo(
        tracking_streak_count=tracking_streak,
        goal_streak_count=goal_streak,
        best_tracking_streak=best_tracking,
        best_goal_streak=best_goal,
        tracking_at_risk=tracking_at_risk,
        goal_at_risk=goal_at_risk
    )



@router.post("/streaks/update")
async def update_streaks(db: Session = Depends(get_db)):
    """Update streak counts based on yesterday's data. Call this daily."""
    user = get_user(db)
    yesterday = date.today() - timedelta(days=1)
    
    streak = db.query(StreakStatus).filter(
        StreakStatus.user_id == user.id
    ).first()
    
    if not streak:
        streak = StreakStatus(user_id=user.id)
        db.add(streak)
    
    # Get yesterday's stats
    yesterday_stats = db.query(DailyStats).filter(
        DailyStats.user_id == user.id,
        DailyStats.date == yesterday
    ).first()
    
    if yesterday_stats:
        # Update tracking streak
        if yesterday_stats.tracking_streak_maintained:
            streak.tracking_streak_count += 1
            streak.best_tracking_streak = max(
                streak.best_tracking_streak,
                streak.tracking_streak_count
            )
        else:
            streak.tracking_streak_count = 0
        
        # Update goal streak (depends on focus mode)
        if user.calorie_focus_mode == "daily":
            if yesterday_stats.goal_streak_maintained:
                streak.goal_streak_count += 1
                streak.best_goal_streak = max(
                    streak.best_goal_streak,
                    streak.goal_streak_count
                )
            else:
                streak.goal_streak_count = 0
        else:
            # Weekly mode - check at end of week
            if yesterday.weekday() == 6:  # Sunday
                week_start, week_end = get_week_dates(yesterday)
                week_stats = db.query(DailyStats).filter(
                    DailyStats.user_id == user.id,
                    DailyStats.date >= week_start,
                    DailyStats.date <= week_end
                ).all()
                
                week_calories = sum(s.total_calories for s in week_stats)
                week_goal = user.daily_calorie_goal * 7
                
                if week_calories <= week_goal:
                    streak.goal_streak_count += 1
                    streak.best_goal_streak = max(
                        streak.best_goal_streak,
                        streak.goal_streak_count
                    )
                else:
                    streak.goal_streak_count = 0
    
    streak.last_updated = date.today()
    db.commit()
    
    return {"status": "updated", "streaks": {
        "tracking": streak.tracking_streak_count,
        "goal": streak.goal_streak_count
    }}


@router.get("/hunger-patterns", response_model=HungerPattern)
async def get_hunger_patterns(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Analyze hunger patterns based on logged ratings."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days)
    
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= start_date,
        MealEntry.hunger_rating.isnot(None)
    ).all()
    
    if not meals:
        return HungerPattern(
            avg_rating_by_protein={"high": 0, "medium": 0, "low": 0},
            avg_rating_by_meal_size={"large": 0, "medium": 0, "small": 0},
            total_ratings=0
        )
    
    # Categorize by protein content
    high_protein = [m for m in meals if m.protein_g >= 30]
    medium_protein = [m for m in meals if 15 <= m.protein_g < 30]
    low_protein = [m for m in meals if m.protein_g < 15]
    
    def avg_rating(meal_list):
        if not meal_list:
            return 0
        return round(sum(m.hunger_rating for m in meal_list) / len(meal_list), 1)
    
    # Categorize by meal size (calories)
    large_meals = [m for m in meals if m.calories >= 600]
    medium_meals = [m for m in meals if 300 <= m.calories < 600]
    small_meals = [m for m in meals if m.calories < 300]
    
    return HungerPattern(
        avg_rating_by_protein={
            "high": avg_rating(high_protein),
            "medium": avg_rating(medium_protein),
            "low": avg_rating(low_protein)
        },
        avg_rating_by_meal_size={
            "large": avg_rating(large_meals),
            "medium": avg_rating(medium_meals),
            "small": avg_rating(small_meals)
        },
        total_ratings=len(meals)
    )


@router.get("/history", response_model=List[DailySummary])
async def get_daily_history(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get daily summaries for the past N days."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days - 1)
    
    result = []
    for i in range(days):
        target_date = start_date + timedelta(days=i)
        
        meals = db.query(MealEntry).filter(
            MealEntry.user_id == user.id,
            MealEntry.date == target_date
        ).all()
        
        total_calories = sum(m.calories or 0 for m in meals)
        total_protein = sum(m.protein_g or 0 for m in meals)
        total_carbs = sum(m.carbs_g or 0 for m in meals)
        total_fat = sum(m.fat_g or 0 for m in meals)
        total_sugar = sum(m.sugar_g or 0 for m in meals)
        total_fiber = sum(m.fiber_g or 0 for m in meals)
        total_sodium = sum(m.sodium_mg or 0 for m in meals)
        
        result.append(DailySummary(
            date=target_date,
            total_calories=total_calories,
            total_protein_g=total_protein,
            total_carbs_g=total_carbs,
            total_fat_g=total_fat,
            total_sugar_g=total_sugar,
            total_fiber_g=total_fiber,
            total_sodium_mg=total_sodium,
            calorie_goal=user.daily_calorie_goal,
            protein_goal_g=user.protein_goal_g,
            sugar_goal_g=user.sugar_goal_g,
            fiber_goal_g=user.fiber_goal_g,
            sodium_goal_mg=user.sodium_goal_mg,
            tracking_streak_maintained=total_calories >= (user.daily_calorie_goal * 0.5),
            goal_streak_maintained=total_calories <= (user.daily_calorie_goal * 1.1)
        ))
    
    return result


@router.get("/weekly-trajectory")
async def get_weekly_trajectory(db: Session = Depends(get_db)):
    """Get trajectory indicator for weekly calorie mode."""
    user = get_user(db)
    
    if user.calorie_focus_mode != "weekly":
        return {"mode": "daily", "trajectory": None}
    
    today = date.today()
    week_start, week_end = get_week_dates(today)
    days_elapsed = (today - week_start).days + 1
    days_remaining = 7 - days_elapsed
    
    # Get calories so far this week
    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= week_start,
        MealEntry.date <= today
    ).all()
    
    calories_so_far = sum(m.calories or 0 for m in meals)
    weekly_goal = user.daily_calorie_goal * 7
    expected_by_now = user.daily_calorie_goal * days_elapsed
    
    # Calculate trajectory
    difference = calories_so_far - expected_by_now
    projected_weekly = calories_so_far + (user.daily_calorie_goal * days_remaining)
    
    if difference <= -200:
        status = "ahead"  # Under budget
    elif difference >= 200:
        status = "behind"  # Over budget
    else:
        status = "on_track"
    
    return {
        "mode": "weekly",
        "trajectory": {
            "status": status,
            "calories_so_far": calories_so_far,
            "expected_by_now": expected_by_now,
            "difference": difference,
            "weekly_goal": weekly_goal,
            "projected_weekly": projected_weekly,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "daily_budget_remaining": (weekly_goal - calories_so_far) // max(days_remaining, 1)
        }
    }


@router.get("/full", response_model=FullStats)
async def get_full_stats(db: Session = Depends(get_db)):
    """Get all statistics in one call, including weekly trajectory."""
    user = get_user(db)
    today_stats = await get_today_stats(db)
    week_stats = await get_week_stats(0, db)
    month_stats = await get_month_stats(0, db)
    streak_info = await get_streak_info(db)
    hunger_patterns = await get_hunger_patterns(30, db)
    daily_history = await get_daily_history(7, db)
    trajectory = await get_weekly_trajectory(db)

    # Latest weight for protein/kg calculation
    latest_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == user.id)
        .order_by(WeightLog.date.desc())
        .first()
    )
    latest_weight_kg = latest_weight.weight_kg if latest_weight else None
    protein_per_kg = (
        round(week_stats.avg_daily_protein_g / latest_weight_kg, 2)
        if latest_weight_kg and latest_weight_kg > 0 else None
    )

    return FullStats(
        today=today_stats,
        this_week=week_stats,
        this_month=month_stats,
        streaks=streak_info,
        hunger_patterns=hunger_patterns,
        daily_history=daily_history,
        weekly_trajectory=trajectory,
        latest_weight_kg=latest_weight_kg,
        protein_per_kg=protein_per_kg
    )


def _get_period_dates(period: str, start_date: Optional[date], end_date: Optional[date]) -> tuple[date, date]:
    """Return (start, end) for the given period string."""
    today = date.today()
    if period == "today":
        return today, today
    elif period == "week":
        week_start, week_end = get_week_dates(today)
        return week_start, week_end
    elif period == "month":
        month_start = date(today.year, today.month, 1)
        if today.month == 12:
            month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)
        return month_start, month_end
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date required for custom period")
        if start_date > end_date:
            start_date, end_date = end_date, start_date
        return start_date, end_date
    else:
        raise HTTPException(status_code=400, detail="period must be today, week, month, or custom")


@router.get("/food-frequency")
async def get_food_frequency(
    period: str = Query("week", regex="^(today|week|month|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get most frequently eaten foods for the period, split into keep_eating / eat_less."""
    user = get_user(db)
    p_start, p_end = _get_period_dates(period, start_date, end_date)

    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= p_start,
        MealEntry.date <= p_end
    ).all()

    # Aggregate per food item from breakdowns
    food_stats: dict[str, dict] = {}
    for meal in meals:
        if not meal.breakdown:
            continue
        try:
            items = json.loads(meal.breakdown)
        except Exception:
            continue
        for item in items:
            name = item.get("item", "").strip().lower()
            if not name or len(name) < 2:
                continue
            if name not in food_stats:
                food_stats[name] = {
                    "name": item.get("item", "").strip(),
                    "count": 0,
                    "total_calories": 0,
                    "total_protein_g": 0,
                    "total_sugar_g": 0,
                    "total_fat_g": 0,
                    "total_fiber_g": 0,
                    "total_sodium_mg": 0,
                }
            s = food_stats[name]
            s["count"] += 1
            s["total_calories"] += item.get("calories", 0) or 0
            s["total_protein_g"] += item.get("protein_g", 0) or 0
            s["total_sugar_g"] += item.get("sugar_g", 0) or 0
            s["total_fat_g"] += item.get("fat_g", 0) or 0
            s["total_fiber_g"] += item.get("fiber_g", 0) or 0
            s["total_sodium_mg"] += item.get("sodium_mg", 0) or 0

    unique_food_count = len(food_stats)

    # Classify each food
    keep_eating = []
    eat_less = []

    for key, s in food_stats.items():
        cnt = s["count"]
        avg_cal = s["total_calories"] / cnt
        avg_protein = s["total_protein_g"] / cnt
        avg_sugar = s["total_sugar_g"] / cnt
        avg_fat = s["total_fat_g"] / cnt
        avg_fiber = s["total_fiber_g"] / cnt
        avg_sodium = s["total_sodium_mg"] / cnt

        entry = {
            "name": s["name"],
            "count": cnt,
            "avg_calories": round(avg_cal),
            "avg_protein_g": round(avg_protein, 1),
            "avg_sugar_g": round(avg_sugar, 1),
            "avg_fat_g": round(avg_fat, 1),
            "avg_fiber_g": round(avg_fiber, 1),
            "avg_sodium_mg": round(avg_sodium),
            "emoji": get_food_emoji(s["name"]),
        }

        # Heuristic: unhealthy if high sugar OR high sodium OR fat >> protein and high cal
        is_unhealthy = (
            avg_sugar > 12
            or avg_sodium > 600
            or (avg_fat > 15 and avg_protein < 8 and avg_cal > 200)
        )
        # Healthy bonus: high protein or high fiber
        is_healthy = avg_protein >= 10 or avg_fiber >= 3

        if is_unhealthy and not is_healthy:
            eat_less.append(entry)
        else:
            keep_eating.append(entry)

    keep_eating.sort(key=lambda x: x["count"], reverse=True)
    eat_less.sort(key=lambda x: x["count"], reverse=True)

    return {
        "keep_eating": keep_eating[:6],
        "eat_less": eat_less[:6],
        "unique_food_count": unique_food_count,
        "period": period,
        "start_date": p_start.isoformat(),
        "end_date": p_end.isoformat(),
    }


@router.get("/health-assessment")
async def get_health_assessment(
    period: str = Query("week", regex="^(week|month|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """AI-generated diet health assessment for the given period."""
    user = get_user(db)
    p_start, p_end = _get_period_dates(period, start_date, end_date)

    # Cache key to avoid redundant API calls
    cache_key = f"{user.id}:{period}:{p_start}:{p_end}"
    if cache_key in _assessment_cache:
        return _assessment_cache[cache_key]

    meals = db.query(MealEntry).filter(
        MealEntry.user_id == user.id,
        MealEntry.date >= p_start,
        MealEntry.date <= p_end
    ).all()

    if not meals:
        return {
            "status": "no_data",
            "summary": "No meals logged for this period.",
            "strengths": [],
            "improvements": [],
            "micronutrient_flags": [],
        }

    # Build summary for the prompt
    total_days = max((p_end - p_start).days + 1, 1)
    tracked_days = len(set(m.date for m in meals))
    total_cal = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein_g or 0 for m in meals)
    total_carbs = sum(m.carbs_g or 0 for m in meals)
    total_fat = sum(m.fat_g or 0 for m in meals)
    total_sugar = sum(m.sugar_g or 0 for m in meals)
    total_fiber = sum(m.fiber_g or 0 for m in meals)
    total_sodium = sum(m.sodium_mg or 0 for m in meals)
    denom = max(tracked_days, 1)

    food_names = [m.description for m in meals if m.description]
    breakdown_items = []
    for m in meals:
        if m.breakdown:
            try:
                breakdown_items.extend([i.get("item", "") for i in json.loads(m.breakdown) if i.get("item")])
            except Exception:
                pass

    prompt = f"""You are a nutrition expert analyzing a user's diet for the period {p_start} to {p_end} ({tracked_days} tracked days out of {total_days}).

User goals: {user.daily_calorie_goal} kcal/day, {user.protein_goal_g}g protein, {user.carbs_goal_g}g carbs, {user.fat_goal_g}g fat, max {user.sugar_goal_g}g sugar, {user.fiber_goal_g}g fiber, max {user.sodium_goal_mg}mg sodium.

Average daily intake:
- Calories: {total_cal // denom} kcal (goal: {user.daily_calorie_goal})
- Protein: {total_protein // denom}g (goal: {user.protein_goal_g}g)
- Carbs: {total_carbs // denom}g (goal: {user.carbs_goal_g}g)
- Fat: {total_fat // denom}g (goal: {user.fat_goal_g}g)
- Sugar: {total_sugar // denom}g (limit: {user.sugar_goal_g}g)
- Fiber: {total_fiber // denom}g (goal: {user.fiber_goal_g}g)
- Sodium: {total_sodium // denom}mg (limit: {user.sodium_goal_mg}mg)

Foods eaten: {', '.join(set(breakdown_items[:80]))}

Provide a concise, actionable diet assessment following these rules:

STRENGTHS rules:
- Include whether the diet is well-balanced across food groups (protein sources, vegetables, whole grains, healthy fats). If it is, say so explicitly.
- Highlight genuine positives (hitting protein goals, good fiber intake, variety, etc).

IMPROVEMENTS rules:
- If the diet is NOT balanced (e.g. lacking vegetables, relying on the same few foods, missing food groups), call this out explicitly.
- For each improvement, suggest 1-2 SPECIFIC foods the user could add or eat more of, chosen to complement their existing eating habits and foods they already enjoy. Make the food suggestions feel natural given what they already eat (e.g. if they eat chicken, suggest adding a side of roasted vegetables; if they eat pasta, suggest adding lentils).
- Keep suggestions practical and realistic.

Respond ONLY with this exact JSON structure:
{{
  "status": "on_track" | "needs_attention" | "off_track",
  "summary": "1-2 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["specific actionable suggestion with food examples 1", "specific actionable suggestion with food examples 2"],
  "micronutrient_flags": [
    {{"nutrient": "Vitamin D", "concern": "low" | "moderate", "suggestion": "Add fatty fish or fortified dairy"}}
  ]
}}
Keep strengths and improvements to 2-3 items each. Only include micronutrient_flags if there are genuine concerns (0-3 items)."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    client = openai.OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=800,
        )
        result = json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI assessment failed: {str(e)}")

    # Cache result for this session
    _assessment_cache[cache_key] = result
    return result

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import os

from database import (
    get_db, User, WeightLog, MeasurementLog, ProgressPhoto,
    ExerciseConfig, LiftLog
)
from services.image_service import save_image

router = APIRouter()


# ============ Weight Tracking ============

class WeightCreate(BaseModel):
    weight_kg: float
    date: Optional[date] = None


class WeightResponse(BaseModel):
    id: int
    date: date
    weight_kg: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class WeightStats(BaseModel):
    current: Optional[float]
    starting: Optional[float]
    change: Optional[float]
    weekly_rate: Optional[float]
    trend_7day: Optional[float]
    entries: List[WeightResponse]


def get_user(db: Session) -> User:
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/weight", response_model=WeightResponse)
async def log_weight(data: WeightCreate, db: Session = Depends(get_db)):
    """Log a weight measurement."""
    user = get_user(db)
    log_date = data.date or date.today()
    
    # Check if entry exists for this date
    existing = db.query(WeightLog).filter(
        WeightLog.user_id == user.id,
        WeightLog.date == log_date
    ).first()
    
    if existing:
        existing.weight_kg = data.weight_kg
        db.commit()
        db.refresh(existing)
        return existing
    
    log = WeightLog(
        user_id=user.id,
        date=log_date,
        weight_kg=data.weight_kg
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.put("/weight/{weight_id}", response_model=WeightResponse)
async def update_weight(weight_id: int, data: WeightCreate, db: Session = Depends(get_db)):
    """Update a weight entry."""
    user = get_user(db)
    
    weight_log = db.query(WeightLog).filter(
        WeightLog.id == weight_id,
        WeightLog.user_id == user.id
    ).first()
    
    if not weight_log:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    
    weight_log.weight_kg = data.weight_kg
    if data.date:
        weight_log.date = data.date
    
    db.commit()
    db.refresh(weight_log)
    return weight_log


@router.delete("/weight/{weight_id}")
async def delete_weight(weight_id: int, db: Session = Depends(get_db)):
    """Delete a weight entry."""
    user = get_user(db)
    
    weight_log = db.query(WeightLog).filter(
        WeightLog.id == weight_id,
        WeightLog.user_id == user.id
    ).first()
    
    if not weight_log:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    
    db.delete(weight_log)
    db.commit()
    return {"status": "deleted"}


@router.get("/weight", response_model=WeightStats)
async def get_weight_stats(
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get weight statistics and entries."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days)
    
    entries = db.query(WeightLog).filter(
        WeightLog.user_id == user.id,
        WeightLog.date >= start_date
    ).order_by(WeightLog.date.asc()).all()
    
    if not entries:
        return WeightStats(
            current=None, starting=None, change=None,
            weekly_rate=None, trend_7day=None, entries=[]
        )
    
    current = entries[-1].weight_kg if entries else None
    starting = entries[0].weight_kg if entries else None
    change = round(current - starting, 2) if current and starting else None
    
    # Calculate weekly rate
    weekly_rate = None
    if len(entries) >= 2:
        days_diff = (entries[-1].date - entries[0].date).days
        if days_diff > 0:
            weekly_rate = round((change / days_diff) * 7, 2)
    
    # 7-day moving average (trend)
    trend_7day = None
    last_7 = [e.weight_kg for e in entries[-7:]]
    if last_7:
        trend_7day = round(sum(last_7) / len(last_7), 2)
    
    return WeightStats(
        current=current,
        starting=starting,
        change=change,
        weekly_rate=weekly_rate,
        trend_7day=trend_7day,
        entries=entries
    )


# ============ Measurement Tracking ============

class MeasurementCreate(BaseModel):
    waist_cm: float
    date: Optional[date] = None


class MeasurementResponse(BaseModel):
    id: int
    date: date
    waist_cm: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class MeasurementStats(BaseModel):
    current: Optional[float]
    starting: Optional[float]
    change: Optional[float]
    entries: List[MeasurementResponse]


@router.post("/measurement", response_model=MeasurementResponse)
async def log_measurement(data: MeasurementCreate, db: Session = Depends(get_db)):
    """Log a waist measurement."""
    user = get_user(db)
    log_date = data.date or date.today()
    
    existing = db.query(MeasurementLog).filter(
        MeasurementLog.user_id == user.id,
        MeasurementLog.date == log_date
    ).first()
    
    if existing:
        existing.waist_cm = data.waist_cm
        db.commit()
        db.refresh(existing)
        return existing
    
    log = MeasurementLog(
        user_id=user.id,
        date=log_date,
        waist_cm=data.waist_cm
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.put("/measurement/{measurement_id}", response_model=MeasurementResponse)
async def update_measurement(measurement_id: int, data: MeasurementCreate, db: Session = Depends(get_db)):
    """Update a measurement entry."""
    user = get_user(db)
    
    measurement_log = db.query(MeasurementLog).filter(
        MeasurementLog.id == measurement_id,
        MeasurementLog.user_id == user.id
    ).first()
    
    if not measurement_log:
        raise HTTPException(status_code=404, detail="Measurement entry not found")
    
    measurement_log.waist_cm = data.waist_cm
    if data.date:
        measurement_log.date = data.date
    
    db.commit()
    db.refresh(measurement_log)
    return measurement_log


@router.delete("/measurement/{measurement_id}")
async def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    """Delete a measurement entry."""
    user = get_user(db)
    
    measurement_log = db.query(MeasurementLog).filter(
        MeasurementLog.id == measurement_id,
        MeasurementLog.user_id == user.id
    ).first()
    
    if not measurement_log:
        raise HTTPException(status_code=404, detail="Measurement entry not found")
    
    db.delete(measurement_log)
    db.commit()
    return {"status": "deleted"}


@router.get("/measurement", response_model=MeasurementStats)
async def get_measurement_stats(
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get measurement statistics and entries."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days)
    
    entries = db.query(MeasurementLog).filter(
        MeasurementLog.user_id == user.id,
        MeasurementLog.date >= start_date
    ).order_by(MeasurementLog.date.asc()).all()
    
    if not entries:
        return MeasurementStats(
            current=None, starting=None, change=None, entries=[]
        )
    
    current = entries[-1].waist_cm if entries else None
    starting = entries[0].waist_cm if entries else None
    change = round(current - starting, 2) if current and starting else None
    
    return MeasurementStats(
        current=current,
        starting=starting,
        change=change,
        entries=entries
    )


# ============ Progress Photos ============

class PhotoResponse(BaseModel):
    id: int
    date: date
    front_image_path: Optional[str]
    side_image_path: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.post("/photos", response_model=PhotoResponse)
async def upload_progress_photos(
    front_image: Optional[UploadFile] = File(None),
    side_image: Optional[UploadFile] = File(None),
    notes: Optional[str] = Form(None),
    photo_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload progress photos (front and/or side)."""
    user = get_user(db)
    log_date = date.fromisoformat(photo_date) if photo_date else date.today()
    
    front_path = None
    side_path = None
    
    if front_image:
        front_path = await save_image(front_image, "progress")
    if side_image:
        side_path = await save_image(side_image, "progress")
    
    if not front_path and not side_path:
        raise HTTPException(status_code=400, detail="At least one photo required")
    
    photo = ProgressPhoto(
        user_id=user.id,
        date=log_date,
        front_image_path=front_path,
        side_image_path=side_path,
        notes=notes
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("/photos", response_model=List[PhotoResponse])
async def get_progress_photos(
    days: int = 365,
    db: Session = Depends(get_db)
):
    """Get all progress photos."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days)
    
    photos = db.query(ProgressPhoto).filter(
        ProgressPhoto.user_id == user.id,
        ProgressPhoto.date >= start_date
    ).order_by(ProgressPhoto.date.desc()).all()
    
    return photos


@router.delete("/photos/{photo_id}")
async def delete_progress_photo(photo_id: int, db: Session = Depends(get_db)):
    """Delete a progress photo."""
    user = get_user(db)
    
    photo = db.query(ProgressPhoto).filter(
        ProgressPhoto.id == photo_id,
        ProgressPhoto.user_id == user.id
    ).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Delete image files
    for path in [photo.front_image_path, photo.side_image_path]:
        if path and os.path.exists(path):
            os.remove(path)
    
    db.delete(photo)
    db.commit()
    return {"status": "deleted"}


# ============ Exercise Configuration ============

class ExerciseCreate(BaseModel):
    name: str
    display_order: Optional[int] = 0


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class ExerciseResponse(BaseModel):
    id: int
    name: str
    display_order: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/exercises", response_model=List[ExerciseResponse])
async def get_exercises(db: Session = Depends(get_db)):
    """Get all configured exercises."""
    user = get_user(db)
    
    exercises = db.query(ExerciseConfig).filter(
        ExerciseConfig.user_id == user.id
    ).order_by(ExerciseConfig.display_order).all()
    
    return exercises


@router.post("/exercises", response_model=ExerciseResponse)
async def create_exercise(data: ExerciseCreate, db: Session = Depends(get_db)):
    """Add a new exercise to track."""
    user = get_user(db)
    
    # Get max display order
    max_order = db.query(func.max(ExerciseConfig.display_order)).filter(
        ExerciseConfig.user_id == user.id
    ).scalar() or 0
    
    exercise = ExerciseConfig(
        user_id=user.id,
        name=data.name,
        display_order=data.display_order or (max_order + 1)
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(exercise_id: int, data: ExerciseUpdate, db: Session = Depends(get_db)):
    """Update an exercise configuration."""
    user = get_user(db)
    
    exercise = db.query(ExerciseConfig).filter(
        ExerciseConfig.id == exercise_id,
        ExerciseConfig.user_id == user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    if data.name is not None:
        exercise.name = data.name
    if data.display_order is not None:
        exercise.display_order = data.display_order
    if data.is_active is not None:
        exercise.is_active = data.is_active
    
    db.commit()
    db.refresh(exercise)
    return exercise


@router.delete("/exercises/{exercise_id}")
async def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Delete an exercise and its logs."""
    user = get_user(db)
    
    exercise = db.query(ExerciseConfig).filter(
        ExerciseConfig.id == exercise_id,
        ExerciseConfig.user_id == user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Delete associated lift logs
    db.query(LiftLog).filter(LiftLog.exercise_id == exercise_id).delete()
    
    db.delete(exercise)
    db.commit()
    return {"status": "deleted"}


# ============ Lift Logging ============

class LiftCreate(BaseModel):
    exercise_id: int
    weight_kg: float
    reps: int
    notes: Optional[str] = None
    date: Optional[date] = None


class LiftResponse(BaseModel):
    id: int
    exercise_id: int
    exercise_name: Optional[str] = None
    date: date
    weight_kg: float
    reps: int
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class LiftStats(BaseModel):
    exercise_id: int
    exercise_name: str
    current_max_kg: Optional[float]
    all_time_pr_kg: Optional[float]
    all_time_pr_reps: Optional[int]
    recent_trend: str  # "up", "down", "flat"
    entries: List[LiftResponse]


@router.post("/lifts", response_model=LiftResponse)
async def log_lift(data: LiftCreate, db: Session = Depends(get_db)):
    """Log a lift (exercise, weight, reps)."""
    user = get_user(db)
    
    # Verify exercise exists
    exercise = db.query(ExerciseConfig).filter(
        ExerciseConfig.id == data.exercise_id,
        ExerciseConfig.user_id == user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    log = LiftLog(
        user_id=user.id,
        exercise_id=data.exercise_id,
        date=data.date or date.today(),
        weight_kg=data.weight_kg,
        reps=data.reps,
        notes=data.notes
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    
    return LiftResponse(
        id=log.id,
        exercise_id=log.exercise_id,
        exercise_name=exercise.name,
        date=log.date,
        weight_kg=log.weight_kg,
        reps=log.reps,
        notes=log.notes,
        created_at=log.created_at
    )


@router.get("/lifts/{exercise_id}", response_model=LiftStats)
async def get_lift_stats(
    exercise_id: int,
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get lift statistics for a specific exercise."""
    user = get_user(db)
    start_date = date.today() - timedelta(days=days)
    
    exercise = db.query(ExerciseConfig).filter(
        ExerciseConfig.id == exercise_id,
        ExerciseConfig.user_id == user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    entries = db.query(LiftLog).filter(
        LiftLog.user_id == user.id,
        LiftLog.exercise_id == exercise_id,
        LiftLog.date >= start_date
    ).order_by(LiftLog.date.asc()).all()
    
    # Calculate stats
    current_max = None
    all_time_pr_kg = None
    all_time_pr_reps = None
    
    if entries:
        # Current max (last entry)
        current_max = entries[-1].weight_kg
        
        # All-time PR (highest weight)
        pr_entry = max(entries, key=lambda x: x.weight_kg)
        all_time_pr_kg = pr_entry.weight_kg
        all_time_pr_reps = pr_entry.reps
    
    # Recent trend (compare last 3 entries)
    trend = "flat"
    if len(entries) >= 3:
        recent_3 = [e.weight_kg for e in entries[-3:]]
        if recent_3[-1] > recent_3[0]:
            trend = "up"
        elif recent_3[-1] < recent_3[0]:
            trend = "down"
    
    return LiftStats(
        exercise_id=exercise_id,
        exercise_name=exercise.name,
        current_max_kg=current_max,
        all_time_pr_kg=all_time_pr_kg,
        all_time_pr_reps=all_time_pr_reps,
        recent_trend=trend,
        entries=[
            LiftResponse(
                id=e.id,
                exercise_id=e.exercise_id,
                exercise_name=exercise.name,
                date=e.date,
                weight_kg=e.weight_kg,
                reps=e.reps,
                notes=e.notes,
                created_at=e.created_at
            ) for e in entries
        ]
    )


@router.get("/lifts", response_model=List[LiftStats])
async def get_all_lift_stats(
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get lift statistics for all active exercises."""
    user = get_user(db)
    
    exercises = db.query(ExerciseConfig).filter(
        ExerciseConfig.user_id == user.id,
        ExerciseConfig.is_active == True
    ).order_by(ExerciseConfig.display_order).all()
    
    results = []
    for exercise in exercises:
        stats = await get_lift_stats(exercise.id, days, db)
        results.append(stats)
    
    return results


class LiftUpdate(BaseModel):
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    notes: Optional[str] = None
    date: Optional[date] = None


@router.put("/lifts/{lift_id}", response_model=LiftResponse)
async def update_lift(lift_id: int, data: LiftUpdate, db: Session = Depends(get_db)):
    """Update a lift log entry."""
    user = get_user(db)
    
    lift = db.query(LiftLog).filter(
        LiftLog.id == lift_id,
        LiftLog.user_id == user.id
    ).first()
    
    if not lift:
        raise HTTPException(status_code=404, detail="Lift log not found")
    
    exercise = db.query(ExerciseConfig).filter(
        ExerciseConfig.id == lift.exercise_id
    ).first()
    
    if data.weight_kg is not None:
        lift.weight_kg = data.weight_kg
    if data.reps is not None:
        lift.reps = data.reps
    if data.notes is not None:
        lift.notes = data.notes
    if data.date is not None:
        lift.date = data.date
    
    db.commit()
    db.refresh(lift)
    
    return LiftResponse(
        id=lift.id,
        exercise_id=lift.exercise_id,
        exercise_name=exercise.name if exercise else None,
        date=lift.date,
        weight_kg=lift.weight_kg,
        reps=lift.reps,
        notes=lift.notes,
        created_at=lift.created_at
    )


@router.delete("/lifts/{lift_id}")
async def delete_lift(lift_id: int, db: Session = Depends(get_db)):
    """Delete a lift log entry."""
    user = get_user(db)
    
    lift = db.query(LiftLog).filter(
        LiftLog.id == lift_id,
        LiftLog.user_id == user.id
    ).first()
    
    if not lift:
        raise HTTPException(status_code=404, detail="Lift log not found")
    
    db.delete(lift)
    db.commit()
    return {"status": "deleted"}


# ============ Combined Progress Dashboard ============

class CombinedProgress(BaseModel):
    weight: WeightStats
    measurement: MeasurementStats
    lifts: List[LiftStats]
    photos_count: int
    overall_status: str  # "on_track", "check_this", "needs_attention"
    trends: dict


@router.get("/combined", response_model=CombinedProgress)
async def get_combined_progress(
    days: int = 90,
    db: Session = Depends(get_db)
):
    """Get combined progress data for the dashboard."""
    user = get_user(db)
    
    weight_stats = await get_weight_stats(days, db)
    measurement_stats = await get_measurement_stats(days, db)
    lift_stats = await get_all_lift_stats(days, db)
    
    photos_count = db.query(ProgressPhoto).filter(
        ProgressPhoto.user_id == user.id
    ).count()
    
    # Determine overall status based on trends
    trends = {
        "weight": "neutral",
        "waist": "neutral",
        "strength": "neutral"
    }
    
    # Weight trend (want it down)
    if weight_stats.change is not None:
        if weight_stats.change < -0.5:
            trends["weight"] = "good"
        elif weight_stats.change > 1:
            trends["weight"] = "bad"
    
    # Waist trend (want it down)
    if measurement_stats.change is not None:
        if measurement_stats.change < -1:
            trends["waist"] = "good"
        elif measurement_stats.change > 1:
            trends["waist"] = "bad"
    
    # Strength trend (want it up)
    up_count = sum(1 for s in lift_stats if s.recent_trend == "up")
    down_count = sum(1 for s in lift_stats if s.recent_trend == "down")
    if up_count > down_count:
        trends["strength"] = "good"
    elif down_count > up_count:
        trends["strength"] = "bad"
    
    # Overall status
    good_count = sum(1 for v in trends.values() if v == "good")
    bad_count = sum(1 for v in trends.values() if v == "bad")
    
    if bad_count >= 2:
        overall_status = "needs_attention"
    elif bad_count == 1:
        overall_status = "check_this"
    else:
        overall_status = "on_track"
    
    return CombinedProgress(
        weight=weight_stats,
        measurement=measurement_stats,
        lifts=lift_stats,
        photos_count=photos_count,
        overall_status=overall_status,
        trends=trends
    )

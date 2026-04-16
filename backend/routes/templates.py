from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from database import get_db, MealTemplate, User, AutoLogHistory

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    calories: int = 0
    protein_g: int = 0
    carbs_g: int = 0
    fat_g: int = 0
    sugar_g: int = 0
    fiber_g: int = 0
    sodium_mg: int = 0
    vitamin_a_mcg: float = 0
    vitamin_c_mg: float = 0
    vitamin_d_mcg: float = 0
    vitamin_b12_mcg: float = 0
    iron_mg: float = 0
    calcium_mg: float = 0
    potassium_mg: float = 0
    magnesium_mg: float = 0
    breakdown: Optional[str] = None  # JSON string
    emoji: Optional[str] = None
    auto_log: bool = False  # Auto-log this favorite when a new day starts


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None
    sugar_g: Optional[int] = None
    fiber_g: Optional[int] = None
    sodium_mg: Optional[int] = None
    vitamin_a_mcg: Optional[float] = None
    vitamin_c_mg: Optional[float] = None
    vitamin_d_mcg: Optional[float] = None
    vitamin_b12_mcg: Optional[float] = None
    iron_mg: Optional[float] = None
    calcium_mg: Optional[float] = None
    potassium_mg: Optional[float] = None
    magnesium_mg: Optional[float] = None
    breakdown: Optional[str] = None
    emoji: Optional[str] = None
    auto_log: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    sugar_g: int = 0
    fiber_g: int = 0
    sodium_mg: int = 0
    vitamin_a_mcg: float = 0
    vitamin_c_mg: float = 0
    vitamin_d_mcg: float = 0
    vitamin_b12_mcg: float = 0
    iron_mg: float = 0
    calcium_mg: float = 0
    potassium_mg: float = 0
    magnesium_mg: float = 0
    breakdown: Optional[str] = None
    emoji: Optional[str] = None
    use_count: int
    auto_log: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


def get_user(db: Session) -> User:
    """Get the default user (single-user app)."""
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/", response_model=List[TemplateResponse])
async def get_templates(db: Session = Depends(get_db)):
    """Get all meal templates, sorted by most frequently used."""
    user = get_user(db)
    
    templates = db.query(MealTemplate).filter(
        MealTemplate.user_id == user.id
    ).order_by(MealTemplate.use_count.desc()).all()
    
    return templates


@router.post("/", response_model=TemplateResponse)
async def create_template(template_data: TemplateCreate, db: Session = Depends(get_db)):
    """Create a new meal template."""
    user = get_user(db)
    
    template = MealTemplate(
        user_id=user.id,
        name=template_data.name,
        description=template_data.description,
        calories=template_data.calories,
        protein_g=template_data.protein_g,
        carbs_g=template_data.carbs_g,
        fat_g=template_data.fat_g,
        sugar_g=template_data.sugar_g,
        fiber_g=template_data.fiber_g,
        sodium_mg=template_data.sodium_mg,
        vitamin_a_mcg=template_data.vitamin_a_mcg,
        vitamin_c_mg=template_data.vitamin_c_mg,
        vitamin_d_mcg=template_data.vitamin_d_mcg,
        vitamin_b12_mcg=template_data.vitamin_b12_mcg,
        iron_mg=template_data.iron_mg,
        calcium_mg=template_data.calcium_mg,
        potassium_mg=template_data.potassium_mg,
        magnesium_mg=template_data.magnesium_mg,
        breakdown=template_data.breakdown,
        emoji=template_data.emoji,
        auto_log=template_data.auto_log
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, template_data: TemplateUpdate, db: Session = Depends(get_db)):
    """Update an existing meal template."""
    user = get_user(db)
    
    template = db.query(MealTemplate).filter(
        MealTemplate.id == template_id,
        MealTemplate.user_id == user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.description is not None:
        template.description = template_data.description
    if template_data.calories is not None:
        template.calories = template_data.calories
    if template_data.protein_g is not None:
        template.protein_g = template_data.protein_g
    if template_data.carbs_g is not None:
        template.carbs_g = template_data.carbs_g
    if template_data.fat_g is not None:
        template.fat_g = template_data.fat_g
    if template_data.sugar_g is not None:
        template.sugar_g = template_data.sugar_g
    if template_data.fiber_g is not None:
        template.fiber_g = template_data.fiber_g
    if template_data.sodium_mg is not None:
        template.sodium_mg = template_data.sodium_mg
    if template_data.vitamin_a_mcg is not None:
        template.vitamin_a_mcg = template_data.vitamin_a_mcg
    if template_data.vitamin_c_mg is not None:
        template.vitamin_c_mg = template_data.vitamin_c_mg
    if template_data.vitamin_d_mcg is not None:
        template.vitamin_d_mcg = template_data.vitamin_d_mcg
    if template_data.vitamin_b12_mcg is not None:
        template.vitamin_b12_mcg = template_data.vitamin_b12_mcg
    if template_data.iron_mg is not None:
        template.iron_mg = template_data.iron_mg
    if template_data.calcium_mg is not None:
        template.calcium_mg = template_data.calcium_mg
    if template_data.potassium_mg is not None:
        template.potassium_mg = template_data.potassium_mg
    if template_data.magnesium_mg is not None:
        template.magnesium_mg = template_data.magnesium_mg
    if template_data.breakdown is not None:
        template.breakdown = template_data.breakdown
    if template_data.emoji is not None:
        template.emoji = template_data.emoji
    if template_data.auto_log is not None:
        template.auto_log = template_data.auto_log
    
    db.commit()
    db.refresh(template)
    
    return template


@router.delete("/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a meal template."""
    user = get_user(db)
    
    template = db.query(MealTemplate).filter(
        MealTemplate.id == template_id,
        MealTemplate.user_id == user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Remove auto-log history rows first to avoid FK constraint violation
    db.query(AutoLogHistory).filter(AutoLogHistory.template_id == template_id).delete()
    db.delete(template)
    db.commit()
    
    return {"status": "deleted"}


@router.post("/{template_id}/use", response_model=TemplateResponse)
async def use_template(template_id: int, db: Session = Depends(get_db)):
    """Increment the use count when a template is used."""
    user = get_user(db)
    
    template = db.query(MealTemplate).filter(
        MealTemplate.id == template_id,
        MealTemplate.user_id == user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.use_count += 1
    db.commit()
    db.refresh(template)
    
    return template

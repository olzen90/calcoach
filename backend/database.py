from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Date, Time, DateTime, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, date
import os

# Database setup — on Vercel, SQLite must live in /tmp (the only writable dir)
_default_db = "sqlite:////tmp/calorie_coach.db" if os.getenv("VERCEL") else "sqlite:///./calorie_coach.db"
DATABASE_URL = os.getenv("DATABASE_URL", _default_db)

# Rewrite postgresql:// to postgresql+psycopg:// so SQLAlchemy uses psycopg v3
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer)
    weight_kg = Column(Float)
    gender = Column(String(20))
    daily_calorie_goal = Column(Integer, default=2000)
    calorie_focus_mode = Column(String(20), default="daily")  # "daily" or "weekly"
    protein_goal_g = Column(Integer, default=150)
    carbs_goal_g = Column(Integer, default=250)
    fat_goal_g = Column(Integer, default=65)
    sugar_goal_g = Column(Integer, default=50)
    fiber_goal_g = Column(Integer, default=30)
    sodium_goal_mg = Column(Integer, default=2300)
    openai_api_key = Column(String(200))
    base_prompt = Column(Text, default="""You are a helpful and encouraging nutrition coach. When analyzing food, be supportive and give helpful tips in your notes. Be encouraging and supportive!""")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    meal_entries = relationship("MealEntry", back_populates="user")
    meal_templates = relationship("MealTemplate", back_populates="user")
    daily_stats = relationship("DailyStats", back_populates="user")
    streak_status = relationship("StreakStatus", back_populates="user", uselist=False)
    progress_photos = relationship("ProgressPhoto", back_populates="user")
    weight_logs = relationship("WeightLog", back_populates="user")
    measurement_logs = relationship("MeasurementLog", back_populates="user")
    exercise_configs = relationship("ExerciseConfig", back_populates="user")
    lift_logs = relationship("LiftLog", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")


class MealEntry(Base):
    __tablename__ = "meal_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today)
    time = Column(Time)
    description = Column(Text)  # AI-generated clean headline
    original_description = Column(Text)  # What the user originally typed
    image_path = Column(String(500))
    calories = Column(Integer, default=0)
    protein_g = Column(Integer, default=0)
    carbs_g = Column(Integer, default=0)
    fat_g = Column(Integer, default=0)
    sugar_g = Column(Integer, default=0)
    fiber_g = Column(Integer, default=0)
    sodium_mg = Column(Integer, default=0)
    emoji = Column(String(10), default="🍽️")
    ai_response = Column(Text)
    breakdown = Column(Text)  # JSON: AI's reasoning for the calorie estimate
    hunger_rating = Column(Integer)  # 1=still hungry, 2=satisfied, 3=very full
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="meal_entries")


class MealTemplate(Base):
    __tablename__ = "meal_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    calories = Column(Integer, default=0)
    protein_g = Column(Integer, default=0)
    carbs_g = Column(Integer, default=0)
    fat_g = Column(Integer, default=0)
    sugar_g = Column(Integer, default=0)
    fiber_g = Column(Integer, default=0)
    sodium_mg = Column(Integer, default=0)
    breakdown = Column(Text)  # JSON string with ingredient breakdown
    emoji = Column(String(10))
    use_count = Column(Integer, default=0)
    auto_log = Column(Boolean, default=False)  # Auto-log this favorite when a new day starts
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="meal_templates")


class DailyStats(Base):
    __tablename__ = "daily_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    total_calories = Column(Integer, default=0)
    total_protein_g = Column(Integer, default=0)
    total_carbs_g = Column(Integer, default=0)
    total_fat_g = Column(Integer, default=0)
    total_sugar_g = Column(Integer, default=0)
    total_fiber_g = Column(Integer, default=0)
    total_sodium_mg = Column(Integer, default=0)
    tracking_streak_maintained = Column(Boolean, default=False)
    goal_streak_maintained = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="daily_stats")


class AutoLogHistory(Base):
    """Tracks which auto-log favorites have been processed for each day.
    
    This prevents re-logging if user deletes an auto-logged meal.
    """
    __tablename__ = "auto_log_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("meal_templates.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Unique constraint: one entry per template per day per user
    __table_args__ = (
        Index('ix_auto_log_history_user_date', 'user_id', 'date'),
    )


class StreakStatus(Base):
    __tablename__ = "streak_status"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tracking_streak_count = Column(Integer, default=0)
    goal_streak_count = Column(Integer, default=0)
    best_tracking_streak = Column(Integer, default=0)
    best_goal_streak = Column(Integer, default=0)
    last_updated = Column(Date, default=date.today)
    
    user = relationship("User", back_populates="streak_status")


class ProgressPhoto(Base):
    __tablename__ = "progress_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today)
    front_image_path = Column(String(500))
    side_image_path = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="progress_photos")


class WeightLog(Base):
    __tablename__ = "weight_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    weight_kg = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="weight_logs")


class MeasurementLog(Base):
    __tablename__ = "measurement_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    waist_cm = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="measurement_logs")


class ExerciseConfig(Base):
    __tablename__ = "exercise_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="exercise_configs")
    lift_logs = relationship("LiftLog", back_populates="exercise")


class LiftLog(Base):
    __tablename__ = "lift_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercise_configs.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    weight_kg = Column(Float, nullable=False)
    reps = Column(Integer, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="lift_logs")
    exercise = relationship("ExerciseConfig", back_populates="lift_logs")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=date.today, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="chat_messages")


def init_db():
    """Initialize the database and create tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_default_user(db):
    """Create a default user if none exists."""
    user = db.query(User).first()
    if not user:
        user = User(
            name="User",
            age=30,
            weight_kg=80.0,
            gender="male",
            daily_calorie_goal=2000,
            protein_goal_g=150,
            carbs_goal_g=200,
            fat_goal_g=70,
            sugar_goal_g=50,
            fiber_goal_g=30,
            sodium_goal_mg=2300
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create default exercises
        default_exercises = [
            ("Squat", 1),
            ("Bench Press", 2),
            ("Deadlift", 3),
            ("Overhead Press", 4),
            ("Barbell Row", 5),
        ]
        for name, order in default_exercises:
            exercise = ExerciseConfig(
                user_id=user.id,
                name=name,
                display_order=order,
                is_active=True
            )
            db.add(exercise)
        
        # Create streak status
        streak = StreakStatus(user_id=user.id)
        db.add(streak)
        
        db.commit()
    
    return user


def run_migrations():
    """Add any missing columns to existing tables."""
    from sqlalchemy import text, inspect
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # Check meal_templates table for new columns
        if 'meal_templates' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('meal_templates')]
            
            if 'breakdown' not in columns:
                conn.execute(text('ALTER TABLE meal_templates ADD COLUMN breakdown TEXT'))
                conn.commit()
            
            if 'emoji' not in columns:
                conn.execute(text('ALTER TABLE meal_templates ADD COLUMN emoji VARCHAR(10)'))
                conn.commit()

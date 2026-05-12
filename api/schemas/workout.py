"""Pydantic schemas for workout data."""
from pydantic import BaseModel, Field


class ExerciseItem(BaseModel):
    name: str
    english_name: str | None = None
    sets: int = 3
    reps: int | str = 10  # Can be "30초" for time-based
    rest_seconds: int = 60
    target_muscles: list[str] = []
    difficulty: str = "intermediate"
    equipment: list[str] = []
    met_value: float = 0.0
    timestamp_seconds: int | None = None


class WorkoutRoutine(BaseModel):
    workout_name: str
    exercises: list[ExerciseItem]
    total_duration_min: int = 0
    estimated_calories: float = 0.0
    creator: str = ""
    source_url: str = ""

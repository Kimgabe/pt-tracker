"""PT Tracker YouTube Analysis Microservice.

Stateless API: receives YouTube URL, returns structured workout/recipe JSON.
No database, no auth, no Redis. PT Tracker handles all storage.
"""
import inspect
import logging
import re

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from classifier import classify_content, classify_content_subtype
from exercise_db import (
    EXERCISE_DB,
    estimate_calories,
    normalize_exercise_name,
)
from pipeline import extract_workout_staged, extract_recipe_staged
from transcript import fetch_transcript_with_fallback, TranscriptNotAvailable

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PT Tracker Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    content_type: str | None = None  # "workout" | "recipe" | None (auto-detect)
    body_weight_kg: float = Field(default=70.0, ge=30, le=200)
    auto_save: bool = True


class ExerciseResult(BaseModel):
    name: str
    english_name: str | None = None
    sets: int = 3
    reps: str = "10"
    rest_seconds: int = 60
    target_muscles: list[str] = []
    equipment: list[str] = []
    met_value: float = 4.0
    difficulty: str = "intermediate"
    estimated_calories: float = 0


class WorkoutResult(BaseModel):
    workout_name: str
    exercises: list[ExerciseResult]
    total_duration_min: int = 0
    estimated_calories: float = 0
    workout_type: str = "strength"
    creator: str = ""
    source_url: str = ""


class IngredientResult(BaseModel):
    name: str
    amount: str = ""


class StepResult(BaseModel):
    description: str
    timestamp_seconds: int | None = None


class RecipeResult(BaseModel):
    recipe_name: str
    ingredients: list[IngredientResult]
    steps: list[StepResult]
    calories: float = 0
    protein_g: float = 0
    carb_g: float = 0
    fat_g: float = 0
    goal_category: str = "maintain"
    estimated_cost_krw: int = 0
    cooking_time_min: int = 0
    difficulty: str = "medium"
    meal_type: str = "lunch"
    content_subtype: str = "recipe"
    creator: str = ""
    source_url: str = ""


class AnalyzeResponse(BaseModel):
    detected_type: str  # "workout" | "recipe"
    saved_id: str | None = None
    workout: WorkoutResult | None = None
    recipe: RecipeResult | None = None
    video_title: str | None = None
    video_author: str | None = None
    content_subtype: str = "recipe"
    transcript_language: str = ""
    is_auto_generated: bool = False
    cached: bool = False
    confidence_score: float = 0.0


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def fetch_video_metadata(video_url: str) -> dict:
    """Fetch video title and author using YouTube oEmbed API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://www.youtube.com/oembed",
                params={"url": video_url, "format": "json"},
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "title": data.get("title"),
                    "author": data.get("author_name"),
                }
    except Exception:
        pass
    return {"title": None, "author": None}


def enrich_exercises(
    exercises: list[dict], body_weight_kg: float, total_duration_min: int
) -> list[ExerciseResult]:
    """Enrich raw LLM exercises with MET values, muscle groups, and calorie estimates."""
    n = len(exercises) or 1
    per_exercise_min = total_duration_min / n if total_duration_min else 3.0

    results = []
    for ex in exercises:
        name = ex.get("name", "")
        canonical = normalize_exercise_name(name)
        info = EXERCISE_DB.get(canonical) if canonical else None

        # Parse reps to estimate duration
        reps_str = str(ex.get("reps", "10"))
        if "초" in reps_str or "sec" in reps_str.lower():
            try:
                duration = int(re.sub(r'[^\d]', '', reps_str)) / 60.0
            except ValueError:
                duration = per_exercise_min
        else:
            duration = per_exercise_min

        sets = ex.get("sets", 3)
        total_exercise_min = duration * sets

        cal = estimate_calories(name, total_exercise_min, body_weight_kg)

        results.append(ExerciseResult(
            name=canonical or name,
            english_name=info.english_name if info else None,
            sets=sets,
            reps=reps_str,
            rest_seconds=ex.get("rest_seconds", 60),
            target_muscles=ex.get("target_muscles", info.primary_muscles if info else []),
            equipment=ex.get("equipment", info.equipment if info else []),
            met_value=info.met_value if info else 4.0,
            difficulty=info.difficulty if info else ex.get("difficulty", "intermediate"),
            estimated_calories=round(cal, 1),
        ))

    return results


def calc_confidence(transcript_text: str, item_count: int, is_auto_generated: bool) -> float:
    score = 0.5
    if len(transcript_text) > 500:
        score += 0.15
    if len(transcript_text) > 1000:
        score += 0.1
    if item_count >= 3:
        score += 0.15
    if not is_auto_generated:
        score += 0.1
    return min(round(score, 2), 1.0)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """Analyze a YouTube video and extract workout or recipe data."""
    video_id = extract_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Fetch transcript
    try:
        transcript = fetch_transcript_with_fallback(video_id)
    except TranscriptNotAvailable as e:
        raise HTTPException(
            status_code=422,
            detail=f"자막을 가져올 수 없습니다: {str(e)[:100]}",
        )

    # Fetch video metadata
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    metadata = fetch_video_metadata(video_url)
    if inspect.isawaitable(metadata):
        metadata = await metadata

    # Classify content type
    if req.content_type:
        detected_type = req.content_type
    else:
        detected_type = classify_content(transcript.text)

    response = AnalyzeResponse(
        detected_type=detected_type,
        video_title=metadata["title"],
        video_author=metadata["author"],
        transcript_language=transcript.language,
        is_auto_generated=transcript.is_auto_generated,
        cached=False,
    )

    if detected_type == "workout":
        raw = extract_workout_staged(
            transcript.text,
            segments=transcript.segments,
            video_title=metadata["title"],
            creator=metadata["author"],
        )
        exercises = enrich_exercises(
            raw.get("exercises", []),
            req.body_weight_kg,
            raw.get("total_duration_min", 0),
        )
        total_cal = sum(e.estimated_calories for e in exercises)
        response.workout = WorkoutResult(
            workout_name=raw.get("workout_name", ""),
            exercises=exercises,
            total_duration_min=raw.get("total_duration_min", 0),
            estimated_calories=round(total_cal, 1),
            workout_type=raw.get("workout_type", "strength"),
            creator=metadata["author"] or "",
            source_url=req.url,
        )
        response.confidence_score = calc_confidence(transcript.text, len(exercises), transcript.is_auto_generated)
    else:
        raw = extract_recipe_staged(
            transcript.text,
            segments=transcript.segments,
            video_title=metadata["title"],
            creator=metadata["author"],
        )
        nutrition = raw.get("nutrition", {})
        subtype = classify_content_subtype(transcript.text)
        response.recipe = RecipeResult(
            recipe_name=raw.get("recipe_name", ""),
            ingredients=[
                IngredientResult(name=i.get("name", ""), amount=i.get("amount", ""))
                for i in raw.get("ingredients", [])
            ],
            steps=[
                StepResult(
                    description=s.get("description", ""),
                    timestamp_seconds=s.get("timestamp_seconds"),
                )
                for s in raw.get("steps", [])
            ],
            calories=nutrition.get("calories", 0),
            protein_g=nutrition.get("protein_g", 0),
            carb_g=nutrition.get("carb_g", 0),
            fat_g=nutrition.get("fat_g", 0),
            goal_category=raw.get("goal_category", "maintain"),
            estimated_cost_krw=raw.get("estimated_cost_krw", 0),
            cooking_time_min=raw.get("cooking_time_min", 0),
            difficulty=raw.get("difficulty", "medium"),
            meal_type=raw.get("meal_type", "lunch"),
            content_subtype=subtype,
            creator=metadata["author"] or "",
            source_url=req.url,
        )
        response.content_subtype = subtype
        response.confidence_score = calc_confidence(transcript.text, len(raw.get("ingredients", [])), transcript.is_auto_generated)

    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

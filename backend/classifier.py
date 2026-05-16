"""Simple content classifier for PT Tracker transcripts."""
from __future__ import annotations

import re

_WORKOUT_HINTS = (
    "workout", "exercise", "sets", "reps", "rep", "bench", "squat", "deadlift",
    "push", "pull", "leg", "hiit", "cardio", "plank", "burpee", "런지", "스쿼트",
    "벤치", "데드", "푸시", "풀", "하체", "상체", "스트레칭", "요가",
)
_RECIPE_HINTS = (
    "recipe", "cook", "cooking", "ingredients", "ingredient", "mix", "bake",
    "boil", "fry", "소금", "설탕", "간장", "재료", "레시피", "조리", "볶",
    "끓", "굽", "양념",
)

_SUBTYPE_HINTS = {
    "salad": ("salad", "샐러드", "greens"),
    "soup": ("soup", "stew", "국", "찌개"),
    "breakfast": ("breakfast", "아침", "오트", "egg"),
    "lunch": ("lunch", "점심"),
    "dinner": ("dinner", "저녁"),
    "snack": ("snack", "간식", "protein bar"),
}


def _count_hints(text: str, hints: tuple[str, ...]) -> int:
    low = text.lower()
    return sum(1 for hint in hints if hint in low)


def classify_content(text: str) -> str:
    """Return 'workout' or 'recipe' using a lightweight heuristic."""
    workout_score = _count_hints(text, _WORKOUT_HINTS)
    recipe_score = _count_hints(text, _RECIPE_HINTS)
    return "workout" if workout_score >= recipe_score else "recipe"


def classify_content_subtype(text: str) -> str:
    low = text.lower()
    for subtype, hints in _SUBTYPE_HINTS.items():
        if any(hint.lower() in low for hint in hints):
            return subtype
    return "recipe"

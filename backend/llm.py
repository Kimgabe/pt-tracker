"""LLM abstraction with optional OpenAI support and deterministic fallback."""
from __future__ import annotations

import json
import os
import re
from typing import Any

from config import settings

try:  # Optional dependency
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover - optional dependency may be absent
    OpenAI = None


_EXERCISES = [
    "벤치프레스", "인클라인 덤벨 프레스", "오버헤드 프레스", "사이드 레터럴 레이즈", "푸시다운",
    "바벨로우", "풀업", "랫풀다운", "시티드케이블로우", "페이스풀", "바이셉컬",
    "스쿼트", "루마니안데드", "레그프레스", "레그컬", "카프레이즈", "행잉레그레이즈",
]
_INGREDIENT_HINTS = [
    "계란", "달걀", "닭가슴살", "두부", "양파", "마늘", "고추", "고추장", "간장", "설탕",
    "소금", "후추", "버터", "올리브오일", "밥", "쌀", "파스타", "토마토", "치즈", "우유",
]


def _extract_transcript_from_prompt(prompt: str) -> str:
    match = re.search(r"Transcript:\n([\s\S]*)$", prompt)
    return match.group(1) if match else prompt


def _heuristic_json(system_prompt: str, user_prompt: str) -> str:
    transcript = _extract_transcript_from_prompt(user_prompt)
    low = transcript.lower()

    if "exercise names" in user_prompt.lower() or "exercise" in system_prompt.lower():
        exercises = [name for name in _EXERCISES if name.lower() in low or name in transcript]
        workout_type = "strength"
        if any(word in low for word in ["hiit", "interval", "tabata"]):
            workout_type = "hiit"
        elif any(word in low for word in ["yoga", "stretch"]):
            workout_type = "yoga"
        elif any(word in low for word in ["dance", "cardio", "run", "러닝"]):
            workout_type = "cardio"
        return json.dumps({"exercises": exercises, "workout_type": workout_type}, ensure_ascii=False)

    if "ingredients" in user_prompt.lower() or "cooking" in system_prompt.lower():
        ingredients = []
        for hint in _INGREDIENT_HINTS:
            if hint in transcript:
                ingredients.append({"name": hint, "amount": ""})
        dish_name = "" if not ingredients else "홈메이드 요리"
        return json.dumps({"ingredients": ingredients, "is_recipe": bool(ingredients), "dish_name": dish_name}, ensure_ascii=False)

    if "nutrition" in user_prompt.lower() or "nutrition" in system_prompt.lower():
        return json.dumps({
            "nutrition": {"calories": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0},
            "goal_category": "maintain",
            "estimated_cost_krw": 0,
            "cooking_time_min": 0,
            "difficulty": "medium",
            "meal_type": "lunch",
        }, ensure_ascii=False)

    if "summarize workout metadata" in system_prompt.lower():
        return json.dumps({"workout_name": "운동 루틴", "total_duration_min": 30}, ensure_ascii=False)

    if "structure exercise details" in system_prompt.lower() or "workout format" in user_prompt.lower():
        return json.dumps({"workout_format": "sets", "exercises": []}, ensure_ascii=False)

    if "summarize workout metadata" in user_prompt.lower():
        return json.dumps({"workout_name": "운동 루틴", "total_duration_min": 30}, ensure_ascii=False)

    if "extract cooking steps" in system_prompt.lower():
        return json.dumps({"steps": []}, ensure_ascii=False)

    return "{}"


def call_llm_with_fallback(
    system_prompt: str,
    user_prompt: str,
    model_override: str | None = None,
    use_json_mode: bool = False,
) -> str:
    """Call OpenAI if configured, otherwise use deterministic local heuristics."""
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if OpenAI is not None and api_key:
        try:
            client = OpenAI(api_key=api_key, base_url=settings.openai_base_url)
            response = client.chat.completions.create(
                model=model_override or settings.whisper_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"} if use_json_mode else None,
            )
            return response.choices[0].message.content or "{}"
        except Exception:
            pass

    return _heuristic_json(system_prompt, user_prompt)

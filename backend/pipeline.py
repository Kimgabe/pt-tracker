"""Multi-stage LLM extraction pipeline.

Stage 1: Extract exercise/ingredient names (NER)
Stage 2: Structure details (sets/reps/steps)
Stage 3: Meta info (name, duration, nutrition)
"""
import json
import re

from llm import call_llm_with_fallback
from config import settings


def _parse_json(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    raw = raw.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if match:
        raw = match.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {}


def _calculate_durations_from_segments(exercises: list, segments: list) -> None:
    """Calculate actual exercise duration from segment timestamps for time-based workouts."""
    rest_times = []
    for seg in segments:
        text_lower = seg.text.lower()
        if any(w in text_lower for w in ['rest', 'break', '휴식', '쉬어']):
            rest_times.append(int(seg.start))

    for i, ex in enumerate(exercises):
        start = ex.get("timestamp_seconds")
        if start is None:
            continue
        next_rest = None
        for rt in rest_times:
            if rt > start + 5:
                next_rest = rt
                break
        if i + 1 < len(exercises):
            next_ex_start = exercises[i + 1].get("timestamp_seconds")
            if next_ex_start and (next_rest is None or next_ex_start < next_rest):
                next_rest = next_ex_start
        if next_rest:
            duration_sec = next_rest - start
            if 10 <= duration_sec <= 120:
                ex["reps"] = f"{duration_sec}초"
                ex["sets"] = 1

    if len(rest_times) >= 2:
        gaps = [rest_times[i + 1] - rest_times[i] for i in range(len(rest_times) - 1) if 30 <= rest_times[i + 1] - rest_times[i] <= 120]
        if gaps:
            avg_interval = sum(gaps) / len(gaps)
            durations = []
            for ex in exercises:
                reps = ex.get("reps", "")
                if isinstance(reps, str) and "초" in reps:
                    try:
                        durations.append(int(reps.replace("초", "")))
                    except ValueError:
                        pass
            if durations:
                avg_dur = sum(durations) / len(durations)
                rest_sec = max(5, int(avg_interval - avg_dur))
                for ex in exercises:
                    if isinstance(ex.get("reps", ""), str) and "초" in ex.get("reps", ""):
                        ex["rest_seconds"] = rest_sec


def extract_workout_staged(
    transcript_text: str,
    segments=None,
    video_title: str | None = None,
    creator: str | None = None,
) -> dict:
    """Multi-stage workout extraction pipeline."""
    full_text = transcript_text
    if segments:
        indexed = ""
        for i, seg in enumerate(segments):
            indexed += f"[SEG:{i}] {seg.text}\n"
        full_text = indexed

    text = full_text[:6000] if len(full_text) > 6000 else full_text

    # Stage 1: Extract exercise names
    stage1_prompt = """From this transcript, list ONLY the exercise names that are EXPLICITLY mentioned.

Rules:
- List ONLY exercises that are clearly named in the transcript
- Do NOT invent or guess exercises
- If no specific exercises are named (e.g. it's a follow-along dance/cardio), return empty list
- Return Korean names when possible

Return JSON: {"exercises": ["운동명1", "운동명2"], "workout_type": "strength|cardio|hiit|yoga|dance|stretching"}
Return ONLY valid JSON."""

    stage1_result = _parse_json(call_llm_with_fallback(
        system_prompt="You extract exercise names from transcripts. Be precise, never invent.",
        user_prompt=f"{stage1_prompt}\n\nTranscript:\n{full_text}",
        model_override=settings.openai_model_ner,
        use_json_mode=True,
    ))

    exercise_names = stage1_result.get("exercises", [])
    workout_type = stage1_result.get("workout_type", "strength")

    if not exercise_names:
        return {
            "workout_name": "",
            "exercises": [],
            "total_duration_min": 0,
            "estimated_calories": 0,
            "creator": "",
            "workout_type": workout_type,
        }

    # Stage 2: Get details for each exercise
    exercise_list = ", ".join(exercise_names)
    stage2_prompt = f"""For these exercises found in the transcript: [{exercise_list}]

First determine: Is this a SET-BASED workout (e.g. "3 sets of 10 reps") or a TIME-BASED workout (e.g. "30 seconds each exercise")?

Return JSON:
{{"workout_format": "sets|time",
  "exercises": [
  {{"name": "운동명", "sets": 1, "reps": "30초", "rest_seconds": 10, "equipment": ["장비"], "target_muscles": ["부위"], "segment_index": null}}
]}}

Rules:
- FIRST check if the transcript mentions specific durations per exercise (e.g. "30 seconds", "40 seconds", "1 minute"). If yes, this is TIME-BASED.
- For TIME-BASED workouts:
  - sets: usually 1 (unless the circuit is repeated)
  - reps: use the DURATION as string (e.g. "30초", "40초", "1분")
  - rest_seconds: extract from transcript (e.g. "10 second rest" = 10)
- For SET-BASED workouts:
  - sets/reps: Use values from transcript. Default to 3 sets, 10 reps if not mentioned.
  - rest_seconds: Default 60 if not mentioned.
- equipment: Extract from transcript, or infer from exercise type
- target_muscles: Based on exercise type (Korean)
- segment_index: The [SEG:N] number where this exercise is first mentioned. Must be exact.
- Return ONLY valid JSON."""

    stage2_result = _parse_json(call_llm_with_fallback(
        system_prompt="You structure exercise details from transcripts. Use only information from the transcript.",
        user_prompt=f"{stage2_prompt}\n\nTranscript:\n{text}",
        model_override=settings.openai_model_structure,
        use_json_mode=True,
    ))

    exercises = stage2_result.get("exercises", [])

    if segments and exercises:
        for ex in exercises:
            seg_idx = ex.get("segment_index")
            if seg_idx is not None and 0 <= seg_idx < len(segments):
                ex["timestamp_seconds"] = int(segments[seg_idx].start)
            else:
                ex["timestamp_seconds"] = None

    if segments and exercises and workout_type in ("cardio", "hiit", "dance"):
        _calculate_durations_from_segments(exercises, segments)

    # Stage 3: Meta info
    title_hint = f'\nVideo title: "{video_title}"' if video_title else ""
    creator_hint = f'\nCreator: "{creator}"' if creator else ""
    stage3_prompt = f"""Workout with exercises: [{exercise_list}]
Workout type: {workout_type}{title_hint}{creator_hint}

Produce:
- workout_name: a concrete Korean routine name based on the video title if provided. NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes (estimate if unsure).

Return JSON: {{"workout_name": "...", "total_duration_min": 30}}
Return ONLY valid JSON."""

    stage3_result = _parse_json(call_llm_with_fallback(
        system_prompt="You summarize workout metadata.",
        user_prompt=stage3_prompt,
        model_override=settings.openai_model_meta,
        use_json_mode=True,
    ))

    return {
        "workout_name": stage3_result.get("workout_name", ""),
        "exercises": exercises,
        "total_duration_min": stage3_result.get("total_duration_min", 0),
        "estimated_calories": 0,
        "creator": "",
        "workout_type": workout_type,
    }


def extract_recipe_staged(
    transcript_text: str,
    segments=None,
    video_title: str | None = None,
    creator: str | None = None,
) -> dict:
    """Multi-stage recipe extraction pipeline."""
    full_text = transcript_text
    if segments:
        indexed = ""
        for i, seg in enumerate(segments):
            indexed += f"[SEG:{i}] {seg.text}\n"
        full_text = indexed

    text = full_text[:6000] if len(full_text) > 6000 else full_text

    # Stage 1: Extract ingredients
    title_hint = f'\n\nVideo title (use as the dish_name unless transcript clearly says otherwise): "{video_title}"' if video_title else ""
    stage1_prompt = f"""From this transcript, extract ONLY the ingredients and amounts that are EXPLICITLY mentioned.

Rules:
- List ONLY ingredients clearly mentioned in the transcript
- Do NOT invent ingredients
- Include amounts if mentioned
- If this is not a recipe, return empty ingredients and set is_recipe=false
- For dish_name: prefer the Video title (cleaned up). Avoid generic names.
{title_hint}

Return JSON: {{"ingredients": [{{"name": "재료명", "amount": "분량"}}], "is_recipe": true, "dish_name": "요리 이름"}}
Return ONLY valid JSON."""

    stage1_result = _parse_json(call_llm_with_fallback(
        system_prompt="You extract ingredients from cooking transcripts. Be precise, never invent.",
        user_prompt=f"{stage1_prompt}\n\nTranscript:\n{full_text}",
        model_override=settings.openai_model_ner,
        use_json_mode=True,
    ))

    ingredients = stage1_result.get("ingredients", [])
    is_recipe = stage1_result.get("is_recipe", True)
    dish_name = stage1_result.get("dish_name", "")

    # Stage 2: Extract cooking steps
    stage2_prompt = f"""For the dish "{dish_name}" with ingredients: {json.dumps([i.get('name', '') for i in ingredients], ensure_ascii=False)}

Extract the cooking steps from this transcript.

Return JSON:
{{"steps": [
  {{"description": "조리 단계 설명", "segment_index": null}}
]}}

Rules:
- Extract steps in chronological order
- segment_index: The [SEG:N] number where this step starts. Must be exact.
- Use Korean for descriptions
- Return ONLY valid JSON."""

    stage2_result = _parse_json(call_llm_with_fallback(
        system_prompt="You extract cooking steps from transcripts.",
        user_prompt=f"{stage2_prompt}\n\nTranscript:\n{text}",
        model_override=settings.openai_model_structure,
        use_json_mode=True,
    ))

    steps = stage2_result.get("steps", [])

    if segments and steps:
        for step in steps:
            seg_idx = step.get("segment_index")
            if seg_idx is not None and 0 <= seg_idx < len(segments):
                step["timestamp_seconds"] = int(segments[seg_idx].start)
            else:
                step["timestamp_seconds"] = None

    # Stage 3: Nutrition + meta
    ing_names = ", ".join([i.get("name", "") for i in ingredients])
    stage3_prompt = f"""Dish: {dish_name}
Ingredients: {ing_names}

Estimate nutrition per serving and classify:

Return JSON:
{{
  "nutrition": {{"calories": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0}},
  "goal_category": "diet|bulking|maintain",
  "estimated_cost_krw": 0,
  "cooking_time_min": 0,
  "difficulty": "easy|medium|hard",
  "meal_type": "breakfast|lunch|dinner|snack|pre_workout|post_workout"
}}
Return ONLY valid JSON."""

    stage3_result = _parse_json(call_llm_with_fallback(
        system_prompt="You estimate nutrition info for Korean dishes.",
        user_prompt=stage3_prompt,
        model_override=settings.openai_model_meta,
        use_json_mode=True,
    ))

    return {
        "recipe_name": dish_name,
        "ingredients": ingredients,
        "steps": steps,
        "is_recipe": is_recipe,
        "nutrition": stage3_result.get("nutrition", {}),
        "goal_category": stage3_result.get("goal_category", "maintain"),
        "estimated_cost_krw": stage3_result.get("estimated_cost_krw", 0),
        "cooking_time_min": stage3_result.get("cooking_time_min", 0),
        "difficulty": stage3_result.get("difficulty", "medium"),
        "meal_type": stage3_result.get("meal_type", "lunch"),
        "creator": "",
    }

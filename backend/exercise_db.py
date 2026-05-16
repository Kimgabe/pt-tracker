"""Exercise metadata and calorie estimation helpers."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExerciseInfo:
    english_name: str
    primary_muscles: list[str]
    equipment: list[str]
    met_value: float
    difficulty: str


EXERCISE_DB: dict[str, ExerciseInfo] = {
    "벤치프레스": ExerciseInfo("bench press", ["가슴", "삼두", "어깨"], ["바벨", "벤치"], 5.0, "intermediate"),
    "인클라인 덤벨 프레스": ExerciseInfo("incline dumbbell press", ["상부가슴", "삼두", "어깨"], ["덤벨", "벤치"], 4.8, "intermediate"),
    "오버헤드 프레스": ExerciseInfo("overhead press", ["어깨", "삼두"], ["바벨", "덤벨"], 4.5, "intermediate"),
    "사이드 레터럴 레이즈": ExerciseInfo("lateral raise", ["어깨"], ["덤벨"], 3.5, "beginner"),
    "푸시다운": ExerciseInfo("triceps pushdown", ["삼두"], ["케이블"], 3.8, "beginner"),
    "바벨로우": ExerciseInfo("barbell row", ["등", "이두"], ["바벨"], 5.0, "intermediate"),
    "풀업": ExerciseInfo("pull-up", ["등", "이두"], ["철봉"], 6.0, "intermediate"),
    "랫풀다운": ExerciseInfo("lat pulldown", ["등", "이두"], ["케이블"], 4.5, "beginner"),
    "시티드케이블로우": ExerciseInfo("seated cable row", ["등"], ["케이블"], 4.5, "beginner"),
    "페이스풀": ExerciseInfo("face pull", ["후면어깨", "상부등"], ["케이블"], 3.8, "beginner"),
    "바이셉컬": ExerciseInfo("biceps curl", ["이두"], ["덤벨", "바"], 3.5, "beginner"),
    "스쿼트": ExerciseInfo("squat", ["대퇴사두", "둔근", "코어"], ["바벨"], 5.5, "intermediate"),
    "루마니안데드": ExerciseInfo("romanian deadlift", ["햄스트링", "둔근", "코어"], ["바벨"], 5.3, "intermediate"),
    "레그프레스": ExerciseInfo("leg press", ["대퇴사두", "둔근"], ["머신"], 4.8, "beginner"),
    "레그컬": ExerciseInfo("leg curl", ["햄스트링"], ["머신"], 4.0, "beginner"),
    "카프레이즈": ExerciseInfo("calf raise", ["종아리"], ["머신", "덤벨"], 3.8, "beginner"),
    "행잉레그레이즈": ExerciseInfo("hanging leg raise", ["복근"], ["철봉"], 4.5, "intermediate"),
}

_NORMALIZE_MAP = {
    "벤치": "벤치프레스",
    "bench": "벤치프레스",
    "incline dumbbell": "인클라인 덤벨 프레스",
    "ohp": "오버헤드 프레스",
    "shoulder press": "오버헤드 프레스",
    "lateral raise": "사이드 레터럴 레이즈",
    "사레레": "사이드 레터럴 레이즈",
    "triceps pushdown": "푸시다운",
    "row": "바벨로우",
    "pullup": "풀업",
    "pull-up": "풀업",
    "lat pulldown": "랫풀다운",
    "seated cable row": "시티드케이블로우",
    "face pull": "페이스풀",
    "biceps curl": "바이셉컬",
    "squat": "스쿼트",
    "romanian deadlift": "루마니안데드",
    "leg press": "레그프레스",
    "leg curl": "레그컬",
    "calf raise": "카프레이즈",
    "hanging leg raise": "행잉레그레이즈",
}


def normalize_exercise_name(name: str) -> str:
    low = name.strip().lower()
    for key, value in _NORMALIZE_MAP.items():
        if key in low:
            return value
    return name.strip()


def estimate_calories(name: str, total_minutes: float, body_weight_kg: float) -> float:
    canonical = normalize_exercise_name(name)
    info = EXERCISE_DB.get(canonical)
    met = info.met_value if info else 4.0
    hours = max(total_minutes, 0) / 60.0
    return met * body_weight_kg * hours

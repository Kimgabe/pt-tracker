"""Exercise dictionary with Korean/English mappings, synonyms, MET values, and muscle groups."""
from dataclasses import dataclass, field


@dataclass
class ExerciseInfo:
    canonical_name: str   # Standard Korean name
    english_name: str
    met_value: float      # Metabolic Equivalent of Task
    primary_muscles: list[str]
    secondary_muscles: list[str]
    equipment: list[str]
    difficulty: str       # "beginner" | "intermediate" | "advanced"
    alternatives: list[str] = field(default_factory=list)


# Synonym mapping: various Korean/English names -> canonical Korean name
EXERCISE_SYNONYMS: dict[str, str] = {
    # Chest
    "벤프": "벤치프레스", "벤치 프레스": "벤치프레스", "bench press": "벤치프레스", "flat bench press": "벤치프레스", "바벨 벤치프레스": "벤치프레스",
    "인클라인 벤치프레스": "인클라인 벤치프레스", "incline bench press": "인클라인 벤치프레스", "인클라인 벤프": "인클라인 벤치프레스",
    "덤벨 프레스": "덤벨 프레스", "dumbbell press": "덤벨 프레스", "덤프": "덤벨 프레스",
    "인클라인 덤벨 프레스": "인클라인 덤벨 프레스", "incline dumbbell press": "인클라인 덤벨 프레스",
    "케이블 크로스오버": "케이블 크로스오버", "cable crossover": "케이블 크로스오버",
    "딥스": "딥스", "dips": "딥스", "chest dips": "딥스",
    "푸시업": "푸시업", "푸쉬업": "푸시업", "push up": "푸시업", "push-up": "푸시업", "pushup": "푸시업",
    "체스트 플라이": "체스트 플라이", "chest fly": "체스트 플라이", "펙덱 플라이": "체스트 플라이",

    # Back
    "풀업": "풀업", "턱걸이": "풀업", "pull up": "풀업", "pull-up": "풀업", "chinup": "풀업", "chin up": "풀업", "chin-up": "풀업",
    "랫풀다운": "랫풀다운", "lat pulldown": "랫풀다운", "랫 풀다운": "랫풀다운",
    "바벨 로우": "바벨 로우", "barbell row": "바벨 로우", "bent over row": "바벨 로우",
    "덤벨 로우": "덤벨 로우", "dumbbell row": "덤벨 로우", "원암 덤벨 로우": "덤벨 로우",
    "시티드 로우": "시티드 로우", "seated row": "시티드 로우", "케이블 로우": "시티드 로우",
    "데드리프트": "데드리프트", "deadlift": "데드리프트", "컨벤셔널 데드리프트": "데드리프트",
    "루마니안 데드리프트": "루마니안 데드리프트", "romanian deadlift": "루마니안 데드리프트", "rdl": "루마니안 데드리프트", "RDL": "루마니안 데드리프트",

    # Legs
    "스쿼트": "스쿼트", "squat": "스쿼트", "barbell squat": "스쿼트", "바벨 스쿼트": "스쿼트", "백스쿼트": "스쿼트",
    "프론트 스쿼트": "프론트 스쿼트", "front squat": "프론트 스쿼트",
    "레그 프레스": "레그 프레스", "leg press": "레그 프레스",
    "레그 익스텐션": "레그 익스텐션", "leg extension": "레그 익스텐션",
    "레그 컬": "레그 컬", "leg curl": "레그 컬", "햄스트링 컬": "레그 컬",
    "런지": "런지", "lunge": "런지", "lunges": "런지", "워킹 런지": "런지",
    "불가리안 스플릿 스쿼트": "불가리안 스플릿 스쿼트", "bulgarian split squat": "불가리안 스플릿 스쿼트",
    "힙 쓰러스트": "힙 쓰러스트", "hip thrust": "힙 쓰러스트", "힙쓰러스트": "힙 쓰러스트",
    "카프 레이즈": "카프 레이즈", "calf raise": "카프 레이즈", "종아리 운동": "카프 레이즈",

    # Shoulders
    "오버헤드 프레스": "오버헤드 프레스", "overhead press": "오버헤드 프레스", "ohp": "오버헤드 프레스", "밀리터리 프레스": "오버헤드 프레스", "숄더 프레스": "오버헤드 프레스",
    "덤벨 숄더 프레스": "덤벨 숄더 프레스", "dumbbell shoulder press": "덤벨 숄더 프레스",
    "사이드 레터럴 레이즈": "사이드 레터럴 레이즈", "lateral raise": "사이드 레터럴 레이즈", "측면 레이즈": "사이드 레터럴 레이즈", "사레레": "사이드 레터럴 레이즈",
    "프론트 레이즈": "프론트 레이즈", "front raise": "프론트 레이즈",
    "페이스풀": "페이스풀", "face pull": "페이스풀",
    "리어 델트 플라이": "리어 델트 플라이", "rear delt fly": "리어 델트 플라이",

    # Arms
    "바이셉 컬": "바이셉 컬", "bicep curl": "바이셉 컬", "바벨 컬": "바이셉 컬", "이두 컬": "바이셉 컬",
    "해머 컬": "해머 컬", "hammer curl": "해머 컬",
    "트라이셉 익스텐션": "트라이셉 익스텐션", "tricep extension": "트라이셉 익스텐션", "삼두 익스텐션": "트라이셉 익스텐션",
    "트라이셉 푸시다운": "트라이셉 푸시다운", "tricep pushdown": "트라이셉 푸시다운",
    "스컬크러셔": "스컬크러셔", "skull crusher": "스컬크러셔",

    # Core
    "플랭크": "플랭크", "plank": "플랭크",
    "크런치": "크런치", "crunch": "크런치", "crunches": "크런치",
    "레그레이즈": "레그레이즈", "leg raise": "레그레이즈", "행잉 레그레이즈": "레그레이즈",
    "사이드 플랭크": "사이드 플랭크", "side plank": "사이드 플랭크",
    "러시안 트위스트": "러시안 트위스트", "russian twist": "러시안 트위스트",

    # Cardio/Full Body
    "버피": "버피", "burpee": "버피", "burpees": "버피",
    "마운틴 클라이머": "마운틴 클라이머", "mountain climber": "마운틴 클라이머",
    "점핑 잭": "점핑 잭", "jumping jack": "점핑 잭",
    "케틀벨 스윙": "케틀벨 스윙", "kettlebell swing": "케틀벨 스윙",
}

# Exercise database: canonical Korean name -> ExerciseInfo
EXERCISE_DB: dict[str, ExerciseInfo] = {
    # Chest (8 exercises)
    "벤치프레스": ExerciseInfo("벤치프레스", "Bench Press", 6.0, ["대흉근"], ["삼두근", "전면 삼각근"], ["바벨", "벤치"], "intermediate", alternatives=["덤벨 프레스", "푸시업"]),
    "인클라인 벤치프레스": ExerciseInfo("인클라인 벤치프레스", "Incline Bench Press", 5.0, ["상부 대흉근"], ["삼두근", "전면 삼각근"], ["바벨", "인클라인 벤치"], "intermediate", alternatives=["인클라인 덤벨 프레스", "케이블 크로스오버"]),
    "덤벨 프레스": ExerciseInfo("덤벨 프레스", "Dumbbell Press", 5.0, ["대흉근"], ["삼두근", "전면 삼각근"], ["덤벨", "벤치"], "beginner", alternatives=["벤치프레스", "푸시업"]),
    "인클라인 덤벨 프레스": ExerciseInfo("인클라인 덤벨 프레스", "Incline Dumbbell Press", 5.0, ["상부 대흉근"], ["삼두근", "전면 삼각근"], ["덤벨", "인클라인 벤치"], "intermediate"),
    "케이블 크로스오버": ExerciseInfo("케이블 크로스오버", "Cable Crossover", 3.5, ["대흉근"], ["전면 삼각근"], ["케이블 머신"], "intermediate"),
    "딥스": ExerciseInfo("딥스", "Dips", 8.0, ["대흉근", "삼두근"], ["전면 삼각근"], ["딥스 바"], "intermediate", alternatives=["벤치프레스", "트라이셉 푸시다운"]),
    "푸시업": ExerciseInfo("푸시업", "Push Up", 3.8, ["대흉근"], ["삼두근", "전면 삼각근", "코어"], ["맨몸"], "beginner", alternatives=["벤치프레스", "딥스"]),
    "체스트 플라이": ExerciseInfo("체스트 플라이", "Chest Fly", 3.0, ["대흉근"], [], ["덤벨", "벤치"], "beginner"),

    # Back (7)
    "풀업": ExerciseInfo("풀업", "Pull Up", 8.0, ["광배근"], ["이두근", "능형근"], ["철봉"], "intermediate", alternatives=["랫풀다운", "덤벨 로우"]),
    "랫풀다운": ExerciseInfo("랫풀다운", "Lat Pulldown", 5.0, ["광배근"], ["이두근", "능형근"], ["케이블 머신"], "beginner", alternatives=["풀업", "시티드 로우"]),
    "바벨 로우": ExerciseInfo("바벨 로우", "Barbell Row", 6.0, ["광배근", "능형근"], ["이두근", "후면 삼각근"], ["바벨"], "intermediate", alternatives=["덤벨 로우", "시티드 로우"]),
    "덤벨 로우": ExerciseInfo("덤벨 로우", "Dumbbell Row", 5.0, ["광배근"], ["이두근", "능형근"], ["덤벨", "벤치"], "beginner"),
    "시티드 로우": ExerciseInfo("시티드 로우", "Seated Row", 5.0, ["광배근", "능형근"], ["이두근"], ["케이블 머신"], "beginner"),
    "데드리프트": ExerciseInfo("데드리프트", "Deadlift", 6.0, ["하부 등", "둔근", "햄스트링"], ["전완근", "승모근", "코어"], ["바벨"], "advanced", alternatives=["루마니안 데드리프트", "바벨 로우"]),
    "루마니안 데드리프트": ExerciseInfo("루마니안 데드리프트", "Romanian Deadlift", 5.5, ["햄스트링", "둔근"], ["하부 등"], ["바벨"], "intermediate"),

    # Legs (9)
    "스쿼트": ExerciseInfo("스쿼트", "Squat", 6.0, ["대퇴사두근", "둔근"], ["햄스트링", "코어"], ["바벨", "스쿼트 랙"], "intermediate", alternatives=["레그 프레스", "런지"]),
    "프론트 스쿼트": ExerciseInfo("프론트 스쿼트", "Front Squat", 6.0, ["대퇴사두근"], ["코어", "상부 등"], ["바벨", "스쿼트 랙"], "advanced"),
    "레그 프레스": ExerciseInfo("레그 프레스", "Leg Press", 5.0, ["대퇴사두근", "둔근"], ["햄스트링"], ["레그 프레스 머신"], "beginner", alternatives=["스쿼트", "런지"]),
    "레그 익스텐션": ExerciseInfo("레그 익스텐션", "Leg Extension", 3.0, ["대퇴사두근"], [], ["레그 익스텐션 머신"], "beginner"),
    "레그 컬": ExerciseInfo("레그 컬", "Leg Curl", 3.0, ["햄스트링"], [], ["레그 컬 머신"], "beginner"),
    "런지": ExerciseInfo("런지", "Lunge", 5.0, ["대퇴사두근", "둔근"], ["햄스트링", "코어"], ["덤벨"], "beginner", alternatives=["불가리안 스플릿 스쿼트", "레그 프레스"]),
    "불가리안 스플릿 스쿼트": ExerciseInfo("불가리안 스플릿 스쿼트", "Bulgarian Split Squat", 5.5, ["대퇴사두근", "둔근"], ["햄스트링"], ["덤벨", "벤치"], "intermediate"),
    "힙 쓰러스트": ExerciseInfo("힙 쓰러스트", "Hip Thrust", 5.0, ["둔근"], ["햄스트링"], ["바벨", "벤치"], "intermediate"),
    "카프 레이즈": ExerciseInfo("카프 레이즈", "Calf Raise", 3.0, ["비복근", "가자미근"], [], ["맨몸"], "beginner"),

    # Shoulders (6)
    "오버헤드 프레스": ExerciseInfo("오버헤드 프레스", "Overhead Press", 6.0, ["삼각근"], ["삼두근", "코어"], ["바벨"], "intermediate", alternatives=["덤벨 숄더 프레스", "사이드 레터럴 레이즈"]),
    "덤벨 숄더 프레스": ExerciseInfo("덤벨 숄더 프레스", "Dumbbell Shoulder Press", 5.0, ["삼각근"], ["삼두근"], ["덤벨"], "beginner"),
    "사이드 레터럴 레이즈": ExerciseInfo("사이드 레터럴 레이즈", "Lateral Raise", 3.0, ["측면 삼각근"], [], ["덤벨"], "beginner"),
    "프론트 레이즈": ExerciseInfo("프론트 레이즈", "Front Raise", 3.0, ["전면 삼각근"], [], ["덤벨"], "beginner"),
    "페이스풀": ExerciseInfo("페이스풀", "Face Pull", 3.0, ["후면 삼각근", "능형근"], [], ["케이블 머신"], "beginner"),
    "리어 델트 플라이": ExerciseInfo("리어 델트 플라이", "Rear Delt Fly", 3.0, ["후면 삼각근"], [], ["덤벨"], "beginner"),

    # Arms (5)
    "바이셉 컬": ExerciseInfo("바이셉 컬", "Bicep Curl", 3.0, ["이두근"], ["전완근"], ["덤벨"], "beginner"),
    "해머 컬": ExerciseInfo("해머 컬", "Hammer Curl", 3.0, ["이두근", "전완근"], [], ["덤벨"], "beginner"),
    "트라이셉 익스텐션": ExerciseInfo("트라이셉 익스텐션", "Tricep Extension", 3.0, ["삼두근"], [], ["덤벨"], "beginner"),
    "트라이셉 푸시다운": ExerciseInfo("트라이셉 푸시다운", "Tricep Pushdown", 3.0, ["삼두근"], [], ["케이블 머신"], "beginner"),
    "스컬크러셔": ExerciseInfo("스컬크러셔", "Skull Crusher", 3.0, ["삼두근"], [], ["이지바", "벤치"], "intermediate"),

    # Core (5)
    "플랭크": ExerciseInfo("플랭크", "Plank", 3.8, ["코어"], ["삼각근", "둔근"], ["맨몸"], "beginner", alternatives=["사이드 플랭크", "크런치"]),
    "크런치": ExerciseInfo("크런치", "Crunch", 2.8, ["복직근"], [], ["맨몸"], "beginner"),
    "레그레이즈": ExerciseInfo("레그레이즈", "Leg Raise", 3.0, ["하복부", "고관절 굴근"], [], ["맨몸"], "beginner"),
    "사이드 플랭크": ExerciseInfo("사이드 플랭크", "Side Plank", 3.8, ["복사근", "코어"], [], ["맨몸"], "beginner"),
    "러시안 트위스트": ExerciseInfo("러시안 트위스트", "Russian Twist", 3.0, ["복사근"], ["코어"], ["맨몸"], "beginner"),

    # Cardio/Full Body (4)
    "버피": ExerciseInfo("버피", "Burpee", 8.0, ["전신"], [], ["맨몸"], "intermediate", alternatives=["마운틴 클라이머", "점핑 잭"]),
    "마운틴 클라이머": ExerciseInfo("마운틴 클라이머", "Mountain Climber", 8.0, ["코어", "대퇴사두근"], ["삼각근"], ["맨몸"], "beginner"),
    "점핑 잭": ExerciseInfo("점핑 잭", "Jumping Jack", 8.0, ["전신"], [], ["맨몸"], "beginner"),
    "케틀벨 스윙": ExerciseInfo("케틀벨 스윙", "Kettlebell Swing", 6.0, ["둔근", "햄스트링"], ["코어", "삼각근"], ["케틀벨"], "intermediate"),
}


def normalize_exercise_name(name: str) -> str | None:
    """Normalize an exercise name to its canonical Korean form.
    Returns None if exercise is not found in dictionary."""
    name_lower = name.strip().lower()
    result = EXERCISE_SYNONYMS.get(name_lower) or EXERCISE_SYNONYMS.get(name)
    if result:
        return result
    # Already a canonical name
    if name in EXERCISE_DB:
        return name
    return None


def get_exercise_info(canonical_name: str) -> ExerciseInfo | None:
    """Get exercise info by canonical name."""
    return EXERCISE_DB.get(canonical_name)


def calculate_calories(canonical_name: str, duration_minutes: float, body_weight_kg: float = 70.0) -> float:
    """Calculate estimated calories burned using MET formula.
    Calories = MET x weight(kg) x duration(hours)"""
    info = EXERCISE_DB.get(canonical_name)
    if not info:
        return 0.0
    return info.met_value * body_weight_kg * (duration_minutes / 60.0)


# Keyword → estimated MET, used when an exercise name is not in EXERCISE_DB.
# Sorted longest-first within each MET tier so "사이드 플랭크" matches before "플랭크".
_FALLBACK_MET_KEYWORDS: list[tuple[str, float]] = [
    # High intensity (cardio / compound)
    ("burpee", 8.0), ("버피", 8.0),
    ("mountain climber", 8.0), ("마운틴", 8.0),
    ("jumping jack", 8.0), ("점핑", 8.0),
    ("dip", 8.0), ("딥스", 8.0),
    ("스쿼트 점프", 8.0), ("점프 스쿼트", 8.0),
    # Medium-high (large compound moves)
    ("deadlift", 6.0), ("데드리프트", 6.0),
    ("squat", 6.0), ("스쿼트", 6.0),
    ("bench press", 6.0), ("벤치프레스", 6.0), ("벤치 프레스", 6.0),
    ("overhead press", 6.0), ("밀리터리", 6.0),
    ("lunge", 5.0), ("런지", 5.0),
    ("kettlebell swing", 6.0), ("케틀벨", 6.0),
    ("hip thrust", 5.0), ("힙 쓰러스트", 5.0), ("힙쓰러스트", 5.0),
    # Medium (presses, rows, pulldowns)
    ("press", 5.0), ("프레스", 5.0),
    ("row", 5.0), ("로우", 5.0),
    ("pulldown", 5.0), ("풀다운", 5.0),
    ("pull up", 8.0), ("pullup", 8.0), ("풀업", 8.0), ("턱걸이", 8.0),
    ("push up", 4.0), ("pushup", 4.0), ("푸시업", 4.0), ("푸쉬업", 4.0),
    # Lower intensity (isolation / fly / extension)
    ("fly", 3.0), ("플라이", 3.0),
    ("curl", 3.0), ("컬", 3.0),
    ("extension", 3.0), ("익스텐션", 3.0),
    ("raise", 3.0), ("레이즈", 3.0),
    ("kickback", 3.5), ("킥백", 3.5),
    ("crunch", 3.0), ("크런치", 3.0),
    ("plank", 3.8), ("플랭크", 3.8),
    ("twist", 3.0), ("트위스트", 3.0),
    ("leg raise", 3.0), ("레그레이즈", 3.0),
    ("calf", 3.0), ("카프", 3.0), ("종아리", 3.0),
]


def infer_met_from_name(name: str) -> float:
    """Best-effort MET estimate for exercises not in EXERCISE_DB.

    Returns 4.0 (moderate effort) if no keyword matches, so calories never stay 0.
    """
    n = name.lower().strip()
    for kw, met in _FALLBACK_MET_KEYWORDS:
        if kw in n:
            return met
    return 4.0  # Default for any named resistance exercise (avoids 0 calories)


def estimate_calories(name: str, duration_minutes: float, body_weight_kg: float = 70.0) -> float:
    """Calorie estimate that falls back to keyword-inferred MET when an exercise
    is not in EXERCISE_DB. Use this in pipelines that accept arbitrary LLM names.
    """
    canonical = normalize_exercise_name(name)
    if canonical:
        info = EXERCISE_DB.get(canonical)
        if info:
            return info.met_value * body_weight_kg * (duration_minutes / 60.0)
    met = infer_met_from_name(name)
    return met * body_weight_kg * (duration_minutes / 60.0)

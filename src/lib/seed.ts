import db from './db';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export function calculateLevel(tests: {
  pushup_max: number;
  pullup_max: number;
  plank_seconds: number;
  squat_max: number;
}): FitnessLevel {
  let score = 0;

  // Pushup scoring (0-3)
  if (tests.pushup_max >= 25) score += 3;
  else if (tests.pushup_max >= 10) score += 2;
  else score += 1;

  // Pullup scoring (0-3) — weighted heavier, harder movement
  if (tests.pullup_max >= 8) score += 3;
  else if (tests.pullup_max >= 3) score += 2;
  else if (tests.pullup_max >= 1) score += 1;

  // Plank scoring (0-3)
  if (tests.plank_seconds >= 90) score += 3;
  else if (tests.plank_seconds >= 30) score += 2;
  else score += 1;

  // Squat scoring (0-3)
  if (tests.squat_max >= 30) score += 3;
  else if (tests.squat_max >= 15) score += 2;
  else score += 1;

  // Total: 4-12
  if (score >= 10) return 'advanced';
  if (score >= 6) return 'intermediate';
  return 'beginner';
}

const levelConfig = {
  beginner: {
    pushSets: 3, pullSets: 3, legSets: 3, hiitSets: 2,
    pushReps: '8-12', pullReps: '3-6', legReps: '10-15', coreTime: '20초',
    rest: 90, hiitRest: 60,
    programName: '홈트 PPL 입문',
    programDesc: '맨몸+철봉 4일 분할 - 입문자용 (기초 체력 형성)',
  },
  intermediate: {
    pushSets: 3, pullSets: 3, legSets: 3, hiitSets: 3,
    pushReps: '12-15', pullReps: '6-10', legReps: '15-20', coreTime: '30초',
    rest: 60, hiitRest: 45,
    programName: '홈트 PPL 다이어트',
    programDesc: '맨몸+철봉 4일 분할 - 다이어트 목적 홈트레이닝',
  },
  advanced: {
    pushSets: 4, pullSets: 4, legSets: 4, hiitSets: 4,
    pushReps: '15-20', pullReps: '8-12', legReps: '20-25', coreTime: '45초',
    rest: 45, hiitRest: 30,
    programName: '홈트 PPL 고급',
    programDesc: '맨몸+철봉 4일 분할 - 고강도 홈트레이닝',
  },
};

export async function seedDatabase() {
  const existing = await db.execute('SELECT COUNT(*) as cnt FROM exercises');
  if ((existing.rows[0].cnt as number) > 0) return;
  await insertHomeTrainingData('intermediate');
}

export async function reseedDatabase(level: FitnessLevel = 'intermediate') {
  await db.execute('PRAGMA foreign_keys = OFF');
  await db.execute('DROP TABLE IF EXISTS workout_sets');
  await db.execute('DROP TABLE IF EXISTS workout_sessions');
  await db.execute('DROP TABLE IF EXISTS program_day_exercises');
  await db.execute('DROP TABLE IF EXISTS program_days');
  await db.execute('DROP TABLE IF EXISTS programs');
  await db.execute('DROP TABLE IF EXISTS exercises');
  await db.execute('PRAGMA foreign_keys = ON');
  const { initializeDatabase } = await import('./schema');
  await initializeDatabase();
  await insertHomeTrainingData(level);
}

async function insertHomeTrainingData(level: FitnessLevel) {
  const cfg = levelConfig[level];

  const exercises = [
    // Push
    ['푸시업', 'push', '가슴/삼두', 'bodyweight'],
    ['와이드 푸시업', 'push', '가슴 외측', 'bodyweight'],
    ['다이아몬드 푸시업', 'push', '삼두/내측가슴', 'bodyweight'],
    ['디클라인 푸시업', 'push', '상부가슴/어깨', 'bodyweight'],
    ['파이크 푸시업', 'push', '어깨 전면', 'bodyweight'],
    ['의자 딥스', 'push', '삼두/가슴', 'bodyweight'],
    // Pull
    ['풀업', 'pull', '광배/이두', 'pullup_bar'],
    ['친업', 'pull', '이두/광배', 'pullup_bar'],
    ['와이드 풀업', 'pull', '광배 외측', 'pullup_bar'],
    ['행잉 레그레이즈', 'pull', '하복부', 'pullup_bar'],
    ['네거티브 풀업', 'pull', '광배/이두', 'pullup_bar'],
    // Legs
    ['스쿼트', 'legs', '대퇴사두/둔근', 'bodyweight'],
    ['점프 스쿼트', 'legs', '대퇴사두/폭발력', 'bodyweight'],
    ['런지', 'legs', '대퇴사두/둔근', 'bodyweight'],
    ['불가리안 스플릿 스쿼트', 'legs', '대퇴사두/둔근', 'bodyweight'],
    ['월 싯', 'legs', '대퇴사두', 'bodyweight'],
    ['카프레이즈', 'legs', '종아리', 'bodyweight'],
    ['글루트 브릿지', 'legs', '둔근/햄스트링', 'bodyweight'],
    // Core
    ['플랭크', 'core', '코어 전체', 'bodyweight'],
    ['사이드 플랭크', 'core', '복사근', 'bodyweight'],
    ['마운틴 클라이머', 'core', '코어/유산소', 'bodyweight'],
    ['바이시클 크런치', 'core', '복직근/복사근', 'bodyweight'],
    ['레그레이즈', 'core', '하복부', 'bodyweight'],
    // Cardio
    ['버피', 'cardio', '전신', 'bodyweight'],
    ['하이니', 'cardio', '전신/심폐', 'bodyweight'],
    ['점핑잭', 'cardio', '전신/심폐', 'bodyweight'],
    // Beginner extras
    ['무릎 푸시업', 'push', '가슴/삼두', 'bodyweight'],
    ['인클라인 푸시업', 'push', '가슴 하부', 'bodyweight'],
    ['데드행', 'pull', '그립/광배', 'pullup_bar'],
    ['하프 스쿼트', 'legs', '대퇴사두', 'bodyweight'],
  ];

  for (const [name, category, muscle, equip] of exercises) {
    await db.execute({
      sql: 'INSERT INTO exercises (name, category, muscle_group, equipment) VALUES (?, ?, ?, ?)',
      args: [name, category, muscle, equip],
    });
  }

  await db.execute({
    sql: 'INSERT INTO programs (id, name, description, days_per_week) VALUES (1, ?, ?, 4)',
    args: [cfg.programName, cfg.programDesc],
  });

  const days = [
    [1, 1, 'Push Day', '가슴/어깨/삼두'],
    [2, 1, 'Pull Day', '등/이두 (철봉)'],
    [3, 1, 'Legs Day', '하체/둔근'],
    [4, 1, 'HIIT + Core', '전신 서킷/코어'],
  ];

  for (const [dayNum, progId, name, focus] of days) {
    await db.execute({
      sql: 'INSERT INTO program_days (id, program_id, day_number, name, focus) VALUES (?, ?, ?, ?, ?)',
      args: [dayNum, progId, dayNum, name, focus],
    });
  }

  // Level-specific exercise programming
  // Exercise IDs: 1-6 push, 7-11 pull, 12-18 legs, 19-23 core, 24-26 cardio, 27-30 beginner extras
  let allDayExercises: (string | number | null)[][] = [];

  if (level === 'beginner') {
    // Easier variations, fewer sets, longer rest
    allDayExercises = [
      // Push Day — easier variations
      [1, 27, 3, '8-12', 90, 1, '무릎 대고'],           // 무릎 푸시업
      [1, 28, 3, '8-12', 90, 2, '테이블/벽에 손 짚고'],  // 인클라인 푸시업
      [1, 1, 2, '최대', 90, 3, '기본 푸시업 도전'],       // 푸시업
      [1, 5, 2, '6-8', 90, 4, '어깨 집중'],              // 파이크 푸시업
      [1, 6, 3, '8-12', 90, 5, '의자 이용'],             // 의자 딥스
      // Pull Day — 네거티브 중심
      [2, 29, 3, '15-20초', 90, 1, '매달리기만'],         // 데드행
      [2, 11, 4, '3-5', 120, 2, '천천히 내려오기 5초'],   // 네거티브 풀업
      [2, 8, 3, '최대', 120, 3, '언더그립, 안되면 네거티브'], // 친업
      [2, 10, 3, '8-10', 60, 4, '무릎 올리기도 OK'],     // 행잉 레그레이즈
      // Legs Day
      [3, 30, 3, '15-20', 60, 1, '반만 내려가기'],       // 하프 스쿼트
      [3, 12, 3, '10-15', 90, 2, '풀 스쿼트 도전'],      // 스쿼트
      [3, 14, 3, '8-10(각)', 90, 3, '교대로'],           // 런지
      [3, 18, 3, '12-15', 60, 4, null],                  // 글루트 브릿지
      [3, 17, 3, '15-20', 45, 5, '계단 모서리 이용'],     // 카프레이즈
      [3, 16, 2, '20초', 60, 6, '벽에 기대서'],           // 월 싯
      // HIIT + Core — 가벼운 서킷
      [4, 26, 2, '20', 60, 1, '가볍게'],                 // 점핑잭
      [4, 25, 2, '20초', 60, 2, '제자리 빠르게'],         // 하이니
      [4, 27, 2, '10-15', 45, 3, '무릎 대고'],           // 무릎 푸시업
      [4, 12, 2, '15', 45, 4, null],                     // 스쿼트
      [4, 19, 2, '20초', 45, 5, null],                   // 플랭크
      [4, 22, 2, '10(각)', 45, 6, null],                 // 바이시클 크런치
      [4, 23, 2, '10', 45, 7, '바닥에 누워서'],           // 레그레이즈
    ];
  } else if (level === 'advanced') {
    // More sets, higher reps, shorter rest
    allDayExercises = [
      // Push Day
      [1, 1, 4, '20-25', 45, 1, '기본 푸시업'],
      [1, 2, 4, '15-20', 45, 2, '팔 넓게'],
      [1, 4, 4, '15-20', 45, 3, '발을 의자/침대 위에'],
      [1, 5, 4, '12-15', 60, 4, '어깨 집중, 엉덩이 높이 들기'],
      [1, 3, 4, '12-15', 45, 5, '손 모아서'],
      [1, 6, 4, '15-20', 45, 6, '의자 이용'],
      // Pull Day
      [2, 7, 5, '10-12', 90, 1, '오버그립'],
      [2, 8, 4, '10-12', 90, 2, '언더그립, 이두 집중'],
      [2, 9, 4, '8-10', 90, 3, '넓은 그립'],
      [2, 11, 3, '8-10', 60, 4, '추가 세트'],
      [2, 10, 4, '15-20', 45, 5, '철봉 매달려서'],
      // Legs Day
      [3, 12, 5, '25-30', 45, 1, null],
      [3, 14, 4, '15-20(각)', 45, 2, '교대로'],
      [3, 15, 4, '12-15(각)', 60, 3, '의자/소파 이용'],
      [3, 13, 4, '15-20', 45, 4, '폭발적으로'],
      [3, 18, 4, '20', 45, 5, '한 다리씩'],
      [3, 16, 3, '45초', 45, 6, '벽에 기대서'],
      [3, 17, 4, '25-30', 30, 7, '계단 모서리 이용'],
      // HIIT + Core — 고강도
      [4, 24, 5, '12-15', 45, 1, '전력으로'],
      [4, 1, 4, '20-25', 30, 2, null],
      [4, 7, 4, '최대', 45, 3, null],
      [4, 12, 4, '25', 30, 4, null],
      [4, 21, 4, '45초', 30, 5, '빠르게'],
      [4, 19, 4, '60초', 30, 6, null],
      [4, 20, 3, '30초(각)', 30, 7, '양쪽'],
      [4, 22, 4, '25(각)', 30, 8, null],
      [4, 23, 4, '20', 30, 9, '바닥에 누워서'],
    ];
  } else {
    // Intermediate (default)
    allDayExercises = [
      // Push Day
      [1, 1, 4, '15-20', 60, 1, '기본 푸시업'],
      [1, 2, 3, '12-15', 60, 2, '팔 넓게'],
      [1, 4, 3, '10-15', 60, 3, '발을 의자/침대 위에'],
      [1, 5, 3, '8-12', 90, 4, '어깨 집중, 엉덩이 높이 들기'],
      [1, 3, 3, '8-12', 60, 5, '손 모아서'],
      [1, 6, 3, '10-15', 60, 6, '의자 이용'],
      // Pull Day
      [2, 7, 4, '6-10', 120, 1, '오버그립'],
      [2, 8, 3, '6-10', 120, 2, '언더그립, 이두 집중'],
      [2, 9, 3, '4-8', 120, 3, '넓은 그립'],
      [2, 11, 3, '5-8', 90, 4, '못하면 네거티브로'],
      [2, 10, 3, '10-15', 60, 5, '철봉 매달려서'],
      // Legs Day
      [3, 12, 4, '15-20', 60, 1, null],
      [3, 14, 3, '12-15(각)', 60, 2, '교대로'],
      [3, 15, 3, '10-12(각)', 90, 3, '의자/소파 이용'],
      [3, 13, 3, '12-15', 60, 4, '폭발적으로'],
      [3, 18, 3, '12-15', 60, 5, null],
      [3, 16, 3, '30초', 60, 6, '벽에 기대서'],
      [3, 17, 3, '20-25', 45, 7, '계단 모서리 이용'],
      // HIIT + Core
      [4, 24, 4, '10', 60, 1, '전력으로'],
      [4, 1, 3, '15-20', 45, 2, null],
      [4, 7, 3, '최대', 60, 3, null],
      [4, 12, 3, '20', 45, 4, null],
      [4, 21, 3, '30초', 45, 5, '빠르게'],
      [4, 19, 3, '45초', 45, 6, null],
      [4, 22, 3, '20(각)', 45, 7, null],
      [4, 23, 3, '15', 45, 8, '바닥에 누워서'],
    ];
  }

  for (const [dayId, exId, sets, reps, rest, order, notes] of allDayExercises) {
    await db.execute({
      sql: `INSERT INTO program_day_exercises
            (program_day_id, exercise_id, sets, reps, rest_seconds, order_num, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [dayId, exId, sets, reps, rest, order, notes],
    });
  }
}

import db from './db';

export async function seedDatabase() {
  // Check if already seeded
  const existing = await db.execute('SELECT COUNT(*) as cnt FROM exercises');
  if ((existing.rows[0].cnt as number) > 0) return;
  await insertHomeTrainingData();
}

export async function reseedDatabase() {
  // Disable FK checks, drop all tables, then recreate and reseed
  await db.execute('PRAGMA foreign_keys = OFF');
  await db.execute('DROP TABLE IF EXISTS workout_sets');
  await db.execute('DROP TABLE IF EXISTS workout_sessions');
  await db.execute('DROP TABLE IF EXISTS program_day_exercises');
  await db.execute('DROP TABLE IF EXISTS program_days');
  await db.execute('DROP TABLE IF EXISTS programs');
  await db.execute('DROP TABLE IF EXISTS exercises');
  await db.execute('DROP TABLE IF EXISTS meals');
  await db.execute('DROP TABLE IF EXISTS body_logs');
  await db.execute('PRAGMA foreign_keys = ON');
  // Reimport and recreate
  const { initializeDatabase } = await import('./schema');
  await initializeDatabase();
  await insertHomeTrainingData();
}

async function insertHomeTrainingData() {
  // Home training exercise catalog (bodyweight + pull-up bar only)
  const exercises = [
    // Push (가슴/어깨/삼두)
    ['푸시업', 'push', '가슴/삼두', 'bodyweight'],
    ['와이드 푸시업', 'push', '가슴 외측', 'bodyweight'],
    ['다이아몬드 푸시업', 'push', '삼두/내측가슴', 'bodyweight'],
    ['디클라인 푸시업', 'push', '상부가슴/어깨', 'bodyweight'],
    ['파이크 푸시업', 'push', '어깨 전면', 'bodyweight'],
    ['의자 딥스', 'push', '삼두/가슴', 'bodyweight'],
    // Pull (등/이두)
    ['풀업', 'pull', '광배/이두', 'pullup_bar'],
    ['친업', 'pull', '이두/광배', 'pullup_bar'],
    ['와이드 풀업', 'pull', '광배 외측', 'pullup_bar'],
    ['행잉 레그레이즈', 'pull', '하복부', 'pullup_bar'],
    ['네거티브 풀업', 'pull', '광배/이두', 'pullup_bar'],
    // Legs (하체)
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
  ];

  for (const [name, category, muscle, equip] of exercises) {
    await db.execute({
      sql: 'INSERT INTO exercises (name, category, muscle_group, equipment) VALUES (?, ?, ?, ?)',
      args: [name, category, muscle, equip],
    });
  }

  // Home Training PPL Program
  await db.execute({
    sql: 'INSERT INTO programs (id, name, description, days_per_week) VALUES (1, ?, ?, 4)',
    args: ['홈트 PPL 다이어트', '맨몸+철봉 4일 분할 - 다이어트 목적 홈트레이닝'],
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

  // Day 1: Push — 푸시업 변형 + 어깨 + 삼두
  const pushExercises = [
    [1, 1, 4, '15-20', 60, 1, '기본 푸시업'],
    [1, 2, 3, '12-15', 60, 2, '팔 넓게'],
    [1, 4, 3, '10-15', 60, 3, '발을 의자/침대 위에'],
    [1, 5, 3, '8-12', 90, 4, '어깨 집중, 엉덩이 높이 들기'],
    [1, 3, 3, '8-12', 60, 5, '손 모아서'],
    [1, 6, 3, '10-15', 60, 6, '의자 이용'],
  ];

  // Day 2: Pull — 철봉 중심
  const pullExercises = [
    [2, 7, 4, '6-10', 120, 1, '오버그립'],
    [2, 8, 3, '6-10', 120, 2, '언더그립, 이두 집중'],
    [2, 9, 3, '4-8', 120, 3, '넓은 그립'],
    [2, 11, 3, '5-8', 90, 4, '못하면 네거티브로'],
    [2, 10, 3, '10-15', 60, 5, '철봉 매달려서'],
  ];

  // Day 3: Legs — 맨몸 하체
  const legExercises = [
    [3, 12, 4, '15-20', 60, 1, null],
    [3, 14, 3, '12-15(각)', 60, 2, '교대로'],
    [3, 15, 3, '10-12(각)', 90, 3, '의자/소파 이용'],
    [3, 13, 3, '12-15', 60, 4, '폭발적으로'],
    [3, 18, 3, '12-15', 60, 5, null],
    [3, 16, 3, '30초', 60, 6, '벽에 기대서'],
    [3, 17, 3, '20-25', 45, 7, '계단 모서리 이용'],
  ];

  // Day 4: HIIT + Core — 전신 서킷
  const hiitExercises = [
    [4, 24, 4, '10', 60, 1, '전력으로'],
    [4, 1, 3, '15-20', 45, 2, null],
    [4, 7, 3, '최대', 60, 3, null],
    [4, 12, 3, '20', 45, 4, null],
    [4, 21, 3, '30초', 45, 5, '빠르게'],
    [4, 19, 3, '45초', 45, 6, null],
    [4, 22, 3, '20(각)', 45, 7, null],
    [4, 23, 3, '15', 45, 8, '바닥에 누워서'],
  ];

  const allDayExercises = [...pushExercises, ...pullExercises, ...legExercises, ...hiitExercises];

  for (const [dayId, exId, sets, reps, rest, order, notes] of allDayExercises) {
    await db.execute({
      sql: `INSERT INTO program_day_exercises
            (program_day_id, exercise_id, sets, reps, rest_seconds, order_num, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [dayId, exId, sets, reps, rest, order, notes],
    });
  }
}

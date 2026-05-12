import db from './db';

export async function seedDatabase() {
  // Check if already seeded
  const existing = await db.execute('SELECT COUNT(*) as cnt FROM exercises');
  if ((existing.rows[0].cnt as number) > 0) return;

  // Exercise catalog
  const exercises = [
    // Push
    ['벤치프레스', 'push', '가슴', 'barbell'],
    ['인클라인 덤벨프레스', 'push', '상부가슴', 'dumbbell'],
    ['오버헤드프레스', 'push', '어깨 전면', 'barbell'],
    ['사이드 레터럴 레이즈', 'push', '어깨 측면', 'dumbbell'],
    ['트라이셉 푸시다운', 'push', '삼두', 'cable'],
    ['딥스', 'push', '가슴/삼두', 'bodyweight'],
    // Pull
    ['바벨 로우', 'pull', '등 중부', 'barbell'],
    ['풀업', 'pull', '광배', 'bodyweight'],
    ['랫풀다운', 'pull', '광배', 'cable'],
    ['페이스풀', 'pull', '후면삼각/승모', 'cable'],
    ['바이셉 컬', 'pull', '이두', 'dumbbell'],
    ['시티드 케이블 로우', 'pull', '등 중부', 'cable'],
    // Legs
    ['스쿼트', 'legs', '대퇴사두', 'barbell'],
    ['루마니안 데드리프트', 'legs', '햄스트링', 'barbell'],
    ['레그프레스', 'legs', '대퇴사두', 'machine'],
    ['레그컬', 'legs', '햄스트링', 'machine'],
    ['카프레이즈', 'legs', '종아리', 'machine'],
    ['불가리안 스플릿 스쿼트', 'legs', '대퇴사두/둔근', 'dumbbell'],
    // Core
    ['플랭크', 'core', '코어', 'bodyweight'],
    ['행잉 레그레이즈', 'core', '하복부', 'bodyweight'],
    // Cardio
    ['트레드밀 인클라인 걷기', 'cardio', '전신', 'machine'],
  ];

  for (const [name, category, muscle, equip] of exercises) {
    await db.execute({
      sql: 'INSERT INTO exercises (name, category, muscle_group, equipment) VALUES (?, ?, ?, ?)',
      args: [name, category, muscle, equip],
    });
  }

  // PPL Program
  await db.execute({
    sql: 'INSERT INTO programs (id, name, description, days_per_week) VALUES (1, ?, ?, 4)',
    args: ['PPL 다이어트', 'Push/Pull/Legs 4일 분할 - 칼로리 적자 시 근손실 최소화'],
  });

  const days = [
    [1, 1, 'Push Day', '가슴/어깨/삼두'],
    [2, 1, 'Pull Day', '등/이두'],
    [3, 1, 'Legs Day', '하체/코어'],
    [4, 1, 'Upper Day', '상체 복합'],
  ];

  for (const [dayNum, progId, name, focus] of days) {
    await db.execute({
      sql: 'INSERT INTO program_days (id, program_id, day_number, name, focus) VALUES (?, ?, ?, ?, ?)',
      args: [dayNum, progId, dayNum, name, focus],
    });
  }

  // Day 1: Push
  const pushExercises = [
    [1, 1, 4, '8-10', 120, 1, null],    // 벤치프레스
    [1, 2, 3, '10-12', 90, 2, null],     // 인클라인 덤벨
    [1, 3, 3, '8-10', 120, 3, null],     // OHP
    [1, 4, 3, '12-15', 60, 4, null],     // 사이드레터럴
    [1, 5, 3, '12-15', 60, 5, null],     // 트라이셉
  ];

  // Day 2: Pull
  const pullExercises = [
    [2, 7, 4, '8-10', 120, 1, null],     // 바벨로우
    [2, 8, 3, '6-10', 120, 2, '못하면 랫풀다운'],
    [2, 12, 3, '10-12', 90, 3, null],    // 시티드로우
    [2, 10, 3, '15-20', 60, 4, null],    // 페이스풀
    [2, 11, 3, '10-12', 60, 5, null],    // 바이셉컬
  ];

  // Day 3: Legs
  const legExercises = [
    [3, 13, 4, '8-10', 180, 1, null],    // 스쿼트
    [3, 14, 3, '10-12', 120, 2, null],   // RDL
    [3, 15, 3, '10-12', 90, 3, null],    // 레그프레스
    [3, 16, 3, '12-15', 60, 4, null],    // 레그컬
    [3, 17, 3, '15-20', 60, 5, null],    // 카프레이즈
  ];

  // Day 4: Upper (lighter)
  const upperExercises = [
    [4, 1, 3, '10-12', 90, 1, '가볍게'], // 벤치프레스
    [4, 9, 3, '10-12', 90, 2, null],     // 랫풀다운
    [4, 3, 3, '10-12', 90, 3, null],     // OHP
    [4, 12, 3, '12-15', 60, 4, null],    // 시티드로우
    [4, 4, 3, '15-20', 60, 5, null],     // 사이드레터럴
    [4, 20, 3, '30초', 60, 6, null],     // 행잉레그레이즈
  ];

  const allDayExercises = [...pushExercises, ...pullExercises, ...legExercises, ...upperExercises];

  for (const [dayId, exId, sets, reps, rest, order, notes] of allDayExercises) {
    await db.execute({
      sql: `INSERT INTO program_day_exercises
            (program_day_id, exercise_id, sets, reps, rest_seconds, order_num, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [dayId, exId, sets, reps, rest, order, notes],
    });
  }
}

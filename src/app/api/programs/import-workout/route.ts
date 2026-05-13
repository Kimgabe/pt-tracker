import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Map extracted target_muscles / workout_type to exercise category
function inferCategory(exercise: { target_muscles?: string[]; equipment?: string[] }, workoutType: string): string {
  const muscles = (exercise.target_muscles || []).map((m) => m.toLowerCase());
  const joined = muscles.join(' ');

  if (['cardio', 'hiit', 'tabata'].includes(workoutType)) return 'cardio';
  if (joined.match(/chest|shoulder|tricep|삼두|가슴|어깨/)) return 'push';
  if (joined.match(/back|bicep|lat|이두|등|광배/)) return 'pull';
  if (joined.match(/quad|hamstring|glute|calf|허벅|둔근|종아리|하체|엉덩/)) return 'legs';
  if (joined.match(/core|ab|복근|복부|옆구리|코어/)) return 'core';
  return 'cardio'; // default for unclassified
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { youtubeWorkoutId, programName } = body as {
      youtubeWorkoutId: number;
      programName?: string;
    };

    if (!youtubeWorkoutId) {
      return NextResponse.json({ error: 'youtubeWorkoutId is required' }, { status: 400 });
    }

    // 1. Fetch the youtube workout
    const yw = await db.execute({
      sql: 'SELECT * FROM youtube_workouts WHERE id = ?',
      args: [youtubeWorkoutId],
    });
    if (!yw.rows.length) {
      return NextResponse.json({ error: 'YouTube workout not found' }, { status: 404 });
    }
    const row = yw.rows[0];
    const exercises: Array<{
      name: string;
      sets: number;
      reps: string | number;
      rest_seconds: number;
      equipment: string[];
      target_muscles: string[];
      timestamp_seconds: number | null;
    }> = JSON.parse(row.exercises_json as string);
    const workoutType = row.workout_type as string;

    // 2. Create program
    const program = await db.execute({
      sql: `INSERT INTO programs (name, description, days_per_week, source, source_url)
            VALUES (?, ?, 1, 'youtube', ?)`,
      args: [
        programName || row.workout_name,
        `${row.creator || 'YouTube'} — ${row.workout_type} (${row.total_duration_min}분)`,
        row.source_url,
      ],
    });
    const programId = Number(program.lastInsertRowid);

    // 3. Create single program day
    const day = await db.execute({
      sql: `INSERT INTO program_days (program_id, day_number, name, focus)
            VALUES (?, 1, ?, ?)`,
      args: [programId, programName || row.workout_name, workoutType],
    });
    const dayId = Number(day.lastInsertRowid);

    // 4. Upsert exercises and link to program day
    let orderNum = 1;
    for (const ex of exercises) {
      const category = inferCategory(ex, workoutType);
      const muscleGroup = ex.target_muscles?.join(', ') || workoutType;
      const equipment = ex.equipment?.join(', ') || 'bodyweight';

      // Try to find existing exercise by name
      const existing = await db.execute({
        sql: 'SELECT id FROM exercises WHERE name = ?',
        args: [ex.name],
      });

      let exerciseId: number;
      if (existing.rows.length > 0) {
        exerciseId = existing.rows[0].id as number;
      } else {
        const inserted = await db.execute({
          sql: 'INSERT INTO exercises (name, category, muscle_group, equipment) VALUES (?, ?, ?, ?)',
          args: [ex.name, category, muscleGroup, equipment],
        });
        exerciseId = Number(inserted.lastInsertRowid);
      }

      // Link to program day
      const reps = typeof ex.reps === 'number' ? String(ex.reps) : (ex.reps || '영상 참고');
      await db.execute({
        sql: `INSERT INTO program_day_exercises (program_day_id, exercise_id, sets, reps, rest_seconds, order_num)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [dayId, exerciseId, ex.sets || 1, reps, ex.rest_seconds || 30, orderNum++],
      });
    }

    return NextResponse.json({
      programId,
      dayId,
      exerciseCount: exercises.length,
      message: '프로그램이 생성되었습니다',
    });
  } catch (e) {
    console.error('import-workout error:', e);
    return NextResponse.json({ error: '프로그램 생성에 실패했습니다' }, { status: 500 });
  }
}

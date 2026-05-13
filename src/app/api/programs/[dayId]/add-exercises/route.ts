import { NextResponse } from 'next/server';
import db from '@/lib/db';

function inferCategory(exercise: { target_muscles?: string[] }, workoutType: string): string {
  const muscles = (exercise.target_muscles || []).map((m) => m.toLowerCase());
  const joined = muscles.join(' ');

  if (['cardio', 'hiit', 'tabata'].includes(workoutType)) return 'cardio';
  if (joined.match(/chest|shoulder|tricep|삼두|가슴|어깨/)) return 'push';
  if (joined.match(/back|bicep|lat|이두|등|광배/)) return 'pull';
  if (joined.match(/quad|hamstring|glute|calf|허벅|둔근|종아리|하체|엉덩/)) return 'legs';
  if (joined.match(/core|ab|복근|복부|옆구리|코어/)) return 'core';
  return 'cardio';
}

export async function POST(req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  try {
    const body = await req.json();
    const { youtubeWorkoutId, exerciseIndices } = body as {
      youtubeWorkoutId: number;
      exerciseIndices: number[];
    };

    if (!youtubeWorkoutId || !exerciseIndices?.length) {
      return NextResponse.json({ error: 'youtubeWorkoutId and exerciseIndices are required' }, { status: 400 });
    }

    // Verify the day exists
    const dayResult = await db.execute({
      sql: 'SELECT * FROM program_days WHERE id = ?',
      args: [dayId],
    });
    if (!dayResult.rows.length) {
      return NextResponse.json({ error: 'Program day not found' }, { status: 404 });
    }

    // Fetch youtube workout
    const yw = await db.execute({
      sql: 'SELECT * FROM youtube_workouts WHERE id = ?',
      args: [youtubeWorkoutId],
    });
    if (!yw.rows.length) {
      return NextResponse.json({ error: 'YouTube workout not found' }, { status: 404 });
    }
    const row = yw.rows[0];
    const allExercises: Array<{
      name: string;
      sets: number;
      reps: string | number;
      rest_seconds: number;
      equipment: string[];
      target_muscles: string[];
    }> = JSON.parse(row.exercises_json as string);
    const workoutType = row.workout_type as string;

    // Get current max order_num for this day
    const maxOrder = await db.execute({
      sql: 'SELECT COALESCE(MAX(order_num), 0) as max_order FROM program_day_exercises WHERE program_day_id = ?',
      args: [dayId],
    });
    let orderNum = (maxOrder.rows[0].max_order as number) + 1;

    let added = 0;
    for (const idx of exerciseIndices) {
      if (idx < 0 || idx >= allExercises.length) continue;
      const ex = allExercises[idx];
      const category = inferCategory(ex, workoutType);
      const muscleGroup = ex.target_muscles?.join(', ') || workoutType;
      const equipment = ex.equipment?.join(', ') || 'bodyweight';

      // Upsert exercise
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

      const reps = typeof ex.reps === 'number' ? String(ex.reps) : (ex.reps || '영상 참고');
      await db.execute({
        sql: `INSERT INTO program_day_exercises (program_day_id, exercise_id, sets, reps, rest_seconds, order_num)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [dayId, exerciseId, ex.sets || 1, reps, ex.rest_seconds || 30, orderNum++],
      });
      added++;
    }

    return NextResponse.json({
      added,
      message: `${added}개 운동이 추가되었습니다`,
    });
  } catch (e) {
    console.error('add-exercises error:', e);
    return NextResponse.json({ error: '운동 추가에 실패했습니다' }, { status: 500 });
  }
}

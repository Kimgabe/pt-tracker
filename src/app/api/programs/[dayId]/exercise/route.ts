import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  try {
    const body = await req.json();
    const { name, timestamp_seconds, sets = 1, reps = '영상 참고' } = body as {
      name: string;
      timestamp_seconds?: number | null;
      sets?: number;
      reps?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const maxOrder = await db.execute({
      sql: 'SELECT COALESCE(MAX(order_num), 0) as max_order FROM program_day_exercises WHERE program_day_id = ?',
      args: [dayId],
    });
    const orderNum = (maxOrder.rows[0].max_order as number) + 1;

    // Upsert exercise
    const existing = await db.execute({
      sql: 'SELECT id FROM exercises WHERE name = ?',
      args: [name.trim()],
    });
    let exerciseId: number;
    if (existing.rows.length > 0) {
      exerciseId = existing.rows[0].id as number;
    } else {
      const inserted = await db.execute({
        sql: `INSERT INTO exercises (name, category, muscle_group, equipment) VALUES (?, 'cardio', '', 'bodyweight')`,
        args: [name.trim()],
      });
      exerciseId = Number(inserted.lastInsertRowid);
    }

    const pde = await db.execute({
      sql: `INSERT INTO program_day_exercises (program_day_id, exercise_id, sets, reps, rest_seconds, order_num, timestamp_seconds)
            VALUES (?, ?, ?, ?, 10, ?, ?)`,
      args: [dayId, exerciseId, sets, reps, orderNum, timestamp_seconds ?? null],
    });

    return NextResponse.json({ id: Number(pde.lastInsertRowid), ok: true });
  } catch (e) {
    console.error('add-exercise error:', e);
    return NextResponse.json({ error: '운동 추가 실패' }, { status: 500 });
  }
}

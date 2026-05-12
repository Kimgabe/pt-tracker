import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  try {
    const day = await db.execute({
      sql: 'SELECT * FROM program_days WHERE id = ?',
      args: [dayId],
    });
    const exercises = await db.execute({
      sql: `SELECT pde.*, e.name, e.category, e.muscle_group, e.equipment
            FROM program_day_exercises pde
            JOIN exercises e ON e.id = pde.exercise_id
            WHERE pde.program_day_id = ?
            ORDER BY pde.order_num`,
      args: [dayId],
    });
    return NextResponse.json({
      day: day.rows[0] || null,
      exercises: exercises.rows,
    });
  } catch {
    return NextResponse.json({ day: null, exercises: [] }, { status: 500 });
  }
}

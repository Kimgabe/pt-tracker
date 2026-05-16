import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId: programId } = await params;
  try {
    const program = await db.execute({
      sql: 'SELECT * FROM programs WHERE id = ?',
      args: [programId],
    });
    if (!program.rows[0]) {
      return NextResponse.json({ program: null, days: [] }, { status: 404 });
    }

    const days = await db.execute({
      sql: 'SELECT * FROM program_days WHERE program_id = ? ORDER BY day_number',
      args: [programId],
    });

    const daysWithExercises = await Promise.all(
      days.rows.map(async (day) => {
        const exercises = await db.execute({
          sql: `SELECT pde.*, e.name, e.category, e.muscle_group, e.equipment
                FROM program_day_exercises pde
                JOIN exercises e ON e.id = pde.exercise_id
                WHERE pde.program_day_id = ?
                ORDER BY pde.order_num`,
          args: [day.id as string | number],
        });
        return { day, exercises: exercises.rows };
      })
    );

    return NextResponse.json({ program: program.rows[0], days: daysWithExercises });
  } catch {
    return NextResponse.json({ program: null, days: [] }, { status: 500 });
  }
}

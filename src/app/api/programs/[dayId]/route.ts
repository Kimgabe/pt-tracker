import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  try {
    const day = await db.execute({
      sql: `SELECT pd.*, p.source, p.source_url, p.name as program_name, p.id as program_id
            FROM program_days pd
            JOIN programs p ON p.id = pd.program_id
            WHERE pd.id = ?`,
      args: [dayId],
    });
    const dayRow = day.rows[0] || null;
    const exercises = await db.execute({
      sql: `SELECT pde.*, e.name, e.category, e.muscle_group, e.equipment
            FROM program_day_exercises pde
            JOIN exercises e ON e.id = pde.exercise_id
            WHERE pde.program_day_id = ?
            ORDER BY pde.order_num`,
      args: [dayId],
    });
    const program = dayRow ? {
      id: dayRow.program_id,
      name: dayRow.program_name,
      source: dayRow.source,
      source_url: dayRow.source_url,
    } : null;
    return NextResponse.json({
      day: dayRow,
      exercises: exercises.rows,
      program,
    });
  } catch {
    return NextResponse.json({ day: null, exercises: [], program: null }, { status: 500 });
  }
}

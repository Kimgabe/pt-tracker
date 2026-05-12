import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const sets = await db.execute({
      sql: `SELECT ws.*, e.name as exercise_name, e.muscle_group
            FROM workout_sets ws
            JOIN exercises e ON e.id = ws.exercise_id
            WHERE ws.session_id = ?
            ORDER BY ws.exercise_id, ws.set_number`,
      args: [sessionId],
    });
    return NextResponse.json(sets.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const body = await req.json();
    const { exercise_id, set_number, weight_kg, reps, rpe } = body;

    const result = await db.execute({
      sql: `INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, rpe, completed)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [sessionId, exercise_id, set_number, weight_kg, reps, rpe || null],
    });
    return NextResponse.json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

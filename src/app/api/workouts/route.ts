import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const limit = searchParams.get('limit') || '10';

  try {
    if (date) {
      const sessions = await db.execute({
        sql: `SELECT ws.*, pd.name as day_name, pd.focus
              FROM workout_sessions ws
              JOIN program_days pd ON pd.id = ws.program_day_id
              WHERE ws.date = ? ORDER BY ws.started_at DESC`,
        args: [date],
      });
      return NextResponse.json(sessions.rows);
    }
    const sessions = await db.execute({
      sql: `SELECT ws.*, pd.name as day_name, pd.focus
            FROM workout_sessions ws
            JOIN program_days pd ON pd.id = ws.program_day_id
            ORDER BY ws.date DESC LIMIT ?`,
      args: [parseInt(limit)],
    });
    return NextResponse.json(sessions.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { program_day_id, date, notes } = body;
    const started_at = new Date().toISOString();

    const result = await db.execute({
      sql: `INSERT INTO workout_sessions (program_day_id, date, started_at, notes)
            VALUES (?, ?, ?, ?)`,
      args: [program_day_id, date, started_at, notes || null],
    });
    return NextResponse.json({ id: Number(result.lastInsertRowid), started_at });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '30';

  try {
    const logs = await db.execute({
      sql: 'SELECT * FROM body_logs ORDER BY date DESC LIMIT ?',
      args: [parseInt(limit)],
    });
    return NextResponse.json(logs.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, weight_kg, body_fat_pct, notes } = body;

    const result = await db.execute({
      sql: `INSERT INTO body_logs (date, weight_kg, body_fat_pct, notes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
              weight_kg = excluded.weight_kg,
              body_fat_pct = excluded.body_fat_pct,
              notes = excluded.notes`,
      args: [date, weight_kg, body_fat_pct || null, notes || null],
    });
    return NextResponse.json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

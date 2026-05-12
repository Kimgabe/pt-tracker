import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const body = await req.json();
    const { notes } = body;

    await db.execute({
      sql: `UPDATE workout_sessions SET completed_at = datetime('now') ${notes !== undefined ? ', notes = ?' : ''} WHERE id = ?`,
      args: notes !== undefined ? [notes, sessionId] : [sessionId],
    });

    const result = await db.execute({
      sql: 'SELECT * FROM workout_sessions WHERE id = ?',
      args: [sessionId],
    });

    return NextResponse.json(result.rows[0] || {});
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ pdeId: string }> }) {
  const { pdeId } = await params;
  try {
    const body = await req.json();
    const { timestamp_seconds, name } = body as { timestamp_seconds?: number | null; name?: string };

    if (timestamp_seconds !== undefined) {
      await db.execute({
        sql: 'UPDATE program_day_exercises SET timestamp_seconds = ? WHERE id = ?',
        args: [timestamp_seconds ?? null, pdeId],
      });
    }

    if (name !== undefined && name.trim()) {
      // Update the linked exercise name
      const pde = await db.execute({
        sql: 'SELECT exercise_id FROM program_day_exercises WHERE id = ?',
        args: [pdeId],
      });
      if (pde.rows[0]) {
        await db.execute({
          sql: 'UPDATE exercises SET name = ? WHERE id = ?',
          args: [name.trim(), pde.rows[0].exercise_id],
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ pdeId: string }> }) {
  const { pdeId } = await params;
  try {
    await db.execute({ sql: 'DELETE FROM program_day_exercises WHERE id = ?', args: [pdeId] });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM youtube_workouts ORDER BY created_at DESC',
      args: [],
    });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다' }, { status: 400 });
    }
    await db.execute({ sql: 'DELETE FROM youtube_workouts WHERE id = ?', args: [Number(id)] });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

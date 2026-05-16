import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await db.execute({
      sql: 'SELECT * FROM youtube_recipes WHERE id = ?',
      args: [Number(id)],
    });
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
  }
}

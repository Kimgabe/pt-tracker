import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const programs = await db.execute(`
      SELECT p.*, (
        SELECT id FROM program_days WHERE program_id = p.id ORDER BY day_number LIMIT 1
      ) as first_day_id
      FROM programs p
    `);
    return NextResponse.json(programs.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

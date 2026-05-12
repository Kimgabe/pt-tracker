import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { initializeDatabase } from '@/lib/schema';
import { calculateLevel, reseedDatabase } from '@/lib/seed';

export async function GET() {
  try {
    await initializeDatabase();
    const result = await db.execute('SELECT * FROM fitness_assessments ORDER BY id DESC LIMIT 1');
    if (result.rows.length === 0) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({ exists: true, assessment: result.rows[0] });
  } catch {
    return NextResponse.json({ exists: false });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pushup_max, pullup_max, plank_seconds, squat_max } = body;

    const level = calculateLevel({ pushup_max, pullup_max, plank_seconds, squat_max });

    await initializeDatabase();

    // Save assessment
    await db.execute({
      sql: `INSERT INTO fitness_assessments (pushup_max, pullup_max, plank_seconds, squat_max, level)
            VALUES (?, ?, ?, ?, ?)`,
      args: [pushup_max, pullup_max, plank_seconds, squat_max, level],
    });

    // Reseed program with appropriate level
    await reseedDatabase(level);

    return NextResponse.json({ ok: true, level });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

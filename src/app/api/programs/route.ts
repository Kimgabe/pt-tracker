import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const programs = await db.execute('SELECT * FROM programs');
    return NextResponse.json(programs.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

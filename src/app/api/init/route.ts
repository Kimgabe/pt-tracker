import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/schema';
import { seedDatabase } from '@/lib/seed';

export async function POST() {
  try {
    await initializeDatabase();
    await seedDatabase();
    return NextResponse.json({ ok: true, message: 'Database initialized and seeded' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/schema';
import { seedDatabase, reseedDatabase } from '@/lib/seed';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reseed = url.searchParams.get('reseed') === 'true';

    await initializeDatabase();
    if (reseed) {
      await reseedDatabase();
    } else {
      await seedDatabase();
    }
    return NextResponse.json({ ok: true, message: reseed ? 'Database reseeded' : 'Database initialized and seeded' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

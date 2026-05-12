import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  try {
    if (date) {
      const meals = await db.execute({
        sql: 'SELECT * FROM meals WHERE date = ? ORDER BY created_at',
        args: [date],
      });
      const summary = await db.execute({
        sql: `SELECT date,
              SUM(calories) as total_calories,
              SUM(protein_g) as total_protein,
              SUM(carbs_g) as total_carbs,
              SUM(fat_g) as total_fat,
              COUNT(*) as meal_count
              FROM meals WHERE date = ? GROUP BY date`,
        args: [date],
      });
      return NextResponse.json({
        meals: meals.rows,
        summary: summary.rows[0] || null,
      });
    }
    // Last 7 days summary
    const summary = await db.execute({
      sql: `SELECT date,
            SUM(calories) as total_calories,
            SUM(protein_g) as total_protein,
            SUM(carbs_g) as total_carbs,
            SUM(fat_g) as total_fat,
            COUNT(*) as meal_count
            FROM meals
            GROUP BY date ORDER BY date DESC LIMIT 7`,
      args: [],
    });
    return NextResponse.json(summary.rows);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url } = body;

    const result = await db.execute({
      sql: `INSERT INTO meals (date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [date, meal_type, description, calories || 0, protein_g || 0, carbs_g || 0, fat_g || 0, photo_url || null],
    });
    return NextResponse.json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

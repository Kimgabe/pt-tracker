import db from './db';

export async function initializeDatabase() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('push','pull','legs','core','cardio')),
        muscle_group TEXT NOT NULL,
        equipment TEXT NOT NULL DEFAULT 'barbell'
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        days_per_week INTEGER NOT NULL DEFAULT 4
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS program_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id),
        day_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        focus TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS program_day_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_day_id INTEGER NOT NULL REFERENCES program_days(id),
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        sets INTEGER NOT NULL DEFAULT 3,
        reps TEXT NOT NULL DEFAULT '8-12',
        rest_seconds INTEGER NOT NULL DEFAULT 90,
        order_num INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_day_id INTEGER NOT NULL REFERENCES program_days(id),
        date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        notes TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        set_number INTEGER NOT NULL,
        weight_kg REAL NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        rpe REAL,
        completed INTEGER NOT NULL DEFAULT 0
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
        description TEXT NOT NULL,
        calories INTEGER NOT NULL DEFAULT 0,
        protein_g REAL NOT NULL DEFAULT 0,
        carbs_g REAL NOT NULL DEFAULT 0,
        fat_g REAL NOT NULL DEFAULT 0,
        photo_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS body_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL,
        body_fat_pct REAL,
        notes TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS fitness_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pushup_max INTEGER NOT NULL DEFAULT 0,
        pullup_max INTEGER NOT NULL DEFAULT 0,
        plank_seconds INTEGER NOT NULL DEFAULT 0,
        squat_max INTEGER NOT NULL DEFAULT 0,
        level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS youtube_workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        creator TEXT,
        workout_type TEXT NOT NULL DEFAULT 'strength',
        total_duration_min INTEGER NOT NULL DEFAULT 0,
        estimated_calories REAL NOT NULL DEFAULT 0,
        exercises_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS youtube_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        creator TEXT,
        goal_category TEXT NOT NULL DEFAULT 'maintain',
        ingredients_json TEXT NOT NULL DEFAULT '[]',
        steps_json TEXT NOT NULL DEFAULT '[]',
        calories INTEGER NOT NULL DEFAULT 0,
        protein_g REAL NOT NULL DEFAULT 0,
        carb_g REAL NOT NULL DEFAULT 0,
        fat_g REAL NOT NULL DEFAULT 0,
        estimated_cost_krw INTEGER NOT NULL DEFAULT 0,
        cooking_time_min INTEGER NOT NULL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'medium',
        meal_type TEXT NOT NULL DEFAULT 'lunch',
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ]);

  // Add prompt_version column to existing tables (idempotent — fails silently if already exists)
  for (const table of ['youtube_workouts', 'youtube_recipes']) {
    try {
      await db.execute({ sql: `ALTER TABLE ${table} ADD COLUMN prompt_version TEXT NOT NULL DEFAULT ''`, args: [] });
    } catch {
      // Column already exists — ignore
    }
  }
}

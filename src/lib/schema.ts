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
  ]);
}

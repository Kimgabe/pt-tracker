export interface Exercise {
  id: number;
  name: string;
  category: 'push' | 'pull' | 'legs' | 'core' | 'cardio';
  muscle_group: string;
  equipment: string;
}

export interface Program {
  id: number;
  name: string;
  description: string;
  days_per_week: number;
}

export interface ProgramDay {
  id: number;
  program_id: number;
  day_number: number;
  name: string;
  focus: string;
}

export interface ProgramDayExercise {
  id: number;
  program_day_id: number;
  exercise_id: number;
  sets: number;
  reps: string; // "8-12" or "30sec" etc.
  rest_seconds: number;
  order_num: number;
  notes: string | null;
  // joined
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: number;
  program_day_id: number;
  date: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  // joined
  program_day?: ProgramDay;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  // joined
  exercise?: Exercise;
}

export interface Meal {
  id: number;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photo_url: string | null;
  created_at: string;
}

export interface BodyLog {
  id: number;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
}

export interface DailyMacroSummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_count: number;
}

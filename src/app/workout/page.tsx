'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Dumbbell, ChevronRight, Target, Clock, RotateCcw } from 'lucide-react';

interface ProgramDay {
  id: number;
  day_number: number;
  name: string;
  focus: string;
}

interface DayExercise {
  id: number;
  exercise_id: number;
  name: string;
  category: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  order_num: number;
  notes: string | null;
}

interface DayData {
  day: ProgramDay;
  exercises: DayExercise[];
}

export default function WorkoutPage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgram() {
      try {
        const responses = await Promise.all(
          [1, 2, 3, 4].map((id) => fetch(`/api/programs/${id}`))
        );
        const data = await Promise.all(responses.map((r) => r.json()));
        setDays(data.filter((d) => d.day !== null));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchProgram();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">프로그램 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PPL 프로그램</h1>
        <p className="text-zinc-400 mt-1">Push / Pull / Legs 4일 분할</p>
      </div>

      <div className="space-y-4">
        {days.map((dayData) => {
          const { day, exercises } = dayData;
          const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
          const avgRest = exercises.length > 0
            ? Math.round(exercises.reduce((sum, e) => sum + e.rest_seconds, 0) / exercises.length)
            : 0;

          return (
            <div
              key={day.id}
              className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden"
            >
              {/* Day Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Day {day.day_number}: {day.name}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">{day.focus}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />
                      {totalSets}세트
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      ~{avgRest}초
                    </span>
                  </div>
                </div>
              </div>

              {/* Exercise List */}
              <div className="px-4 py-2">
                {exercises.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className={`flex items-center justify-between py-2.5 ${
                      idx < exercises.length - 1 ? 'border-b border-zinc-800/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500 w-5 text-center font-mono">
                        {ex.order_num}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{ex.name}</p>
                        <p className="text-xs text-zinc-500">{ex.muscle_group}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-300">
                        {ex.sets} x {ex.reps}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1 justify-end">
                        <RotateCcw className="h-3 w-3" />
                        {ex.rest_seconds}초
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start Button */}
              <div className="p-4 pt-2">
                <Link
                  href={`/workout/${day.id}`}
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl py-3 min-h-[48px] active:scale-[0.98] transition-transform"
                >
                  <Dumbbell className="h-5 w-5" />
                  운동 시작
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

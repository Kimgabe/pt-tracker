'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Dumbbell, UtensilsCrossed, Scale, ChevronRight, Flame, Beef, Wheat, Droplets } from 'lucide-react';

interface WorkoutSession {
  id: number;
  program_day_id: number;
  date: string;
  day_name: string;
  focus: string;
  completed_at: string | null;
}

interface MealSummary {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_count: number;
}

interface BodyLog {
  date: string;
  weight_kg: number;
}

interface ProgramDay {
  id: number;
  day_number: number;
  name: string;
  focus: string;
}

export default function HomePage() {
  const [initialized, setInitialized] = useState(false);
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutSession[]>([]);
  const [mealSummary, setMealSummary] = useState<MealSummary | null>(null);
  const [recentWeights, setRecentWeights] = useState<BodyLog[]>([]);
  const [programDays, setProgramDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const initDB = useCallback(async () => {
    try {
      await fetch('/api/init', { method: 'POST' });
      setInitialized(true);
    } catch {
      setInitialized(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [workoutsRes, mealsRes, bodyRes, programsRes] = await Promise.all([
        fetch(`/api/workouts?date=${today}`),
        fetch(`/api/meals?date=${today}`),
        fetch('/api/body-log?limit=7'),
        fetch('/api/programs'),
      ]);

      const workouts = await workoutsRes.json();
      setTodayWorkouts(Array.isArray(workouts) ? workouts : []);

      const mealsData = await mealsRes.json();
      setMealSummary(mealsData.summary || null);

      const bodyData = await bodyRes.json();
      setRecentWeights(Array.isArray(bodyData) ? bodyData.reverse() : []);

      // Fetch program days
      const programs = await programsRes.json();
      if (Array.isArray(programs) && programs.length > 0) {
        const daysRes = await fetch('/api/workouts?limit=50');
        const recentWorkouts: WorkoutSession[] = await daysRes.json();

        // Determine next workout day from PPL cycle
        const allDaysRes = await Promise.all(
          [1, 2, 3, 4].map((id) => fetch(`/api/programs/${id}`))
        );
        const allDays = await Promise.all(allDaysRes.map((r) => r.json()));
        const days = allDays
          .filter((d) => d.day)
          .map((d) => d.day as ProgramDay);
        setProgramDays(days);

        // Figure out which day is next based on most recent workout
        if (recentWorkouts.length > 0 && days.length > 0) {
          // Already have todayWorkouts set above
        }
      }
    } catch {
      // Silently fail - data will be empty
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    initDB().then(() => fetchData());
  }, [initDB, fetchData]);

  const latestWeight = recentWeights.length > 0 ? recentWeights[recentWeights.length - 1] : null;

  // Simple sparkline using SVG
  const renderSparkline = () => {
    if (recentWeights.length < 2) return null;
    const weights = recentWeights.map((w) => w.weight_kg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const width = 120;
    const height = 40;
    const points = weights
      .map((w, i) => {
        const x = (i / (weights.length - 1)) * width;
        const y = height - ((w - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="ml-auto">
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">
      {/* Date Header */}
      <div>
        <h1 className="text-2xl font-bold">{todayDisplay}</h1>
        <p className="text-zinc-400 mt-1">오늘의 운동 & 식단</p>
      </div>

      {/* Today's Workout Summary */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-400" />
            운동
          </h2>
          <Link href="/workout" className="text-emerald-400 text-sm flex items-center gap-1">
            전체 보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {todayWorkouts.length > 0 ? (
          <div className="space-y-2">
            {todayWorkouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium">{w.day_name}</p>
                  <p className="text-sm text-zinc-400">{w.focus}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  w.completed_at ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {w.completed_at ? '완료' : '진행 중'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-400 text-sm">
            {programDays.length > 0 ? (
              <p>오늘 운동 예정: <span className="text-zinc-200 font-medium">{programDays[0].name}</span> - {programDays[0].focus}</p>
            ) : (
              <p>오늘 예정된 운동이 없습니다</p>
            )}
          </div>
        )}
      </div>

      {/* Calorie/Macro Summary */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
            식단
          </h2>
          <Link href="/diet" className="text-emerald-400 text-sm flex items-center gap-1">
            전체 보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {mealSummary ? (
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <Flame className="h-4 w-4 mx-auto text-orange-400 mb-1" />
              <p className="text-lg font-bold">{mealSummary.total_calories}</p>
              <p className="text-xs text-zinc-400">kcal</p>
            </div>
            <div className="text-center">
              <Beef className="h-4 w-4 mx-auto text-red-400 mb-1" />
              <p className="text-lg font-bold">{Math.round(mealSummary.total_protein)}g</p>
              <p className="text-xs text-zinc-400">단백질</p>
            </div>
            <div className="text-center">
              <Wheat className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
              <p className="text-lg font-bold">{Math.round(mealSummary.total_carbs)}g</p>
              <p className="text-xs text-zinc-400">탄수화물</p>
            </div>
            <div className="text-center">
              <Droplets className="h-4 w-4 mx-auto text-blue-400 mb-1" />
              <p className="text-lg font-bold">{Math.round(mealSummary.total_fat)}g</p>
              <p className="text-xs text-zinc-400">지방</p>
            </div>
          </div>
        ) : (
          <p className="text-zinc-400 text-sm">오늘 기록된 식사가 없습니다</p>
        )}
      </div>

      {/* Body Weight Trend */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-400" />
            체중
          </h2>
          <Link href="/progress" className="text-emerald-400 text-sm flex items-center gap-1">
            전체 보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            {latestWeight ? (
              <>
                <p className="text-3xl font-bold">{latestWeight.weight_kg}<span className="text-lg text-zinc-400 ml-1">kg</span></p>
                <p className="text-xs text-zinc-400 mt-1">{latestWeight.date}</p>
              </>
            ) : (
              <p className="text-zinc-400 text-sm">체중 기록이 없습니다</p>
            )}
          </div>
          {renderSparkline()}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/workout"
          className="flex flex-col items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-2xl py-4 px-3 min-h-[80px] active:scale-95 transition-transform"
        >
          <Dumbbell className="h-6 w-6" />
          <span className="text-sm font-medium">운동 시작</span>
        </Link>
        <Link
          href="/diet"
          className="flex flex-col items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-2xl py-4 px-3 min-h-[80px] border border-zinc-700 active:scale-95 transition-transform"
        >
          <UtensilsCrossed className="h-6 w-6" />
          <span className="text-sm font-medium">식단 기록</span>
        </Link>
        <Link
          href="/progress"
          className="flex flex-col items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-2xl py-4 px-3 min-h-[80px] border border-zinc-700 active:scale-95 transition-transform"
        >
          <Scale className="h-6 w-6" />
          <span className="text-sm font-medium">체중 기록</span>
        </Link>
      </div>
    </div>
  );
}

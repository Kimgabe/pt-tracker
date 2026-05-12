'use client';

import { useState, useEffect, useCallback } from 'react';
import { Scale, Dumbbell, Flame, TrendingUp, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';

interface BodyLog {
  id: number;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
}

interface WorkoutSession {
  id: number;
  date: string;
  day_name: string;
  focus: string;
  completed_at: string | null;
}

interface MealSummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_count: number;
}

const CHART_COLORS = {
  grid: '#3f3f46',
  axis: '#a1a1aa',
  emerald: '#10b981',
};

const CustomTooltipStyle = {
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  color: '#f4f4f5',
  fontSize: '12px',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CustomTooltipStyle} className="px-3 py-2">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value} kg</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CalorieTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CustomTooltipStyle} className="px-3 py-2">
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value} kcal</p>
    </div>
  );
}

export default function ProgressPage() {
  const today = new Date().toISOString().split('T')[0];

  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formDate, setFormDate] = useState(today);
  const [formWeight, setFormWeight] = useState('');
  const [formBodyFat, setFormBodyFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [bodyRes, workoutsRes, mealsRes] = await Promise.all([
        fetch('/api/body-log?limit=30'),
        fetch('/api/workouts?limit=50'),
        fetch('/api/meals'),
      ]);
      const [bodyData, workoutsData, mealsData] = await Promise.all([
        bodyRes.json(),
        workoutsRes.json(),
        mealsRes.json(),
      ]);
      setBodyLogs(Array.isArray(bodyData) ? bodyData : []);
      setWorkouts(Array.isArray(workoutsData) ? workoutsData : []);
      setMeals(Array.isArray(mealsData) ? mealsData : []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWeight) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/body-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          weight_kg: parseFloat(formWeight),
          body_fat_pct: formBodyFat ? parseFloat(formBodyFat) : null,
        }),
      });
      if (res.ok) {
        setSaveMsg('저장 완료');
        setFormWeight('');
        setFormBodyFat('');
        await fetchAll();
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch {
      setSaveMsg('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // Derived data — weight chart (ascending by date)
  const weightChartData = [...bodyLogs]
    .reverse()
    .map((log) => ({
      date: format(parseISO(log.date), 'M/d', { locale: ko }),
      weight: log.weight_kg,
    }));

  const latestLog = bodyLogs[0] ?? null;
  const weekAgo = subDays(new Date(), 7);
  const recentWeights = bodyLogs.filter((l) => isAfter(parseISO(l.date), weekAgo));
  const weeklyAvg =
    recentWeights.length > 0
      ? (recentWeights.reduce((s, l) => s + l.weight_kg, 0) / recentWeights.length).toFixed(1)
      : null;

  // Workout history — last 14 days
  const twoWeeksAgo = subDays(new Date(), 14);
  const recentWorkouts = workouts
    .filter((w) => isAfter(parseISO(w.date), twoWeeksAgo))
    .slice(0, 14);

  // Weekly workout count
  const thisWeekWorkouts = workouts.filter((w) => isAfter(parseISO(w.date), weekAgo));

  // Calorie chart
  const calorieChartData = [...meals]
    .reverse()
    .map((m) => ({
      date: format(parseISO(m.date), 'M/d', { locale: ko }),
      calories: m.total_calories,
    }));

  const avgCalories =
    meals.length > 0
      ? Math.round(meals.reduce((s, m) => s + m.total_calories, 0) / meals.length)
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">진행 현황</h1>
        <p className="text-zinc-400 mt-1">체중 · 운동 · 칼로리 추이</p>
      </div>

      {/* ── Body Weight Section ── */}
      <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5 text-emerald-400" />
          체중
        </h2>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400 mb-1">현재</p>
            <p className="text-xl font-bold">
              {latestLog ? `${latestLog.weight_kg}` : '—'}
              <span className="text-xs text-zinc-400 ml-0.5">kg</span>
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400 mb-1">주간 평균</p>
            <p className="text-xl font-bold">
              {weeklyAvg ?? '—'}
              <span className="text-xs text-zinc-400 ml-0.5">kg</span>
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-400 mb-1">체지방</p>
            <p className="text-xl font-bold">
              {latestLog?.body_fat_pct != null ? `${latestLog.body_fat_pct}` : '—'}
              <span className="text-xs text-zinc-400 ml-0.5">%</span>
            </p>
          </div>
        </div>

        {/* Weight chart */}
        {weightChartData.length >= 2 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<WeightTooltip />} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={CHART_COLORS.emerald}
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-4">
            체중 데이터가 2개 이상 있어야 그래프가 표시됩니다
          </p>
        )}

        {/* Weight input form */}
        <form onSubmit={handleSaveWeight} className="space-y-3 pt-1">
          <p className="text-sm font-medium text-zinc-300">체중 기록</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="0.1"
              placeholder="체중 (kg)"
              value={formWeight}
              onChange={(e) => setFormWeight(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <input
            type="number"
            step="0.1"
            placeholder="체지방률 % (선택)"
            value={formBodyFat}
            onChange={(e) => setFormBodyFat(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 min-h-[44px] active:scale-[0.98] transition-transform text-sm"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          {saveMsg && (
            <p className="text-center text-sm text-emerald-400">{saveMsg}</p>
          )}
        </form>
      </section>

      {/* ── Workout History Section ── */}
      <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-400" />
            운동 기록
          </h2>
          <div className="flex items-center gap-1.5 text-sm bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full">
            <TrendingUp className="h-3.5 w-3.5" />
            이번 주 {thisWeekWorkouts.length}회
          </div>
        </div>

        {recentWorkouts.length > 0 ? (
          <div className="space-y-2">
            {recentWorkouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-zinc-400 w-14">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(w.date), 'M/d')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{w.day_name}</p>
                    <p className="text-xs text-zinc-400">{w.focus}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    w.completed_at
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {w.completed_at ? '완료' : '진행'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-4">최근 2주 운동 기록이 없습니다</p>
        )}
      </section>

      {/* ── Calorie Trend Section ── */}
      <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="h-5 w-5 text-emerald-400" />
            칼로리 추이
          </h2>
          {avgCalories !== null && (
            <p className="text-sm text-zinc-400">
              평균 <span className="text-zinc-100 font-semibold">{avgCalories}</span> kcal
            </p>
          )}
        </div>

        {calorieChartData.length > 0 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={calorieChartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CalorieTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="calories" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-4">최근 7일 식단 기록이 없습니다</p>
        )}
      </section>
    </div>
  );
}

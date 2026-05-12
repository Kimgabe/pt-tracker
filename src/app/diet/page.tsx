'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Flame,
  Beef,
  Wheat,
  Droplets,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Zap,
} from 'lucide-react';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface Meal {
  id: number;
  date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface MealSummary {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_count: number;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const CALORIE_TARGET = 2200;
const PROTEIN_TARGET = 180;
const CARBS_TARGET = 220;
const FAT_TARGET = 60;

interface Preset {
  label: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const PRESETS: Preset[] = [
  { label: '닭가슴살 100g', description: '닭가슴살 100g', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  { label: '현미밥 1공기', description: '현미밥 1공기', calories: 350, protein_g: 7, carbs_g: 73, fat_g: 2 },
  { label: '계란 2개', description: '계란 2개', calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 },
  { label: '프로틴 쉐이크', description: '프로틴 쉐이크', calories: 120, protein_g: 25, carbs_g: 3, fat_g: 1 },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function MacroBar({
  label,
  value,
  target,
  color,
  unit = 'g',
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit?: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline text-sm">
        <span className={`font-medium ${color}`}>{label}</span>
        <span className="text-zinc-300 font-semibold">
          {Math.round(value)}<span className="text-zinc-500 text-xs ml-0.5">{unit}</span>
          <span className="text-zinc-500 text-xs"> / {target}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DietPage() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<MealSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [defaultMealType, setDefaultMealType] = useState<MealType>('breakfast');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formMealType, setFormMealType] = useState<MealType>('breakfast');
  const [formDescription, setFormDescription] = useState('');
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFat, setFormFat] = useState('');

  const fetchMeals = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meals?date=${date}`);
      const data = await res.json();
      setMeals(Array.isArray(data.meals) ? data.meals : []);
      setSummary(data.summary || null);
    } catch {
      setMeals([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals(selectedDate);
  }, [selectedDate, fetchMeals]);

  function openModal(mealType: MealType) {
    setDefaultMealType(mealType);
    setFormMealType(mealType);
    setFormDescription('');
    setFormCalories('');
    setFormProtein('');
    setFormCarbs('');
    setFormFat('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  function applyPreset(preset: Preset) {
    setFormDescription(preset.description);
    setFormCalories(String(preset.calories));
    setFormProtein(String(preset.protein_g));
    setFormCarbs(String(preset.carbs_g));
    setFormFat(String(preset.fat_g));
  }

  async function handleSave() {
    if (!formDescription.trim() || !formCalories) return;
    setSaving(true);
    try {
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          meal_type: formMealType,
          description: formDescription.trim(),
          calories: Number(formCalories) || 0,
          protein_g: Number(formProtein) || 0,
          carbs_g: Number(formCarbs) || 0,
          fat_g: Number(formFat) || 0,
        }),
      });
      closeModal();
      await fetchMeals(selectedDate);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  const calories = summary?.total_calories ?? 0;
  const protein = summary?.total_protein ?? 0;
  const carbs = summary?.total_carbs ?? 0;
  const fat = summary?.total_fat ?? 0;
  const calPct = Math.min((calories / CALORIE_TARGET) * 100, 100);

  const isToday = selectedDate === todayStr;

  return (
    <>
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
            식단 기록
          </h1>
        </div>

        {/* Date Selector */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-3">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-2 rounded-xl hover:bg-zinc-800 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="이전 날"
          >
            <ChevronLeft className="h-5 w-5 text-zinc-400" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-100">{formatDate(selectedDate)}</p>
            {isToday && (
              <span className="text-xs text-emerald-400 font-medium">오늘</span>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={isToday}
            className="p-2 rounded-xl hover:bg-zinc-800 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
            aria-label="다음 날"
          >
            <ChevronRight className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Macro Summary Card */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-4">
          {/* Calorie ring + number */}
          <div className="flex items-center gap-4">
            {/* SVG ring */}
            <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
              <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#27272a" strokeWidth="8" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - calPct / 100)}`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold leading-none text-orange-400">{Math.round(calories)}</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">kcal</span>
              </div>
            </div>

            {/* Calorie text info */}
            <div className="flex-1">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-orange-400">{Math.round(calories)}</span>
                <span className="text-zinc-500 text-sm">/ {CALORIE_TARGET} kcal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm text-zinc-400">
                  {calories >= CALORIE_TARGET
                    ? '목표 달성!'
                    : `${CALORIE_TARGET - Math.round(calories)} kcal 남음`}
                </span>
              </div>
            </div>
          </div>

          {/* Macro bars */}
          <div className="space-y-3">
            <MacroBar label="단백질" value={protein} target={PROTEIN_TARGET} color="text-red-400" />
            <MacroBar label="탄수화물" value={carbs} target={CARBS_TARGET} color="text-yellow-400" />
            <MacroBar label="지방" value={fat} target={FAT_TARGET} color="text-blue-400" />
          </div>

          {/* Macro icons row */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
              <Beef className="h-4 w-4 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-bold">{Math.round(protein)}g</p>
                <p className="text-[10px] text-zinc-500">단백질</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
              <Wheat className="h-4 w-4 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-bold">{Math.round(carbs)}g</p>
                <p className="text-[10px] text-zinc-500">탄수화물</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
              <Droplets className="h-4 w-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-bold">{Math.round(fat)}g</p>
                <p className="text-[10px] text-zinc-500">지방</p>
              </div>
            </div>
          </div>
        </div>

        {/* Meal List grouped by type */}
        {loading ? (
          <div className="text-center py-8 text-zinc-500 animate-pulse">로딩 중...</div>
        ) : (
          <div className="space-y-4">
            {MEAL_ORDER.map((mealType) => {
              const typeMeals = meals.filter((m) => m.meal_type === mealType);
              return (
                <div key={mealType} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <h2 className="font-semibold text-zinc-100">{MEAL_LABELS[mealType]}</h2>
                    <button
                      onClick={() => openModal(mealType)}
                      className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 active:scale-95 transition-transform min-h-[36px] px-2"
                    >
                      <Plus className="h-4 w-4" />
                      추가
                    </button>
                  </div>

                  {/* Meals */}
                  {typeMeals.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-600">기록 없음</div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60">
                      {typeMeals.map((meal) => (
                        <div key={meal.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-zinc-100 flex-1">{meal.description}</p>
                            <span className="text-sm font-bold text-orange-400 shrink-0">
                              {meal.calories} kcal
                            </span>
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                            <span className="text-red-400/80">P {meal.protein_g}g</span>
                            <span className="text-yellow-400/80">C {meal.carbs_g}g</span>
                            <span className="text-blue-400/80">F {meal.fat_g}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Meal Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Slide-up panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl border-t border-zinc-800 max-w-lg mx-auto shadow-2xl animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-700 rounded-full" />
            </div>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">식사 추가</h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-zinc-800 active:scale-95 transition-transform"
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Meal type selector */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">식사 종류</label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_ORDER.map((mt) => (
                    <button
                      key={mt}
                      onClick={() => setFormMealType(mt)}
                      className={`py-2.5 rounded-xl text-sm font-medium min-h-[44px] transition-colors ${
                        formMealType === mt
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {MEAL_LABELS[mt]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick presets */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  빠른 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="text-left bg-zinc-800 hover:bg-zinc-700 rounded-xl px-3 py-2.5 min-h-[52px] active:scale-[0.98] transition-transform"
                    >
                      <p className="text-xs font-medium text-zinc-200 leading-tight">{preset.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {preset.calories}kcal · P{preset.protein_g}g
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">음식명</label>
                <input
                  type="text"
                  placeholder="예: 닭가슴살 샐러드"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Calories */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">칼로리 (kcal)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formCalories}
                  onChange={(e) => setFormCalories(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              {/* P/C/F */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">영양소 (g)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-red-400 mb-1 text-center">단백질</p>
                    <input
                      type="number"
                      placeholder="0"
                      value={formProtein}
                      onChange={(e) => setFormProtein(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-yellow-400 mb-1 text-center">탄수화물</p>
                    <input
                      type="number"
                      placeholder="0"
                      value={formCarbs}
                      onChange={(e) => setFormCarbs(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-blue-400 mb-1 text-center">지방</p>
                    <input
                      type="number"
                      placeholder="0"
                      value={formFat}
                      onChange={(e) => setFormFat(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!formDescription.trim() || !formCalories || saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold rounded-xl py-3.5 min-h-[52px] active:scale-[0.98] transition-transform text-base"
              >
                {saving ? '저장 중...' : '저장'}
              </button>

              {/* Bottom safe area spacer */}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

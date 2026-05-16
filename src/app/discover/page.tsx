'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CirclePlay,
  Search,
  Loader2,
  Dumbbell,
  UtensilsCrossed,
  Clock,
  Flame,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  Download,
  Plus,
  Check,
} from 'lucide-react';

interface Exercise {
  name: string;
  sets: number;
  reps: string | number;
  rest_seconds: number;
  equipment: string[];
  target_muscles: string[];
  timestamp_seconds: number | null;
}

interface WorkoutResult {
  id?: number;
  workout_name: string;
  source_url: string;
  creator: string;
  workout_type: string;
  total_duration_min: number;
  exercises: Exercise[];
  exercises_json?: string;
  created_at?: string;
}

interface Ingredient {
  name: string;
  amount: string;
}

interface Step {
  description: string;
  timestamp_seconds: number | null;
}

interface RecipeResult {
  id?: number;
  recipe_name: string;
  source_url: string;
  creator: string;
  goal_category: string;
  ingredients: Ingredient[];
  ingredients_json?: string;
  steps: Step[];
  steps_json?: string;
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  cooking_time_min: number;
  difficulty: string;
  meal_type: string;
  tags: string[];
  tags_json?: string;
  created_at?: string;
}

interface ProgramDay {
  id: number;
  program_id: number;
  day_number: number;
  name: string;
  focus: string;
  program_name: string;
}

type TabType = 'analyze' | 'workouts' | 'recipes';

export default function DiscoverPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('analyze');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ type: string; data: WorkoutResult | RecipeResult; saved: boolean; message?: string; id?: number } | null>(null);

  const [savedWorkouts, setSavedWorkouts] = useState<WorkoutResult[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<RecipeResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Program import state
  const [importingId, setImportingId] = useState<number | null>(null);
  const [showDayPicker, setShowDayPicker] = useState<{ workoutId: number; exercises: Exercise[] } | null>(null);
  const [programDays, setProgramDays] = useState<ProgramDay[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'workouts') fetchWorkouts();
    if (activeTab === 'recipes') fetchRecipes();
  }, [activeTab]);

  async function fetchWorkouts() {
    const res = await fetch('/api/youtube/workouts');
    const data = await res.json();
    setSavedWorkouts(
      (data as WorkoutResult[]).map((w) => ({
        ...w,
        exercises: w.exercises_json ? JSON.parse(w.exercises_json) : [],
      }))
    );
  }

  async function fetchRecipes() {
    const res = await fetch('/api/youtube/recipes');
    const data = await res.json();
    setSavedRecipes(
      (data as RecipeResult[]).map((r) => ({
        ...r,
        ingredients: r.ingredients_json ? JSON.parse(r.ingredients_json) : [],
        steps: r.steps_json ? JSON.parse(r.steps_json) : [],
        tags: r.tags_json ? JSON.parse(r.tags_json) : [],
      }))
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleImportAsProgram(workoutId: number) {
    setImportingId(workoutId);
    setActionLoading(true);
    try {
      const res = await fetch('/api/programs/import-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeWorkoutId: workoutId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`✓ ${data.exerciseCount}개 운동 프로그램 생성 완료`);
    } catch (e) {
      showToast(`✕ ${e instanceof Error ? e.message : '프로그램 생성 실패'}`);
    } finally {
      setActionLoading(false);
      setImportingId(null);
    }
  }

  async function openDayPicker(workoutId: number, exercises: Exercise[]) {
    // Fetch all program days
    try {
      const progRes = await fetch('/api/programs');
      const programs = await progRes.json();
      const allDays: ProgramDay[] = [];
      for (const prog of programs) {
        // Fetch each program's days
        const daysRes = await fetch(`/api/programs?programId=${prog.id}`);
        // We don't have a dedicated endpoint, so fetch day IDs from the program
        // Use a simple approach: fetch days 1-10 and filter
        for (let d = 1; d <= 20; d++) {
          const dayRes = await fetch(`/api/programs/${d}`);
          const dayData = await dayRes.json();
          if (dayData.day && dayData.day.program_id === prog.id) {
            allDays.push({ ...dayData.day, program_name: prog.name });
          }
        }
      }
      setProgramDays(allDays);
      setSelectedExercises(exercises.map((_, i) => i)); // select all by default
      setShowDayPicker({ workoutId, exercises });
    } catch {
      showToast('프로그램 목록 조회 실패');
    }
  }

  async function handleAddToDay(dayId: number) {
    if (!showDayPicker) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/programs/${dayId}/add-exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeWorkoutId: showDayPicker.workoutId,
          exerciseIndices: selectedExercises,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`✓ ${data.added}개 운동 추가 완료`);
      setShowDayPicker(null);
    } catch (e) {
      showToast(`✕ ${e instanceof Error ? e.message : '운동 추가 실패'}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/youtube/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '분석에 실패했습니다');
        return;
      }
      setResult(data);
      setUrl('');
    } catch {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(type: 'workouts' | 'recipes', id: number) {
    await fetch(`/api/youtube/${type}?id=${id}`, { method: 'DELETE' });
    if (type === 'workouts') fetchWorkouts();
    else fetchRecipes();
  }

  function toggleExpand(key: string) {
    setExpandedId(expandedId === key ? null : key);
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'analyze', label: '분석', icon: <Search className="h-4 w-4" /> },
    { key: 'workouts', label: '운동', icon: <Dumbbell className="h-4 w-4" /> },
    { key: 'recipes', label: '레시피', icon: <UtensilsCrossed className="h-4 w-4" /> },
  ];

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CirclePlay className="h-6 w-6 text-red-500" />
        디스커버
      </h1>
      <p className="text-zinc-400 text-sm">YouTube 영상에서 운동 프로그램이나 레시피를 자동 추출합니다</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Analyze Tab */}
      {activeTab === 'analyze' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
                placeholder="YouTube URL 붙여넣기..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 pr-9 text-sm focus:outline-none focus:border-emerald-500 placeholder:text-zinc-500"
                disabled={loading}
              />
              {url && !loading && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 active:text-white transition-colors"
                  aria-label="입력 지우기"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:scale-95"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </button>
          </div>

          {loading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
              <p className="text-zinc-400 text-sm">AI가 영상을 분석하고 있습니다...</p>
              <p className="text-zinc-500 text-xs">자막 추출 → 콘텐츠 분류 → 상세 분석 (약 10~20초)</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
              <p className="text-red-400 text-sm">{error}</p>
              {error.includes('Transcript') && (
                <p className="text-zinc-400 text-xs">
                  💡 자막 추출이 차단된 경우, 텔레그램 PT봇에 YouTube URL을 보내면 로컬에서 분석 후 자동 저장됩니다.
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {result.type === 'workout' ? (
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" /> 운동
                  </span>
                ) : (
                  <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <UtensilsCrossed className="h-3 w-3" /> 레시피
                  </span>
                )}
                {result.saved ? (
                  <span className="text-emerald-400">✓ 저장됨</span>
                ) : (
                  <span className="text-yellow-400">{result.message}</span>
                )}
              </div>

              {result.type === 'workout' ? (
                <WorkoutCard
                  workout={{ ...(result.data as WorkoutResult), id: result.id ?? (result.data as WorkoutResult).id }}
                  expanded
                  onImport={result.saved ? handleImportAsProgram : undefined}
                  onAddToDay={result.saved ? openDayPicker : undefined}
                  importing={importingId === result.id && actionLoading}
                />
              ) : (
                <RecipeCard recipe={result.data as RecipeResult} expanded />
              )}
            </div>
          )}
        </div>
      )}

      {/* Saved Workouts Tab */}
      {activeTab === 'workouts' && (
        <div className="space-y-3">
          {savedWorkouts.length === 0 ? (
            <p className="text-zinc-500 text-center py-8 text-sm">저장된 운동 프로그램이 없습니다</p>
          ) : (
            savedWorkouts.map((w) => (
              <div key={w.id} className="relative">
                <div
                  onClick={() => toggleExpand(`w-${w.id}`)}
                  className="w-full text-left cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleExpand(`w-${w.id}`)}
                >
                  <WorkoutCard
                    workout={w}
                    expanded={expandedId === `w-${w.id}`}
                    onImport={handleImportAsProgram}
                    onAddToDay={openDayPicker}
                    importing={importingId === w.id && actionLoading}
                  />
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => toggleExpand(`w-${w.id}`)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    {expandedId === `w-${w.id}` ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => w.id && handleDelete('workouts', w.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved Recipes Tab */}
      {activeTab === 'recipes' && (
        <div className="space-y-3">
          {savedRecipes.length === 0 ? (
            <p className="text-zinc-500 text-center py-8 text-sm">저장된 레시피가 없습니다</p>
          ) : (
            savedRecipes.map((r) => (
              <div key={r.id} className="relative">
                <button
                  onClick={() => r.id && router.push(`/recipe/${r.id}`)}
                  className="w-full text-left"
                >
                  <RecipeCard recipe={r} expanded={false} />
                </button>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => toggleExpand(`r-${r.id}`)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    {expandedId === `r-${r.id}` ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => r.id && handleDelete('recipes', r.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {/* Day Picker Bottom Sheet */}
      {showDayPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDayPicker(null)} />
          <div className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">기존 프로그램에 추가</h3>
              <button onClick={() => setShowDayPicker(null)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Exercise selection */}
            <div>
              <p className="text-xs text-zinc-400 mb-2">추가할 운동 선택 ({selectedExercises.length}/{showDayPicker.exercises.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {showDayPicker.exercises.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedExercises((prev) =>
                        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                      );
                    }}
                    className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      selectedExercises.includes(i) ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-800/50 text-zinc-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedExercises.includes(i) ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'
                    }`}>
                      {selectedExercises.includes(i) && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Day selection */}
            <div>
              <p className="text-xs text-zinc-400 mb-2">프로그램 Day 선택</p>
              {programDays.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">프로그램이 없습니다. 먼저 &apos;새 프로그램으로 저장&apos;을 사용하세요.</p>
              ) : (
                <div className="space-y-1.5">
                  {programDays.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => handleAddToDay(day.id)}
                      disabled={actionLoading || selectedExercises.length === 0}
                      className="w-full flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl px-4 py-3 text-left transition-colors active:scale-[0.98]"
                    >
                      <div>
                        <p className="text-sm font-medium">{day.program_name}</p>
                        <p className="text-xs text-zinc-400">Day {day.day_number}: {day.name}</p>
                      </div>
                      <Plus className="h-4 w-4 text-zinc-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutCard({
  workout,
  expanded,
  onImport,
  onAddToDay,
  importing,
}: {
  workout: WorkoutResult;
  expanded: boolean;
  onImport?: (id: number) => void;
  onAddToDay?: (id: number, exercises: Exercise[]) => void;
  importing?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="pr-16">
        <h3 className="font-semibold text-base">{workout.workout_name || '운동 프로그램'}</h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
          {workout.creator && <span>by {workout.creator}</span>}
          {workout.total_duration_min > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {workout.total_duration_min}분
            </span>
          )}
          <span className="bg-zinc-800 px-1.5 py-0.5 rounded">{workout.workout_type}</span>
        </div>
      </div>

      {expanded && workout.exercises && workout.exercises.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
              <div>
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-zinc-400">
                  {ex.target_muscles?.join(', ')}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-emerald-400">{ex.sets}×{ex.reps}</p>
                <p className="text-xs text-zinc-500">휴식 {ex.rest_seconds}초</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons — only for saved workouts (have id) */}
      {expanded && workout.id && onImport && onAddToDay && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onImport(workout.id!); }}
            disabled={importing}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white text-xs font-medium rounded-xl py-2.5 transition-colors active:scale-[0.98]"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            새 프로그램으로 저장
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToDay(workout.id!, workout.exercises); }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium rounded-xl py-2.5 transition-colors active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            기존 프로그램에 추가
          </button>
        </div>
      )}

      {workout.source_url && (
        <a
          href={workout.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400"
        >
          <ExternalLink className="h-3 w-3" /> 원본 영상
        </a>
      )}
    </div>
  );
}

function RecipeCard({ recipe, expanded }: { recipe: RecipeResult; expanded: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="pr-16">
        <h3 className="font-semibold text-base">{recipe.recipe_name || '레시피'}</h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
          {recipe.creator && <span>by {recipe.creator}</span>}
          {recipe.cooking_time_min > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {recipe.cooking_time_min}분
            </span>
          )}
          <span className="bg-zinc-800 px-1.5 py-0.5 rounded">{recipe.difficulty}</span>
        </div>
      </div>

      {/* Macro summary */}
      {recipe.calories > 0 && (
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-orange-400">
            <Flame className="h-3 w-3" /> {recipe.calories}kcal
          </span>
          <span className="text-red-400">P {recipe.protein_g}g</span>
          <span className="text-yellow-400">C {recipe.carb_g}g</span>
          <span className="text-blue-400">F {recipe.fat_g}g</span>
        </div>
      )}

      {expanded && (
        <>
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2 font-medium">재료</p>
              <div className="grid grid-cols-2 gap-1">
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="text-sm bg-zinc-800/50 rounded-lg px-2 py-1">
                    {ing.name} <span className="text-zinc-400">{ing.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recipe.steps && recipe.steps.length > 0 && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2 font-medium">조리 순서</p>
              <ol className="space-y-1.5">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-emerald-400 font-mono text-xs mt-0.5">{i + 1}</span>
                    <span className="text-zinc-300">{step.description}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400"
        >
          <ExternalLink className="h-3 w-3" /> 원본 영상
        </a>
      )}
    </div>
  );
}

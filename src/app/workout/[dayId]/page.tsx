'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  Timer,
  SkipForward,
  Trophy,
  Dumbbell,
  Clock,
  Weight,
} from 'lucide-react';

interface ProgramDay {
  id: number;
  day_number: number;
  name: string;
  focus: string;
}

interface ProgramExercise {
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

interface SetInput {
  weight_kg: string;
  reps: string;
  completed: boolean;
  savedId: number | null;
}

interface CompletedSetData {
  weight_kg: number;
  reps: number;
}

interface RestTimer {
  exerciseIdx: number;
  seconds: number;
  total: number;
}

interface SessionSummary {
  totalVolume: number;
  durationSeconds: number;
  exercisesCompleted: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export default function WorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const dayId = params.dayId as string;

  const [day, setDay] = useState<ProgramDay | null>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // setInputs[exerciseIdx][setIdx]
  const [setInputs, setSetInputs] = useState<SetInput[][]>([]);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [completing, setCompleting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Initialize set inputs when exercises load
  const initSetInputs = useCallback((exList: ProgramExercise[]) => {
    setSetInputs(
      exList.map((ex) =>
        Array.from({ length: ex.sets }, () => ({
          weight_kg: '',
          reps: '',
          completed: false,
          savedId: null,
        }))
      )
    );
  }, []);

  useEffect(() => {
    if (!dayId) return;

    const init = async () => {
      try {
        // 1. Fetch program day exercises
        const dayRes = await fetch(`/api/programs/${dayId}`);
        const dayData = await dayRes.json();
        if (!dayData.day) throw new Error('운동 프로그램을 찾을 수 없습니다.');
        setDay(dayData.day);
        const exList: ProgramExercise[] = dayData.exercises;
        setExercises(exList);
        initSetInputs(exList);

        // 2. Create workout session
        const today = new Date().toISOString().split('T')[0];
        const sessionRes = await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_day_id: dayData.day.id, date: today }),
        });
        const sessionData = await sessionRes.json();
        if (!sessionData.id) throw new Error('세션을 생성할 수 없습니다.');
        setSessionId(sessionData.id);
        setStartedAt(sessionData.started_at);
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [dayId, initSetInputs]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev) return null;
        if (prev.seconds <= 1) {
          // Timer done — vibrate if available
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restTimer?.exerciseIdx, restTimer !== null]);

  const updateSetInput = (exIdx: number, setIdx: number, field: 'weight_kg' | 'reps', value: string) => {
    setSetInputs((prev) => {
      const next = prev.map((ex) => ex.map((s) => ({ ...s })));
      next[exIdx][setIdx][field] = value;
      return next;
    });
  };

  const completeSet = async (exIdx: number, setIdx: number) => {
    if (!sessionId) return;
    const exercise = exercises[exIdx];
    const input = setInputs[exIdx][setIdx];

    const weight = parseFloat(input.weight_kg) || 0;
    const reps = parseInt(input.reps) || 0;

    try {
      const res = await fetch(`/api/workouts/${sessionId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exercise.exercise_id,
          set_number: setIdx + 1,
          weight_kg: weight,
          reps,
        }),
      });
      const data = await res.json();

      setSetInputs((prev) => {
        const next = prev.map((ex) => ex.map((s) => ({ ...s })));
        next[exIdx][setIdx].completed = true;
        next[exIdx][setIdx].savedId = data.id || null;

        // Auto-fill next set
        if (setIdx + 1 < next[exIdx].length) {
          if (!next[exIdx][setIdx + 1].weight_kg) {
            next[exIdx][setIdx + 1].weight_kg = input.weight_kg;
          }
          if (!next[exIdx][setIdx + 1].reps) {
            next[exIdx][setIdx + 1].reps = input.reps;
          }
        }
        return next;
      });

      // Start rest timer
      setRestTimer({
        exerciseIdx: exIdx,
        seconds: exercise.rest_seconds,
        total: exercise.rest_seconds,
      });

      // Check if all sets for this exercise are done → scroll to next exercise
      const updatedSets = setInputs[exIdx].map((s, i) =>
        i === setIdx ? { ...s, completed: true } : s
      );
      const allDone = updatedSets.every((s) => s.completed);
      if (allDone && exIdx + 1 < exercises.length) {
        setTimeout(() => {
          exerciseRefs.current[exIdx + 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }
    } catch {
      // Silent fail — set stays uncompleted
    }
  };

  const skipTimer = () => {
    setRestTimer(null);
  };

  const completeWorkout = async () => {
    if (!sessionId || !startedAt) return;
    setCompleting(true);
    try {
      await fetch(`/api/workouts/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Compute summary
      let totalVolume = 0;
      let exercisesCompleted = 0;
      setInputs.forEach((exSets, exIdx) => {
        const completedSets = exSets.filter((s) => s.completed);
        if (completedSets.length > 0) exercisesCompleted++;
        completedSets.forEach((s) => {
          totalVolume += (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0);
        });
        exIdx; // suppress unused warning
      });

      const durationSeconds = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
        : 0;

      setSummary({ totalVolume, durationSeconds, exercisesCompleted });
    } catch {
      setCompleting(false);
    }
  };

  // Completed sets per exercise for display
  const getCompletedCount = (exIdx: number) =>
    setInputs[exIdx]?.filter((s) => s.completed).length ?? 0;

  const allSetsCompleted = setInputs.length > 0 &&
    setInputs.every((exSets) => exSets.every((s) => s.completed));

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-zinc-400 animate-pulse text-lg">세션 준비 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 px-4 gap-4">
        <p className="text-red-400 text-center">{error}</p>
        <button
          onClick={() => router.back()}
          className="text-emerald-400 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> 돌아가기
        </button>
      </div>
    );
  }

  // ── Summary Screen ───────────────────────────────────────────────────────
  if (summary) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-10 max-w-lg mx-auto">
        <div className="w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
          <div className="text-center">
            <Trophy className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">운동 완료!</h1>
            <p className="text-zinc-400 mt-1">{day?.name} — {day?.focus}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <Weight className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{Math.round(summary.totalVolume).toLocaleString()}</p>
              <p className="text-xs text-zinc-400 mt-1">총 볼륨 (kg)</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <Clock className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{formatDuration(summary.durationSeconds)}</p>
              <p className="text-xs text-zinc-400 mt-1">운동 시간</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <Dumbbell className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold">{summary.exercisesCompleted}</p>
              <p className="text-xs text-zinc-400 mt-1">완료 운동</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-transform rounded-2xl py-4 font-semibold text-lg min-h-[56px]"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // ── Main Workout UI ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-zinc-400 min-h-[44px] px-1"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">취소</span>
          </button>
          <div className="text-center">
            <p className="font-semibold">{day?.name}</p>
            <p className="text-xs text-zinc-400">{day?.focus}</p>
          </div>
          <div className="w-16" />
        </div>
      </div>

      {/* Rest Timer Overlay */}
      {restTimer && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 flex flex-col items-center justify-center gap-6 px-4">
          <p className="text-zinc-400 text-lg font-medium">휴식 시간</p>

          {/* Circular progress */}
          <div className="relative w-48 h-48">
            <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="44"
                fill="none"
                stroke="#27272a"
                strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="44"
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - restTimer.seconds / restTimer.total)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums">{restTimer.seconds}</span>
              <span className="text-zinc-400 text-sm mt-1">초</span>
            </div>
          </div>

          <button
            onClick={skipTimer}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-transform rounded-2xl px-6 py-3 min-h-[48px] text-zinc-300"
          >
            <SkipForward className="h-4 w-4" />
            건너뛰기
          </button>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {exercises.map((exercise, exIdx) => {
          const completedCount = getCompletedCount(exIdx);
          const isFullyDone = completedCount === exercise.sets;

          return (
            <div
              key={exercise.id}
              ref={(el) => { exerciseRefs.current[exIdx] = el; }}
              className={`bg-zinc-900 rounded-2xl border transition-colors ${
                isFullyDone ? 'border-emerald-800' : 'border-zinc-800'
              } overflow-hidden`}
            >
              {/* Exercise Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight">{exercise.name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{exercise.muscle_group}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isFullyDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {completedCount}/{exercise.sets} 세트
                    </span>
                    <span className="text-xs text-zinc-500 mt-1">{exercise.reps} reps</span>
                  </div>
                </div>
                {exercise.notes && (
                  <p className="text-xs text-amber-400/80 mt-2 bg-amber-500/10 rounded-lg px-2 py-1.5">
                    {exercise.notes}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-2">
                  <Timer className="h-3 w-3 text-zinc-500" />
                  <span className="text-xs text-zinc-500">휴식 {exercise.rest_seconds}초</span>
                </div>
              </div>

              {/* Set Column Headers */}
              <div className="px-4 pb-1">
                <div className="grid grid-cols-[32px_1fr_1fr_48px] gap-2 items-center">
                  <span className="text-xs text-zinc-500 text-center">세트</span>
                  <span className="text-xs text-zinc-500 text-center">무게 (kg)</span>
                  <span className="text-xs text-zinc-500 text-center">횟수</span>
                  <span />
                </div>
              </div>

              {/* Set Rows */}
              <div className="px-4 pb-4 space-y-2">
                {setInputs[exIdx]?.map((setInput, setIdx) => (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-[32px_1fr_1fr_48px] gap-2 items-center ${
                      setInput.completed ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Set number */}
                    <span className="text-sm font-medium text-zinc-400 text-center">
                      {setIdx + 1}
                    </span>

                    {/* Weight input */}
                    <input
                      type="number"
                      inputMode="decimal"
                      value={setInput.weight_kg}
                      onChange={(e) => updateSetInput(exIdx, setIdx, 'weight_kg', e.target.value)}
                      disabled={setInput.completed}
                      placeholder="0"
                      className="bg-zinc-800 text-center text-lg font-semibold rounded-xl py-3 w-full
                        border border-zinc-700 focus:border-emerald-500 focus:outline-none
                        disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
                    />

                    {/* Reps input */}
                    <input
                      type="number"
                      inputMode="numeric"
                      value={setInput.reps}
                      onChange={(e) => updateSetInput(exIdx, setIdx, 'reps', e.target.value)}
                      disabled={setInput.completed}
                      placeholder="0"
                      className="bg-zinc-800 text-center text-lg font-semibold rounded-xl py-3 w-full
                        border border-zinc-700 focus:border-emerald-500 focus:outline-none
                        disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
                    />

                    {/* Complete button */}
                    <button
                      onClick={() => !setInput.completed && completeSet(exIdx, setIdx)}
                      disabled={setInput.completed}
                      className={`flex items-center justify-center min-h-[52px] rounded-xl transition-colors ${
                        setInput.completed
                          ? 'text-emerald-400 cursor-default'
                          : 'text-zinc-500 hover:text-emerald-400 active:scale-90 bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      {setInput.completed ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Workout Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={completeWorkout}
            disabled={completing}
            className={`w-full rounded-2xl py-4 font-semibold text-lg min-h-[56px] transition-all active:scale-95 ${
              allSetsCompleted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            } ${completing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {completing ? '저장 중...' : '운동 완료'}
          </button>
          {!allSetsCompleted && (
            <p className="text-xs text-zinc-500 text-center mt-2">
              모든 세트를 완료하지 않아도 운동을 종료할 수 있습니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

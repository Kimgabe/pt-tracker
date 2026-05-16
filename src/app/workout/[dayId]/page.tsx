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
  Play,
  ChevronUp,
  Pencil,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';

interface Program {
  id: number;
  name: string;
  source: string | null;
  source_url: string | null;
}

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
  timestamp_seconds: number | null;
}

interface SetInput {
  weight_kg: string;
  reps: string;
  completed: boolean;
  savedId: number | null;
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

function toMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseMMSS(val: string): number | null {
  const parts = val.trim().split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const s = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(s) && s < 60) return m * 60 + s;
  }
  if (parts.length === 1 && /^\d+$/.test(parts[0])) return parseInt(parts[0]);
  return null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return m ? m[1] : null;
}

export default function WorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const dayId = params.dayId as string;

  // Common state
  const [program, setProgram] = useState<Program | null>(null);
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [completing, setCompleting] = useState(false);

  // Strength mode state
  const [setInputs, setSetInputs] = useState<SetInput[][]>([]);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);

  // YouTube follow-along state
  const [videoTimestamp, setVideoTimestamp] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [videoVisible, setVideoVisible] = useState(true);
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [checkedExercises, setCheckedExercises] = useState<boolean[]>([]);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, { name?: string; ts?: string }>>({});
  const [addForm, setAddForm] = useState({ name: '', ts: '' });
  const savingRef = useRef<Record<number, boolean>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

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
        await fetch('/api/init', { method: 'POST' });
        const dayRes = await fetch(`/api/programs/${dayId}`);
        const dayData = await dayRes.json();
        if (!dayData.day) throw new Error('운동 프로그램을 찾을 수 없습니다.');
        setDay(dayData.day);
        setProgram(dayData.program ?? null);
        const exList: ProgramExercise[] = dayData.exercises;
        setExercises(exList);
        setCheckedExercises(new Array(exList.length).fill(false));
        initSetInputs(exList);

        // For YouTube mode, pre-seek to first exercise timestamp
        if (dayData.program?.source === 'youtube' && exList.length > 0 && exList[0].timestamp_seconds != null) {
          setVideoTimestamp(exList[0].timestamp_seconds);
        }

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

  // Rest timer countdown (strength mode)
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
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [restTimer?.exerciseIdx, restTimer !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Strength mode helpers ────────────────────────────────────────────────

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
        body: JSON.stringify({ exercise_id: exercise.exercise_id, set_number: setIdx + 1, weight_kg: weight, reps }),
      });
      const data = await res.json();
      setSetInputs((prev) => {
        const next = prev.map((ex) => ex.map((s) => ({ ...s })));
        next[exIdx][setIdx].completed = true;
        next[exIdx][setIdx].savedId = data.id || null;
        if (setIdx + 1 < next[exIdx].length) {
          if (!next[exIdx][setIdx + 1].weight_kg) next[exIdx][setIdx + 1].weight_kg = input.weight_kg;
          if (!next[exIdx][setIdx + 1].reps) next[exIdx][setIdx + 1].reps = input.reps;
        }
        return next;
      });
      setRestTimer({ exerciseIdx: exIdx, seconds: exercise.rest_seconds, total: exercise.rest_seconds });
      const updatedSets = setInputs[exIdx].map((s, i) => i === setIdx ? { ...s, completed: true } : s);
      if (updatedSets.every((s) => s.completed) && exIdx + 1 < exercises.length) {
        setTimeout(() => {
          exerciseRefs.current[exIdx + 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }
    } catch {
      // Silent fail
    }
  };

  const completeWorkoutStrength = async () => {
    if (!sessionId || !startedAt) return;
    setCompleting(true);
    try {
      await fetch(`/api/workouts/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      let totalVolume = 0;
      let exercisesCompleted = 0;
      setInputs.forEach((exSets) => {
        const done = exSets.filter((s) => s.completed);
        if (done.length > 0) exercisesCompleted++;
        done.forEach((s) => { totalVolume += (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0); });
      });
      const durationSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setSummary({ totalVolume, durationSeconds, exercisesCompleted });
    } catch { setCompleting(false); }
  };

  // ── YouTube follow-along helpers ─────────────────────────────────────────

  const seekTo = (ts: number) => {
    setVideoTimestamp(ts);
    setVideoKey((k) => k + 1);
    setVideoAutoplay(true);
  };

  const toggleCheck = (idx: number) => {
    setCheckedExercises((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const completeWorkoutYoutube = async () => {
    if (!sessionId || !startedAt) return;
    setCompleting(true);
    try {
      await fetch(`/api/workouts/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const durationSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setSummary({ totalVolume: 0, durationSeconds, exercisesCompleted: checkedExercises.filter(Boolean).length });
    } catch { setCompleting(false); }
  };

  const saveField = useCallback(async (exId: number, field: 'name' | 'ts', val: string) => {
    if (savingRef.current[exId]) return;
    savingRef.current[exId] = true;
    if (field === 'ts') {
      const seconds = val.trim() === '' ? null : parseMMSS(val);
      if (val.trim() !== '' && seconds === null) { savingRef.current[exId] = false; return; }
      await fetch(`/api/programs/exercises/${exId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp_seconds: seconds }),
      });
      setExercises(prev => prev.map(e => e.id === exId ? { ...e, timestamp_seconds: seconds } : e));
      if (seconds != null) seekTo(seconds);
    } else {
      if (!val.trim()) { savingRef.current[exId] = false; return; }
      await fetch(`/api/programs/exercises/${exId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: val.trim() }),
      });
      setExercises(prev => prev.map(e => e.id === exId ? { ...e, name: val.trim() } : e));
    }
    savingRef.current[exId] = false;
  }, [seekTo]);

  const deleteExercise = useCallback(async (exId: number, idx: number) => {
    await fetch(`/api/programs/exercises/${exId}`, { method: 'DELETE' });
    setExercises(prev => prev.filter(e => e.id !== exId));
    setCheckedExercises(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addExercise = useCallback(async () => {
    if (!addForm.name.trim() || !day) return;
    const seconds = addForm.ts.trim() ? parseMMSS(addForm.ts) : null;
    const res = await fetch(`/api/programs/${day.id}/exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addForm.name.trim(), timestamp_seconds: seconds }),
    });
    const data = await res.json();
    if (data.ok) {
      const newEx: ProgramExercise = {
        id: data.id, exercise_id: 0, name: addForm.name.trim(),
        category: 'cardio', muscle_group: '', sets: 1, reps: '영상 참고',
        rest_seconds: 10, order_num: 999, notes: null, timestamp_seconds: seconds,
      };
      setExercises(prev => [...prev, newEx]);
      setCheckedExercises(prev => [...prev, false]);
      setAddForm({ name: '', ts: '' });
      if (seconds != null) seekTo(seconds);
    }
  }, [addForm, day, seekTo]);

  const getCompletedCount = (exIdx: number) =>
    setInputs[exIdx]?.filter((s) => s.completed).length ?? 0;

  const allSetsCompleted =
    setInputs.length > 0 && setInputs.every((exSets) => exSets.every((s) => s.completed));

  const isYoutube = program?.source === 'youtube';

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
        <button onClick={() => router.back()} className="text-emerald-400 flex items-center gap-1">
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
            <p className="text-zinc-400 mt-1">{day?.name}</p>
          </div>
          <div className={`grid gap-4 ${isYoutube ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
            {!isYoutube && (
              <div className="bg-zinc-800 rounded-xl p-4 text-center">
                <Weight className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-xl font-bold">{Math.round(summary.totalVolume).toLocaleString()}</p>
                <p className="text-xs text-zinc-400 mt-1">총 볼륨 (kg)</p>
              </div>
            )}
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

  // ── YouTube Follow-Along Mode ────────────────────────────────────────────
  if (isYoutube) {
    const videoId = program?.source_url ? extractVideoId(program.source_url) : null;
    const checkedCount = checkedExercises.filter(Boolean).length;

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
              <p className="font-semibold text-sm leading-tight">{day?.name}</p>
              <p className="text-xs text-zinc-400">{checkedCount} / {exercises.length} 완료</p>
            </div>
            <button
              onClick={() => setEditMode(v => !v)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full min-h-[32px] transition-colors ${
                editMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {editMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              {editMode ? '완료' : '편집'}
            </button>
          </div>
        </div>

        {/* YouTube Player */}
        {videoId && (
          <div className="bg-black">
            {videoVisible ? (
              <>
                <iframe
                  key={videoKey}
                  src={`https://www.youtube.com/embed/${videoId}?start=${videoTimestamp}&autoplay=${videoAutoplay ? 1 : 0}&rel=0&modestbranding=1`}
                  className="w-full"
                  style={{ height: 210 }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="workout video"
                />
                <button
                  onClick={() => setVideoVisible(false)}
                  className="w-full py-1.5 text-xs text-zinc-400 flex items-center justify-center gap-1 hover:text-zinc-300"
                >
                  <ChevronUp className="h-3.5 w-3.5" /> 영상 접기
                </button>
              </>
            ) : (
              <button
                onClick={() => setVideoVisible(true)}
                className="w-full py-3 text-sm text-emerald-400 flex items-center justify-center gap-1.5 hover:text-emerald-300"
              >
                <Play className="h-4 w-4" /> 영상 보기
              </button>
            )}
          </div>
        )}

        {/* Exercise List */}
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
          {exercises.map((ex, idx) => {
            const muscles = ex.muscle_group
              ? ex.muscle_group.split(',').map((m) => m.trim()).filter(Boolean)
              : [];
            const ev = editValues[ex.id] ?? {};
            const displayName = ev.name !== undefined ? ev.name : ex.name;
            const displayTS = ev.ts !== undefined ? ev.ts : (ex.timestamp_seconds != null ? toMMSS(ex.timestamp_seconds) : '');
            return (
              <div
                key={ex.id}
                onClick={() => !editMode && ex.timestamp_seconds != null && seekTo(ex.timestamp_seconds)}
                className={`bg-zinc-900 rounded-2xl border overflow-hidden transition-colors ${
                  checkedExercises[idx] ? 'border-emerald-800' : 'border-zinc-800'
                } ${!editMode && ex.timestamp_seconds != null ? 'active:scale-[0.98] cursor-pointer' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {editMode ? (
                        <>
                          <input
                            type="text"
                            value={displayName}
                            className="text-sm font-semibold bg-zinc-800 border border-zinc-700 rounded px-2 py-1 w-full focus:outline-none focus:border-emerald-500"
                            onChange={e => setEditValues(v => ({ ...v, [ex.id]: { ...ev, name: e.target.value } }))}
                            onBlur={e => saveField(ex.id, 'name', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          />
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-xs text-zinc-500">⏱</span>
                            <input
                              type="text"
                              value={displayTS}
                              placeholder="M:SS"
                              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 w-16 text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                              onChange={e => setEditValues(v => ({ ...v, [ex.id]: { ...ev, ts: e.target.value } }))}
                              onBlur={e => saveField(ex.id, 'ts', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            {ex.timestamp_seconds != null && (
                              <span className="text-xs text-blue-400 font-mono shrink-0">
                                {formatTimestamp(ex.timestamp_seconds)}
                              </span>
                            )}
                            <p className={`font-semibold leading-tight ${checkedExercises[idx] ? 'line-through text-zinc-500' : ''}`}>
                              {ex.name}
                            </p>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{ex.reps}</p>
                        </>
                      )}
                    </div>
                    {editMode ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteExercise(ex.id, idx); }}
                        className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCheck(idx); }}
                        className="shrink-0 active:scale-90 transition-transform p-1"
                      >
                        {checkedExercises[idx]
                          ? <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                          : <Circle className="h-12 w-12 text-zinc-600" />}
                      </button>
                    )}
                  </div>

                  {!editMode && muscles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {muscles.map((m, i) => (
                        <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Exercise Form (edit mode) */}
        {editMode && (
          <div className="max-w-lg mx-auto px-4 pt-2 pb-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-2">운동 추가</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={addForm.name}
                  placeholder="운동명"
                  className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 min-h-[40px]"
                  onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addExercise(); }}
                />
                <input
                  type="text"
                  value={addForm.ts}
                  placeholder="M:SS"
                  className="w-16 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-blue-400 font-mono focus:outline-none focus:border-blue-500 min-h-[40px]"
                  onChange={e => setAddForm(prev => ({ ...prev, ts: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addExercise(); }}
                />
                <button
                  onClick={addExercise}
                  disabled={!addForm.name.trim()}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-lg min-h-[40px] active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Button */}
        <div className="fixed bottom-16 left-0 right-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-4 z-40">
          <div className="max-w-lg mx-auto">
            <button
              onClick={completeWorkoutYoutube}
              disabled={completing}
              className={`w-full rounded-2xl py-4 font-semibold text-lg min-h-[56px] active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-500 text-white ${
                completing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {completing ? '저장 중...' : '운동 완료'}
            </button>
            <p className="text-xs text-zinc-500 text-center mt-2">
              {checkedCount} / {exercises.length} 운동 체크됨
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Strength Mode ────────────────────────────────────────────────────────
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
          <div className="relative w-48 h-48">
            <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#27272a" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="44" fill="none" stroke="#10b981" strokeWidth="8"
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
            onClick={() => setRestTimer(null)}
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
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight">{exercise.name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{exercise.muscle_group}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isFullyDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
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

              <div className="px-4 pb-1">
                <div className="grid grid-cols-[32px_1fr_1fr_48px] gap-2 items-center">
                  <span className="text-xs text-zinc-500 text-center">세트</span>
                  <span className="text-xs text-zinc-500 text-center">무게 (kg)</span>
                  <span className="text-xs text-zinc-500 text-center">횟수</span>
                  <span />
                </div>
              </div>

              <div className="px-4 pb-4 space-y-2">
                {setInputs[exIdx]?.map((setInput, setIdx) => (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-[32px_1fr_1fr_48px] gap-2 items-center ${
                      setInput.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-zinc-400 text-center">{setIdx + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={setInput.weight_kg}
                      onChange={(e) => updateSetInput(exIdx, setIdx, 'weight_kg', e.target.value)}
                      disabled={setInput.completed}
                      placeholder="0"
                      className="bg-zinc-800 text-center text-lg font-semibold rounded-xl py-3 w-full border border-zinc-700 focus:border-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={setInput.reps}
                      onChange={(e) => updateSetInput(exIdx, setIdx, 'reps', e.target.value)}
                      disabled={setInput.completed}
                      placeholder="0"
                      className="bg-zinc-800 text-center text-lg font-semibold rounded-xl py-3 w-full border border-zinc-700 focus:border-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
                    />
                    <button
                      onClick={() => !setInput.completed && completeSet(exIdx, setIdx)}
                      disabled={setInput.completed}
                      className={`flex items-center justify-center min-h-[52px] rounded-xl transition-colors ${
                        setInput.completed
                          ? 'text-emerald-400 cursor-default'
                          : 'text-zinc-500 hover:text-emerald-400 active:scale-90 bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      {setInput.completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
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
            onClick={completeWorkoutStrength}
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

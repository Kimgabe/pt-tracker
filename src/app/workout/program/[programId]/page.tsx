'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, ChevronRight, ChevronLeft, Target, Clock, RotateCcw, PlayCircle, Pencil, Check, Plus, AlertCircle, Trash2 } from 'lucide-react';

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

function extractVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return m ? m[1] : null;
}

interface Program {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  source_url: string | null;
}

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
  timestamp_seconds: number | null;
}

interface DayData {
  day: ProgramDay;
  exercises: DayExercise[];
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, { name?: string; ts?: string }>>({});
  const [videoTimestamp, setVideoTimestamp] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [addForm, setAddForm] = useState<Record<number, { name: string; ts: string }>>({});
  const savingRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    async function fetchProgram() {
      try {
        const res = await fetch(`/api/programs/${programId}/days`);
        const data = await res.json();
        setProgram(data.program);
        setDays(data.days);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchProgram();
  }, [programId]);

  const seekTo = useCallback((ts: number) => {
    setVideoTimestamp(ts);
    setVideoKey(k => k + 1);
  }, []);

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
      setDays(prev => prev.map(d => ({
        ...d,
        exercises: d.exercises.map(e => e.id === exId ? { ...e, timestamp_seconds: seconds } : e),
      })));
      if (seconds != null) seekTo(seconds);
    } else {
      if (!val.trim()) { savingRef.current[exId] = false; return; }
      await fetch(`/api/programs/exercises/${exId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: val.trim() }),
      });
      setDays(prev => prev.map(d => ({
        ...d,
        exercises: d.exercises.map(e => e.id === exId ? { ...e, name: val.trim() } : e),
      })));
    }

    savingRef.current[exId] = false;
  }, [seekTo]);

  const deleteExercise = useCallback(async (dayId: number, exId: number) => {
    await fetch(`/api/programs/exercises/${exId}`, { method: 'DELETE' });
    setDays(prev => prev.map(d =>
      d.day.id === dayId
        ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) }
        : d
    ));
  }, []);

  const addExercise = useCallback(async (dayId: number) => {
    const form = addForm[dayId];
    if (!form?.name?.trim()) return;
    const seconds = form.ts?.trim() ? parseMMSS(form.ts) : null;
    const res = await fetch(`/api/programs/${dayId}/exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), timestamp_seconds: seconds }),
    });
    const data = await res.json();
    if (data.ok) {
      const newEx: DayExercise = {
        id: data.id,
        exercise_id: 0,
        name: form.name.trim(),
        category: 'cardio',
        muscle_group: '',
        sets: 1,
        reps: '영상 참고',
        rest_seconds: 10,
        order_num: 999,
        notes: null,
        timestamp_seconds: seconds,
      };
      setDays(prev => prev.map(d =>
        d.day.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d
      ));
      setAddForm(prev => ({ ...prev, [dayId]: { name: '', ts: '' } }));
      if (seconds != null) seekTo(seconds);
    }
  }, [addForm, seekTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">프로그램 로딩 중...</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-4">
        <p className="text-zinc-400">프로그램을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-emerald-400 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> 돌아가기
        </button>
      </div>
    );
  }

  const isYoutube = program.source === 'youtube';
  const videoId = isYoutube && program.source_url ? extractVideoId(program.source_url) : null;

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="px-4 pt-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-zinc-400 mb-3 min-h-[44px] -ml-1">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm">프로그램 목록</span>
        </button>

        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{program.name}</h1>
            {program.description && (
              <p className="text-zinc-400 mt-0.5 text-xs">{program.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isYoutube && (
              <span className="flex items-center gap-1 bg-red-500/15 text-red-400 text-xs px-2 py-1 rounded-full">
                <PlayCircle className="h-3 w-3" />
                YouTube
              </span>
            )}
            {isYoutube && (
              <button
                onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full min-h-[32px] transition-colors ${
                  editMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {editMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {editMode ? '완료' : '편집'}
              </button>
            )}
          </div>
        </div>

        {/* AI 부정확성 안내 */}
        {isYoutube && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              AI가 영상에서 자동 추출한 결과로 <strong className="text-amber-300">운동명·타임스탬프가 부정확할 수 있어요.</strong>{' '}
              운동을 탭해 영상을 확인하고, <strong className="text-amber-300">편집</strong> 버튼으로 수정·추가하세요.
            </p>
          </div>
        )}
      </div>

      {/* YouTube Player */}
      {videoId && (
        <div className="w-full aspect-video bg-black mb-4">
          <iframe
            key={videoKey}
            src={`https://www.youtube.com/embed/${videoId}?start=${videoTimestamp}&autoplay=1&rel=0&modestbranding=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Day Cards */}
      <div className="px-4 space-y-4">
        {days.map((dayData) => {
          const { day, exercises } = dayData;
          const form = addForm[day.id] ?? { name: '', ts: '' };
          const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
          const avgRest = exercises.length > 0
            ? Math.round(exercises.reduce((sum, e) => sum + e.rest_seconds, 0) / exercises.length)
            : 0;

          return (
            <div key={day.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              {/* Day Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Day {day.day_number}: {day.name}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{day.focus}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{totalSets}세트</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{avgRest}초</span>
                  </div>
                </div>
              </div>

              {/* Exercise List */}
              <div className="px-4 py-2">
                {exercises.map((ex, idx) => {
                  const ev = editValues[ex.id] ?? {};
                  const displayName = ev.name !== undefined ? ev.name : ex.name;
                  const displayTS = ev.ts !== undefined ? ev.ts : (ex.timestamp_seconds != null ? toMMSS(ex.timestamp_seconds) : '');
                  const hasTS = ex.timestamp_seconds != null;

                  return (
                    <div
                      key={ex.id}
                      className={`flex items-start justify-between py-3 gap-2 ${
                        idx < exercises.length - 1 ? 'border-b border-zinc-800/50' : ''
                      }`}
                    >
                      <div
                        className={`flex items-start gap-3 flex-1 min-w-0 ${
                          !editMode && hasTS ? 'cursor-pointer active:opacity-60' : ''
                        }`}
                        onClick={() => { if (!editMode && hasTS) seekTo(ex.timestamp_seconds!); }}
                      >
                        <span className="text-xs text-zinc-500 w-5 text-center font-mono shrink-0 pt-0.5">
                          {ex.order_num}
                        </span>
                        <div className="flex-1 min-w-0">
                          {editMode ? (
                            <input
                              type="text"
                              value={displayName}
                              className="text-sm font-medium bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 w-full focus:outline-none focus:border-emerald-500"
                              onChange={e => setEditValues(v => ({ ...v, [ex.id]: { ...ev, name: e.target.value } }))}
                              onBlur={e => saveField(ex.id, 'name', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            />
                          ) : (
                            <p className="text-sm font-medium">{ex.name}</p>
                          )}

                          {editMode ? (
                            <div className="flex items-center gap-1.5 mt-1">
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
                              {hasTS && (
                                <button onClick={() => seekTo(ex.timestamp_seconds!)} className="text-xs text-blue-400 underline">
                                  확인
                                </button>
                              )}
                            </div>
                          ) : (
                            hasTS && (
                              <p className="text-xs text-blue-400 font-mono mt-0.5">▶ {toMMSS(ex.timestamp_seconds!)}</p>
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm text-zinc-300">{ex.sets} x {ex.reps}</p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1 justify-end">
                            <RotateCcw className="h-3 w-3" />{ex.rest_seconds}초
                          </p>
                        </div>
                        {editMode && (
                          <button
                            onClick={() => deleteExercise(day.id, ex.id)}
                            className="text-zinc-600 hover:text-red-400 transition-colors pt-0.5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Exercise Form (edit mode only) */}
              {editMode && (
                <div className="px-4 pb-3 pt-1 border-t border-zinc-800/50">
                  <p className="text-xs text-zinc-500 mb-2">운동 추가</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.name}
                      placeholder="운동명"
                      className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 min-h-[40px]"
                      onChange={e => setAddForm(prev => ({ ...prev, [day.id]: { ...form, name: e.target.value } }))}
                      onKeyDown={e => { if (e.key === 'Enter') addExercise(day.id); }}
                    />
                    <input
                      type="text"
                      value={form.ts}
                      placeholder="M:SS"
                      className="w-16 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-blue-400 font-mono focus:outline-none focus:border-blue-500 min-h-[40px]"
                      onChange={e => setAddForm(prev => ({ ...prev, [day.id]: { ...form, ts: e.target.value } }))}
                      onKeyDown={e => { if (e.key === 'Enter') addExercise(day.id); }}
                    />
                    <button
                      onClick={() => addExercise(day.id)}
                      disabled={!form.name?.trim()}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-lg min-h-[40px] active:scale-95 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

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

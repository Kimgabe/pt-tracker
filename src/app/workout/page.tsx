'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, ChevronRight, PlayCircle } from 'lucide-react';

interface Program {
  id: number;
  name: string;
  description: string | null;
  source: string | null;
  source_url: string | null;
}

export default function WorkoutPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrograms() {
      try {
        await fetch('/api/init', { method: 'POST' });
        const res = await fetch('/api/programs');
        const data = await res.json();
        setPrograms(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchPrograms();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">운동 프로그램</h1>
        <p className="text-zinc-400 mt-1">프로그램을 선택해 운동을 시작하세요</p>
      </div>

      <div className="space-y-3">
        {programs.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            등록된 프로그램이 없습니다
          </div>
        )}
        {programs.map((program) => {
          const isYoutube = program.source === 'youtube';
          return (
            <button
              key={program.id}
              onClick={() => router.push(`/workout/program/${program.id}`)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:border-zinc-700 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                {isYoutube ? (
                  <PlayCircle className="h-6 w-6 text-red-400" />
                ) : (
                  <Dumbbell className="h-6 w-6 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{program.name}</p>
                  {isYoutube && (
                    <span className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">
                      YouTube
                    </span>
                  )}
                </div>
                {program.description && (
                  <p className="text-sm text-zinc-400 mt-0.5 line-clamp-1">{program.description}</p>
                )}
              </div>

              <ChevronRight className="h-5 w-5 text-zinc-500 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

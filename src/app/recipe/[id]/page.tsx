'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, Flame, ExternalLink, Play } from 'lucide-react';

interface Ingredient {
  name: string;
  amount: string;
}

interface Step {
  description: string;
  timestamp_seconds: number | null;
}

interface Recipe {
  id: number;
  recipe_name: string;
  source_url: string;
  creator: string | null;
  goal_category: string;
  ingredients_json: string;
  steps_json: string;
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  estimated_cost_krw: number;
  cooking_time_min: number;
  difficulty: string;
  meal_type: string;
  tags_json: string;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return m ? m[1] : null;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
  pre_workout: '운동 전',
  post_workout: '운동 후',
};

export default function RecipePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoTimestamp, setVideoTimestamp] = useState(0);
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then((data) => setRecipe(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function seekTo(ts: number) {
    setVideoTimestamp(ts);
    setVideoKey((k) => k + 1);
    setVideoAutoplay(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500">로딩 중...</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">레시피를 찾을 수 없습니다</p>
      </div>
    );
  }

  const videoId = extractVideoId(recipe.source_url);
  const ingredients: Ingredient[] = recipe.ingredients_json ? JSON.parse(recipe.ingredients_json) : [];
  const steps: Step[] = recipe.steps_json ? JSON.parse(recipe.steps_json) : [];
  const tags: string[] = recipe.tags_json ? JSON.parse(recipe.tags_json) : [];

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Video */}
      {videoId && (
        <div className="relative bg-black" style={{ paddingTop: '56.25%' }}>
          <iframe
            key={videoKey}
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?start=${videoTimestamp}&autoplay=${videoAutoplay ? 1 : 0}&rel=0&modestbranding=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}

      <div className="px-4 pt-4 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.back()}
            className="mt-0.5 text-zinc-400 hover:text-white shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">{recipe.recipe_name}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
              {recipe.creator && <span>by {recipe.creator}</span>}
              {recipe.cooking_time_min > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {recipe.cooking_time_min}분
                </span>
              )}
              {recipe.difficulty && (
                <span className="bg-zinc-800 px-1.5 py-0.5 rounded">
                  {DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty}
                </span>
              )}
              {recipe.meal_type && (
                <span className="bg-zinc-800 px-1.5 py-0.5 rounded">
                  {MEAL_TYPE_LABEL[recipe.meal_type] ?? recipe.meal_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Macros */}
        {recipe.calories > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-orange-400 text-sm font-semibold">
                <Flame className="h-3.5 w-3.5" /> {recipe.calories}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">kcal</div>
            </div>
            <div>
              <div className="text-red-400 text-sm font-semibold">{recipe.protein_g}g</div>
              <div className="text-xs text-zinc-500 mt-0.5">단백질</div>
            </div>
            <div>
              <div className="text-yellow-400 text-sm font-semibold">{recipe.carb_g}g</div>
              <div className="text-xs text-zinc-500 mt-0.5">탄수화물</div>
            </div>
            <div>
              <div className="text-blue-400 text-sm font-semibold">{recipe.fat_g}g</div>
              <div className="text-xs text-zinc-500 mt-0.5">지방</div>
            </div>
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">재료</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {ingredients.map((ing, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm">
                  {ing.name}{' '}
                  <span className="text-zinc-400">{ing.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">조리 순서</h2>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex gap-3 items-start"
                >
                  <span className="text-emerald-400 font-mono text-xs mt-0.5 shrink-0 w-4">{i + 1}</span>
                  <span className="text-sm text-zinc-200 flex-1">{step.description}</span>
                  {step.timestamp_seconds != null && videoId && (
                    <button
                      onClick={() => seekTo(step.timestamp_seconds!)}
                      className="shrink-0 text-zinc-500 hover:text-emerald-400 active:scale-95 transition-all"
                      title="영상에서 보기"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <span key={i} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Source link */}
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
    </div>
  );
}

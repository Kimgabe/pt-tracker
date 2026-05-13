import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractVideoId, fetchTranscript, fetchVideoMetadata } from '@/lib/youtube';
import { classifyContent } from '@/lib/pipelines/contentClassifier';
import { extractWorkout, WORKOUT_PROMPT_VERSION } from '@/lib/pipelines/workoutExtractor';
import { extractRecipe, RECIPE_PROMPT_VERSION } from '@/lib/pipelines/recipeExtractor';

async function findCached(sourceUrl: string) {
  const [workoutRow, recipeRow] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM youtube_workouts WHERE source_url = ? LIMIT 1', args: [sourceUrl] }),
    db.execute({ sql: 'SELECT * FROM youtube_recipes WHERE source_url = ? LIMIT 1', args: [sourceUrl] }),
  ]);

  if (workoutRow.rows.length > 0) {
    const row = workoutRow.rows[0] as Record<string, unknown>;
    const cachedVersion = (row.prompt_version as string) ?? '';
    if (cachedVersion !== WORKOUT_PROMPT_VERSION) {
      // Stale cache — delete and re-analyze
      await db.execute({ sql: 'DELETE FROM youtube_workouts WHERE id = ?', args: [row.id as number] });
      return null;
    }
    return {
      type: 'workout' as const,
      id: row.id as number,
      data: {
        id: row.id as number,
        workout_name: row.workout_name as string,
        source_url: row.source_url as string,
        creator: row.creator as string,
        workout_type: row.workout_type as string,
        total_duration_min: row.total_duration_min as number,
        estimated_calories: row.estimated_calories as number,
        exercises: JSON.parse((row.exercises_json as string) || '[]'),
      },
    };
  }

  if (recipeRow.rows.length > 0) {
    const row = recipeRow.rows[0] as Record<string, unknown>;
    const cachedVersion = (row.prompt_version as string) ?? '';
    if (cachedVersion !== RECIPE_PROMPT_VERSION) {
      // Stale cache — delete and re-analyze
      await db.execute({ sql: 'DELETE FROM youtube_recipes WHERE id = ?', args: [row.id as number] });
      return null;
    }
    return {
      type: 'recipe' as const,
      id: row.id as number,
      data: {
        id: row.id as number,
        recipe_name: row.recipe_name as string,
        source_url: row.source_url as string,
        creator: row.creator as string,
        goal_category: row.goal_category as string,
        ingredients: JSON.parse((row.ingredients_json as string) || '[]'),
        steps: JSON.parse((row.steps_json as string) || '[]'),
        calories: row.calories as number,
        protein_g: row.protein_g as number,
        carb_g: row.carb_g as number,
        fat_g: row.fat_g as number,
        cooking_time_min: row.cooking_time_min as number,
        difficulty: row.difficulty as string,
        meal_type: row.meal_type as string,
        tags: JSON.parse((row.tags_json as string) || '[]'),
      },
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다' }, { status: 400 });
    }

    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Check cache — return existing result if already analyzed
    const cached = await findCached(sourceUrl);
    if (cached) {
      return NextResponse.json({
        type: cached.type,
        saved: true,
        cached: true,
        id: cached.id,
        data: cached.data,
      });
    }

    // Fetch transcript and metadata in parallel
    const [transcript, metadata] = await Promise.all([
      fetchTranscript(videoId),
      fetchVideoMetadata(sourceUrl),
    ]);

    // Classify content type
    const contentType = classifyContent(transcript.text);

    if (contentType === 'workout') {
      const workout = await extractWorkout(
        transcript.text,
        transcript.segments,
        metadata.title,
        metadata.author,
        sourceUrl,
      );

      if (workout.exercises.length === 0) {
        return NextResponse.json({
          type: 'workout',
          saved: false,
          cached: false,
          data: workout,
          message: '운동 정보를 추출할 수 없습니다. 자막에 운동 설명이 부족합니다.',
        });
      }

      // Save to DB
      const result = await db.execute({
        sql: `INSERT INTO youtube_workouts (workout_name, source_url, creator, workout_type, total_duration_min, estimated_calories, exercises_json, prompt_version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          workout.workout_name,
          workout.source_url,
          workout.creator,
          workout.workout_type,
          workout.total_duration_min,
          workout.estimated_calories,
          JSON.stringify(workout.exercises),
          WORKOUT_PROMPT_VERSION,
        ],
      });

      return NextResponse.json({
        type: 'workout',
        saved: true,
        cached: false,
        id: Number(result.lastInsertRowid),
        data: workout,
      });
    } else {
      const recipe = await extractRecipe(
        transcript.text,
        transcript.segments,
        metadata.title,
        metadata.author,
        sourceUrl,
      );

      if (recipe.ingredients.length === 0) {
        return NextResponse.json({
          type: 'recipe',
          saved: false,
          cached: false,
          data: recipe,
          message: '레시피 정보를 추출할 수 없습니다. 자막에 요리 설명이 부족합니다.',
        });
      }

      // Save to DB
      const result = await db.execute({
        sql: `INSERT INTO youtube_recipes (recipe_name, source_url, creator, goal_category, ingredients_json, steps_json, calories, protein_g, carb_g, fat_g, estimated_cost_krw, cooking_time_min, difficulty, meal_type, tags_json, prompt_version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          recipe.recipe_name,
          recipe.source_url,
          recipe.creator,
          recipe.goal_category,
          JSON.stringify(recipe.ingredients),
          JSON.stringify(recipe.steps),
          recipe.nutrition.calories,
          recipe.nutrition.protein_g,
          recipe.nutrition.carb_g,
          recipe.nutrition.fat_g,
          recipe.estimated_cost_krw,
          recipe.cooking_time_min,
          recipe.difficulty,
          recipe.meal_type,
          JSON.stringify(recipe.tags),
          RECIPE_PROMPT_VERSION,
        ],
      });

      return NextResponse.json({
        type: 'recipe',
        saved: true,
        cached: false,
        id: Number(result.lastInsertRowid),
        data: recipe,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

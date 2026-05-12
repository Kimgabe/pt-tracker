import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractVideoId, fetchTranscript, fetchVideoMetadata } from '@/lib/youtube';
import { classifyContent } from '@/lib/pipelines/contentClassifier';
import { extractWorkout } from '@/lib/pipelines/workoutExtractor';
import { extractRecipe } from '@/lib/pipelines/recipeExtractor';

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
          data: workout,
          message: '운동 정보를 추출할 수 없습니다. 자막에 운동 설명이 부족합니다.',
        });
      }

      // Save to DB
      const result = await db.execute({
        sql: `INSERT INTO youtube_workouts (workout_name, source_url, creator, workout_type, total_duration_min, estimated_calories, exercises_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          workout.workout_name,
          workout.source_url,
          workout.creator,
          workout.workout_type,
          workout.total_duration_min,
          workout.estimated_calories,
          JSON.stringify(workout.exercises),
        ],
      });

      return NextResponse.json({
        type: 'workout',
        saved: true,
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
          data: recipe,
          message: '레시피 정보를 추출할 수 없습니다. 자막에 요리 설명이 부족합니다.',
        });
      }

      // Save to DB
      const result = await db.execute({
        sql: `INSERT INTO youtube_recipes (recipe_name, source_url, creator, goal_category, ingredients_json, steps_json, calories, protein_g, carb_g, fat_g, estimated_cost_krw, cooking_time_min, difficulty, meal_type, tags_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      });

      return NextResponse.json({
        type: 'recipe',
        saved: true,
        id: Number(result.lastInsertRowid),
        data: recipe,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

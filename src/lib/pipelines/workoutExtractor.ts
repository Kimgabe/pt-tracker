import { callLLM, parseJSON } from '../llm';
import type { TranscriptSegment } from '../youtube';

/** Bump this when workout extraction prompts change to auto-invalidate cached results */
export const WORKOUT_PROMPT_VERSION = 'w-2026-05-16h';

export interface ExtractedExercise {
  name: string;
  sets: number;
  reps: string | number;
  rest_seconds: number;
  equipment: string[];
  target_muscles: string[];
  timestamp_seconds: number | null;
}

export interface ExtractedWorkout {
  workout_name: string;
  exercises: ExtractedExercise[];
  total_duration_min: number;
  estimated_calories: number;
  creator: string;
  workout_type: string;
  source_url: string;
}

function parseDescriptionTimestamps(
  description: string,
): Array<{ name: string; timestamp_seconds: number }> {
  const results: Array<{ name: string; timestamp_seconds: number }> = [];
  const re = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/;
  for (const line of description.split('\n')) {
    const m = line.trim().match(re);
    if (!m) continue;
    const hours = m[1] ? parseInt(m[1]) : 0;
    const minutes = parseInt(m[2]);
    const seconds = parseInt(m[3]);
    results.push({
      name: m[4].trim(),
      timestamp_seconds: hours * 3600 + minutes * 60 + seconds,
    });
  }
  return results;
}

async function buildFromDescriptionTimestamps(
  timestamps: Array<{ name: string; timestamp_seconds: number }>,
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
): Promise<ExtractedWorkout> {
  const exercises: ExtractedExercise[] = [...timestamps]
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    .map(t => ({
      name: t.name,
      sets: 1,
      reps: '영상 참고',
      rest_seconds: 10,
      equipment: [],
      target_muscles: [],
      timestamp_seconds: t.timestamp_seconds,
    }));

  const exerciseList = timestamps.map(t => t.name).join(', ');
  const titleHint = videoTitle ? `\nVideo title: "${videoTitle}"` : '';
  const stage3 = parseJSON(await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: cardio${titleHint}

Produce:
- workout_name: a concrete Korean routine name. If a Video title is provided, base the name on it. NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes. If the video title contains a duration (e.g. "12분", "30 min"), use that.

Return JSON: {"workout_name": "...", "total_duration_min": 30}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' }
  ));

  return {
    workout_name: (stage3.workout_name as string) ?? videoTitle ?? '',
    exercises,
    total_duration_min: Number(stage3.total_duration_min) || 0,
    estimated_calories: 0,
    creator: creator ?? '',
    workout_type: 'cardio',
    source_url: sourceUrl,
  };
}

/**
 * Parse numbered exercise list from video description.
 * Matches lines like "1. 레터럴 잭 [전신유산소]" or "2) 스쿼트"
 */
function parseDescriptionExerciseList(description: string): string[] {
  const results: string[] = [];
  const re = /^\d+[.)]\s+(.+?)(?:\s*[\[（(].+?[\]）)])*\s*$/;
  for (const line of description.split('\n')) {
    const m = line.trim().match(re);
    if (!m) continue;
    // Remove bracketed muscle tags like [전신유산소]
    const name = m[1].replace(/\s*[\[（(][^\]）)]*[\]）)]/g, '').trim();
    if (name.length > 1) results.push(name);
  }
  return results;
}

async function buildFromDescriptionExerciseList(
  exerciseNames: string[],
  segments: TranscriptSegment[],
  truncatedTranscript: string,
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
  description?: string | null,
): Promise<ExtractedWorkout> {
  const exerciseList = exerciseNames.join(', ');
  const titleHint = videoTitle ? `\nVideo title: "${videoTitle}"` : '';

  // Ask LLM to find each exercise's start timestamp in the transcript
  const tsResult = parseJSON(await callLLM(
    'You find exact timestamps where exercises begin in workout video transcripts.',
    `These exercises are performed in order in this workout video:
[${exerciseList}]
${titleHint}

For each exercise, find the [SEG:N] segment where it is FIRST ACTUALLY DEMONSTRATED (not the intro preview at the start).

Rules:
- Exercises appear in the ORDER listed above. Use this order to guide your search.
- Skip any mention of exercises in the intro/preview section at the very beginning.
- Look for instructor cues like movement descriptions, "시작", "합니다", directional guidance.
- NEVER use segments containing "active rest", "Active rest", "액티브 레스트" — these are rest periods between exercises.
- If you cannot find a reliable start segment for an exercise, return null for that one.
- Consecutive exercise segments must be at least 20 seconds apart.

Return JSON: {"exercises": [{"name": "운동명", "segment_index": N_or_null}, ...]}
Return ONLY valid JSON.

Transcript:
${truncatedTranscript}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const rawExercises = (tsResult.exercises as Array<{ name: string; segment_index: number | null }>) ?? [];

  const exercises: ExtractedExercise[] = rawExercises.map(ex => {
    const segIdx = ex.segment_index;
    let timestamp: number | null = null;
    if (segIdx !== null && segIdx !== undefined && segIdx >= 0 && segIdx < segments.length) {
      timestamp = Math.floor(segments[segIdx].offset);
    }
    return {
      name: ex.name,
      sets: 1,
      reps: '영상 참고',
      rest_seconds: 10,
      equipment: [],
      target_muscles: [],
      timestamp_seconds: timestamp,
    };
  });

  // Sort by timestamp (nulls last), then filter < 15s gaps
  exercises.sort((a, b) => {
    if (a.timestamp_seconds === null) return 1;
    if (b.timestamp_seconds === null) return -1;
    return a.timestamp_seconds - b.timestamp_seconds;
  });
  for (let i = 1; i < exercises.length; i++) {
    const prev = exercises[i - 1].timestamp_seconds;
    const curr = exercises[i].timestamp_seconds;
    if (prev !== null && curr !== null && curr - prev < 15) {
      exercises[i].timestamp_seconds = null;
    }
  }

  // Meta info
  const stage3 = parseJSON(await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: hiit${titleHint}
${description ? `\nDescription excerpt: ${description.slice(0, 400)}` : ''}

Produce:
- workout_name: a concrete Korean routine name based on the video title or description.
- total_duration_min: workout time in minutes. Extract from title/description if possible.

Return JSON: {"workout_name": "...", "total_duration_min": 20}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' }
  ));

  return {
    workout_name: (stage3.workout_name as string) ?? videoTitle ?? '',
    exercises,
    total_duration_min: Number(stage3.total_duration_min) || 0,
    estimated_calories: 0,
    creator: creator ?? '',
    workout_type: 'hiit',
    source_url: sourceUrl,
  };
}

/** Sanitize reps: accept numbers or duration strings (e.g. "30초"), reject ASR garbage */
function sanitizeReps(raw: unknown): string | number {
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Pass through descriptive labels like "영상 참고"
    if (trimmed === '영상 참고') return trimmed;
    // Pure number string
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    // Duration pattern: "30초", "40초", "1분", "1분 30초"
    if (/^\d+\s*(초|분|seconds?|sec|min|minutes?)/.test(trimmed)) return trimmed;
    // Fallback: if it contains a number, extract it
    const numMatch = trimmed.match(/(\d+)/);
    if (numMatch) return Number(numMatch[1]);
  }
  return 10; // default
}

export async function extractWorkout(
  transcriptText: string,
  segments: TranscriptSegment[],
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
  description?: string | null,
): Promise<ExtractedWorkout> {
  // Description-first path: use timestamps from video description when available
  if (description) {
    const descTimestamps = parseDescriptionTimestamps(description);
    if (descTimestamps.length >= 3) {
      return buildFromDescriptionTimestamps(descTimestamps, videoTitle, creator, sourceUrl);
    }
  }

  // Description exercise-list path: creator's own numbered list → use as ground truth for names
  if (description) {
    const descExercises = parseDescriptionExerciseList(description);
    if (descExercises.length >= 3) {
      let fullText = transcriptText;
      if (segments.length > 0) {
        fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
      }
      // Description-list path only finds timestamps (simpler task) → allow more transcript
      const truncated = fullText.length > 20000 ? fullText.slice(0, 20000) : fullText;
      return buildFromDescriptionExerciseList(descExercises, segments, truncated, videoTitle, creator, sourceUrl, description);
    }
  }

  // Format with segment indices
  let fullText = transcriptText;
  if (segments.length > 0) {
    fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
  }
  const truncated = fullText.length > 10000 ? fullText.slice(0, 10000) : fullText;

  // === Stage 1: Extract exercise names + circuit detection ===
  const stage1 = parseJSON(await callLLM(
    'You extract exercise names from workout video transcripts. Be precise, never invent.',
    `From this transcript, list ALL exercises or movements performed.

Rules:
- Include formally named exercises (e.g. "스쿼트", "푸시업", "버피")
- ALSO include movement descriptions used in follow-along/cardio videos (e.g. "제자리 걷기", "무릎 들어올리기", "팔꿈치-무릎 터치", "골반 회전 뛰기")
- For follow-along videos, the instructor often describes movements without formal exercise names — extract these as exercise names
- Do NOT invent exercises not in the transcript
- Return Korean names when possible
- Aim to capture every distinct movement/exercise in the MAIN workout, even if described informally
- Do NOT include cooldown stretches, static stretches, or post-workout cool-down movements (e.g. breathing exercises, hamstring stretches, butterfly stretch) — only include the active workout exercises
- is_circuit: true if the same set of exercises is repeated multiple times (rounds/circuits). false otherwise.
- estimated_rounds: how many times the circuit repeats (1 if not a circuit)

Return JSON: {"exercises": ["운동명1", "운동명2"], "workout_type": "strength|cardio|hiit|yoga|dance|stretching", "is_circuit": false, "estimated_rounds": 1}
Return ONLY valid JSON.

Transcript:
${fullText}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const exerciseNames = (stage1.exercises as string[]) ?? [];
  const workoutType = (stage1.workout_type as string) ?? 'strength';
  const isCircuit = Boolean(stage1.is_circuit);
  const estimatedRounds = Number(stage1.estimated_rounds) || 1;

  if (exerciseNames.length === 0) {
    return {
      workout_name: videoTitle ?? '',
      exercises: [],
      total_duration_min: 0,
      estimated_calories: 0,
      creator: creator ?? '',
      workout_type: workoutType,
      source_url: sourceUrl,
    };
  }

  // === Stage 2: Get details for each exercise ===
  const exerciseList = exerciseNames.join(', ');
  const isCardioType = ['cardio', 'hiit', 'dance'].includes(workoutType);
  const circuitRoundsHint = isCircuit && estimatedRounds > 1
    ? `\nThis is a CIRCUIT workout repeated ${estimatedRounds} times. For each exercise, find the segment_index for EVERY round occurrence.`
    : '';
  const segmentIndexField = isCircuit && estimatedRounds > 1
    ? `"segment_indices": [N_round1, N_round2, ...]`
    : `"segment_index": null`;

  const stage2 = parseJSON(await callLLM(
    'You structure exercise details from transcripts. Use only information from the transcript.',
    `For these exercises found in the transcript: [${exerciseList}]

Workout type from classification: ${workoutType}${circuitRoundsHint}

${isCardioType
  ? 'This is a CARDIO/HIIT/DANCE workout. Default to TIME-BASED format unless the transcript explicitly mentions sets and reps (e.g. "3세트 10회").'
  : 'Determine: Is this SET-BASED (e.g. "3 sets of 10 reps") or TIME-BASED (e.g. "30 seconds each")?'}

Return JSON:
{"workout_format": "sets|time",
  "exercises": [
  {"name": "운동명", "sets": 1, "reps": "30초", "rest_seconds": 10, "equipment": ["장비"], "target_muscles": ["부위"], ${segmentIndexField}}
]}

Rules:
- For TIME-BASED workouts (cardio/hiit/dance default):
  - sets: usually 1 (unless the circuit is repeated)
  - reps: use the DURATION as string (e.g. "30초", "40초", "1분"). If no specific duration is mentioned, return "영상 참고".
  - rest_seconds: extract from transcript if mentioned. Default ${isCardioType ? '10' : '60'} if not mentioned.
- For SET-BASED workouts:
  - sets/reps: Use values from transcript. Default to 3 sets, 10 reps if not mentioned.
  - rest_seconds: Default 60 if not mentioned.
- equipment: Extract from transcript, or infer from exercise type
- target_muscles: Based on exercise type (Korean)
${isCircuit && estimatedRounds > 1 ? `- segment_indices: Array of [SEG:N] numbers, one per round. Find EACH occurrence across all rounds.
  * Skip intro preview mentions at the start.
  * Each round's exercises should be spaced ~equal time apart.` : `- segment_index: The [SEG:N] number where this exercise is ACTUALLY PERFORMED (not the intro preview).
  IMPORTANT rules for follow-along/cardio videos:
  * Instructors often list ALL exercises at the start as a preview — IGNORE these intro mentions.
  * Use the segment where the instructor says "자", "시작", "합니다" RIGHT BEFORE the exercise begins.
  * Two consecutive exercises should be at least 20 seconds apart. If your chosen segments are less than 20s apart, reconsider — one of them is likely an intro mention.
  * When in doubt, prefer a LATER segment (actual demonstration) over an EARLIER one (intro mention).
  * NEVER use segments containing '액티브 레스트', '가볍게', '제자리에서 걷거나', '제자리에서 뛰거나', 'active rest', 'Active rest', 'rest time', 'take a rest', or similar rest/transition cues. These are ACTIVE REST periods between exercises, not exercise starts.
  * For non-rest exercises (e.g. jumping jacks, squats, bicycle kicks): if your chosen segment says "active rest" or "rest", it is WRONG. Choose the next segment where the instructor names or demonstrates that exercise.`}
- reps MUST be either a number (e.g. 10, 15), a duration string (e.g. "30초", "40초", "1분"), or "영상 참고" if unknown. NEVER use broken ASR text as reps value.
- Return ONLY valid JSON.

Transcript:
${truncated}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const defaultRest = isCardioType ? 10 : 60;
  const rawExercises = (stage2.exercises as Record<string, unknown>[]) ?? [];

  const exercises: ExtractedExercise[] = [];
  for (const ex of rawExercises) {
    const baseName = (ex.name as string) ?? '';
    const sets = Number(ex.sets) || (isCardioType ? 1 : 3);
    const reps = sanitizeReps(ex.reps);
    const restSeconds = Number(ex.rest_seconds) || defaultRest;
    const equipment = (ex.equipment as string[]) ?? [];
    const targetMuscles = (ex.target_muscles as string[]) ?? [];

    // Circuit path: segment_indices array
    if (isCircuit && Array.isArray(ex.segment_indices) && ex.segment_indices.length > 0) {
      const roundIndices = ex.segment_indices as number[];
      roundIndices.forEach((segIdx, roundIdx) => {
        let timestamp: number | null = null;
        if (segIdx != null && segIdx >= 0 && segIdx < segments.length) {
          timestamp = Math.floor(segments[segIdx].offset);
        }
        const name = roundIndices.length > 1 ? `${baseName} · ${roundIdx + 1}R` : baseName;
        exercises.push({ name, sets, reps, rest_seconds: restSeconds, equipment, target_muscles: targetMuscles, timestamp_seconds: timestamp });
      });
    } else {
      // Non-circuit path: single segment_index
      const segIdx = ex.segment_index as number | null;
      let timestamp: number | null = null;
      if (segIdx !== null && segIdx >= 0 && segIdx < segments.length) {
        timestamp = Math.floor(segments[segIdx].offset);
      }
      exercises.push({ name: baseName, sets, reps, rest_seconds: restSeconds, equipment, target_muscles: targetMuscles, timestamp_seconds: timestamp });
    }
  }

  exercises.sort((a, b) => {
    if (a.timestamp_seconds === null) return 1;
    if (b.timestamp_seconds === null) return -1;
    return a.timestamp_seconds - b.timestamp_seconds;
  });

  // Post-process: reset timestamps that are suspiciously close (< 15s apart)
  // Apply to all workout types — even in circuits, two different exercises can't start 5s apart
  for (let i = 1; i < exercises.length; i++) {
    const prev = exercises[i - 1].timestamp_seconds;
    const curr = exercises[i].timestamp_seconds;
    if (prev !== null && curr !== null && curr - prev < 15) {
      exercises[i].timestamp_seconds = null;
    }
  }

  // === Stage 3: Meta info ===
  const titleHint = videoTitle ? `\nVideo title: "${videoTitle}"` : '';
  const creatorHint = creator ? `\nCreator: "${creator}"` : '';
  const stage3 = parseJSON(await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: ${workoutType}${titleHint}${creatorHint}

Produce:
- workout_name: a concrete Korean routine name. If a Video title is provided, base the
  name on it (you may shorten or simplify, but keep the specific topic). NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes. If the video title contains a duration (e.g. "12분", "30 min"), use that as the primary source. Otherwise estimate from exercise count.

Return JSON: {"workout_name": "...", "total_duration_min": 30}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' }
  ));

  return {
    workout_name: (stage3.workout_name as string) ?? videoTitle ?? '',
    exercises,
    total_duration_min: Number(stage3.total_duration_min) || 0,
    estimated_calories: 0,
    creator: creator ?? '',
    workout_type: workoutType,
    source_url: sourceUrl,
  };
}

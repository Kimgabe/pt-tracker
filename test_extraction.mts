/**
 * Test script: Run workoutExtractor pipeline against local json3 transcript
 * for video oMJuiJ9Rs0w (임피티 12분 뱃살 걷기 홈트)
 *
 * Usage: npx tsx test_extraction.mts
 */

import { readFileSync } from 'fs';

// Load .env.local manually (no dotenv dependency)
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  process.env[key] = val;
}

// ── Parse local json3 ──

interface CaptionEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8: string }[];
}

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

function parseJson3Events(events: CaptionEvent[]): TranscriptSegment[] {
  return events
    .filter(e => e.segs && e.segs.some(s => s.utf8?.trim()))
    .map(e => ({
      text: e.segs!.map(s => s.utf8).join('').trim(),
      offset: (e.tStartMs ?? 0) / 1000,
      duration: (e.dDurationMs ?? 0) / 1000,
    }))
    .filter(s => s.text.length > 0);
}

// ── LLM helpers (copied from src/lib/llm.ts to avoid TS path alias issues) ──

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { jsonMode?: boolean; model?: string },
): Promise<string> {
  const model = options?.model ?? 'gpt-4.1-mini';
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2000,
    ...(options?.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });
  return response.choices[0]?.message?.content ?? '';
}

function parseJSON(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = blockMatch ? blockMatch[1].trim() : trimmed;
  try {
    return JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    return {};
  }
}

function sanitizeReps(raw: unknown): string | number {
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '영상 참고') return trimmed;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    if (/^\d+\s*(초|분|seconds?|sec|min|minutes?)/.test(trimmed)) return trimmed;
    const numMatch = trimmed.match(/(\d+)/);
    if (numMatch) return Number(numMatch[1]);
  }
  return 10;
}

// ── Main ──

async function main() {
  console.log('='.repeat(70));
  console.log('PT TRACKER - WORKOUT EXTRACTION PIPELINE TEST');
  console.log('Video: oMJuiJ9Rs0w (임피티 12분 뱃살 걷기 홈트)');
  console.log('='.repeat(70));

  // 1. Load local json3
  const json3Path = '🔥단 12분만에! 뱃살이 무섭게 빠지는 실속 걷기 홈트!! 12-min full body fat burning workout korean [oMJuiJ9Rs0w].ko.json3';
  const raw = JSON.parse(readFileSync(json3Path, 'utf-8'));
  const events: CaptionEvent[] = raw.events ?? [];
  const segments = parseJson3Events(events);

  console.log(`\n[TRANSCRIPT] ${segments.length} segments loaded from local json3`);

  const fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
  const plainText = segments.map(s => s.text).join(' ');
  console.log(`[TRANSCRIPT] Full text length: ${fullText.length} chars`);
  console.log(`[TRANSCRIPT] Plain text length: ${plainText.length} chars`);
  const truncated = fullText.length > 6000 ? fullText.slice(0, 6000) : fullText;
  console.log(`[TRANSCRIPT] Truncated (for stage 2): ${truncated.length} chars`);

  // Show a sample of the transcript
  console.log('\n--- Transcript sample (first 500 chars) ---');
  console.log(plainText.slice(0, 500));
  console.log('--- End sample ---\n');

  // 2. Stage 1: Extract exercise names
  console.log('[STAGE 1] Extracting exercise names...');
  const stage1Raw = await callLLM(
    'You extract exercise names from workout video transcripts. Be precise, never invent.',
    `From this transcript, list ALL exercises or movements performed.

Rules:
- Include formally named exercises (e.g. "스쿼트", "푸시업", "버피")
- ALSO include movement descriptions used in follow-along/cardio videos (e.g. "제자리 걷기", "무릎 들어올리기", "팔꿈치-무릎 터치", "골반 회전 뛰기")
- For follow-along videos, the instructor often describes movements without formal exercise names — extract these as exercise names
- Do NOT invent exercises not in the transcript
- Return Korean names when possible
- Aim to capture every distinct movement/exercise, even if described informally

Return JSON: {"exercises": ["운동명1", "운동명2"], "workout_type": "strength|cardio|hiit|yoga|dance|stretching"}
Return ONLY valid JSON.

Transcript:
${fullText}`,
    { jsonMode: true, model: 'gpt-4.1-mini' },
  );

  const stage1 = parseJSON(stage1Raw);
  const exerciseNames = (stage1.exercises as string[]) ?? [];
  const workoutType = (stage1.workout_type as string) ?? 'strength';

  console.log(`\n[STAGE 1 RESULT] workout_type: ${workoutType}`);
  console.log(`[STAGE 1 RESULT] ${exerciseNames.length} exercises detected:`);
  exerciseNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`);
  });

  if (exerciseNames.length === 0) {
    console.log('\nERROR: Stage 1 returned 0 exercises. Aborting.');
    return;
  }

  // 3. Stage 2: Get details
  console.log('\n[STAGE 2] Getting exercise details...');
  const exerciseList = exerciseNames.join(', ');
  const isCardioType = ['cardio', 'hiit', 'dance'].includes(workoutType);

  const stage2Raw = await callLLM(
    'You structure exercise details from transcripts. Use only information from the transcript.',
    `For these exercises found in the transcript: [${exerciseList}]

Workout type from classification: ${workoutType}

${isCardioType
  ? 'This is a CARDIO/HIIT/DANCE workout. Default to TIME-BASED format unless the transcript explicitly mentions sets and reps (e.g. "3세트 10회").'
  : 'Determine: Is this SET-BASED (e.g. "3 sets of 10 reps") or TIME-BASED (e.g. "30 seconds each")?'}

Return JSON:
{"workout_format": "sets|time",
  "exercises": [
  {"name": "운동명", "sets": 1, "reps": "30초", "rest_seconds": 10, "equipment": ["장비"], "target_muscles": ["부위"], "segment_index": null}
]}

Rules:
- For TIME-BASED workouts (cardio/hiit/dance default):
  - sets: usually 1 (unless the circuit is repeated)
  - reps: use the DURATION as string (e.g. "30초", "40초", "1분"). If no specific duration is mentioned, estimate from the gap between consecutive exercises using segment timing, or return "영상 참고".
  - rest_seconds: extract from transcript if mentioned. Default ${isCardioType ? '10' : '60'} if not mentioned.
- For SET-BASED workouts:
  - sets/reps: Use values from transcript. Default to 3 sets, 10 reps if not mentioned.
  - rest_seconds: Default 60 if not mentioned.
- equipment: Extract from transcript, or infer from exercise type
- target_muscles: Based on exercise type (Korean)
- segment_index: The [SEG:N] number where this exercise is first mentioned. Must be exact.
- reps MUST be either a number (e.g. 10, 15), a duration string (e.g. "30초", "40초", "1분"), or "영상 참고" if unknown. NEVER use broken ASR text as reps value.
- Return ONLY valid JSON.

Transcript:
${truncated}`,
    { jsonMode: true, model: 'gpt-4.1-mini' },
  );

  const stage2 = parseJSON(stage2Raw);
  const defaultRest = isCardioType ? 10 : 60;

  interface ExerciseRaw {
    name: string;
    sets: number;
    reps: unknown;
    rest_seconds: number;
    equipment: string[];
    target_muscles: string[];
    segment_index: number | null;
  }

  const exercises = ((stage2.exercises as ExerciseRaw[]) ?? []).map(ex => {
    const segIdx = ex.segment_index;
    let timestamp: number | null = null;
    if (segIdx !== null && segIdx >= 0 && segIdx < segments.length) {
      timestamp = Math.floor(segments[segIdx].offset);
    }

    return {
      name: ex.name ?? '',
      sets: Number(ex.sets) || (isCardioType ? 1 : 3),
      reps: sanitizeReps(ex.reps),
      rest_seconds: Number(ex.rest_seconds) || defaultRest,
      equipment: ex.equipment ?? [],
      target_muscles: ex.target_muscles ?? [],
      timestamp_seconds: timestamp,
      segment_index: segIdx,
    };
  });

  // 4. Stage 3: Meta
  console.log('\n[STAGE 3] Getting workout metadata...');
  const videoTitle = '🔥단 12분만에! 뱃살이 무섭게 빠지는 실속 걷기 홈트!!';
  const creator = '임피티IMPT';
  const stage3Raw = await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: ${workoutType}
Video title: "${videoTitle}"
Creator: "${creator}"

Produce:
- workout_name: a concrete Korean routine name. If a Video title is provided, base the
  name on it (you may shorten or simplify, but keep the specific topic). NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes. If the video title contains a duration (e.g. "12분", "30 min"), use that as the primary source. Otherwise estimate from exercise count.

Return JSON: {"workout_name": "...", "total_duration_min": 30}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' },
  );
  const stage3 = parseJSON(stage3Raw);

  // 5. Final report
  console.log('\n' + '='.repeat(70));
  console.log('FINAL EXTRACTION RESULTS');
  console.log('='.repeat(70));
  console.log(`Workout name: ${stage3.workout_name}`);
  console.log(`Duration: ${stage3.total_duration_min} min`);
  console.log(`Type: ${workoutType}`);
  console.log(`Creator: ${creator}`);
  console.log(`Total exercises extracted: ${exercises.length}`);
  console.log('');

  console.log('EXERCISES:');
  console.log('-'.repeat(70));
  exercises.forEach((ex, i) => {
    const ts = ex.timestamp_seconds !== null
      ? `${Math.floor(ex.timestamp_seconds / 60)}:${String(ex.timestamp_seconds % 60).padStart(2, '0')}`
      : 'N/A';
    console.log(
      `  ${String(i + 1).padStart(2)}. ${ex.name.padEnd(20)} | sets: ${ex.sets} | reps: ${String(ex.reps).padEnd(8)} | rest: ${ex.rest_seconds}s | timestamp: ${ts} | muscles: ${ex.target_muscles.join(', ')}`,
    );
  });

  // 6. Comparison
  const previousResult = ['팔벌려뛰기', '재기차기', '줄넘기'];
  const expectedMovements = [
    '제자리 걷기', '팔꿈치-무릎 터치', '대각선 펀치', '복부 바운스',
    '무릎 손바닥 터치', '골반 회전 뛰기', '줄넘기', '팔벌려뛰기',
    '재기차기',
  ];

  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON');
  console.log('='.repeat(70));
  console.log(`Previous extraction: ${previousResult.length} exercises (${previousResult.join(', ')})`);
  console.log(`Current extraction:  ${exercises.length} exercises`);
  console.log(`Improvement: ${previousResult.length} → ${exercises.length} (${exercises.length > previousResult.length ? '+' : ''}${exercises.length - previousResult.length})`);

  console.log('\nExpected movements coverage:');
  for (const expected of expectedMovements) {
    const found = exercises.some(ex =>
      ex.name.includes(expected) || expected.includes(ex.name) ||
      ex.name.replace(/\s/g, '').includes(expected.replace(/\s/g, '')),
    );
    console.log(`  ${found ? '[FOUND]' : '[MISS] '} ${expected}`);
  }

  // Data quality checks
  console.log('\n' + '='.repeat(70));
  console.log('DATA QUALITY');
  console.log('='.repeat(70));
  const withTimestamp = exercises.filter(ex => ex.timestamp_seconds !== null).length;
  const withValidReps = exercises.filter(ex => {
    if (typeof ex.reps === 'number') return true;
    if (typeof ex.reps === 'string' && /^\d+\s*(초|분|sec|min)/.test(ex.reps)) return true;
    if (ex.reps === '영상 참고') return true;
    return false;
  }).length;

  console.log(`Exercises with timestamps: ${withTimestamp}/${exercises.length}`);
  console.log(`Exercises with valid reps:  ${withValidReps}/${exercises.length}`);
  console.log(`Exercises with equipment:   ${exercises.filter(ex => ex.equipment.length > 0).length}/${exercises.length}`);
  console.log(`Exercises with muscles:     ${exercises.filter(ex => ex.target_muscles.length > 0).length}/${exercises.length}`);

  // Check for issues
  const issues: string[] = [];
  if (exercises.length < 8) issues.push(`Only ${exercises.length} exercises extracted (expected 12-15)`);
  if (withTimestamp < exercises.length * 0.5) issues.push(`Low timestamp coverage (${withTimestamp}/${exercises.length})`);
  const duplicates = exercises.filter((ex, i) => exercises.findIndex(e => e.name === ex.name) !== i);
  if (duplicates.length > 0) issues.push(`Duplicate names: ${duplicates.map(d => d.name).join(', ')}`);

  if (issues.length > 0) {
    console.log('\nISSUES:');
    issues.forEach(issue => console.log(`  ! ${issue}`));
  } else {
    console.log('\nNo major issues detected.');
  }

  console.log('\n' + '='.repeat(70));
  console.log(exercises.length >= 8
    ? 'VERDICT: SIGNIFICANT IMPROVEMENT over previous 3/15 result'
    : 'VERDICT: STILL NEEDS WORK — not enough exercises extracted');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});

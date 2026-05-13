/**
 * Local test script: exercise extraction from YouTube video
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-extraction.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(import.meta.dirname ?? __dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { fetchTranscript, fetchVideoMetadata } from '../src/lib/youtube';
import { extractWorkout } from '../src/lib/pipelines/workoutExtractor';

const VIDEO_URL = 'https://www.youtube.com/watch?v=oMJuiJ9Rs0w';
const VIDEO_ID = 'oMJuiJ9Rs0w';

async function main() {
  console.log('=== PT Tracker 운동 추출 로컬 테스트 ===\n');
  console.log(`영상: ${VIDEO_URL}\n`);

  // 1. Fetch transcript
  console.log('📥 자막 가져오는 중...');
  const transcript = await fetchTranscript(VIDEO_ID);
  console.log(`✅ 세그먼트 ${transcript.segments.length}개, ${transcript.text.length}자\n`);

  // 2. Fetch metadata
  console.log('📋 메타데이터 가져오는 중...');
  const metadata = await fetchVideoMetadata(VIDEO_URL);
  console.log(`✅ 제목: ${metadata.title}`);
  console.log(`✅ 채널: ${metadata.author}\n`);

  // 3. Extract workout
  console.log('🏋️ 운동 추출 중 (Stage 1→2→3)...\n');
  const workout = await extractWorkout(
    transcript.text,
    transcript.segments,
    metadata.title,
    metadata.author,
    VIDEO_URL,
  );

  // 4. Report
  console.log('=== 결과 ===');
  console.log(`운동명: ${workout.workout_name}`);
  console.log(`타입: ${workout.workout_type}`);
  console.log(`총 시간: ${workout.total_duration_min}분`);
  console.log(`추출 운동 수: ${workout.exercises.length}개\n`);

  console.log('--- 운동 목록 ---');
  for (const ex of workout.exercises) {
    const ts = ex.timestamp_seconds !== null ? `${Math.floor(ex.timestamp_seconds / 60)}:${String(Math.floor(ex.timestamp_seconds % 60)).padStart(2, '0')}` : '??:??';
    console.log(`[${ts}] ${ex.name} — ${ex.sets}세트 x ${ex.reps} | 휴식 ${ex.rest_seconds}초 | 부위: ${ex.target_muscles.join(', ')}`);
  }

  console.log(`\n총 ${workout.exercises.length}개 운동 추출됨 (목표: ~15개)`);
}

main().catch(err => {
  console.error('❌ 에러:', err);
  process.exit(1);
});

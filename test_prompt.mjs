import OpenAI from 'openai';
import { readFileSync } from 'fs';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rawSegs = JSON.parse(readFileSync('/tmp/transcript_test.json', 'utf8'));
const segments = rawSegs.map((s, i) => `[SEG:${i}] ${s.text}`).join('\n');

// ── OLD PROMPT ──
const oldSystem = 'You extract exercise names from workout video transcripts. Be precise, never invent.';
const oldUser = `From this transcript, list ALL exercises or movements performed.

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
${segments}`;

// ── NEW PROMPT ──
const newSystem = 'You extract every distinct exercise/movement from workout video transcripts. Be thorough — never skip a movement section.';
const newUser = `From this follow-along workout transcript, extract ALL distinct exercises or movements.

## How to identify exercises
In follow-along/cardio videos, each exercise is a distinct movement section. Identify them by:
1. **Transition markers**: "자", "이번에는", "이어서", "자 그럼", "좋아요" often signal a NEW exercise
2. **[음악] gaps**: Music-only segments between spoken instructions usually mean the exercise is being performed
3. **Exercise count hint**: If the instructor states how many exercises there are (e.g. "15가지 동작"), use that as your target count
4. **"반대쪽" segments**: "반대쪽도" means the SAME exercise on the other side — do NOT count as a separate exercise

## Naming rules
- Use formal Korean exercise names when the instructor says them (e.g. "팔벌려뛰기", "재기차기", "줄넘기")
- When no formal name is given, synthesize a concise descriptive Korean name from the movement description:
  - "무릎을 연속해서 들어올려 볼게요" → "무릎 들어올리기"
  - "팔꿈치와 무릎이 닿는듯한 동작" → "팔꿈치-무릎 터치"
  - "골반을 좌우로 회전하면서 뛰어 볼게요" → "골반 회전 뛰기"
  - "양손으로 허벅 앞쪽을 터치" → "허벅지 터치 걷기"
- Do NOT invent exercises — every name must trace back to transcript content
- Exclude cool-down stretches (스트레칭) from the exercise list

Return JSON: {"exercises": ["운동명1", "운동명2"], "exercise_count_hint": <number or null>, "workout_type": "strength|cardio|hiit|yoga|dance|stretching"}
Return ONLY valid JSON.

Transcript:
${segments}`;

async function run(label, sys, usr) {
  const res = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });
  const content = res.choices[0]?.message?.content ?? '';
  const parsed = JSON.parse(content);
  console.log(`\n=== ${label} ===`);
  console.log(`Exercises found: ${parsed.exercises?.length}`);
  parsed.exercises?.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  console.log(`Type: ${parsed.workout_type}`);
  if (parsed.exercise_count_hint) console.log(`Hint: ${parsed.exercise_count_hint}`);
  return parsed;
}

console.log('Testing both prompts on the same transcript...');
const [oldRes, newRes] = await Promise.all([
  run('OLD PROMPT', oldSystem, oldUser),
  run('NEW PROMPT', newSystem, newUser),
]);
console.log(`\n📊 Comparison: OLD ${oldRes.exercises?.length} → NEW ${newRes.exercises?.length} exercises`);

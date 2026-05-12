const WORKOUT_KEYWORDS = {
  ko: ['세트', '렙', '반복', '운동', '근육', '벤치프레스', '스쿼트', '데드리프트',
       '덤벨', '바벨', '풀업', '푸시업', '휴식', '루틴', '헬스', '웨이트',
       '가슴', '등', '하체', '어깨', '이두', '삼두', '코어', '복근'],
  en: ['set', 'rep', 'exercise', 'muscle', 'bench press', 'squat', 'deadlift',
       'dumbbell', 'barbell', 'pull up', 'push up', 'rest', 'routine', 'workout',
       'chest', 'back', 'leg', 'shoulder', 'bicep', 'tricep', 'core', 'abs'],
};

const RECIPE_KEYWORDS = {
  ko: ['재료', '레시피', '요리', '조리', '볶음', '끓이', '구이', '찜',
       '소금', '설탕', '간장', '된장', '고추장', '식재료', '칼로리',
       '닭가슴살', '현미', '샐러드', '스푼', '컵', '그램', '식단', '밥'],
  en: ['ingredient', 'recipe', 'cook', 'bake', 'fry', 'boil', 'grill',
       'salt', 'sugar', 'sauce', 'meal', 'food', 'calories', 'protein',
       'chicken breast', 'rice', 'salad', 'tablespoon', 'cup', 'gram', 'diet'],
};

export type ContentType = 'workout' | 'recipe';

export function classifyContent(text: string): ContentType {
  const lower = text.toLowerCase();

  let workoutScore = 0;
  let recipeScore = 0;

  for (const lang of ['ko', 'en'] as const) {
    for (const kw of WORKOUT_KEYWORDS[lang]) workoutScore += countOccurrences(lower, kw);
    for (const kw of RECIPE_KEYWORDS[lang]) recipeScore += countOccurrences(lower, kw);
  }

  return recipeScore > workoutScore ? 'recipe' : 'workout';
}

function countOccurrences(text: string, keyword: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(keyword, pos)) !== -1) {
    count++;
    pos += keyword.length;
  }
  return count;
}

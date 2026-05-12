'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, ArrowRight, ArrowLeft, CheckCircle, Trophy, Star, Zap } from 'lucide-react';

type Step = 'intro' | 'pushup' | 'pullup' | 'plank' | 'squat' | 'result';

interface TestResults {
  pushup_max: number;
  pullup_max: number;
  plank_seconds: number;
  squat_max: number;
}

const levelInfo = {
  beginner: {
    label: '입문',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: Star,
    desc: '기초 체력을 쌓는 단계입니다. 쉬운 변형 동작으로 시작해서 점진적으로 강도를 높여갑니다.',
    details: [
      '무릎 푸시업 등 쉬운 변형 위주',
      '네거티브 풀업으로 근력 형성',
      '세트 간 휴식 90초',
      '주 4일 분할',
    ],
  },
  intermediate: {
    label: '중급',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: Zap,
    desc: '기본기가 갖춰진 단계입니다. 표준 동작으로 볼륨을 채우며 다이어트에 최적화된 프로그램입니다.',
    details: [
      '표준 푸시업/풀업 수행',
      '3-4세트 × 10-15회',
      '세트 간 휴식 60초',
      '주 4일 분할',
    ],
  },
  advanced: {
    label: '고급',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    icon: Trophy,
    desc: '높은 볼륨과 짧은 휴식으로 최대 효율의 홈트레이닝을 수행합니다.',
    details: [
      '고반복 + 고세트',
      '4-5세트 × 15-25회',
      '세트 간 휴식 30-45초',
      '주 4일 분할 + 고강도 HIIT',
    ],
  },
};

const testSteps: { key: keyof TestResults; step: Step; title: string; unit: string; description: string; tips: string[]; placeholder: string }[] = [
  {
    key: 'pushup_max',
    step: 'pushup',
    title: '푸시업 테스트',
    unit: '개',
    description: '기본 푸시업을 연속으로 최대 몇 개까지 할 수 있나요?',
    tips: [
      '가슴이 바닥에 거의 닿을 때까지 내려갑니다',
      '팔이 완전히 펴질 때까지 올라갑니다',
      '무릎을 대지 않고 수행합니다',
      '못 하면 0으로 입력하세요',
    ],
    placeholder: '예: 15',
  },
  {
    key: 'pullup_max',
    step: 'pullup',
    title: '풀업 테스트',
    unit: '개',
    description: '오버그립 풀업을 연속으로 최대 몇 개까지 할 수 있나요?',
    tips: [
      '완전히 매달린 상태에서 시작합니다',
      '턱이 바 위로 올라갈 때까지 당깁니다',
      '반동(키핑) 없이 수행합니다',
      '한 개도 못 하면 0으로 입력하세요',
    ],
    placeholder: '예: 5',
  },
  {
    key: 'plank_seconds',
    step: 'plank',
    title: '플랭크 테스트',
    unit: '초',
    description: '플랭크 자세를 최대 몇 초까지 유지할 수 있나요?',
    tips: [
      '팔꿈치와 발끝으로 몸을 지탱합니다',
      '몸이 일직선이 되도록 유지합니다',
      '엉덩이가 내려가거나 올라가면 종료',
      '스톱워치로 측정하세요',
    ],
    placeholder: '예: 60',
  },
  {
    key: 'squat_max',
    step: 'squat',
    title: '스쿼트 테스트',
    unit: '개',
    description: '맨몸 스쿼트를 연속으로 최대 몇 개까지 할 수 있나요?',
    tips: [
      '허벅지가 지면과 평행할 때까지 내려갑니다',
      '무릎이 발끝 방향으로 향합니다',
      '상체를 최대한 세운 채 수행합니다',
      '중간에 쉬지 않고 연속으로 수행합니다',
    ],
    placeholder: '예: 20',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [testIndex, setTestIndex] = useState(0);
  const [results, setResults] = useState<TestResults>({
    pushup_max: 0,
    pullup_max: 0,
    plank_seconds: 0,
    squat_max: 0,
  });
  const [inputValue, setInputValue] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced' | null>(null);
  const [saving, setSaving] = useState(false);

  const currentTest = testSteps[testIndex];
  const progress = currentStep === 'intro' ? 0 : currentStep === 'result' ? 100 : ((testIndex + 1) / testSteps.length) * 80 + 10;

  const handleStartTests = () => {
    setCurrentStep(testSteps[0].step);
    setTestIndex(0);
    setInputValue('');
  };

  const handleNextTest = () => {
    const value = parseInt(inputValue) || 0;
    const updatedResults = { ...results, [currentTest.key]: value };
    setResults(updatedResults);

    if (testIndex < testSteps.length - 1) {
      setTestIndex(testIndex + 1);
      setCurrentStep(testSteps[testIndex + 1].step);
      setInputValue('');
    } else {
      // Calculate level client-side for preview
      let score = 0;
      if (updatedResults.pushup_max >= 25) score += 3;
      else if (updatedResults.pushup_max >= 10) score += 2;
      else score += 1;
      if (updatedResults.pullup_max >= 8) score += 3;
      else if (updatedResults.pullup_max >= 3) score += 2;
      else if (updatedResults.pullup_max >= 1) score += 1;
      if (updatedResults.plank_seconds >= 90) score += 3;
      else if (updatedResults.plank_seconds >= 30) score += 2;
      else score += 1;
      if (updatedResults.squat_max >= 30) score += 3;
      else if (updatedResults.squat_max >= 15) score += 2;
      else score += 1;

      const calcLevel = score >= 10 ? 'advanced' : score >= 6 ? 'intermediate' : 'beginner';
      setLevel(calcLevel);
      setCurrentStep('result');
    }
  };

  const handlePrevTest = () => {
    if (testIndex > 0) {
      setTestIndex(testIndex - 1);
      setCurrentStep(testSteps[testIndex - 1].step);
      setInputValue(String(results[testSteps[testIndex - 1].key] || ''));
    } else {
      setCurrentStep('intro');
    }
  };

  const handleConfirm = async () => {
    if (!level) return;
    setSaving(true);
    try {
      const res = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/');
      }
    } catch {
      // retry silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-4 pt-8 max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {currentStep === 'intro' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <Dumbbell className="h-10 w-10 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">체력 측정</h1>
              <p className="text-zinc-400 leading-relaxed">
                4가지 간단한 테스트로 현재 체력 수준을 측정하고,<br />
                맞춤 운동 프로그램을 생성합니다.
              </p>
            </div>
            <div className="w-full space-y-3 text-left">
              {testSteps.map((t, i) => (
                <div key={t.key} className="flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3 border border-zinc-800">
                  <span className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-bold text-zinc-400">
                    {i + 1}
                  </span>
                  <span className="text-sm">{t.title}</span>
                  <span className="text-xs text-zinc-500 ml-auto">{t.unit}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleStartTests}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 mt-8 mb-8 active:scale-95 transition-transform"
          >
            측정 시작 <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {currentStep !== 'intro' && currentStep !== 'result' && currentTest && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500">{testIndex + 1} / {testSteps.length}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{currentTest.title}</h1>
          <p className="text-zinc-400 mb-6">{currentTest.description}</p>

          {/* Input */}
          <div className="flex items-center gap-3 mb-6">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={currentTest.placeholder}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:border-emerald-500 transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNextTest()}
            />
            <span className="text-lg text-zinc-400 font-medium w-8">{currentTest.unit}</span>
          </div>

          {/* Tips */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6">
            <p className="text-sm font-medium text-zinc-300 mb-2">💡 측정 방법</p>
            <ul className="space-y-1.5">
              {currentTest.tips.map((tip, i) => (
                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto flex gap-3 mb-8">
            <button
              onClick={handlePrevTest}
              className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-medium flex items-center gap-2 active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextTest}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {testIndex < testSteps.length - 1 ? '다음' : '결과 확인'}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'result' && level && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-1">측정 완료!</h1>
              <p className="text-zinc-400">맞춤 프로그램이 준비되었습니다</p>
            </div>

            {/* Level badge */}
            {(() => {
              const info = levelInfo[level];
              const Icon = info.icon;
              return (
                <div className={`${info.bg} border ${info.border} rounded-2xl p-5 text-center`}>
                  <Icon className={`h-10 w-10 ${info.color} mx-auto mb-2`} />
                  <p className={`text-2xl font-bold ${info.color}`}>{info.label}</p>
                  <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{info.desc}</p>
                </div>
              );
            })()}

            {/* Test results summary */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
              <p className="text-sm font-medium text-zinc-300 mb-3">📊 측정 결과</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                  <p className="text-xs text-zinc-500">푸시업</p>
                  <p className="text-lg font-bold">{results.pushup_max}<span className="text-sm text-zinc-400 ml-1">개</span></p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                  <p className="text-xs text-zinc-500">풀업</p>
                  <p className="text-lg font-bold">{results.pullup_max}<span className="text-sm text-zinc-400 ml-1">개</span></p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                  <p className="text-xs text-zinc-500">플랭크</p>
                  <p className="text-lg font-bold">{results.plank_seconds}<span className="text-sm text-zinc-400 ml-1">초</span></p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                  <p className="text-xs text-zinc-500">스쿼트</p>
                  <p className="text-lg font-bold">{results.squat_max}<span className="text-sm text-zinc-400 ml-1">개</span></p>
                </div>
              </div>
            </div>

            {/* Program preview */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
              <p className="text-sm font-medium text-zinc-300 mb-3">🏋️ 프로그램 구성</p>
              <ul className="space-y-2">
                {levelInfo[level].details.map((detail, i) => (
                  <li key={i} className="text-sm text-zinc-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-3 mt-6 mb-8">
            <button
              onClick={() => {
                setCurrentStep(testSteps[testSteps.length - 1].step);
                setTestIndex(testSteps.length - 1);
                setInputValue(String(results.squat_max || ''));
              }}
              className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-medium flex items-center gap-2 active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {saving ? (
                <span className="animate-pulse">프로그램 생성 중...</span>
              ) : (
                <>프로그램 시작하기 <CheckCircle className="h-5 w-5" /></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

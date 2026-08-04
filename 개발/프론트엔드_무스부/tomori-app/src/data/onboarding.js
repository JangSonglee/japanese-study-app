// 온보딩 진단(4문항) + 코스 추천 로직 + 게스트 저장.
// 기준: docs/superpowers/specs/2026-08-03-onboarding-diagnosis-design.md (PRD 10장).
// 🔴 localStorage 접근은 함수 안에서만(모듈 로드는 순수) — 순수 매핑 함수는 브라우저 밖에서도 안전.

const KEY = 'tomori.onboarding';

// 진단 4문항 — 한 문항씩 표시. value = 내부 키(저장·매핑용), label = 화면 문구.
export const QUESTIONS = [
  {
    key: 'q1',
    title: '일본어가 가장 급하게 필요한 순간은?',
    hint: '가장 가까운 하나만 골라요.',
    options: [
      { value: 'travel',  emoji: '✈️', label: '여행 갈 때' },
      { value: 'jlpt',    emoji: '📝', label: '시험(JLPT) 준비' },
      { value: 'biz',     emoji: '💼', label: '업무·비즈니스' },
      { value: 'culture', emoji: '🎌', label: '문화·뉴스가 좋아서' },
    ],
  },
  {
    key: 'q2',
    title: '지금 일본어를 얼마나 알고 있나요?',
    hint: '읽기 도움 기본값을 여기에 맞춰 드려요.',
    options: [
      { value: 'beginner',     label: '완전 초보 (히라가나부터)' },
      { value: 'some',         label: '조금 안다 (N5~N4쯤)' },
      { value: 'intermediate', label: '어느 정도 안다 (N3 이상)' },
    ],
  },
  {
    key: 'q3',
    title: '하루에 학습에 쓸 수 있는 시간은?',
    hint: '부담 없이 골라요 — 언제든 바꿀 수 있어요.',
    options: [
      { value: 'short', label: '5분 안팎' },
      { value: 'mid',   label: '15분쯤' },
      { value: 'long',  label: '30분 이상' },
    ],
  },
  {
    key: 'q4',
    title: '학습할 때 나를 움직이게 하는 건?',
    options: [
      { value: 'streak',   label: '연속 기록이 끊기지 않는 것' },
      { value: 'progress', label: '목표에 가까워지는 것' },
      { value: 'reward',   label: '보상을 모으는 재미' },
    ],
  },
];

// Q1 → 메인 코스 key (CourseListScreen.COURSES 의 key 와 일치).
const COURSE_BY_Q1 = { travel: 'travel', jlpt: 'jlpt', biz: 'biz', culture: 'folk' };
// 현재 콘텐츠 준비된 코스(= CourseList 의 ready). 지금은 JLPT만.
const READY_COURSES = new Set(['jlpt']);

// Q2 → 시작 난이도 힌트(참고용; 실제 급수는 세션 진입 시 선택).
const LEVEL_BY_Q2 = { beginner: 'N5', some: 'N5', intermediate: 'N4' };

export function computeRecommendation(answers) {
  const q1 = answers && answers.q1;
  const mainCourse = COURSE_BY_Q1[q1] || 'jlpt';   // 미응답 방어: JLPT
  const mainReady = READY_COURSES.has(mainCourse);
  // 서브 제안: 메인이 JLPT가 아니면 JLPT(기초·바로 시작 가능). 메인이 JLPT면 서브 없음.
  const subCourse = mainCourse === 'jlpt' ? null : 'jlpt';
  const level = LEVEL_BY_Q2[answers && answers.q2] || 'N5';
  return { mainCourse, mainReady, subCourse, level };
}

// Q2 → 읽기도움 기본값(PRD 8.4). 완전 초보만 한글 발음 ON.
export function readAidFromQ2(q2) {
  return { furigana: true, pron: q2 === 'beginner' };
}

export function loadOnboarding() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.done ? o : null;
  } catch { return null; }
}

export function isOnboardingDone() {
  return loadOnboarding() != null;
}

// answers 저장 + 추천 계산 결과 병합해 저장, 결과 반환.
export function saveOnboarding(answers) {
  const rec = computeRecommendation(answers);
  const record = {
    done: true,
    answers,
    mainCourse: rec.mainCourse,
    subCourse: rec.subCourse,
    savedAt: null,   // Date 미사용(호출부에서 필요 시 주입). 지금은 시점 불필요.
  };
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* ignore */ }
  return { ...record, ...rec };
}

export function clearOnboarding() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

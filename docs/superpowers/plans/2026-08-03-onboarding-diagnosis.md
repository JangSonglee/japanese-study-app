# 온보딩 진단 + 코스 추천 (FE 슬라이스) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 신규 사용자가 진단 4문항에 답하면 목적에 맞는 메인 코스를 추천하고, 학습 코스 목록에서 그 코스에 `추천` 태그를 달아 첫 학습으로 잇는다.

**Architecture:** RN Web(Vite) 스택 네비. 순수 로직 모듈(`data/onboarding.js`) + 화면 2개(`OnboardingScreen`·`RecommendScreen`) + App 게이트/라우트 + CourseList 태그 + MY 재진입. 저장은 게스트 localStorage(`tomori.onboarding`), Q2는 기존 읽기도움 설정(`tomori.readAid`)에 반영.

**Tech Stack:** React + React Native Web, Vite, 기존 디자인 토큰(`theme/tokens.js`: `typeStyle`·`radius`·`space`·`fonts`·`keepAll`), 자체 라우터(`nav/router.js`).

## Global Constraints

- 기준 문서: `docs/superpowers/specs/2026-08-03-onboarding-diagnosis-design.md`. 값·매핑은 스펙과 **정확히** 일치.
- 디자인 토큰만 사용(하드코딩 fontSize 금지 — `typeStyle(role)`), 카드 `radius.lg`·버튼/칩 `radius.sm`, 한국어 텍스트 `keepAll` 스프레드, 강조=앰버(`brand`)·파랑(`courseJlpt`)은 코스 식별만.
- 토모 톤: 담담·응원. 진단/추천에 밝기 헤일로·폭죽 없음(헤일로는 새 쪽지 전용, PRD 14.2.1).
- 저장 키: 온보딩 `tomori.onboarding`, 읽기도움 `tomori.readAid`(기존). 게스트 localStorage만(인증 이관은 범위 밖).
- 기존 동작 무회귀: `tomori.onboarding`이 없던 기존 상태에서 홈·세션·학습코스 정상, 추천 배지 없음.
- 검증: 리포에 유닛 테스트 러너 없음 → 각 태스크는 `npm run build` 통과 + `@5599` 미리보기(브라우저 pane 표시)로 확인. 작업 디렉터리 = `개발/프론트엔드_무스부/tomori-app`.
- 문항/옵션 내부 키: Q1 `travel|jlpt|biz|culture`, Q2 `beginner|some|intermediate`, Q3 `short|mid|long`, Q4 `streak|progress|reward`.
- Q1→코스: `travel→travel`, `jlpt→jlpt`, `biz→biz`, `culture→folk`. 준비됨은 `jlpt`만(`CourseListScreen.COURSES[].ready` 기준).

---

### Task 1: `data/onboarding.js` — 문항·추천 로직·저장

**Files:**
- Create: `src/data/onboarding.js`

**Interfaces:**
- Produces:
  - `QUESTIONS` — `[{ key:'q1', title, hint?, options:[{ value, label, emoji? }] }, ...]` (4문항, 스펙 §3).
  - `computeRecommendation(answers) → { mainCourse, mainReady, subCourse, level }`
  - `readAidFromQ2(q2) → { furigana:boolean, pron:boolean }`
  - `loadOnboarding() → object|null` · `saveOnboarding(answers) → result` · `clearOnboarding()` · `isOnboardingDone() → boolean`

- [ ] **Step 1: 모듈 작성**

Create `src/data/onboarding.js`:

```js
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
```

- [ ] **Step 2: 빌드 통과 확인**

Run: `npm run build`
Expected: 빌드 성공(모듈 파싱·번들 OK).

- [ ] **Step 3: 매핑 대조 검토**

`QUESTIONS`/`COURSE_BY_Q1`/`readAidFromQ2`/`LEVEL_BY_Q2` 값이 스펙 §3~§6과 일치하는지 확인(문항 문구·옵션 키·Q1→코스·Q2→발음). 불일치 0.

- [ ] **Step 4: 커밋**

```bash
git add src/data/onboarding.js
git commit -m "feat(onboarding): 진단 문항·추천 로직·저장 모듈(data/onboarding)"
```

---

### Task 2: `OnboardingScreen` + App 게이트/라우트 (진단 화면 렌더)

**Files:**
- Create: `src/screens/OnboardingScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `QUESTIONS` (Task 1).
- Produces: `OnboardingScreen({ onFinish, onExit })` — `onFinish(answers)`는 `{q1,q2,q3,q4}` 전달.
- App: 초기 라우트 게이트 `isOnboardingDone() ? 'home' : 'onboarding'`, 라우트 `onboarding` 추가.

- [ ] **Step 1: OnboardingScreen 작성**

Create `src/screens/OnboardingScreen.jsx`:

```jsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { QUESTIONS } from '../data/onboarding';

/**
 * 온보딩 진단 — 4문항, 한 문항씩. 시험이 아니라 취향·상황 파악(PRD 10.2).
 *  · 진행 점 4개, 뒤로로 이전 문항 수정, 단일 선택 → 다음.
 *  · 토모 동행(담담·응원). 밝기 헤일로 없음(새 쪽지 전용 14.2.1).
 */
export default function OnboardingScreen({ onFinish, onExit }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = QUESTIONS[step];
  const selected = answers[q.key];
  const isLast = step === QUESTIONS.length - 1;

  function choose(value) {
    setAnswers((a) => ({ ...a, [q.key]: value }));
  }
  function next() {
    if (selected == null) return;
    if (isLast) { onFinish(answers); return; }
    setStep((s) => s + 1);
  }
  function back() {
    if (step === 0) { onExit && onExit(); return; }
    setStep((s) => s - 1);
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={step === 0 ? '닫기' : '이전 문항'}>
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        {/* 진행 점 */}
        <View style={S.dots}>
          {QUESTIONS.map((_, i) => (
            <View key={i} style={[S.dot, { backgroundColor: i <= step ? t.brand : t.border }]} />
          ))}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={S.body}>
        <View style={S.tomoWrap}><Tomo scale={0.5} pose="bright" showNote={false} /></View>
        <Text style={[S.step, { color: t.textLow }]}>{step + 1} / {QUESTIONS.length}</Text>
        <Text style={[S.title, { color: t.textHigh }, keepAll]}>{q.title}</Text>
        {q.hint ? <Text style={[S.hint, { color: t.textMid }, keepAll]}>{q.hint}</Text> : null}

        <View style={S.options}>
          {q.options.map((o) => {
            const on = selected === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => choose(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[S.option, { backgroundColor: t.bgSurface, borderColor: on ? t.brand : t.border }, on && { borderWidth: 2 }]}
              >
                {o.emoji ? <Text style={S.emoji}>{o.emoji}</Text> : null}
                <Text style={[S.optionText, { color: t.textHigh }, keepAll]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={S.foot}>
        <Pressable
          onPress={next}
          disabled={selected == null}
          accessibilityRole="button"
          style={[S.btnPri, { backgroundColor: selected == null ? t.sunk : t.brand }]}
        >
          <Text style={[S.btnPriText, { color: selected == null ? t.textLow : t.onBrand }]}>
            {isLast ? '결과 보기' : '다음'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 18, height: 6, borderRadius: radius.full },
    body: { padding: 20, gap: 8, alignItems: 'center' },
    tomoWrap: { marginBottom: 4 },
    step: { fontFamily: fonts.ko, ...typeStyle('label') },
    title: { fontFamily: fonts.ko, ...typeStyle('heading'), textAlign: 'center', marginTop: 2 },
    hint: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    options: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 16 },
    emoji: { fontSize: 22 },
    optionText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600', flex: 1 },
    foot: { padding: 16 },
    btnPri: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
  });
}
```

- [ ] **Step 2: App 라우트·게이트 추가 (임시 onFinish)**

`src/App.jsx` 수정:

1) import 추가 (다른 스크린 import 옆):
```jsx
import OnboardingScreen from './screens/OnboardingScreen';
import { isOnboardingDone } from './data/onboarding';
```

2) 초기 라우트 게이트 — `const nav = useRouter('home');` 를:
```jsx
  const nav = useRouter(isOnboardingDone() ? 'home' : 'onboarding');
```

3) 라우트 분기 추가 — `{name === 'home' ? (` 바로 위 또는 체인에 삽입:
```jsx
            ) : name === 'onboarding' ? (
              <OnboardingScreen
                onFinish={(answers) => { console.log('onboarding answers', answers); nav.reset('home'); }}
                onExit={() => nav.reset('home')}
              />
```
(이 태스크에선 onFinish 를 임시로 홈 복귀로 둔다. Task 3에서 실제 추천 연결.)

- [ ] **Step 3: 빌드 + 첫 실행 검증**

Run: `npm run build` → 통과.
그다음 `@5599` 미리보기(브라우저 pane 표시). localStorage 초기화 후 첫 실행 재현:
- 브라우저 콘솔에서 `localStorage.removeItem('tomori.onboarding')` 후 새로고침 → 진단 Q1이 뜬다.
- Q1 선택→다음, Q2·Q3·Q4 진행, 진행 점이 채워지고, 뒤로로 이전 문항 수정 가능.
- 마지막 문항 `결과 보기` → (임시) 홈 복귀 + 콘솔에 answers 객체.
Expected: 4문항 스텝·뒤로·선택 하이라이트 정상, 콘솔 오류 0.

- [ ] **Step 4: 커밋**

```bash
git add src/screens/OnboardingScreen.jsx src/App.jsx
git commit -m "feat(onboarding): 진단 4문항 화면 + App 첫실행 게이트"
```

---

### Task 3: `RecommendScreen` + App 완료/시작 핸들러 + Q2→읽기도움

**Files:**
- Create: `src/screens/RecommendScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `computeRecommendation`/`saveOnboarding`/`readAidFromQ2` (Task 1), `OnboardingScreen.onFinish` (Task 2).
- Produces: `RecommendScreen({ result, onStart })` — `result = { mainCourse, mainReady, subCourse, level }`.

- [ ] **Step 1: RecommendScreen 작성**

Create `src/screens/RecommendScreen.jsx`:

```jsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';

// 코스 표시 정보(이름·설명) — CourseListScreen 과 동일 톤.
const COURSE_META = {
  jlpt:   { name: 'JLPT',      desc: '급수별 단어·문법·독해·청해' },
  travel: { name: '여행 회화',  desc: '상황별 표현' },
  biz:    { name: '비즈니스',   desc: '이메일·전화·회의' },
  news:   { name: '뉴스·시사',  desc: '읽기형 콘텐츠' },
  folk:   { name: '전래동화',   desc: '읽기형 콘텐츠' },
};

/**
 * 추천 결과 — 진단 뒤 메인 코스 1장(PRD 10.3). 담담한 톤·강제 없음.
 *  · 메인이 준비 중이면 "곧 열려요 · 먼저 JLPT로" 안내(대표님 결정).
 */
export default function RecommendScreen({ result, onStart }) {
  const { t, mode } = useTheme();
  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const main = COURSE_META[result.mainCourse] || COURSE_META.jlpt;
  const sub = result.subCourse ? COURSE_META[result.subCourse] : null;

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <ScrollView contentContainerStyle={S.body}>
        <View style={S.tomoWrap}><Tomo scale={0.7} pose="shine" showNote={false} /></View>
        <Text style={[S.lead, { color: t.textMid }, keepAll]}>이런 코스가 잘 맞을 것 같아요</Text>

        {/* 메인 코스 카드 */}
        <View style={[S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }]}>
          <View style={[S.accent, { backgroundColor: t.courseJlpt }]} />
          <Text style={[S.courseName, { color: t.textHigh }, keepAll]}>{main.name}</Text>
          <Text style={[S.courseDesc, { color: t.textMid }, keepAll]}>{main.desc}</Text>
          {!result.mainReady ? (
            <View style={[S.soonRow, { backgroundColor: t.sunk }]}>
              <Text style={[S.soonText, { color: t.textMid }, keepAll]}>
                아직 준비 중이에요 · 먼저 JLPT로 시작해볼까요?
              </Text>
            </View>
          ) : null}
        </View>

        {sub ? (
          <Text style={[S.subNote, { color: t.textMid }, keepAll]}>
            함께 보면 좋은 코스 · {sub.name}
          </Text>
        ) : null}
      </ScrollView>

      <View style={S.foot}>
        <Pressable onPress={onStart} accessibilityRole="button" style={[S.btnPri, { backgroundColor: t.brand }]}>
          <Text style={[S.btnPriText, { color: t.onBrand }]}>시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    body: { padding: 20, gap: 12, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
    tomoWrap: { marginBottom: 4 },
    lead: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    card: { alignSelf: 'stretch', borderRadius: radius.lg, padding: 20, gap: 6 },
    accent: { width: 40, height: 4, borderRadius: radius.full, marginBottom: 6 },
    courseName: { fontFamily: fonts.ko, ...typeStyle('title'), fontWeight: '700' },
    courseDesc: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400' },
    soonRow: { borderRadius: radius.md, padding: 12, marginTop: 8 },
    soonText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    subNote: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    foot: { padding: 16 },
    btnPri: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
  });
}
```

- [ ] **Step 2: App 완료/시작 핸들러 배선**

`src/App.jsx` 수정:

1) import 확장:
```jsx
import RecommendScreen from './screens/RecommendScreen';
import { isOnboardingDone, saveOnboarding, readAidFromQ2 } from './data/onboarding';
```

2) 컴포넌트 안에 핸들러 추가(`const { name, params } = nav.current;` 위):
```jsx
  function handleOnboardingFinish(answers) {
    const result = saveOnboarding(answers);        // 저장 + 추천 계산
    setSettings(readAidFromQ2(answers.q2));         // Q2 → 읽기도움 기본값(localStorage 반영)
    nav.replace('recommend', { result });
  }
  function handleStart() {
    nav.reset('home');
    nav.push('courses');                            // 홈 + 학습 코스(추천 태그)로 랜딩
  }
```

3) Task 2에서 넣은 임시 `onboarding` 분기의 onFinish 를 실제로 교체 + `recommend` 분기 추가:
```jsx
            ) : name === 'onboarding' ? (
              <OnboardingScreen onFinish={handleOnboardingFinish} onExit={() => nav.reset('home')} />
            ) : name === 'recommend' ? (
              <RecommendScreen result={params.result} onStart={handleStart} />
```

- [ ] **Step 3: 빌드 + 흐름 검증**

Run: `npm run build` → 통과. `@5599` 미리보기:
- 콘솔 `localStorage.removeItem('tomori.onboarding')` → 새로고침 → 진단.
- **Q1=시험(jlpt)** 완주 → 추천 화면 "JLPT" + 안내 없음 → `시작하기` → 학습 코스 목록(뒤로=홈).
- 다시(`removeItem`) → **Q1=여행(travel)** 완주 → 추천 "여행 회화" + "아직 준비 중 · 먼저 JLPT로" 안내 + 서브 "함께 보면 좋은 · JLPT" → `시작하기` → 학습 코스.
- **Q2=완전 초보**로 답한 경우: 이후 `localStorage['tomori.readAid']` 가 `{furigana:true,pron:true}`인지 확인(콘솔).
Expected: 두 코스 케이스·시작 랜딩·Q2 반영 정상, 콘솔 0.

- [ ] **Step 4: 커밋**

```bash
git add src/screens/RecommendScreen.jsx src/App.jsx
git commit -m "feat(onboarding): 추천 결과 화면 + 완료·시작 배선 + Q2 읽기도움 반영"
```

---

### Task 4: 학습 코스 `추천` 태그 + MY 재진입

**Files:**
- Modify: `src/screens/CourseListScreen.jsx`
- Modify: `src/screens/MyScreen.jsx`

**Interfaces:**
- Consumes: `loadOnboarding` (Task 1).

- [ ] **Step 1: CourseList 추천 배지**

`src/screens/CourseListScreen.jsx` 수정:

1) import 추가:
```jsx
import { loadOnboarding } from '../data/onboarding';
```

2) `CourseListScreen` 본문에서 추천 코스 key 계산(컴포넌트 상단):
```jsx
  const recommended = (loadOnboarding() || {}).mainCourse || null;
```

3) `COURSES.map` 의 `CourseCard` 에 prop 전달:
```jsx
          <CourseCard key={c.key} t={t} course={c} recommended={c.key === recommended} onPress={() => c.ready && nav.push('jlptHub')} />
```

4) `CourseCard({ t, course, onPress })` → `CourseCard({ t, course, onPress, recommended })`. 이름(`S.name`) 옆에 배지 추가(제목 Row 로 감싸기):
```jsx
      <View style={S.cardText}>
        <View style={S.nameRow}>
          <Text style={[S.name, { color: ready ? t.textHigh : t.textMid }]}>{name}</Text>
          {recommended ? (
            <View style={[S.recBadge, { backgroundColor: t.brand }]}>
              <Text style={[S.recText, { color: t.onBrand }]}>추천</Text>
            </View>
          ) : null}
        </View>
        <Text style={[S.desc, { color: t.textMid }]}>{desc}</Text>
      </View>
```

5) 스타일 추가(`makeStyles` 의 `StyleSheet.create` 안):
```jsx
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    recBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
    recText: { fontFamily: fonts.ko, ...typeStyle('caption'), fontWeight: '700' },
```
(파일 상단 import 에 `typeStyle` 이 이미 있음 — 없으면 추가.)

- [ ] **Step 2: MY 재진입 메뉴**

`src/screens/MyScreen.jsx` 수정 — `학습` 섹션의 `코스 전환` 위에 추가:
```jsx
        <MenuRow t={t} label="코스 추천 다시 받기" onPress={() => nav.push('onboarding')} />
```

- [ ] **Step 3: 빌드 + 검증**

Run: `npm run build` → 통과. `@5599`:
- 온보딩 Q1=여행 완주 → 시작하기 → 학습 코스: **여행 회화**에 `추천` 배지(곧 열려요와 공존), JLPT는 배지 없음·시작 가능.
- Q1=시험 재실행 → 학습 코스: **JLPT**에 `추천` 배지.
- 온보딩 안 한 상태(`removeItem` 후 홈으로 바로 가는 경로 없음 → 이 경우 첫 실행 진단이 뜨므로, 배지-없음 확인은: 콘솔에서 `localStorage.setItem('tomori.onboarding','')` 대신 정상 완료 케이스로 대체) — **무회귀 확인**은 `loadOnboarding()===null`일 때 `recommended===null`이라 배지 없음(코드 검토 + 완료 전 CourseList 진입 시 무배지).
- MY → `코스 추천 다시 받기` → 진단 재실행 → 추천 → 시작하기 → 학습 코스 갱신된 배지.
Expected: 배지 정확·무회귀·재진입 정상, 콘솔 0.

- [ ] **Step 4: 커밋**

```bash
git add src/screens/CourseListScreen.jsx src/screens/MyScreen.jsx
git commit -m "feat(onboarding): 학습 코스 추천 배지 + MY 다시 받기 진입"
```

---

### Task 5: 엔드투엔드 검증 + 진행상태 기록

**Files:**
- Modify: `기획/진행상태.md`

- [ ] **Step 1: 전체 흐름 검증(@5599, 라이트/다크)**

브라우저 pane 표시 상태에서:
1. `localStorage.removeItem('tomori.onboarding')` → 새로고침 → 진단 4문항(뒤로·선택·진행 점).
2. Q1=시험 → 추천 JLPT(안내 없음) → 시작하기 → 학습 코스 JLPT `추천` 배지 → 뒤로 홈.
3. `removeItem` → Q1=여행·Q2=완전 초보 → 추천 여행회화 + "먼저 JLPT로" 안내 + 서브 JLPT → 시작하기 → 학습 코스 여행회화 `추천` 배지.
4. `localStorage['tomori.readAid']` = `{furigana:true,pron:true}` 확인 → 단어 세션 진입 시 한글 발음 기본 노출(opacity 1) 확인.
5. 새로고침 → 온보딩 스킵·바로 홈.
6. MY → 코스 추천 다시 받기 → 재실행 정상.
7. 라이트/다크 각 스크린샷. 콘솔 오류 0.

각 단계 실패 시 소스 수정 후 재검증.

- [ ] **Step 2: 스크린샷 증빙**

`computer{action:"screenshot"}`로 진단 문항·추천 결과·학습 코스 배지 캡처(라이트/다크).

- [ ] **Step 3: 진행상태.md 세션 기록**

`기획/진행상태.md` 4번째 줄(누적 세션 로그)에 이번 세션 ▶ 항목 추가: 온보딩 진단 4문항+추천 결과+학습코스 추천배지+MY 재진입, 저장 `tomori.onboarding`(게스트), Q1→메인코스·Q2→읽기도움 반영·Q3/Q4 저장만, 미완 코스 "먼저 JLPT로" 안내, 스펙/계획 경로, 범위 밖(탭바·레벨테스트·인증이관·Q4 위젯순서). ⑥ 온보딩 = 이번 슬라이스 완료로 갱신.

- [ ] **Step 4: 커밋**

```bash
git add 기획/진행상태.md
git commit -m "docs(progress): 온보딩 진단+코스 추천 슬라이스 세션 기록"
```

---

## Self-Review (계획 ↔ 스펙 대조)

- **스펙 커버리지**: §2 흐름=Task2·3, §3 문항=Task1·2, §4 추천/미완=Task1·3, §5 Q2→읽기도움=Task3, §6 저장=Task1, §7 화면/파일=Task1~4, §9 수용기준=Task5 검증 단계와 1:1. 누락 없음.
- **플레이스홀더 스캔**: 각 코드 스텝에 실제 코드/편집 앵커 제공. "적절히"류 없음.
- **타입 일관성**: `computeRecommendation`/`saveOnboarding` 반환 `{mainCourse,mainReady,subCourse,level}` — RecommendScreen `result` 소비와 일치. Q 키 `q1..q4`·옵션 value 키 전 태스크 공통. `loadOnboarding().mainCourse` — 저장 레코드 필드와 일치.
- **주의(리뷰 유의)**: CourseList `COURSES` 키(jlpt/travel/biz/news/folk)와 Q1 매핑(culture→folk) 일치 확인 필요. App 라우팅에서 `onboarding` 루트→`replace('recommend')`, MY 재진입(push)→`replace('recommend')`→시작 `reset+push`로 스택 잔재 없음.

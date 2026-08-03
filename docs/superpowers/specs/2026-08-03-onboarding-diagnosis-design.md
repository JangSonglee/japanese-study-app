# 온보딩 진단 + 코스 추천 (FE 슬라이스) — 설계

> 작성: 2026-08-03 · 상태: 대표님 승인(브레인스토밍 결정 반영) · 기준: PRD 10장(온보딩)
> 프로젝트: 토모리(Tomori) FE(`개발/프론트엔드_무스부/tomori-app`, Vite + RN Web)

## 1. 목적 · 범위

PRD 10장에 설계된 온보딩 중 **진단 4문항 + 추천 결과**를 현재 FE 슬라이스로 구현한다.
신규 사용자가 4문항(약 40초)에 답하면 목적에 맞는 **메인 코스를 추천**하고, 학습 코스 목록에서
그 코스에 **`추천` 태그**를 달아 자연스럽게 첫 학습으로 잇는다.

**핵심 철학 준수**: 학습 의지를 꺾지 않고 북돋는다 — 진단은 시험이 아니라 취향·상황 파악.
강제 진행 없음(건너뛸 수 있는 여지), 첫 경험이 막히지 않게 함(미완 코스 안내).

### 범위 안 (이번에 만든다)
- 진단 4문항 화면(한 문항씩, 진행 표시, 뒤로 가능)
- 짧은 추천 결과 화면 1장(메인 코스 + 추천 이유 + 서브 제안 + 시작하기)
- 학습 코스 목록(`CourseListScreen`)의 추천 코스에 `추천` 태그
- 첫 실행 자동 노출 + `MY › 코스 추천 다시 받기` 재진입, `localStorage` 저장
- Q1 → 메인 코스 추천, Q2 → 읽기도움 기본값 자동 설정

### 범위 밖 (다음 서브프로젝트)
스플래시 · 앱 소개 1~2장 · 회원가입/로그인 · 레벨 테스트 · 하단 탭 5개(홈·학습코스·단어장·번역·내정보) ·
Q4 홈 위젯 순서 재배열 · 인증 사용자 프로필 저장(현재는 게스트 localStorage만).

## 2. 전체 흐름

```
[첫 실행 · 게스트 · onboarding 미완]
  → OnboardingScreen (Q1 → Q2 → Q3 → Q4, 한 문항씩)
  → (완료 시) 답 저장 + Q2→읽기도움 설정 반영 + 추천 계산
  → RecommendScreen (메인 코스 + 이유 + 서브 제안)
  → [시작하기] → 홈 + 학습 코스(추천 태그) 로 랜딩

[재실행 · onboarding 완료됨]
  → 바로 홈

[MY › 코스 추천 다시 받기]
  → OnboardingScreen 재실행 → RecommendScreen → 시작하기 → 홈 + 학습 코스
```

랜딩 방식: `시작하기`는 스택을 `[home, courses]`로 만들어 **학습 코스**를 보여주되 뒤로 가면 홈.
(구현: `nav.reset('home')` 후 `nav.push('courses')`.)

## 3. 진단 문항 (PRD 10.2)

한 문항씩 표시. 상단에 진행 점 4개(현재 문항 강조). 각 문항은 단일 선택. 뒤로 버튼으로 이전 문항 수정.
토모 동행 톤(담담·응원, 밝기 헤일로 축하 금지 — 14.2.1은 새 쪽지 전용).

| # | 문항 | 옵션 | 반영 |
|---|---|---|---|
| Q1 | 일본어가 가장 급하게 필요한 순간은? | 여행 ✈️ / 시험 📝 / 업무 💼 / 문화·뉴스 🎌 | **메인 코스**(§4) |
| Q2 | 지금 일본어를 얼마나 알고 있나요? | 완전 초보 / 조금 안다 / 어느 정도 안다 | **읽기도움 설정**(§5) + 시작 난이도 힌트 |
| Q3 | 하루에 학습에 쓸 수 있는 시간은? | 5분 안팎 / 15분쯤 / 30분 이상 | 저장만(후속: 분량·알림) |
| Q4 | 학습할 때 나를 움직이게 하는 것은? | 연속 기록 / 목표에 가까워짐 / 보상 모으기 | 저장만(후속: 홈 위젯 순서 10.5) |

옵션 값(내부 키): Q1 = `travel|jlpt|biz|culture`, Q2 = `beginner|some|intermediate`,
Q3 = `short|mid|long`, Q4 = `streak|progress|reward`.

## 4. 추천 로직

`computeRecommendation(answers) → { mainCourse, mainReady, subCourse, level }`

**Q1 → 메인 코스 매핑**
| Q1 | 메인 코스 key | 준비 상태 |
|---|---|---|
| travel | `travel`(여행 회화) | 곧 열려요 |
| jlpt | `jlpt`(JLPT) | ✅ 준비됨 |
| biz | `biz`(비즈니스) | 곧 열려요 |
| culture | `folk`(전래동화) | 곧 열려요 |

- 코스 준비 상태는 `CourseListScreen`의 `COURSES[].ready`와 **동일 기준**(현재 `jlpt`만 `ready:true`).
- **서브 제안**: 메인이 JLPT가 아니면 `jlpt`(기초이며 바로 시작 가능). 메인이 JLPT면 서브 없음(또는 여행회화 제안 — 미완이라 생략).
- **level**: Q2 → 시작 난이도 힌트. `beginner→N5`, `some→N5`, `intermediate→N4`(현재는 힌트만; 실제 세션은 급수 선택에서 정함).

**미완 코스 처리(대표님 결정: 진단대로 추천 + JLPT 안내)**
- 추천 결과 화면은 진단대로 메인 코스를 크게 보여준다(예: "여행 회화를 추천해요").
- 메인이 `!ready`이면 결과 화면에 **"아직 준비 중이에요 · 먼저 JLPT로 시작해볼까요?"** 안내와 함께
  `시작하기`는 학습 코스로 랜딩(거기서 매핑 코스=추천 태그+곧 열려요, JLPT=바로 시작 가능).
- 메인이 `ready`(JLPT)면 안내 없이 바로 그 코스로 이어진다.

## 5. Q2 → 읽기도움 설정 반영 (PRD 8.4)

읽기도움 설정은 App 상태 `settings = { furigana, pron }`(localStorage `tomori.readAid`)에 저장돼
세션·설정 화면에 주입된다. 온보딩 완료 시 Q2로 초기화한다.

| Q2 | furigana | pron | 근거 |
|---|---|---|---|
| beginner(완전 초보) | ON | **ON** | 한글 발음 보조바퀴 필요 |
| some(조금 안다) | ON | OFF | PRD 8.4 「조금 안다 이상」 |
| intermediate(어느 정도) | ON | OFF | 〃 |

- 적용: App 이 온보딩 완료 콜백에서 `setSettings({ furigana, pron })` → 기존 useEffect 가 localStorage 저장.
- 사용자가 이후 MY › 설정에서 언제든 바꾼다(온보딩은 초기값만).

## 6. 저장 (localStorage)

- 키: `tomori.onboarding`
- 값: `{ done: true, answers: { q1, q2, q3, q4 }, mainCourse, subCourse, savedAt }`
  (`savedAt`은 ISO 문자열; 화면에서 `Date`가 필요하면 저장 시점 문자열만 사용)
- `loadOnboarding()` → 객체 또는 `null`(미완). `saveOnboarding(answers)` → 계산·저장 후 결과 반환.
- **게스트 전용**(인증 후 프로필 이관은 후속). 인증 사용자여도 지금은 localStorage 사용.

## 7. 화면 · 파일

### 신설
- `src/data/onboarding.js`
  - `QUESTIONS`(문항·옵션 정의), `COURSE_BY_Q1`, `computeRecommendation(answers)`,
    `readAidFromQ2(q2) → { furigana, pron }`, `loadOnboarding()`, `saveOnboarding(answers)`,
    `clearOnboarding()`(개발·재실행용), `isOnboardingDone()`.
- `src/screens/OnboardingScreen.jsx`
  - props: `{ onFinish(answers), onExit? }`. 한 문항씩 상태(`step 0..3`), 선택·다음·뒤로,
    마지막 문항에서 `onFinish(answers)`. 디자인 토큰(`typeStyle`·`radius`·`space`) 사용, `keepAll` 조판.
- `src/screens/RecommendScreen.jsx`
  - props: `{ result, onStart() }`. 메인 코스 카드(코스명·설명·추천 이유) + 미완 시 JLPT 안내 +
    서브 제안(있으면) + `시작하기` 버튼. 토모 등장(`pose="shine"` 등, 담담).

### 수정
- `src/App.jsx`
  - 초기 라우트 게이트: `useRouter(isOnboardingDone() ? 'home' : 'onboarding')`.
  - 라우트 추가: `onboarding`(OnboardingScreen), `recommend`(RecommendScreen).
  - 온보딩 완료 핸들러: `handleOnboardingFinish(answers)` = `saveOnboarding` → 결과로
    `setSettings(readAidFromQ2(answers.q2))` → `nav.replace('recommend', { result })`.
  - 시작 핸들러: `handleStart()` = `nav.reset('home')` 후 `nav.push('courses')`.
- `src/screens/CourseListScreen.jsx`
  - 마운트 시 `loadOnboarding()` 읽어 `mainCourse` 확인 → 해당 코스 카드에 `추천` 배지(앰버 톤,
    `card.soon`과 겹치면 두 배지 공존 가능). 온보딩 없으면 배지 없음(무회귀).
- `src/screens/MyScreen.jsx`
  - `학습` 섹션에 `코스 추천 다시 받기` 메뉴 → `nav.push('onboarding')`.

### 라우팅 주의
- `onboarding`이 루트일 때 완료 → `nav.replace('recommend')`(뒤로 시 온보딩 안 돌아옴).
- MY에서 `push('onboarding')`로 재진입 시에도 완료 → `replace('recommend')` → `시작하기`가
  `reset('home')+push('courses')`라 스택이 깔끔히 정리됨(재진입 잔재 없음).

## 8. 디자인 규칙

- 디자인 토큰만 사용(`typeStyle(role)`·`radius`·`space`·`fonts.ko`), 하드코딩 크기 금지.
- 색 절제: 강조는 앰버(`brand`), 파랑(`courseJlpt`)은 코스 식별에만. 상태색 남용 금지.
- 한국어 조판 `keepAll`(어절 단위). 카드 `radius.lg`, 버튼·칩 `radius.sm`.
- 토모 톤: 담담·응원. 진단·추천에 폭죽/헤일로 없음(밝기 헤일로는 새 쪽지 전용 14.2.1).

## 9. 수용 기준 (Acceptance)

1. 첫 실행(온보딩 미완)에 진단 화면이 뜨고, 4문항을 한 문항씩 답하며 뒤로로 수정 가능.
2. 완료 시 추천 결과 화면에 Q1에 맞는 메인 코스가 표시된다.
   - Q1=시험 → JLPT(준비됨, 안내 없음).
   - Q1=여행/업무/문화 → 해당 코스 + "곧 열려요 · 먼저 JLPT로" 안내.
3. `시작하기` → 학습 코스 목록이 보이고, 추천 코스에 `추천` 배지가 있다(뒤로 = 홈).
4. Q2=완전 초보로 답하면 이후 단어/독해 세션의 한글 발음 기본값이 ON(설정에 반영).
   Q2=조금 안다/어느 정도면 발음 OFF·후리가나 ON.
5. 재실행 시 온보딩이 다시 뜨지 않고 바로 홈. `MY › 코스 추천 다시 받기`로 재진입 가능.
6. 온보딩을 한 적 없는(=`tomori.onboarding` 없는) 기존 상태에서 학습 코스 목록에 추천 배지가
   없고 기존 동작 무회귀(게스트·홈·세션 정상).
7. 빌드 오류 0, 콘솔 오류 0(@5599 미리보기).

## 10. 검증

- `npm run build` 통과 후 `@5599` 미리보기(브라우저 pane 표시 상태에서):
  진단 4문항 → 추천(JLPT / 미완 코스 각 1회) → 시작하기 → 학습 코스 추천 배지 → 재실행 스킵 →
  MY 다시 받기 → Q2=완전초보 후 단어 세션 발음 기본 ON 확인. 라이트/다크 각 확인. 콘솔 0.
- 개발 편의: `clearOnboarding()`(콘솔 또는 임시 버튼)로 첫 실행 재현.

## 11. 후속 (범위 밖 메모)

- 하단 탭 5개(홈·학습코스·단어장·번역·내정보) 셸 — 단어장·번역 신설 포함(별도 서브프로젝트).
- Q4 → 홈 위젯 순서 재배열(PRD 10.5), Q3 → 학습 분량·알림.
- 인증 후 온보딩 결과 프로필 저장·기기 간 이관, 레벨 테스트, 앱 소개·스플래시.
- 미완 코스(여행/비즈니스/뉴스/전래동화) 콘텐츠 채워지면 추천이 바로 학습으로 이어짐.

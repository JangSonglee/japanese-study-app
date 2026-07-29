# 「모르겠어요」 스킵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 독해·청해 객관식 풀이 화면에 「모르겠어요」 도피구를 추가한다 — 선택 없이 눌러 오답과 같이 '못 맞춤'으로 처리하고, 토모가 솔직함을 격려하며 해설로 안내한다.

**Architecture:** 단일 파일 `QuizScreen.jsx` 수정. 기존 3단 흐름(풀이 → 토모 반응 모달 → 결과)에 합류한다. `reaction` 상태에 `'unknown'` 케이스를 더하고, 제출 버튼 아래 고스트 버튼 하나와 토모 모달의 문구 분기만 추가한다. BE/DB/오디오 무관.

**Tech Stack:** React Native Web (Vite 빌드 + `vite preview` 정적 서빙), 프로젝트 테마 토큰(`fonts`, `radius`, `t.*`). 유닛 테스트 러너 없음 → 검증은 빌드 + 포트 5599 프리뷰 DOM 확인.

## Global Constraints

- 상태색(`t.error`) 금지 — 「모르겠어요」는 틀림이 아니므로 중립 톤(`t.textMid`/`t.textHigh`/`t.borderStrong`)만 사용.
- 밝기(헤일로) 확대 축하 연출 금지 — 「새 쪽지」 전용(PRD 14.2.1). 문구·색으로만 표현.
- 채점: 「모르겠어요」는 `correct` 카운트를 올리지 않는다(오답과 동일 '못 맞춤'). `DoneView`/세션 요약 무변경.
- 폰트·모서리: `fonts.ko`(한글), `radius.sm` 등 기존 토큰만 사용. 새 색·폰트 도입 금지.
- 문구 확정값(verbatim): 제목 `솔직하게 말해줘서 좋아요`, 부제 `모르는 걸 아는 것도 실력이에요. 같이 볼까요?`, 버튼 `모르겠어요`.
- BE/DB/`content_vocab_links`/TTS 무관.
- 검증 기준: `npm run build` 성공 + 포트 5599 프리뷰에서 동작 확인 + 콘솔 에러 0.

---

### Task 1: 「모르겠어요」 스킵 (로직 + 버튼 + 토모 분기)

한 파일 안에서 로직·UI·문구가 함께 있어야 동작을 검증할 수 있으므로 하나의 태스크로 둔다.

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx`
  - `skip()` 함수 신설 (기존 `submit`/`toResult`/`next` 옆, 57–73행 근처)
  - 풀이 phase 제출 버튼 블록 (216–224행) 아래 고스트 버튼 추가
  - `TomoReaction` 컴포넌트 (414–445행) 문구 분기
  - `makeStyles`에 `btnGhost`/`btnGhostText` 스타일 추가 (522–523행 `btnPri` 근처)

**Interfaces:**
- Consumes: 기존 상태 `reaction`(`null | 'correct' | 'wrong'`), `q`, `setReaction`. 기존 `toResult`(모달 → 결과), `next`.
- Produces: `skip()` — 인자 없음, `reaction`을 `'unknown'`으로 세팅(`correct` 미증가, `selected` 유지). `TomoReaction`은 `kind`에 `'unknown'`을 받으면 격려 문구 + 「해설 보기」 단일 버튼을 렌더.

- [ ] **Step 1: `skip()` 함수 추가**

`submit()` 함수(57–63행) 바로 아래에 추가한다. `correct`를 올리지 않고 `selected`도 건드리지 않아, 결과 화면에서 오답 마크 없이 정답만 하이라이트된다.

```jsx
  function skip() {
    if (!q) return;
    setReaction('unknown');   // 오답과 같이 '못 맞춤'(correct 미증가), selected는 null 유지
  }
```

- [ ] **Step 2: 풀이 화면에 「모르겠어요」 고스트 버튼 추가**

현재 216–224행의 제출 버튼은 단일 `<Pressable>`이다. 이를 Fragment로 감싸고 아래에 고스트 버튼을 더한다. `showAnswers`가 false(풀이 중)일 때만 보인다.

수정 전(216–224행):
```jsx
            {!showAnswers ? (
              <Pressable
                style={[S.btnPri, { backgroundColor: selected == null ? t.border : t.brand }]}
                onPress={submit}
                disabled={selected == null}
                accessibilityRole="button"
              >
                <Text style={[S.btnPriText, { color: selected == null ? t.textLow : t.onBrand }]}>제출하기</Text>
              </Pressable>
            ) : (
```

수정 후:
```jsx
            {!showAnswers ? (
              <>
                <Pressable
                  style={[S.btnPri, { backgroundColor: selected == null ? t.border : t.brand }]}
                  onPress={submit}
                  disabled={selected == null}
                  accessibilityRole="button"
                >
                  <Text style={[S.btnPriText, { color: selected == null ? t.textLow : t.onBrand }]}>제출하기</Text>
                </Pressable>
                <Pressable
                  style={[S.btnGhost, { borderColor: t.borderStrong }]}
                  onPress={skip}
                  accessibilityRole="button"
                  accessibilityLabel="모르겠어요, 해설 보기"
                >
                  <Text style={[S.btnGhostText, { color: t.textMid }]}>모르겠어요</Text>
                </Pressable>
              </>
            ) : (
```

- [ ] **Step 3: `TomoReaction`에 `unknown` 문구 분기 추가**

현재 정답(`ok`)이면 2버튼, 아니면 「해설 보기」 1버튼이다. `unknown`은 `ok`가 아니므로 **버튼 구조는 오답과 동일(1버튼)** — 제목/부제 문구만 분기하면 된다. 제목 색은 오답과 같은 중립(`t.textHigh`).

수정 전(414–425행):
```jsx
function TomoReaction({ t, S, kind, onReview, onNext }) {
  const ok = kind === 'correct';
  return (
    <View style={S.modalOverlay}>
      <View style={[S.modalCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
        <Tomo scale={1.15} showNote={false} />
        <Text style={[S.modalTitle, { color: ok ? t.success : t.textHigh }]}>
          {ok ? '최고예요!' : '괜찮아요, 같이 봐요'}
        </Text>
        <Text style={[S.modalSub, { color: t.textMid }]}>
          {ok ? '정확해요. 이 기세로 가요.' : '틀린 건 배움의 시작이에요. 해설을 같이 볼까요?'}
        </Text>
```

수정 후:
```jsx
function TomoReaction({ t, S, kind, onReview, onNext }) {
  const ok = kind === 'correct';
  const unknown = kind === 'unknown';
  const title = ok ? '최고예요!' : unknown ? '솔직하게 말해줘서 좋아요' : '괜찮아요, 같이 봐요';
  const sub = ok ? '정확해요. 이 기세로 가요.'
    : unknown ? '모르는 걸 아는 것도 실력이에요. 같이 볼까요?'
    : '틀린 건 배움의 시작이에요. 해설을 같이 볼까요?';
  return (
    <View style={S.modalOverlay}>
      <View style={[S.modalCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
        <Tomo scale={1.15} showNote={false} />
        <Text style={[S.modalTitle, { color: ok ? t.success : t.textHigh }]}>
          {title}
        </Text>
        <Text style={[S.modalSub, { color: t.textMid }]}>
          {sub}
        </Text>
```

이 컴포넌트의 버튼 영역(426–441행)은 `ok ? (2버튼) : (해설 보기 1버튼)` 구조라 그대로 두면 `unknown`은 오답과 같은 「해설 보기」 1버튼(`onReview` → 결과)이 된다. 수정 불필요.

- [ ] **Step 4: `btnGhost` 스타일 추가**

`makeStyles`의 `btnPri`/`btnPriText`(522–523행) 바로 아래에 추가한다.

```jsx
    btnGhost: { height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    btnGhostText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
```

- [ ] **Step 5: 빌드**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && npm run build
```
Expected: `✓ built in ...` (에러 0). JSX Fragment/문법 오류 없어야 함.

- [ ] **Step 6: 프리뷰에서 독해 동작 검증**

포트 5599 프리뷰(`.claude/launch.json` fe)에서 홈 → 학습 시작 → JLPT → (급수 아무거나) → 독해 진입.
확인:
- 풀이 화면 제출하기 **아래에 「모르겠어요」** 노출.
- 선택지를 **안 고른 채** 「모르겠어요」 눌림 → 토모 모달 제목 `솔직하게 말해줘서 좋아요`·부제 `모르는 걸 아는 것도 실력이에요. 같이 볼까요?` + 「해설 보기」 1버튼.
- 「해설 보기」 → 결과 화면: **오답 마크 없이 정답만 하이라이트** + 해설 표시.
- 콘솔 에러 0 (`read_console_messages`).

- [ ] **Step 7: 회귀 + 청해 검증**

- 정답 흐름: 선택 → 제출 → 「최고예요!」 2버튼 정상.
- 오답 흐름: 오답 선택 → 제출 → 「괜찮아요, 같이 봐요」 정상.
- 청해: 음성만 있는 풀이 화면에서도 「모르겠어요」 노출·동일 동작.
- 콘솔 에러 0.

- [ ] **Step 8: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx"
git commit -m "feat: 독해·청해 「모르겠어요」 스킵(오답처럼 위로+해설)"
```

---

### Task 2: 진행상태 문서 기록

**Files:**
- Modify: `기획/진행상태.md` (최종 갱신 라인의 밤 세션 노트에 이어 기록 — 프로젝트 관행: 결정+근거)

**Interfaces:**
- Consumes: Task 1이 구현·검증 완료됨.
- Produces: 없음(문서).

- [ ] **Step 1: 진행상태.md에 결정·구현 기록 추가**

밤 세션 노트 흐름에 한 항목 추가한다. 내용: 「모르겠어요」 스킵 구현, 3결정(버튼=선택지 아래 고스트·항상 활성 / 채점=오답과 같이 못맞춤 / 토모=솔직함 격려 전용 문구)과 근거, 검증 결과, 스펙·계획 문서 경로(`docs/superpowers/specs/2026-07-30-moreugesseoyo-skip-design.md`).

- [ ] **Step 2: 커밋**

```bash
git add "기획/진행상태.md"
git commit -m "docs: 진행상태에 「모르겠어요」 스킵 기록"
```

---

## Self-Review

- **Spec coverage:** D1(고스트 버튼·항상 활성)=Task1 Step2 / D2(오답과 같이 못맞춤·DoneView 무변경)=Step1 `skip()` correct 미증가 / D3(격려 전용 문구)=Step3. 청해 자동 적용=Step7. 문서 기록=Task2. 모든 스펙 항목에 태스크 있음.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "적절히"/"TODO" 없음.
- **Type consistency:** `skip()`·`reaction='unknown'`·`kind==='unknown'`·`btnGhost`/`btnGhostText` 이름이 태스크 전체에서 일치. `TomoReaction`의 기존 `onReview`(결과 진입)·`onNext`(다음)는 그대로 사용.

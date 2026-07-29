# 2회 연속 오답 분기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QuizScreen에 2라운드 구조(1차 전체 → 2차 오답 재노출)와 2연속 오답 분기 UI([다시 풀기]/[넘어가기])를 더한다.

**Architecture:** 단일 파일 `QuizScreen.jsx` 수정. props `cards`(원본)는 불변 유지하고, 현재 라운드가 푸는 목록을 `roundCards` 상태로 둔다. 1차에서 못 맞춘(오답+모름) 카드를 ref에 누적했다가 1차 종료 시 2차 목록으로 승격한다. `reaction`을 결과 화면까지 유지해 버튼 분기를 판정한다.

**Tech Stack:** React Native Web (Vite 빌드 + `vite preview`). 유닛 테스트 러너 없음 → 검증은 빌드 + 포트 5599 프리뷰 DOM 확인. RN Web Pressable은 navigate 직후 좌표 클릭이 무시될 수 있어 `javascript_tool`로 DOM 클릭/상태 확인.

## Global Constraints

- 강제 반복 금지(PRD 1.3): 2연속에서 항상 「넘어가기」 제공. 3차 라운드 없음.
- 요약 성적은 **첫 시도(round 1) 정답만** 집계(`correct`는 round 1에서만 증가). DoneView `total`은 원본 `cards.length` 유지.
- 오답노트 실 저장 금지(인증 대기) — 안내 문구 + `// TODO: 인증 후 오답노트 저장 배선` 주석만.
- 밝기(헤일로) 축하 금지 — 「새 쪽지」 전용(PRD 14.2.1). 문구·색만.
- 상태색(`t.error`)은 오답 마크 등 기존 용도만. 「넘어가기」 버튼은 중립 고스트.
- 문구 확정값(verbatim): 「넘어가도 오답노트에 남아요.」, 버튼 「다시 풀기」·「넘어가기」·「계속하기」.
- BE/DB/오답노트 화면(18·47번)/인증 무관.
- 검증 기준: `npm run build` 성공 + 5599 프리뷰 동작 + 콘솔 에러 0.

---

### Task 1: 2라운드 + 2연속 분기 (QuizScreen.jsx)

라운드 상태·흐름·버튼·모달이 서로 물려 있어 함께 있어야 검증 가능하므로 하나의 태스크로 둔다.

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx`

**Interfaces:**
- Consumes: props `cards`(원본, 불변). 기존 상태 `idx`,`selected`,`phase`,`reaction`(`null|'correct'|'wrong'|'unknown'`),`correct`. 기존 `TomoReaction`(props `onReview`,`onNext`), `DoneView`.
- Produces: `round`(`1|2`), `roundCards`, `wrongRef`. 함수 `submit`/`skip`(라운드 인지), `toResult`(reaction 유지), `advance`(라운드 전환 포함, 기존 `next` 대체), `retry`(같은 문제 재도전).

- [ ] **Step 1: 라운드 상태 추가 + done/card 재정의**

`useState` 블록(현재 `const [idx, setIdx] = useState(0);` 아래)과 `useRef` import를 이용한다. `useRef`는 이미 파일 상단에서 import됨.

`const [wordsState, setWordsState] = useState('idle');` 다음 줄에 추가:
```jsx
  const [round, setRound] = useState(1);          // 1=전체, 2=오답 재노출
  const [roundCards, setRoundCards] = useState(cards);  // 현재 라운드가 푸는 목록(원본 cards는 불변)
  const wrongRef = useRef([]);                     // 1차에서 못 맞춘 카드 누적(오답+모름) → 2차 목록
```

그리고 기존 `done`/`card` 정의(`const done = idx >= cards.length;` / `const card = done ? null : cards[idx];`)를 roundCards 기준으로 바꾼다:
```jsx
  const done = idx >= roundCards.length;
  const card = done ? null : roundCards[idx];
```

- [ ] **Step 2: submit/skip에 라운드 로직**

기존 `submit`/`skip`을 교체한다. round 1에서만 `correct` 증가·`wrongRef` 누적한다.

```jsx
  function submit() {
    if (selected == null || !q) return;
    const chosen = q.choices.find((c) => c.seq === selected);
    const ok = !!(chosen && chosen.correct);
    if (ok) {
      if (round === 1) setCorrect((c) => c + 1);
    } else if (round === 1) {
      wrongRef.current.push(card);   // 1차 오답 → 2차 재노출 큐
    }
    setReaction(ok ? 'correct' : 'wrong');
  }
  function skip() {
    if (!q) return;
    if (round === 1) wrongRef.current.push(card);   // 모름도 '못 맞춤' → 재노출
    setReaction('unknown');
  }
```

- [ ] **Step 3: toResult/advance/retry (기존 next 대체)**

기존 `toResult`/`next`를 교체한다. `advance`가 1차 종료 시 2차 진입 또는 요약으로 분기한다.

```jsx
  function toResult() { setPhase('result'); }   // reaction 유지 → 모달만 닫힘

  function advance() {
    const atEnd = idx + 1 >= roundCards.length;
    if (round === 1 && atEnd && wrongRef.current.length > 0) {
      setRoundCards(wrongRef.current);   // 2차 진입: 못 맞춘 문제만
      wrongRef.current = [];
      setRound(2);
      setIdx(0);
    } else {
      setIdx((i) => i + 1);
    }
    setPhase('solve');
    setSelected(null);
    setReaction(null);
    setFuri(false);
    setTrans(false);
    setWordSheet(false);
  }

  function retry() {   // 2연속에서 같은 문제 다시(같은 idx)
    setPhase('solve');
    setSelected(null);
    setReaction(null);
  }
```

- [ ] **Step 4: 모달 표시 조건 + onRestart + next 참조 교체**

(a) 토모 모달 조건(현재 `{reaction ? <TomoReaction ... /> : null}`)을 풀이 phase로 좁히고 `onNext`를 `advance`로:
```jsx
      {reaction && phase === 'solve' ? <TomoReaction t={t} S={S} kind={reaction} onReview={toResult} onNext={advance} /> : null}
```

(b) DoneView `onRestart`(현재 `() => { setIdx(0); setCorrect(0); setSelected(null); setPhase('solve'); setReaction(null); }`)에 라운드 초기화 추가:
```jsx
        onRestart={() => { setIdx(0); setCorrect(0); setSelected(null); setPhase('solve'); setReaction(null); setRound(1); setRoundCards(cards); wrongRef.current = []; }}
```

(c) "이 지문에 연결된 문항이 없어요" 카드의 버튼(현재 `onPress={next}`)을 `advance`로 바꾸고, 라벨은 Step 5의 `contLabel`을 쓰지 않고 단순히 유지한다:
```jsx
            <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={advance}>
              <Text style={[S.btnPriText, { color: t.onBrand }]}>{idx + 1 < roundCards.length ? '다음' : '결과 보기'}</Text>
            </Pressable>
```

- [ ] **Step 5: 결과 화면 버튼 분기 (2연속 UI)**

결과 phase의 버튼 블록(현재 해설 박스 다음의 단일 「다음/결과 보기」 Pressable)을 라운드·정오로 분기한다. 해당 블록:
```jsx
                <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={next}>
                  <Text style={[S.btnPriText, { color: t.onBrand }]}>{idx + 1 < cards.length ? '다음' : '결과 보기'}</Text>
                </Pressable>
```
을 다음으로 교체한다:
```jsx
                {round === 2 && reaction !== 'correct' ? (
                  <>
                    <Text style={[S.retryNote, { color: t.textMid }]}>넘어가도 오답노트에 남아요.</Text>
                    <View style={S.retryRow}>
                      <Pressable style={[S.btnGhost, { borderColor: t.borderStrong, flex: 1, marginTop: 0 }]} onPress={advance} accessibilityRole="button">
                        <Text style={[S.btnGhostText, { color: t.textMid }]}>넘어가기</Text>
                      </Pressable>
                      <Pressable style={[S.btnPri, { backgroundColor: t.brand, flex: 1, marginTop: 0 }]} onPress={retry} accessibilityRole="button">
                        <Text style={[S.btnPriText, { color: t.onBrand }]}>다시 풀기</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={advance} accessibilityRole="button">
                    <Text style={[S.btnPriText, { color: t.onBrand }]}>
                      {round === 1 && idx + 1 >= roundCards.length && wrongRef.current.length > 0
                        ? '틀린 문제 다시 보기'
                        : idx + 1 >= roundCards.length ? '결과 보기' : '계속하기'}
                    </Text>
                  </Pressable>
                )}
```

주석 한 줄을 이 블록 위에 남긴다(오답노트 배선 지점 표식):
```jsx
                {/* TODO: 인증 후 오답노트 저장 배선 — 지금은 안내 문구만 */}
```

- [ ] **Step 6: 스타일 추가**

`makeStyles`의 `btnGhostText` 다음 줄에 추가:
```jsx
    retryRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    retryNote: { fontFamily: fonts.ko, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
```

- [ ] **Step 7: 빌드**

Run:
```bash
cd "개발/프론트엔드_무스부/tomori-app" && npm run build
```
Expected: `✓ built in ...` (에러 0). `next`가 남아 참조 에러 안 나는지 확인(모두 `advance`로 교체됨).

- [ ] **Step 8: 프리뷰 검증 (5599)**

`preview_start {name:"fe"}` → `navigate http://localhost:5599`. RN Web navigate 직후 좌표 클릭이 무시되므로 `javascript_tool`로 DOM 클릭/상태 확인.
진입: 홈 → 학습 시작 → JLPT → (급수) → 독해.
확인 항목:
- 1차에서 오답 1개 이상 만들고 「계속하기」로 진행 → 1차 마지막 버튼이 **「틀린 문제 다시 보기」**.
- 눌러 2차 진입 → **오답 문제만 재노출**(state에 `readingSession` 유지, 카드 수가 오답 수).
- 2차에서 오답/모름 → 결과에 **「넘어가도 오답노트에 남아요.」 + [넘어가기][다시 풀기]** 노출.
  - [다시 풀기] → 같은 문제 풀이 화면 복귀. [넘어가기] → 다음.
- 2차 정답 → 「계속하기」.
- 1차 전부 정답인 지문(문항 1개짜리 등)으로 → 2차 없이 바로 요약(DoneView).
- 요약 정답 수 = 첫 시도 기준(2차 정답 미반영), total = 원본 문항 수.
- 콘솔 에러 0(`read_console_messages`).

- [ ] **Step 9: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx"
git commit -m "feat: 독해·청해 2회 연속 오답 분기(오답 재노출 + 다시 풀기/넘어가기)"
```

---

### Task 2: 진행상태 문서 기록

**Files:**
- Modify: `기획/진행상태.md` (밤 세션 노트에 이어 결정+근거 기록)

**Interfaces:**
- Consumes: Task 1 구현·검증 완료.
- Produces: 없음(문서).

- [ ] **Step 1: 진행상태.md에 기록 추가**

내용: 2회 연속 오답 분기 구현. 범위(재도전+2연속 UI, 오답노트 저장은 인증 대기 TODO), 방식(라운드형·문서 원안), 결정(요약=첫 시도 기준·2차에서도 모르겠어요 유지·강제 반복 없음), 검증 결과, 스펙·계획 경로.

- [ ] **Step 2: 커밋**

```bash
git add "기획/진행상태.md"
git commit -m "docs: 진행상태에 2회 연속 오답 분기 기록"
```

---

## Self-Review

- **Spec coverage:** 2라운드 구조=Step1·3 / 1차 오답·모름 재노출 큐=Step2 / 2차 2연속 분기 UI=Step5 / 요약 첫 시도 기준=Step2(`round===1` 가드)+DoneView total 원본 / 오답노트 안내+TODO=Step5 / 강제 반복 없음=Step5(항상 넘어가기) / 모달 회귀=Step4(a). 모든 스펙 항목에 태스크 있음.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드. "적절히"/"TODO 구현" 없음(오답노트 TODO는 의도된 배선 표식, 인증 대기).
- **Type consistency:** `round`/`roundCards`/`wrongRef`/`advance`/`retry`/`toResult` 이름이 전 태스크 일치. 기존 `next` 참조 3곳(모달 onNext·결과 버튼·문항없음 버튼) 모두 `advance`로 교체(Step3에서 next 제거, Step4c·Step5에서 참조 갱신). `reaction` 유지 방식(모달 조건 `phase==='solve'`)과 결과 버튼 판정(`reaction!=='correct'`) 정합.

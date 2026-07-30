# 실데이터 A — 세션 기록 + 스트릭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 학습 세션을 완료하면 서버에 기록하고(스터디·일일·스트릭), 홈 스트릭 위젯을 실데이터로 표시한다.

**Architecture:** BE `record_session_complete` RPC(SECURITY DEFINER)가 세션 완료를 원자적으로 처리(study_sessions insert + daily_studies upsert + users_profile 스트릭). FE `data/study.js`가 RPC 호출·스트릭 로드를 감싼다. 모든 세션이 공유하는 `DoneView`에서 완료 시 1회 기록하고, HomeScreen이 스트릭을 로드한다. 게스트는 데모 폴백.

**Tech Stack:** Supabase(RPC·MCP), React Native Web + Vite, `useAuth` 세션.

## Global Constraints

- 🔴 유닛 테스트 없음. 검증 = `npm run build` + 프리뷰(@5599) + Supabase MCP.
  🔴 **로그인 검증 분리**: BE는 정의·advisor를 MCP로 확인(RPC 실행은 auth 컨텍스트 필요). FE는 빌드+게스트 폴백(회귀 없음). **로그인 상태 세션완료→스트릭→홈 end-to-end는 대표님(또는 로그인된 프리뷰 세션)**이 확인, 컨트롤러가 `study_sessions`·`daily_studies`·`users_profile` 행을 MCP로 확인.
- 🔴 원시 hex 금지(토큰만). 한국어 문장 `keepAll`. 커밋은 태스크 끝. Bash(POSIX), PowerShell heredoc 금지.
- 🔴 게스트/미로그인은 기록하지 않음 — `recordSessionComplete`·`loadStreak`가 세션 없으면 `null`.
- Supabase ref `vtbprgphfksfffivfnrf`. FE = `개발/프론트엔드_무스부/tomori-app`. 날짜 = KST(Asia/Seoul).
- study_sessions NOT NULL: user_id·source·correct_count·wrong_count·is_offline·verify_status. daily_studies NOT NULL: user_id·study_date·target_sessions·completed_sessions·is_completed·stamp_granted.

---

## File Structure
- 마이그레이션 `record_session_complete_rpc` (+ daily_studies unique 없으면) — MCP.
- `개발/프론트엔드_무스부/tomori-app/src/data/study.js` — **신규**. `recordSessionComplete`·`loadStreak`.
- `개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx` — **수정**. DoneView 완료 훅 + source.
- `개발/프론트엔드_무스부/tomori-app/src/screens/GrammarCardScreen.jsx` · `QuizScreen.jsx` — **수정**. DoneView 에 source 전달.
- `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx` — **수정**. 스트릭 실데이터.
- `기획/진행상태.md` — 기록.

---

## Task 1: BE — `record_session_complete` RPC

**Files:** 마이그레이션 `record_session_complete_rpc` (Supabase MCP `apply_migration`).

**Interfaces:** Produces `public.record_session_complete(p_source text, p_correct int, p_wrong int) → jsonb` (SECURITY DEFINER). 반환 키: streak_count·last_studied_on·completed_sessions·target_sessions·is_completed.

- [ ] **Step 1: 사전 확인** (MCP `execute_sql`)
```sql
-- daily_studies (user_id, study_date) unique 존재?
select conname from pg_constraint where conrelid='public.daily_studies'::regclass and contype='u';
-- study_sessions.verify_status 의 check 제약/기본값(유효값 확인)
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.study_sessions'::regclass and contype='c';
select column_name, column_default from information_schema.columns where table_schema='public' and table_name='study_sessions' and column_name='verify_status';
```
🔴 unique 가 없으면 Step 2 마이그레이션 앞에 `alter table public.daily_studies add constraint daily_studies_user_date_key unique (user_id, study_date);` 추가. verify_status 에 check 가 있으면 허용값 중 하나(예 온라인=`'trusted'` 또는 허용되는 값)를 Step 2 insert 에 사용. 허용값 미상이면 가장 안전한(무제약이면 `'trusted'`) 값으로.

- [ ] **Step 2: RPC 적용** (MCP `apply_migration`, name `record_session_complete_rpc`)
```sql
-- (Step1 결과 unique 없으면 여기 상단에 alter table ... add constraint ... unique(user_id, study_date);)
create or replace function public.record_session_complete(p_source text, p_correct int, p_wrong int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_target int; v_completed int; v_is_completed boolean; v_last date; v_streak int;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  select daily_session_target, last_studied_on, streak_count
    into v_target, v_last, v_streak
    from public.users_profile where user_id = v_uid;
  if v_target is null then v_target := 1; end if;

  insert into public.study_sessions
    (user_id, source, correct_count, wrong_count, is_offline, verify_status, started_at, finished_at)
  values
    (v_uid, coalesce(p_source,'unknown'), coalesce(p_correct,0), coalesce(p_wrong,0), false, 'trusted', now(), now());

  insert into public.daily_studies
    (user_id, study_date, target_sessions, completed_sessions, is_completed, stamp_granted)
  values (v_uid, v_today, v_target, 1, (1 >= v_target), false)
  on conflict (user_id, study_date) do update
    set completed_sessions = daily_studies.completed_sessions + 1,
        is_completed = (daily_studies.completed_sessions + 1 >= daily_studies.target_sessions);

  select completed_sessions, is_completed into v_completed, v_is_completed
    from public.daily_studies where user_id = v_uid and study_date = v_today;

  if v_last is distinct from v_today then
    if v_last = v_today - 1 then v_streak := coalesce(v_streak,0) + 1;
    else v_streak := 1; end if;
    update public.users_profile
      set streak_count = v_streak, last_studied_on = v_today, updated_at = now()
      where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'streak_count', v_streak, 'last_studied_on', v_today,
    'completed_sessions', v_completed, 'target_sessions', v_target, 'is_completed', v_is_completed);
end;
$$;

revoke all on function public.record_session_complete(text,int,int) from public, anon;
grant execute on function public.record_session_complete(text,int,int) to authenticated;
```
🔴 Step1 에서 verify_status 허용값이 'trusted' 가 아니면 그 값으로 교체.

- [ ] **Step 3: 검증** (MCP)
```sql
select proname, prosecdef, proconfig from pg_proc where proname='record_session_complete';  -- prosecdef=true, search_path=public
```
+ `get_advisors`(security) 신규 경고 0. EXECUTE 권한이 authenticated 만인지 `information_schema.routine_privileges` 확인.

- [ ] **Step 4: 기록 커밋**
`기획/진행상태.md` 러닝노트에 마이그레이션명·검증 한 줄(Edit, 끝 앵커) → `git add "기획/진행상태.md"` → `git commit -m "docs(streak): record_session_complete RPC 적용 기록"`.

---

## Task 2: FE 데이터 — `data/study.js`

**Files:** Create `개발/프론트엔드_무스부/tomori-app/src/data/study.js`

**Interfaces:** Produces `recordSessionComplete(source, correct, wrong)→Promise<result|null>`, `loadStreak()→Promise<{days:int, week:boolean[7]}|null>`.

- [ ] **Step 1: 파일 생성**
```js
// 학습 세션 실데이터(로그인 시). 서버 RPC가 기록·스트릭을 원자 처리.
import { supabase } from './supabaseClient';

// YYYY-MM-DD (클라 로컬=KST 사용자 기준, 서버 KST study_date와 매칭).
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function recordSessionComplete(source, correct, wrong) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('record_session_complete', {
    p_source: source, p_correct: correct | 0, p_wrong: wrong | 0,
  });
  if (error) throw error;
  return data;
}

export async function loadStreak() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof, error: e1 } = await supabase
    .from('users_profile').select('streak_count').maybeSingle();
  if (e1) throw e1;
  const { data: days, error: e2 } = await supabase
    .from('daily_studies').select('study_date').order('study_date', { ascending: false }).limit(30);
  if (e2) throw e2;
  const studied = new Set((days || []).map((d) => d.study_date));
  const week = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    week.push(studied.has(localISO(d)));
  }
  return { days: prof?.streak_count || 0, week };
}
```

- [ ] **Step 2: 빌드** — `cd "개발/프론트엔드_무스부/tomori-app" && npm run build` → 0 errors.
- [ ] **Step 3: 커밋** — `git add ".../src/data/study.js"` → `git commit -m "feat(streak): 세션 기록·스트릭 데이터 계층(rpc + loadStreak)"`.

---

## Task 3: FE — DoneView 완료 훅 + source 전달

**Files:** Modify `WordCardScreen.jsx`(DoneView + source), `GrammarCardScreen.jsx`, `QuizScreen.jsx`.

**Interfaces:** Consumes `recordSessionComplete`(Task 2). `DoneView` 에 `source` prop 추가.

- [ ] **Step 1: `WordCardScreen.jsx` — import + DoneView 훅**
상단 import 수정:
```js
import React, { useState, useEffect, useRef } from 'react';
```
그리고 `study` import 추가(파일 상단 import 들 근처):
```js
import { recordSessionComplete } from '../data/study';
```
`export function DoneView(...)` 시그니처에 `source` 추가하고 훅을 함수 본문 최상단에 넣는다:
```js
export function DoneView({ t, mode, known, total, savedCount, onRestart, onBack, noun = '단어', source }) {
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || !source) return;
    recordedRef.current = true;
    recordSessionComplete(source, known, Math.max(0, total - known)).catch(() => {});
  }, [source, known, total]);
  // ...기존 본문 그대로...
```
그리고 WordCardScreen 이 DoneView 를 렌더하는 곳(`if (done) return <DoneView ... />`)에 `source="vocab"` 추가.

- [ ] **Step 2: 빌드 검증** — `npm run build` 0 errors.

- [ ] **Step 3: `GrammarCardScreen.jsx` — DoneView 에 source**
`<DoneView ... noun="문형" ... />` 에 `source="grammar"` 추가(다른 props 그대로).

- [ ] **Step 4: `QuizScreen.jsx` — DoneView 에 source**
`<DoneView t={t} mode={mode} known={correct} total={cards.length} savedCount={savedWords.size} noun="문제" ... />` 에 `source={kind}` 추가(`kind` 는 이미 컴포넌트 prop = 'reading'|'listening').

- [ ] **Step 5: 빌드 + 게스트 검증**
`npm run build` 0 errors. 프리뷰(**게스트**): 단어/독해 세션을 완주해 DoneView 도달 → 에러·크래시 없음(게스트라 `recordSessionComplete` 는 null 반환, 아무 기록 안 함)·콘솔0. 스크린샷 1장.

- [ ] **Step 6: 커밋**
```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/GrammarCardScreen.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx"
git commit -m "feat(streak): 세션 완료 시 DoneView에서 기록(source별 단어·문법·독해·청해)"
```

---

## Task 4: FE — 홈 스트릭 위젯 실데이터 + docs

**Files:** Modify `HomeScreen.jsx`. Modify `기획/진행상태.md`.

**Interfaces:** Consumes `loadStreak`(Task 2).

- [ ] **Step 1: `HomeScreen.jsx` — 스트릭 로드**
상단 import 에 추가:
```js
import { loadStreak } from '../data/study';
```
`HomeScreen` 컴포넌트 안(다른 훅 근처):
```js
  const [streak, setStreak] = useState(null);
  useEffect(() => { loadStreak().then(setStreak).catch(() => setStreak(null)); }, []);
```
(React 에 `useState, useEffect` 필요 — import 확인, 없으면 추가.)
`const D = HOME_DEMO;` 다음에:
```js
  const streakData = streak || D.streak; // 로그인 실데이터, 없으면 데모 폴백
```
연속 학습 위젯의 `D.streak.days` → `streakData.days`, `D.streak.week` → `streakData.week` 로 교체(그 위젯 블록만).

- [ ] **Step 2: 빌드 + 검증**
`npm run build` 0 errors. 프리뷰: 게스트=데모 스트릭 폴백(회귀 없음). 콘솔0. 스크린샷.
🔴 로그인 실데이터 반영은 완료 후(대표님/로그인 세션) 확인 항목.

- [ ] **Step 3: docs + 커밋**
`기획/진행상태.md` 에 세션 요약(A 완료·범위밖 B/C) 기록.
```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx" "기획/진행상태.md"
git commit -m "feat(streak): 홈 스트릭 위젯 실데이터(loadStreak) + 데모 폴백"
```

---

## 완료 후 (로그인 end-to-end)
컨트롤러가 BE(정의·advisor)·FE(빌드·게스트)를 확인한 뒤, **로그인 세션에서 세션 1개 완주** → 홈 스트릭 반영 확인 + Supabase MCP 로 `study_sessions`·`daily_studies`(오늘, completed_sessions)·`users_profile.streak_count`·`last_studied_on` 행 확인. (실 세션 데이터를 대표님 계정에 쓰므로 대표님 양해/직접 수행 우선.)

## Self-Review (작성자 점검)
- **Spec coverage**: RPC(Task1)·데이터(Task2)·완료 훅(Task3)·홈 스트릭(Task4)·docs. 스펙 ①②③④ 매핑. 범위밖(우표·오답노트·진도·오프라인)=태스크 없음(정상).
- **Placeholder scan**: SQL·JS 실제. Task1 Step1 은 조건부 실제 지시(unique·verify_status 유효값).
- **Type consistency**: RPC 파라미터 `p_source/p_correct/p_wrong` = FE rpc 호출 인자 일치. 반환 키 = loadStreak/사용처 참조. `DoneView` `source` prop Task3 정의 = 3개 caller 전달 일치. `recordSessionComplete(source, correct, wrong)`·`loadStreak()→{days,week}` Task2 정의 = Task3/Task4 소비 일치.

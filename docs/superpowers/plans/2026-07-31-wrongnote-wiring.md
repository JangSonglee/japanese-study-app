# 오답노트 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 퀴즈(독해·청해 객관식) 오답·넘어감을 `session_attempts`에 기록하고, MY의 "오답노트 모아보기"에서 누적 오답을 복습·졸업할 수 있게 한다.

**Architecture:** 시도는 세션 동안 클라이언트에 모아 `record_session_complete`에 `p_attempts` 배열로 실어 세션과 한 트랜잭션에 기록(A·B와 동일 흐름). 오답노트는 `load_wrong_notes` RPC가 `session_attempts`를 문항별 집계·졸업 필터해 반환하고, 화면은 렌더만. 졸업은 `wrong_note_graduated` 테이블(날짜 인지 재등장). FE는 스트릭/우표와 동일한 게스트→null→폴백.

**Tech Stack:** Supabase Postgres(plpgsql, SECURITY DEFINER, RLS), Supabase MCP, React Native Web + Vite.

## Global Constraints
- 프로젝트 ref: `vtbprgphfksfffivfnrf`. DDL=MCP `apply_migration`, 검증=`execute_sql`.
- 🔴 `session_attempts.chk_outcome` 허용값 = **`correct`·`wrong`·`skipped`**(넘어감=`skipped`, `skip` 아님). 그 외 값은 23514.
- `session_attempts`: session_id FK→study_sessions(CASCADE), question_id FK→questions, attempt_no default 1.
- 신규 함수: `SECURITY DEFINER`, `SET search_path TO 'public'`, EXECUTE는 public/anon revoke·authenticated grant.
- `record_session_complete`는 오버로드 충돌 방지 위해 기존 `(text,int,int)`를 **drop 후** `(text,int,int,jsonb)`로 재생성(3인자 호출은 default로 흡수). 본문의 기존 기능(세션·daily·스트릭·우표 적립·편지 배달)은 **그대로 보존**.
- 기록=**1차 시도만**(round 1). 2차 재도전 미기록.
- FE 게스트/미인증: 기록 생략·조회 null 반환 → 화면 폴백. `supabase.auth.getUser()` 판별(study.js 패턴).
- FE 루트 `개발/프론트엔드_무스부/tomori-app`. 빌드 `npm run build`, 프리뷰 5599(HMR 아님).
- 🔴 대표님 계정에 학습 데이터를 조작하지 않는다. 로그인 end-to-end는 대표님 확인. 컨트롤러 검증=순수/롤백 SQL + 게스트 폴백.
- 커밋만; push는 대표님 지시 시.

---

### Task 1: BE — 오답노트 스키마 + 기록·조회 RPC

**Files:** MCP 마이그레이션 `wrong_note_graduated_table`, `record_session_complete_v3`, `load_wrong_notes_fn`, `graduate_wrong_note_fn`

**Interfaces:**
- Consumes: `session_attempts`, `study_sessions`, `questions`, `question_choices`, `users_profile`, `grant_stamp`, `deliver_letters`.
- Produces: `wrong_note_graduated` 테이블, `record_session_complete(text,int,int,jsonb)`, `load_wrong_notes()→jsonb`, `graduate_wrong_note(uuid)`.

- [ ] **Step 1: `wrong_note_graduated` 테이블**

`apply_migration` name=`wrong_note_graduated_table`:
```sql
create table if not exists public.wrong_note_graduated (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  graduated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.wrong_note_graduated enable row level security;
create policy "wng_select_own" on public.wrong_note_graduated
  for select using (auth.uid() = user_id);
```

- [ ] **Step 2: `record_session_complete` v3(attempts 기록) — drop 후 재생성**

`apply_migration` name=`record_session_complete_v3`:
```sql
drop function if exists public.record_session_complete(text, integer, integer);
create or replace function public.record_session_complete(p_source text, p_correct integer, p_wrong integer, p_attempts jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_target int; v_completed int; v_is_completed boolean; v_last date; v_streak int;
  v_ds_id uuid; v_stamp_granted boolean; v_session_id uuid; v_att jsonb;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  select daily_session_target, last_studied_on, streak_count
    into v_target, v_last, v_streak
    from public.users_profile where user_id = v_uid;
  if v_target is null then v_target := 1; end if;

  insert into public.study_sessions
    (user_id, source, correct_count, wrong_count, is_offline, verify_status, started_at, finished_at)
  values
    (v_uid, coalesce(p_source,'unknown'), coalesce(p_correct,0), coalesce(p_wrong,0), false, 'trusted', now(), now())
  returning id into v_session_id;

  -- 오답 시도 기록(퀴즈 객관식 1차). outcome CHECK=correct/wrong/skipped.
  if p_attempts is not null and jsonb_typeof(p_attempts) = 'array' then
    for v_att in select value from jsonb_array_elements(p_attempts) loop
      if (v_att->>'question_id') is not null
         and (v_att->>'outcome') in ('correct','wrong','skipped') then
        insert into public.session_attempts(session_id, question_id, attempt_no, is_correct, outcome)
        values (v_session_id, (v_att->>'question_id')::uuid, 1, (v_att->>'is_correct')::boolean, v_att->>'outcome');
      end if;
    end loop;
  end if;

  insert into public.daily_studies
    (user_id, study_date, target_sessions, completed_sessions, is_completed, stamp_granted)
  values (v_uid, v_today, v_target, 1, (1 >= v_target), false)
  on conflict (user_id, study_date) do update
    set completed_sessions = daily_studies.completed_sessions + 1,
        is_completed = (daily_studies.completed_sessions + 1 >= daily_studies.target_sessions);

  select id, completed_sessions, is_completed, stamp_granted
    into v_ds_id, v_completed, v_is_completed, v_stamp_granted
    from public.daily_studies where user_id = v_uid and study_date = v_today;

  if v_is_completed and not v_stamp_granted then
    perform public.grant_stamp(v_uid, 1, 'daily_study',
      'day:'||v_uid::text||':'||v_today::text, 'daily_studies', v_ds_id);
    update public.daily_studies set stamp_granted = true
      where user_id = v_uid and study_date = v_today;
    perform public.deliver_letters(v_uid, v_today);
  end if;

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
end $$;
revoke execute on function public.record_session_complete(text,integer,integer,jsonb) from public, anon;
grant execute on function public.record_session_complete(text,integer,integer,jsonb) to authenticated;
```

- [ ] **Step 3: `load_wrong_notes`·`graduate_wrong_note`**

`apply_migration` name=`load_wrong_notes_fn`:
```sql
create or replace function public.load_wrong_notes()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.last_at desc), '[]'::jsonb) into v_result
  from (
    select a.question_id,
           q.content_key, q.question_type, q.stem_ja, q.stem_ruby, q.explanation,
           (select cc.choice_text from question_choices cc where cc.question_id = a.question_id and cc.is_correct limit 1) as correct_text,
           (select cc.choice_ruby from question_choices cc where cc.question_id = a.question_id and cc.is_correct limit 1) as correct_ruby,
           (array_agg(a.outcome order by a.created_at desc))[1] as latest_outcome,
           count(*) as wrong_count,
           max(a.created_at) as last_at
    from public.session_attempts a
    join public.study_sessions s on s.id = a.session_id
    join public.questions q on q.id = a.question_id
    where s.user_id = v_uid and a.outcome in ('wrong','skipped')
    group by a.question_id, q.content_key, q.question_type, q.stem_ja, q.stem_ruby, q.explanation
    having not exists (
      select 1 from public.wrong_note_graduated g
      where g.user_id = v_uid and g.question_id = a.question_id and g.graduated_at >= max(a.created_at)
    )
  ) x;
  return v_result;
end $$;
revoke execute on function public.load_wrong_notes() from public, anon;
grant execute on function public.load_wrong_notes() to authenticated;
```

`apply_migration` name=`graduate_wrong_note_fn`:
```sql
create or replace function public.graduate_wrong_note(p_question_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.wrong_note_graduated(user_id, question_id)
  values (auth.uid(), p_question_id)
  on conflict (user_id, question_id) do update set graduated_at = now();
end $$;
revoke execute on function public.graduate_wrong_note(uuid) from public, anon;
grant execute on function public.graduate_wrong_note(uuid) to authenticated;
```

- [ ] **Step 4: 검증 — 함수/테이블·집계 로직**

`execute_sql`:
```sql
-- 존재 확인
select proname, pg_get_function_arguments(oid) as args from pg_proc
 where pronamespace='public'::regnamespace and proname in ('record_session_complete','load_wrong_notes','graduate_wrong_note') order by proname;
select count(*) as wng_cols from information_schema.columns where table_schema='public' and table_name='wrong_note_graduated';
-- record_session_complete 오버로드 유일성(3인자 호출 모호성 없음)
select count(*) as rsc_overloads from pg_proc where pronamespace='public'::regnamespace and proname='record_session_complete';
```
Expected: 세 함수 존재(record_session_complete args에 `p_attempts jsonb`), wng_cols=3, rsc_overloads=1(단일).

집계·졸업 필터는 실 FK 데이터가 필요(대표님 계정)하므로 로직은 `load_wrong_notes` 정의로 확인하고 실 end-to-end는 이월. 순수 확인용: outcome 필터·날짜 졸업 조건이 정의에 포함됨을 리뷰로 확인.

- [ ] **Step 5: 커밋** (원격 DB만 — 로컬 파일 없음. 실행·검증 로그를 리포트에 기록.)

---

### Task 2: FE — question_id 배선 + 데이터 계층

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/data/vocab.js`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/data/study.js`
- Create: `개발/프론트엔드_무스부/tomori-app/src/data/wrongNotes.js`

**Interfaces:**
- Consumes: `record_session_complete`(v3)·`load_wrong_notes`·`graduate_wrong_note` RPC(Task 1), `supabaseClient`.
- Produces: 카드 `question.id`, `recordSessionComplete(source,correct,wrong,attempts)`, `loadWrongNotes()`, `graduateWrongNote(id)`.

- [ ] **Step 1: `vocab.js` — questions select에 `id` 추가 + VM**

`loadReading`(현재 L201-203)·`loadListening`(현재 L230-232)의 questions `.select(...)` 문자열 맨 앞에 `id, `를 추가:
```
.select('id, content_key, target_item_key, stem_ja, stem_ruby, explanation, question_choices(seq, choice_text, choice_ruby, is_correct)')
```
그리고 `questionVM`(L276-282) 반환 객체에 `id`:
```js
return { id: q.id || null, stem: rubyOr(q.stem_ruby, q.stem_ja), explanation: q.explanation || '', choices };
```

- [ ] **Step 2: `study.js` — recordSessionComplete에 attempts 인자**

```js
export async function recordSessionComplete(source, correct, wrong, attempts = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('record_session_complete', {
    p_source: source, p_correct: correct | 0, p_wrong: wrong | 0,
    p_attempts: Array.isArray(attempts) ? attempts : [],
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: `data/wrongNotes.js` 작성**

```js
// 오답노트 실데이터(로그인 시). 게스트면 null(또는 no-op) → 화면 폴백.
import { supabase } from './supabaseClient';

// [{ question_id, content_key, question_type, stem_ja, stem_ruby, explanation,
//    correct_text, correct_ruby, latest_outcome, wrong_count, last_at }] | null
export async function loadWrongNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_wrong_notes');
  if (error) return null;
  return data;
}

// "이제 알아요" — 졸업 처리. 게스트면 no-op.
export async function graduateWrongNote(questionId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('graduate_wrong_note', { p_question_id: questionId });
}
```

- [ ] **Step 4: 빌드**

Run(`tomori-app`): `npm run build` → 성공.

- [ ] **Step 5: 커밋**
```bash
git add 개발/프론트엔드_무스부/tomori-app/src/data/vocab.js 개발/프론트엔드_무스부/tomori-app/src/data/study.js 개발/프론트엔드_무스부/tomori-app/src/data/wrongNotes.js
git commit -m "feat(wrongnote): FE 오답 기록 데이터 계층(question id·attempts·loadWrongNotes)"
```

---

### Task 3: FE — QuizScreen 시도 수집·전달

**Files:** Modify `개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx`

**Interfaces:**
- Consumes: `recordSessionComplete`(Task 2, attempts 인자)·`card.question.id`(Task 2).
- Produces: 세션 완료 시 1차 시도 배열이 DoneView 경유로 기록됨.

- [ ] **Step 1: 1차 시도 수집**

QuizScreen 상단에 `const attemptsRef = useRef([]);` 추가. `submit()`·`skip()`에서 **round === 1일 때만** 기록:
- submit: `if (round === 1 && q && card.question?.id) attemptsRef.current.push({ question_id: card.question.id, outcome: ok ? 'correct' : 'wrong', is_correct: ok });`
- skip: `if (round === 1 && card.question?.id) attemptsRef.current.push({ question_id: card.question.id, outcome: 'skipped', is_correct: false });`
- `onRestart`(재시작)에서 `attemptsRef.current = [];`로 리셋(setRound(1) 옆).

- [ ] **Step 2: DoneView에 attempts 전달**

`DoneView` 호출(현재 L102-)에 `attempts={attemptsRef.current}` 추가. (DoneView는 Task 4에서 attempts를 recordSessionComplete로 넘기도록 확장 — 순서상 이 태스크가 먼저면 prop만 넘기고 소비는 Task 4에서. **아래 순서 주의**: DoneView 확장(Task 4 Step 0)과 이 prop 전달이 짝.)

- [ ] **Step 3: 빌드 + 커밋**

Run: `npm run build` → 성공.
```bash
git add 개발/프론트엔드_무스부/tomori-app/src/screens/QuizScreen.jsx
git commit -m "feat(wrongnote): QuizScreen 1차 시도 수집→DoneView 전달"
```

---

### Task 4: FE — DoneView attempts 소비 + 오답노트 화면·라우트·MY 진입

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx` (DoneView)
- Create: `개발/프론트엔드_무스부/tomori-app/src/screens/WrongNoteScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/App.jsx` (라우트 `wrongNote`)
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx` (보관함 › 오답노트)

**Interfaces:**
- Consumes: `loadWrongNotes`·`graduateWrongNote`(Task 2), `Ruby`, `Tomo`, `Icon`.
- Produces: 오답노트 모아보기 화면, 기록 훅이 attempts를 실제로 전달.

- [ ] **Step 0: DoneView가 attempts를 recordSessionComplete로 전달**

`WordCardScreen.jsx`의 `DoneView`에 `attempts` prop 추가(기본 `[]`), 기록 훅을 `recordSessionComplete(source, known, Math.max(0,total-known), attempts).catch(()=>{})`로. 단어·문법 호출은 attempts 미전달→`[]`(무회귀).

- [ ] **Step 1: `WrongNoteScreen.jsx` 작성**

편지함(`LetterBoxScreen`) 구조를 참고한 목록 화면:
- `const [notes, setNotes] = useState(null); useEffect(() => { loadWrongNotes().then(setNotes).catch(() => setNotes(null)); }, []);`
- `notes == null`(게스트/실패): 로그인 안내 or 담담한 빈 상태(토모 `sit`, "로그인하면 오답노트가 모여요"). `notes.length === 0`: 빈 상태("아직 오답노트가 비어 있어요 · 틀린 문제가 여기 모여요").
- 목록 항목(문항별): **배지** latest_outcome `wrong`→`✕`·`skipped`→`⤼`(색은 error 아님, 중립 톤 — PRD 8.6 감정 배제), **질문** `<Ruby>`(stem_ruby→base/ruby, 후리가나 기본 ON), **정답** `correct_text`(+correct_ruby 후리가나), 탭 시 **해설**(explanation) 펼침, 우측 하단 「이제 알아요」 고스트 버튼.
- 「이제 알아요」→ `graduateWrongNote(question_id)` 후 로컬 목록에서 제거(`setNotes(n => n.filter(x => x.question_id !== id))`).
- stem_ruby/correct_ruby는 `{base, ruby}` 좌표(Ruby 렌더러용). 값이 없으면 평문(stem_ja/correct_text) 폴백.

- [ ] **Step 2: App.jsx 라우트**

`name === 'wrongNote' ? <WrongNoteScreen nav={nav} /> : ...` 분기 추가, `import WrongNoteScreen from './screens/WrongNoteScreen';`.

- [ ] **Step 3: MyScreen 진입**

「보관함」 그룹에 「오답노트」 행 추가(편지함과 같은 그룹) → `nav.push('wrongNote')`. 편지함 메뉴 패턴 그대로.

- [ ] **Step 4: 빌드 + 프리뷰 게스트 검증**

Run: `npm run build` → 성공. 컨트롤러가 프리뷰(5599)에서 ①게스트 퀴즈 완주 시 콘솔·네트워크 오류 없음(게스트=기록 생략), ②MY→오답노트 게스트 화면(빈/안내) 정상 렌더 확인. 로그인 실데이터는 대표님 이월.

- [ ] **Step 5: 커밋**
```bash
git add 개발/프론트엔드_무스부/tomori-app/src/screens/WordCardScreen.jsx 개발/프론트엔드_무스부/tomori-app/src/screens/WrongNoteScreen.jsx 개발/프론트엔드_무스부/tomori-app/src/App.jsx 개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx
git commit -m "feat(wrongnote): 오답노트 모아보기 화면·라우트·MY 진입 + DoneView attempts 소비"
```

---

### Task 5: 문서 정합

**Files:** Modify `기획/진행상태.md`, (선택) `기획/PRD.md`

- [ ] **Step 1: `진행상태.md`에 C 완료 기록** — 완료(기록 배선·모아보기 화면·졸업), 결정·이유(퀴즈만·1차만·졸업 테이블 날짜인지), 🔴 outcome=skipped 함정, 미해결(요약 오답분·PDF 따라쓰기·플래시카드 vocab_states·대표님 로그인 end-to-end), 확인 방법.
- [ ] **Step 2: (선택) PRD 47 각주** — 구현 위치(`load_wrong_notes`·`wrong_note_graduated`)·outcome 매핑 1줄.
- [ ] **Step 3: 커밋**
```bash
git add 기획/진행상태.md 기획/PRD.md
git commit -m "docs(wrongnote): 서브프로젝트 C(오답노트 기록+모아보기) 배선 완료 기록"
```

---

## Self-Review
- **스펙 커버리지:** 기록(T1 record v3 + T2 vocab id + T3 수집 + T4 DoneView)·모아보기(T1 load_wrong_notes + T4 화면)·졸업(T1 graduate + wrong_note_graduated + T4 버튼)·MY 진입(T4)·문서(T5). 전부 매핑.
- **플레이스홀더:** 없음(SQL·JS 실코드).
- **타입 일관성:** outcome ∈ correct/wrong/skipped(CHECK 준수). record_session_complete 3인자 호출은 drop+4인자 default로 흡수(오버로드 유일). attempts 원소 키(question_id/outcome/is_correct) = QuizScreen 수집 = record 삽입 = 일치. load_wrong_notes 반환키 = wrongNotes.js 주석 = WrongNoteScreen 소비 일치. 졸업 필터 `graduated_at >= max(created_at)` = 스펙의 "졸업 후 또 틀리면 재등장".
- **순서 주의:** DoneView attempts 소비(T4 Step0)와 QuizScreen prop 전달(T3 Step2)은 짝 — T3에서 prop만 넘기고 T4에서 소비. 둘 다 머지돼야 기록이 흐름(중간 상태에선 attempts 무시될 뿐 무해).

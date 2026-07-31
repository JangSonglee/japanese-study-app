# 우표 적립 + 편지 마일스톤 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "학습한 하루"마다 우표 1장을 실제 적립하고, 우표가 마일스톤(첫 3장·이후 14장)에 닿으면 토모의 편지가 실제 배달되어 홈 위젯·편지함에 실데이터로 반영한다.

**Architecture:** BE는 기존 `record_session_complete` RPC(서브프로젝트 A)를 확장해 하루 첫 완료 시 `grant_stamp`를 부르고 `deliver_letters` 헬퍼로 편지를 배달한다. 배달 기록은 새 `user_letters` 테이블에. 편지 상수는 `app_configs`에 두고 `load_stamp_state` RPC가 표시값을 계산해 반환하므로 FE는 상수 계산 없이 렌더만 한다. FE는 스트릭(`study.js`)과 동일한 게스트→null→데모 폴백 패턴.

**Tech Stack:** Supabase Postgres(plpgsql, SECURITY DEFINER, RLS), Supabase MCP(마이그레이션·검증), React Native Web + Vite(FE), `@supabase/supabase-js`.

## Global Constraints
- 프로젝트 ref: `vtbprgphfksfffivfnrf`. DDL은 MCP `apply_migration`, 조회·검증은 MCP `execute_sql`.
- 모든 신규 함수: `SECURITY DEFINER`, `SET search_path TO 'public'`. EXECUTE는 `public`·`anon`에서 revoke, `authenticated`에 grant.
- 편지 상수: `letters.milestone_first=3`, `letters.milestone_interval=14`, `letters.total_available=2`. `threshold(k)=first+interval*(k-1)` → k=1:3, k=2:17.
- 적립 멱등: 하루 1키 `'day:'||user||':'||date` + `daily_studies.stamp_granted` 플래그 이중 방어. 같은 날 여러 세션 완료해도 우표 1장.
- `app_configs.value`는 jsonb. 정수 추출은 `(value#>>'{}')::int`.
- FE 게스트/미인증: 데이터 함수는 `null` 반환(또는 no-op) → 화면 데모 폴백. `supabase.auth.getUser()`로 판별(스트릭 `study.js` 패턴).
- FE 작업 디렉터리: `개발/프론트엔드_무스부/tomori-app`. 빌드 `npm run build`, 프리뷰 포트 5599(HMR 아님).
- 🔴 대표님 계정에 학습 데이터를 조작하지 않는다. 로그인 end-to-end는 대표님이 확인. 컨트롤러 검증은 임시 uid로 SQL 스팟 체크 + 게스트 데모 폴백 확인까지.
- 커밋만; push는 대표님이 지시할 때.

---

### Task 1: BE — `user_letters` 테이블 + 편지 상수

**Files:**
- MCP 마이그레이션: `user_letters_table`, `letters_config_seed`

**Interfaces:**
- Produces: `public.user_letters(id, user_id, letter_seq, delivered_on, read_at, created_at)` with `unique(user_id, letter_seq)`, RLS select-own. `app_configs`에 편지 상수 3개.

- [ ] **Step 1: `user_letters` 테이블 마이그레이션 적용**

`apply_migration` name=`user_letters_table`:
```sql
create table if not exists public.user_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  letter_seq int not null,
  delivered_on date not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, letter_seq)
);
alter table public.user_letters enable row level security;
create policy "user_letters_select_own" on public.user_letters
  for select using (auth.uid() = user_id);
-- insert/update는 SECURITY DEFINER RPC로만. 직접 쓰기 정책 없음(select-only).
```

- [ ] **Step 2: 편지 상수 시드 마이그레이션 적용**

`apply_migration` name=`letters_config_seed`:
```sql
insert into public.app_configs(key, value) values
  ('letters.milestone_first', '3'::jsonb),
  ('letters.milestone_interval', '14'::jsonb),
  ('letters.total_available', '2'::jsonb)
on conflict (key) do update set value = excluded.value;
```

- [ ] **Step 3: 검증 — 테이블·정책·상수 확인**

`execute_sql`:
```sql
select count(*) as cols from information_schema.columns where table_schema='public' and table_name='user_letters';
select polname from pg_policies where tablename='user_letters';
select key, (value#>>'{}')::int as v from app_configs where key like 'letters.%' order by key;
```
Expected: cols=6, 정책 `user_letters_select_own` 존재, 상수 3개(3·14·2).

- [ ] **Step 4: 커밋** (마이그레이션은 원격 DB에 적용됨 — 로컬엔 문서만; 이 태스크는 커밋할 로컬 파일 없음. 실행 로그를 리포트에 남기고 다음 태스크로.)

---

### Task 2: BE — 적립·배달·조회 RPC

**Files:**
- MCP 마이그레이션: `deliver_letters_fn`, `record_session_complete_v2`, `load_stamp_state_fn`, `mark_letter_read_fn`

**Interfaces:**
- Consumes: `grant_stamp(uuid,int,text,text,text,uuid)`, `stamp_balances`, `daily_studies`, `user_letters`(Task 1), `app_configs` 편지 상수(Task 1).
- Produces: `deliver_letters(uuid,date)`, 확장된 `record_session_complete(text,int,int)`, `load_stamp_state()→jsonb`, `mark_letter_read(int)`.

- [ ] **Step 1: `deliver_letters` 헬퍼 적용**

`apply_migration` name=`deliver_letters_fn`:
```sql
create or replace function public.deliver_letters(p_user uuid, p_today date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_first int := (select (value#>>'{}')::int from app_configs where key='letters.milestone_first');
  v_interval int := (select (value#>>'{}')::int from app_configs where key='letters.milestone_interval');
  v_total int := (select (value#>>'{}')::int from app_configs where key='letters.total_available');
  v_balance int := (select coalesce(balance,0) from stamp_balances where user_id = p_user);
  v_delivered int := (select count(*) from user_letters where user_id = p_user);
  v_threshold int;
begin
  loop
    exit when v_delivered >= coalesce(v_total,0);
    v_threshold := v_first + v_interval * v_delivered;  -- threshold((delivered)+1)
    exit when v_balance < v_threshold;
    insert into user_letters(user_id, letter_seq, delivered_on)
      values (p_user, v_delivered + 1, p_today)
      on conflict (user_id, letter_seq) do nothing;
    v_delivered := v_delivered + 1;
  end loop;
end $$;
revoke execute on function public.deliver_letters(uuid,date) from public, anon;
grant execute on function public.deliver_letters(uuid,date) to authenticated;
```

- [ ] **Step 2: `record_session_complete` 확장(우표 적립+편지 배달) 적용**

`apply_migration` name=`record_session_complete_v2`. 기존 본문에 `stamp_granted`·`id` 조회와 적립 블록을 추가한 전체 교체:
```sql
create or replace function public.record_session_complete(p_source text, p_correct integer, p_wrong integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_target int; v_completed int; v_is_completed boolean; v_last date; v_streak int;
  v_ds_id uuid; v_stamp_granted boolean;
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

  select id, completed_sessions, is_completed, stamp_granted
    into v_ds_id, v_completed, v_is_completed, v_stamp_granted
    from public.daily_studies where user_id = v_uid and study_date = v_today;

  -- 우표 적립: 그날 처음 완료 시 1장 + 편지 배달 검사
  if v_is_completed and not v_stamp_granted then
    perform public.grant_stamp(v_uid, 1, 'daily_complete',
      'day:'||v_uid::text||':'||v_today::text, 'daily_studies', v_ds_id);
    update public.daily_studies set stamp_granted = true
      where user_id = v_uid and study_date = v_today;
    perform public.deliver_letters(v_uid, v_today);
  end if;

  -- 스트릭
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
```
(EXECUTE 권한은 기존 함수에서 유지됨 — 시그니처 동일. 필요 시 재적용:
`revoke execute on function public.record_session_complete(text,integer,integer) from public, anon; grant execute on function public.record_session_complete(text,integer,integer) to authenticated;`)

- [ ] **Step 3: `load_stamp_state`·`mark_letter_read` 적용**

`apply_migration` name=`load_stamp_state_fn`:
```sql
create or replace function public.load_stamp_state()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_first int; v_interval int; v_total int;
  v_balance int; v_delivered int; v_unread int;
  v_prev int; v_next int; v_have int; v_need int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select (value#>>'{}')::int into v_first from app_configs where key='letters.milestone_first';
  select (value#>>'{}')::int into v_interval from app_configs where key='letters.milestone_interval';
  select (value#>>'{}')::int into v_total from app_configs where key='letters.total_available';
  v_balance := (select coalesce(balance,0) from stamp_balances where user_id=v_uid);
  v_delivered := (select count(*) from user_letters where user_id=v_uid);
  select max(letter_seq) into v_unread from user_letters where user_id=v_uid and read_at is null;
  if v_delivered >= coalesce(v_total,0) then
    v_have := null; v_need := null;
  else
    v_prev := case when v_delivered=0 then 0 else v_first + v_interval*(v_delivered-1) end;
    v_next := v_first + v_interval*v_delivered;
    v_have := greatest(0, v_balance - v_prev);
    v_need := v_next - v_prev;
  end if;
  return jsonb_build_object(
    'balance', v_balance, 'delivered', v_delivered,
    'cycle_have', v_have, 'cycle_need', v_need, 'newest_unread_seq', v_unread);
end $$;
revoke execute on function public.load_stamp_state() from public, anon;
grant execute on function public.load_stamp_state() to authenticated;
```

`apply_migration` name=`mark_letter_read_fn`:
```sql
create or replace function public.mark_letter_read(p_seq int)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update user_letters set read_at = now()
    where user_id = auth.uid() and letter_seq = p_seq and read_at is null;
end $$;
revoke execute on function public.mark_letter_read(int) from public, anon;
grant execute on function public.mark_letter_read(int) to authenticated;
```

- [ ] **Step 4: 검증 — 임시 uid로 적립·배달·조회 시뮬레이션**

`execute_sql` (트랜잭션 롤백으로 실데이터 오염 없이):
```sql
do $$
declare u uuid := gen_random_uuid(); s jsonb;
begin
  -- 잔액 3 도달까지 grant 3회 → 첫 편지 배달돼야
  perform grant_stamp(u,1,'test','t:'||u||':1'); 
  perform grant_stamp(u,1,'test','t:'||u||':2');
  perform grant_stamp(u,1,'test','t:'||u||':3');
  perform deliver_letters(u, current_date);
  raise notice 'delivered after 3 = %', (select count(*) from user_letters where user_id=u); -- 1
  -- 14 더(총 17) → 둘째 편지
  for i in 4..17 loop perform grant_stamp(u,1,'test','t:'||u||':'||i); end loop;
  perform deliver_letters(u, current_date);
  raise notice 'delivered after 17 = %', (select count(*) from user_letters where user_id=u); -- 2
  -- total_available=2 상한 → 더 줘도 안 늘어야
  for i in 18..40 loop perform grant_stamp(u,1,'test','t:'||u||':'||i); end loop;
  perform deliver_letters(u, current_date);
  raise notice 'delivered after 40 (cap 2) = %', (select count(*) from user_letters where user_id=u); -- 2
  raise exception 'rollback test';
exception when others then
  if sqlerrm <> 'rollback test' then raise; end if;
end $$;
```
Expected NOTICE: delivered 1, 2, 2. (에러 'rollback test'로 전체 롤백 → 실데이터 무변화.)

- [ ] **Step 5: 커밋** (원격 DB 적용 — 로컬 파일 없음. 실행·검증 로그를 리포트에 기록.)

---

### Task 3: FE — 우표 데이터 계층

**Files:**
- Create: `개발/프론트엔드_무스부/tomori-app/src/data/stamps.js`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/data/letters.js` (getLetterBySeq 추가)

**Interfaces:**
- Consumes: `load_stamp_state`·`mark_letter_read` RPC(Task 2), `user_letters` select(Task 1), `supabaseClient`.
- Produces: `loadStampState()`, `markLetterRead(seq)`, `loadDeliveredLetters()`, `getLetterBySeq(seq)`.

- [ ] **Step 1: `data/stamps.js` 작성**

```js
// 우표·편지 실데이터(로그인 시). 서버 RPC가 마일스톤 표시값을 계산해 반환.
// 게스트/미인증이면 null(또는 no-op) → 화면이 데모로 폴백(스트릭 study.js와 동일).
import { supabase } from './supabaseClient';

// { balance, delivered, cycle_have, cycle_need, newest_unread_seq } | null
export async function loadStampState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_stamp_state');
  if (error) return null;
  return data;
}

// 편지 열람 시 도착 배지 해제. 게스트면 no-op.
export async function markLetterRead(seq) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('mark_letter_read', { p_seq: seq });
}

// 배달된 편지 목록(seq·도착일·읽음). 게스트면 null. seq 내림차순.
export async function loadDeliveredLetters() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_letters')
    .select('letter_seq, delivered_on, read_at')
    .order('letter_seq', { ascending: false });
  if (error) return null;
  return data;
}
```

- [ ] **Step 2: `letters.js`에 `getLetterBySeq` 추가**

파일 끝(getLetter 아래)에:
```js
export function getLetterBySeq(seq) {
  return LETTERS.find((l) => l.seq === seq) || null;
}
```

- [ ] **Step 3: 빌드 확인**

Run(작업 디렉터리 `tomori-app`): `npm run build`
Expected: 성공(신규 모듈 import 오류 없음).

- [ ] **Step 4: 커밋**
```bash
git add 개발/프론트엔드_무스부/tomori-app/src/data/stamps.js 개발/프론트엔드_무스부/tomori-app/src/data/letters.js
git commit -m "feat(stamp): FE 우표·편지 데이터 계층(loadStampState/markLetterRead/배달목록)"
```

---

### Task 4: FE — 홈 우표 위젯·편지함·편지 상세 실데이터

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/LetterBoxScreen.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx`

**Interfaces:**
- Consumes: `loadStampState`, `loadDeliveredLetters`, `markLetterRead`(Task 3), `getLetterBySeq`(Task 3).
- Produces: 실데이터 홈 위젯·편지함·읽음 처리. 게스트는 데모 유지.

- [ ] **Step 1: 홈 우표 위젯 실데이터 배선 (`HomeScreen.jsx`)**

스트릭과 동일 패턴. `loadStreak` import 옆에 `import { loadStampState } from '../data/stamps';` 추가. 스트릭 state 근처에:
```jsx
const [stamp, setStamp] = useState(null);
useEffect(() => { loadStampState().then(setStamp).catch(() => setStamp(null)); }, []);
```
우표/편지 위젯 렌더에서 실데이터 우선, 없으면 데모:
- `const hasStamp = stamp != null;`
- 편지 도착 배지: `const letterWaiting = hasStamp ? (stamp.newest_unread_seq != null) : D.letterWaiting;`
- 배달 편지 seq: `const newestSeq = hasStamp ? stamp.newest_unread_seq : D.newestLetterId 대응 seq;` → onPress에서 `nav.push('letter', { seq: newestSeq })` (LetterScreen이 seq를 받도록 Step 3에서 정리; 데모 경로는 기존 id 유지).
- "모은 우표" 수치: 실데이터면 `stamp.cycle_have` / `stamp.cycle_need`, 진행바 `cycle_have/cycle_need`, "다음 편지까지 `cycle_need - cycle_have`장". `cycle_need == null`(더 배달할 편지 없음)이면 "다음 편지 준비 중"으로 표기하고 탭 시 편지함.
- 게스트/`stamp==null`이면 기존 `D.stamp.have/need`·`D.letterWaiting` 그대로.

주의: 기존 데모 분기(`D.letterWaiting ? … : …`)를 실데이터 변수로 치환하되, 게스트 폴백을 깨지 않도록 위 파생 변수만 갈아끼운다.

- [ ] **Step 2: 편지함 실데이터 (`LetterBoxScreen.jsx`)**

`loadDeliveredLetters()`로 배달 목록을 받아 `getLetterBySeq(seq)` 콘텐츠와 조인해 렌더. 도착일=`delivered_on`, 안읽음=`read_at == null`. `null`(게스트)이면 기존 데모 목록 유지.
```jsx
const [delivered, setDelivered] = useState(null);
useEffect(() => { loadDeliveredLetters().then(setDelivered).catch(() => setDelivered(null)); }, []);
// delivered != null 이면 delivered.map(d => { const c = getLetterBySeq(d.letter_seq); … 도착일 d.delivered_on, unread !d.read_at }) 로 목록 구성
// delivered == null 이면 기존 LETTERS 데모 목록
```
항목 탭 시 `nav.push('letter', { seq })`.

- [ ] **Step 3: 편지 열람 시 읽음 처리 (`LetterScreen.jsx`)**

seq로 콘텐츠를 찾도록 정리: props가 `seq`면 `getLetterBySeq(seq)`, 기존 `id`면 `getLetter(id)`(데모 하위호환). 편지 표시 후:
```jsx
useEffect(() => { if (seq != null) markLetterRead(seq); }, [seq]);
```
`import { markLetterRead } from '../data/stamps'; import { getLetterBySeq } from '../data/letters';` 추가. 본문·후리가나·해석·답장(LetterReply)은 기존 그대로.

- [ ] **Step 4: 빌드 + 프리뷰 게스트 폴백 확인**

Run(`tomori-app`): `npm run build`
그다음 컨트롤러가 프리뷰(5599)에서 홈·편지함이 **게스트 데모로 정상 렌더**되고 콘솔/네트워크 오류 없음을 확인(로그인 실데이터는 대표님 몫). Expected: 빌드 성공, 게스트 화면 정상.

- [ ] **Step 5: 커밋**
```bash
git add 개발/프론트엔드_무스부/tomori-app/src/screens/HomeScreen.jsx 개발/프론트엔드_무스부/tomori-app/src/screens/LetterBoxScreen.jsx 개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx
git commit -m "feat(stamp): 홈 우표 위젯·편지함·편지 열람 읽음처리 실데이터(게스트 데모 폴백)"
```

---

### Task 5: 문서 정합

**Files:**
- Modify: `기획/진행상태.md`
- Modify: `기획/PRD.md` (필요 시 12.2에 배선 완료·상수 위치 각주)

**Interfaces:**
- Consumes: Task 1–4 결과.

- [ ] **Step 1: `진행상태.md`에 B 완료 기록**

서브프로젝트 B 항목: 완료한 것(적립 배선·마일스톤·`user_letters`·`load_stamp_state`·홈/편지함 실데이터), 미해결(편지 문안 seq 3+ 별도, 옛 소비모델 config 잔재 정리 별도, 대표님 로그인 end-to-end 확인), 이유(엔진만 배선·콘텐츠 분리, user_letters 채택). 확인 방법(FE 빌드·프리뷰 5599, MCP).

- [ ] **Step 2: PRD 12.2 각주(선택)**

상수 원본이 `app_configs`(`letters.milestone_first/interval/total_available`)이고 표시값은 `load_stamp_state`가 계산함을 12.2에 1줄 각주로 남긴다(구현-문서 드리프트 방지).

- [ ] **Step 3: 커밋**
```bash
git add 기획/진행상태.md 기획/PRD.md
git commit -m "docs(stamp): 서브프로젝트 B(우표 적립+편지 마일스톤) 배선 완료 기록"
```

---

## Self-Review
- **스펙 커버리지:** 적립(T2)·마일스톤 엔진(T2 deliver_letters)·user_letters(T1)·상수 app_configs(T1)·load_stamp_state/mark_letter_read(T2)·FE 데이터(T3)·홈/편지함/열람(T4)·문서(T5) — 스펙 항목 전부 태스크에 매핑됨.
- **플레이스홀더:** 없음(모든 SQL·JS 실코드 포함).
- **타입 일관성:** `threshold(k)=first+interval*(k-1)`; deliver의 `v_threshold=first+interval*v_delivered`는 (delivered+1)번째=threshold(delivered+1) 동일식. load의 prev=`delivered==0?0:first+interval*(delivered-1)`, next=`first+interval*delivered` 일치. RPC 시그니처(`record_session_complete(text,int,int)`) 불변(권한 유지). FE 반환키(balance/delivered/cycle_have/cycle_need/newest_unread_seq)와 홈 위젯 소비 일치.

# 토모리 — RLS 정책 초안 (v1.1 / 2026-07-24)

> 작성: 도다이(BE)
> 전제: Supabase(PostgreSQL). 클라이언트는 `anon`/`authenticated` 역할로 붙고, `auth.uid()`가 로그인 유저의 uuid를 준다.
> 기준: `스키마_설계.md` v1.1 6.1(오프라인 우표 조작방지) · `schema.sql`

## 0. 세 부류로 나뉜다

| 부류 | 테이블 | 정책 요지 |
|---|---|---|
| **A. 사용자 데이터** | `users_profile` `daily_studies` `study_sessions` `session_attempts` `vocab_states` `track_progress` `reading_progress` `stamp_balances` (+ Phase2: 설정·오답노트·단어장·구독·오프라인) | **본인 것만** read/write. `user_id = auth.uid()` |
| **B. 우표 원장** | `stamp_ledger` | 🔴 **본인 것 read만.** insert/update/delete는 **앱이 전혀 못 한다** — 서버 함수(SECURITY DEFINER)로만 발급 |
| **C. 콘텐츠 마스터** | `courses` `course_levels` `course_tracks` `lessons` `vocab_items` `expression_items` `grammar_items` `listening_items` `listening_lines` `reading_texts` `reading_sentences` `tips` `questions` `question_choices` `app_configs` | **전체 read-only.** 단 `is_published=false`는 숨김. 쓰기는 서비스 롤(콘텐츠 배포)만 |

**대원칙**: 모든 테이블에 `enable row level security`를 켠다. RLS를 켜고 정책이 없으면 **기본 거부**다 — 정책을 깜빡한 테이블이 열려 있는 사고를 원천 차단한다.

---

## A. 사용자 데이터 — 본인 것만

패턴 하나로 끝난다. `user_id`가 있는 테이블 전부에 동일 적용.

```sql
alter table study_sessions enable row level security;

create policy sess_select on study_sessions
  for select using (user_id = auth.uid());

create policy sess_insert on study_sessions
  for insert with check (user_id = auth.uid());

create policy sess_update on study_sessions
  for update using (user_id = auth.uid())
              with check (user_id = auth.uid());
-- delete 정책은 두지 않는다(= 기본 거부). 학습 기록은 사용자가 지우지 않는다.
```

- `using`은 **읽을 수 있는 행**, `with check`는 **쓸 수 있는 행**. insert가 남의 `user_id`로 못 들어오게 `with check`가 필수다.
- 자식 테이블(`session_attempts`)은 `user_id`가 없다 → 부모(`study_sessions`)를 통해 소유 확인:

```sql
create policy attempt_all on session_attempts
  for all using (exists (
    select 1 from study_sessions s
    where s.id = session_attempts.session_id and s.user_id = auth.uid()));
```

- 같은 부모-경유 패턴 대상: `session_attempts`(→`study_sessions`).
- `stamp_balances`는 A에 속하지만 **읽기만** 열고 쓰기는 막는다(원장 재계산 캐시라 서버가 갱신). → B와 함께 관리.

> ⭐ **`daily_studies.stamp_granted` 를 앱이 못 바꾸게** 하는 게 핵심이다. 이 테이블은 A(본인 read/write)지만, `stamp_granted`·`is_completed`를 앱이 바꾸면 우표를 스스로 찍는 셈이 된다. → **B의 서버 함수 안에서만** 이 두 컬럼을 갱신하고, 앱의 update 정책은 이 컬럼을 제외한다(컬럼 단위 제한은 `GRANT UPDATE(col,...)` 또는 서버 경유 쓰기로 강제).

---

## B. 우표 원장 — 🔴 앱은 insert 불가, 서버 함수로만 발급

오프라인 우표 조작방지의 뼈대다(스키마_설계 6.1). **로컬은 잔액을 못 만진다**를 RLS로 못 박는다.

```sql
alter table stamp_ledger enable row level security;

-- 읽기: 본인 원장만 (CS·내역 화면)
create policy ledger_select on stamp_ledger
  for select using (user_id = auth.uid());

-- 🔴 insert/update/delete 정책을 아무것도 만들지 않는다 → authenticated 역할은 전면 거부.
--    앱은 어떤 경로로도 원장에 직접 쓰지 못한다.
```

발급은 **SECURITY DEFINER 함수**로만 한다. 함수는 소유자(서비스 롤) 권한으로 실행되어 RLS를 통과한다.

```sql
create or replace function grant_stamp(
  p_user uuid, p_delta int, p_reason text, p_idem text,
  p_ref_type text default null, p_ref_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 멱등: 같은 키면 조용히 무시(네트워크 재시도·구독 월증정 중복 방지)
  insert into stamp_ledger(user_id, delta, reason, ref_type, ref_id, idempotency_key)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref_id, p_idem)
  on conflict (idempotency_key) do nothing;

  -- 읽기 캐시 갱신 (진실은 언제나 원장)
  insert into stamp_balances(user_id, balance)
  values (p_user, (select coalesce(sum(delta),0) from stamp_ledger where user_id = p_user))
  on conflict (user_id) do update set balance = excluded.balance, updated_at = now();
end $$;

revoke all on function grant_stamp(uuid,int,text,text,text,uuid) from public, anon, authenticated;
-- 이 함수는 Edge Function/서버(서비스 롤)에서만 호출. 클라이언트에 execute 권한을 주지 않는다.
```

**왜 이 구조인가**
- 온라인 학습 완료: 서버가 `daily_studies`를 검증한 뒤 `grant_stamp(uid, +1, 'daily_study', 'user:{uid}:daily:2026-07-22')`.
- 오프라인 학습: 앱은 로그만 큐에 쌓고 화면엔 "도착 예정". 온라인 복귀 시 서버가 검증 5규칙(스키마_설계 6.1: 미리받은 범위·서버시간·하루 1장·최소소요·7일 소급)을 돌린 뒤 `grant_stamp(uid, +1, 'daily_study_offline', …)`.
- 구독 월증정: 갱신 훅에서 `grant_stamp(uid, +350, 'subscription_grant', 'user:{uid}:grant:2026-07')`. 멱등키가 매달 한 번만 통과시킨다.
- 🔴 **소비(-)도 서버만**: PDF 발행은 우표를 차감하므로 발행 처리도 `grant_stamp(uid, -7, 'export_summary', …)`처럼 서버에서. 앱이 직접 음수 delta를 못 넣으니 무료 발행 조작이 불가능하다.

> `stamp_balances`도 앱에는 select만 열고 write는 막는다. 위 함수가 유일한 갱신 경로다.

---

## C. 콘텐츠 마스터 — read-only, 미공개 숨김

```sql
alter table vocab_items enable row level security;

create policy vocab_public_read on vocab_items
  for select using (is_published = true);
-- insert/update/delete 정책 없음 → 서비스 롤(콘텐츠 배포 파이프라인)만 쓴다.
```

- **모든 콘텐츠 마스터 테이블에 동일 패턴** (`is_published = true`인 행만 select).
- 🔴 **`is_locked`가 아니라 `is_published`다**(스키마_설계 규칙2). false는 *자격 판단으로 막는 것*이 아니라 *아직 안 만들어 아예 안 보이는 것*. RLS가 "숨김"을 강제하므로 앱이 실수로 미공개 콘텐츠를 불러올 수 없다.
- 자식 테이블(`reading_sentences` `listening_lines` `question_choices`)은 부모의 `is_published`를 따라간다:

```sql
create policy sent_read on reading_sentences
  for select using (exists (
    select 1 from reading_texts t
    where t.id = reading_sentences.text_id and t.is_published = true));
```

- `app_configs`: 앱이 밸런싱 수치(세션 분량 등)를 읽어야 하므로 **select 전체 허용**, 쓰기 금지. 민감값을 넣지 않는다(넣게 되면 config를 공개/비공개로 분리).

---

## 요약 표

| 테이블군 | select | insert/update | delete |
|---|---|---|---|
| 사용자 데이터(user_id) | 본인만 | 본인만(`with check`) | 없음(거부) |
| `daily_studies` | 본인만 | 본인만, 단 `stamp_granted`/`is_completed`는 서버만 | 없음 |
| `stamp_ledger` | 본인만 | 🔴 **전면 거부** → `grant_stamp()` SECURITY DEFINER | 거부 |
| `stamp_balances` | 본인만 | 서버만 | 거부 |
| 콘텐츠 마스터 | `is_published=true`만 | 서비스 롤만 | 서비스 롤만 |
| `app_configs` | 전체 | 서비스 롤만 | 거부 |

## 남은 것 (Phase 2에서 정책 추가)
- `wrong_notes` `user_vocabs` `vocab_tags` `exports` `export_quotas` `subscriptions` `offline_captures` `content_downloads` — 전부 A 패턴(`user_id = auth.uid()`)이라 단순. 단:
  - `exports.file_url`(Storage 경로)은 Supabase Storage RLS도 별도로 걸어 남의 PDF를 못 받게 한다.
  - `content_downloads`는 **구독 체크가 붙는 유일한 곳**(PRD 5.6 ③) — insert 시 `with check`에 구독 상태 조건 추가.
  - `vocab_tags`는 `user_id is null`(기본 태그)이면 전체 read 허용 + 본인 것만 write.

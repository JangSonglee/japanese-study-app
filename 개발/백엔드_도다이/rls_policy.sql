-- =============================================================================
-- 토모리(Tomori) — rls_policy.sql  (v1.1 / 2026-07-25)
-- =============================================================================
-- rls_policy.md v1.1 의 설계를 24개 Phase-1 테이블 전체에 적용한 실행본.
-- 전제: schema.sql 실행 완료 + 'Run and enable RLS'로 24개 테이블 RLS 이미 ON.
-- 실행: Supabase SQL Editor 또는 MCP apply_migration. ⚠️ 한 번만(정책 create는 재실행 시 중복 에러).
-- service_role 은 BYPASSRLS 라 아래 정책과 무관하게 쓰기 가능(콘텐츠 배포·서버 함수).
-- =============================================================================

-- 안전망: 혹시 enable이 빠진 테이블이 있어도 강제 ON (이미 ON이면 무해)
alter table app_configs        enable row level security;
alter table users_profile      enable row level security;
alter table courses            enable row level security;
alter table course_levels      enable row level security;
alter table course_tracks      enable row level security;
alter table lessons            enable row level security;
alter table vocab_items        enable row level security;
alter table expression_items   enable row level security;
alter table grammar_items      enable row level security;
alter table listening_items    enable row level security;
alter table listening_lines    enable row level security;
alter table reading_texts      enable row level security;
alter table reading_sentences  enable row level security;
alter table tips               enable row level security;
alter table questions          enable row level security;
alter table question_choices   enable row level security;
alter table daily_studies      enable row level security;
alter table study_sessions     enable row level security;
alter table session_attempts   enable row level security;
alter table vocab_states       enable row level security;
alter table track_progress     enable row level security;
alter table reading_progress   enable row level security;
alter table stamp_ledger       enable row level security;
alter table stamp_balances     enable row level security;

-- =============================================================================
-- B. 우표 원장 — 발급 함수 (앱은 원장에 직접 못 쓰고, 이 함수로만 발급)
-- =============================================================================
create or replace function grant_stamp(
  p_user uuid, p_delta int, p_reason text, p_idem text,
  p_ref_type text default null, p_ref_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 멱등: 같은 키면 조용히 무시(재시도·월증정 중복 방지)
  insert into stamp_ledger(user_id, delta, reason, ref_type, ref_id, idempotency_key)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref_id, p_idem)
  on conflict (idempotency_key) do nothing;
  -- 읽기 캐시 갱신(진실은 언제나 원장)
  insert into stamp_balances(user_id, balance)
  values (p_user, (select coalesce(sum(delta),0) from stamp_ledger where user_id = p_user))
  on conflict (user_id) do update set balance = excluded.balance, updated_at = now();
end $$;
-- 클라이언트에 execute 권한 주지 않음 → 서버(Edge Function/서비스 롤)에서만 호출
revoke all on function grant_stamp(uuid,int,text,text,text,uuid) from public, anon, authenticated;

-- =============================================================================
-- C. 콘텐츠 마스터 — read-only, 미공개(is_published=false) 숨김
--    쓰기 정책 없음 → anon/authenticated 쓰기 거부. 배포는 service_role(BYPASSRLS).
-- =============================================================================
-- courses 는 '구조'라 전체 노출(coming_soon 도 라벨로 보여줌). is_published 없음.
create policy courses_read on courses for select using (true);
-- app_configs 는 앱이 밸런싱 수치를 읽어야 함 → 전체 read
create policy config_read  on app_configs for select using (true);

-- is_published 를 가진 콘텐츠: 공개된 행만
create policy clevels_read on course_levels    for select using (is_published = true);
create policy ctracks_read on course_tracks    for select using (is_published = true);
create policy lessons_read on lessons          for select using (is_published = true);
create policy vocab_read   on vocab_items      for select using (is_published = true);
create policy expr_read    on expression_items for select using (is_published = true);
create policy gram_read    on grammar_items    for select using (is_published = true);
create policy listen_read  on listening_items  for select using (is_published = true);
create policy rtext_read   on reading_texts    for select using (is_published = true);
create policy tips_read    on tips             for select using (is_published = true);
create policy q_read       on questions        for select using (is_published = true);

-- 자식 테이블: 부모의 is_published 를 따라감
create policy llines_read on listening_lines for select using (exists (
  select 1 from listening_items p
  where p.id = listening_lines.listening_item_id and p.is_published = true));
create policy rsent_read on reading_sentences for select using (exists (
  select 1 from reading_texts p
  where p.id = reading_sentences.text_id and p.is_published = true));
create policy qchoice_read on question_choices for select using (exists (
  select 1 from questions p
  where p.id = question_choices.question_id and p.is_published = true));

-- =============================================================================
-- A. 사용자 데이터 — 본인 것만 (user_id = auth.uid())
--    delete 정책은 두지 않음 → 기본 거부(학습 기록은 사용자가 지우지 않음)
-- =============================================================================
-- users_profile (PK = user_id)
create policy profile_sel on users_profile for select using (user_id = auth.uid());
create policy profile_ins on users_profile for insert with check (user_id = auth.uid());
create policy profile_upd on users_profile for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- study_sessions
create policy sess_sel on study_sessions for select using (user_id = auth.uid());
create policy sess_ins on study_sessions for insert with check (user_id = auth.uid());
create policy sess_upd on study_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- session_attempts (user_id 없음 → 부모 study_sessions 소유로 판정)
create policy attempt_all on session_attempts for all
  using (exists (select 1 from study_sessions s
                 where s.id = session_attempts.session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from study_sessions s
                      where s.id = session_attempts.session_id and s.user_id = auth.uid()));

-- vocab_states
create policy vstate_sel on vocab_states for select using (user_id = auth.uid());
create policy vstate_ins on vocab_states for insert with check (user_id = auth.uid());
create policy vstate_upd on vocab_states for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- track_progress
create policy tprog_sel on track_progress for select using (user_id = auth.uid());
create policy tprog_ins on track_progress for insert with check (user_id = auth.uid());
create policy tprog_upd on track_progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reading_progress
create policy rprog_sel on reading_progress for select using (user_id = auth.uid());
create policy rprog_ins on reading_progress for insert with check (user_id = auth.uid());
create policy rprog_upd on reading_progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- daily_studies — 본인 read/insert/update. 단 stamp_granted/is_completed 는 앱이 못 바꿈.
create policy daily_sel on daily_studies for select using (user_id = auth.uid());
create policy daily_ins on daily_studies for insert with check (user_id = auth.uid());
create policy daily_upd on daily_studies for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- ⭐ 컬럼 단위 제한(rls_policy.md A ⭐): 앱은 completed_sessions 만 갱신 가능.
--    stamp_granted/is_completed/target_sessions 는 서버(service_role)만 → 우표 자가발급 차단.
revoke update on daily_studies from authenticated;
grant  update (completed_sessions) on daily_studies to authenticated;

-- =============================================================================
-- B. 우표 원장·잔액 — 본인 read만. 쓰기 정책 없음 → 앱 insert/update/delete 전면 거부.
--    발급/차감은 위 grant_stamp() (SECURITY DEFINER)로만.
-- =============================================================================
create policy ledger_sel  on stamp_ledger   for select using (user_id = auth.uid());
create policy balance_sel on stamp_balances for select using (user_id = auth.uid());

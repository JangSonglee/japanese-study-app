-- 홈 실데이터 RPC — 이어서 학습(단어 진도)·오늘 진행한 학습·복습 (2026-08-07)
-- Supabase 마이그레이션 `home_vocab_progress`로 적용됨. 이 파일은 저장소 기록용.
--
-- 설계 결정(대표님 2026-08-07):
--  · 이어서 학습 진도 = 「안다」로 표시한 단어 수 / 급수의 공개 단어 수(분모).
--    (course_levels.vocab_goal_count가 null이라, 급수의 is_published vocab_items 수를 분모로 씀.)
--  · 오늘 진행한 학습 = 오늘(KST) 완료 세션 수(daily_studies.completed_sessions). 단어/독해/청해/문법 공통.
--  · 오늘의 3분 복습 = 오늘 학습을 완료했을 때 노출(studied_today), 개수 = 오늘 학습한 항목 수(today_items, 모든 영역).
--  · 히어로 상태 자동 결정: 레벨 미정→레벨테스트 / 오늘 학습함→학습 후 / 그 외→학습 전.

-- 1) 「안다」 표시 단어 적립: content_key 배열 → vocab_states(acquired) upsert.
create or replace function public.record_vocab_known(p_keys text[])
returns int
language plpgsql security definer set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_n int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_keys is null or array_length(p_keys,1) is null then return 0; end if;
  insert into public.vocab_states(user_id, vocab_item_id, status, known_count, last_seen_at)
  select v_uid, vi.id, 'acquired', 1, now()
  from public.vocab_items vi
  where vi.content_key = any(p_keys) and vi.is_published
  on conflict (user_id, vocab_item_id) do update
    set status = 'acquired',
        known_count = public.vocab_states.known_count + 1,
        last_seen_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 2) 홈 진도 로드: 프로필 급수 기준 단어 진도 + 오늘 학습 수 + 오늘 복습 대상 수.
create or replace function public.load_home_progress()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_level text; v_level_id uuid;
  v_done int := 0; v_total int := 0; v_today int := 0; v_today_known int := 0; v_today_items int := 0;
  v_today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select level_estimate into v_level from public.users_profile where user_id = v_uid;
  select id into v_level_id from public.course_levels where code = v_level limit 1;
  if v_level_id is not null then
    select count(*) into v_total from public.vocab_items
      where course_level_id = v_level_id and is_published;
    select count(*) into v_done from public.vocab_states vs
      join public.vocab_items vi on vi.id = vs.vocab_item_id
      where vs.user_id = v_uid and vs.status = 'acquired' and vi.course_level_id = v_level_id;
  end if;
  select coalesce(completed_sessions,0) into v_today from public.daily_studies
    where user_id = v_uid and study_date = v_today_date;
  select count(*) into v_today_known from public.vocab_states
    where user_id = v_uid and (last_seen_at at time zone 'Asia/Seoul')::date = v_today_date;
  -- 오늘 학습한 항목 수 = 오늘 완료 세션의 (정답+오답) 합(단어=안다+모름, 퀴즈=정답+오답).
  select coalesce(sum(correct_count + wrong_count),0) into v_today_items from public.study_sessions
    where user_id = v_uid and (finished_at at time zone 'Asia/Seoul')::date = v_today_date;
  return jsonb_build_object(
    'level', v_level,
    'has_level', v_level is not null,
    'vocab_done', coalesce(v_done,0),
    'vocab_total', coalesce(v_total,0),
    'today_sessions', coalesce(v_today,0),
    'studied_today', coalesce(v_today,0) > 0,
    'today_known', coalesce(v_today_known,0),
    'today_items', coalesce(v_today_items,0)
  );
end $$;

grant execute on function public.record_vocab_known(text[]) to authenticated;
grant execute on function public.load_home_progress() to authenticated;

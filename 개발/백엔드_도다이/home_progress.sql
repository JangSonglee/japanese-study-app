-- 홈 실데이터 RPC — 이어서 학습(단어 진도)·오늘 진행한 학습·3분 복습 (2026-08-07)
-- Supabase 마이그레이션: home_vocab_progress → home_progress_today_items → session_signature_and_review.
-- 이 파일은 저장소 기록용(최신 상태 반영).
--
-- 설계 결정(대표님 2026-08-07):
--  · 이어서 학습 진도 = 「안다」 표시 단어 수 / 급수의 공개 단어 수(분모). vocab_goal_count가 null이라 공개 vocab_items 수 사용.
--  · 세션 크기: 단어·어휘 10 / 문법 3 / 독해 1(지문) / 청해 1(음성). (App.jsx 로더 인자)
--  · 세션 서명(study_sessions.signature) = 영역+급수+항목 content_key 세트 → 같은 세션 다시보기 판별.
--  · 오늘 진행한 학습 = 오늘 완료 세션의 distinct signature 수(다시보기는 1회).
--  · 오늘의 3분 복습 = 오늘 세션 1개↑면 노출, 랜덤 1세션의 크기(그 세션 항목 수).
--  · 스트릭·우표(daily_studies/grant_stamp)는 기존 로직 그대로(세션당 +1, 분리).

-- record_session_complete 는 스트릭 마이그레이션에서 정의됨. session_signature_and_review 에서
--   p_signature 인자 추가(study_sessions.signature 저장). 스트릭·우표 로직은 불변.

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

-- 2) 홈 진도 로드: 단어 진도 + 오늘 진행한 학습(distinct 세션) + 3분복습(랜덤 1세션 크기).
create or replace function public.load_home_progress()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_level text; v_level_id uuid;
  v_done int := 0; v_total int := 0; v_today int := 0; v_review int := 0; v_review_sig text;
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
  -- 오늘 완료 세션 distinct signature 수(다시보기=1회).
  select count(*) into v_today from (
    select distinct coalesce(signature, 'nosig:'||id::text) k
    from public.study_sessions
    where user_id = v_uid and (finished_at at time zone 'Asia/Seoul')::date = v_today_date
  ) c;
  -- 3분복습: 중복 제거 후 랜덤 1세션의 서명·크기(복습 화면이 서명으로 항목 재로드).
  select real_sig, sz into v_review_sig, v_review from (
    select distinct on (coalesce(signature, 'nosig:'||id::text))
           signature real_sig, (correct_count + wrong_count) sz
    from public.study_sessions
    where user_id = v_uid and (finished_at at time zone 'Asia/Seoul')::date = v_today_date
    order by coalesce(signature, 'nosig:'||id::text), finished_at desc
  ) dd order by random() limit 1;
  return jsonb_build_object(
    'level', v_level,
    'has_level', v_level is not null,
    'vocab_done', coalesce(v_done,0),
    'vocab_total', coalesce(v_total,0),
    'today_sessions', coalesce(v_today,0),
    'studied_today', coalesce(v_today,0) > 0,
    'review_count', coalesce(v_review,0),
    'review_sig', v_review_sig
  );
end $$;

grant execute on function public.record_vocab_known(text[]) to authenticated;
grant execute on function public.load_home_progress() to authenticated;

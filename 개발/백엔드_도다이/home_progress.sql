-- 홈 실데이터 RPC — 이어서 학습·오늘 진행한 학습·3분 복습·연속학습·시험 D-day (2026-08-07)
-- Supabase 마이그레이션 순서:
--   home_vocab_progress → home_progress_today_items → session_signature_and_review
--   → home_progress_review_sig(_fix) → home_progress_streak_dday(_v2)
-- 이 파일은 저장소 기록용(최신 상태).
--
-- 설계 결정(대표님 2026-08-07):
--  · 이어서 학습 진도 = 「안다」 표시 단어 수 / 급수의 공개 단어 수(분모). vocab_goal_count가 null이라 공개 vocab_items 수 사용.
--  · 세션 크기: 단어·어휘 10 / 문법 3 / 독해 1(지문) / 청해 1(음성)(App.jsx 로더 인자).
--  · 세션 서명(study_sessions.signature = 영역+급수+content_key세트) → 같은 세션 다시보기 판별.
--  · 오늘 진행한 학습 = 오늘 완료 세션의 distinct signature 수(다시보기=1회).
--  · 오늘의 3분 복습 = 오늘 세션 1개↑면 노출, 랜덤 1세션(review_sig로 복습화면이 항목 재로드).
--  · 연속학습 = users_profile.streak_count. 시험 D-day = app_configs('jlpt.exam_date') − 오늘(KST).
--  · 모은 우표는 홈이 별도 load_stamp_state() 재사용(잔액=stamp_balances). 여기 미포함.
--  · 스트릭·우표(daily_studies/grant_stamp)는 세션당 +1 기존 로직 유지(카운트 표시와 분리).
--
-- record_session_complete 는 스트릭 마이그레이션에서 정의. session_signature_and_review 에서
--   p_signature 인자 추가(study_sessions.signature 저장). 스트릭·우표 로직 불변.
-- app_configs('jlpt.exam_date') = 다음 JLPT 시험일(전역, jsonb 문자열). 사용자별 등록 UI는 추후.

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

-- 2) 홈 진도 로드.
create or replace function public.load_home_progress()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_level text; v_level_id uuid; v_streak int := 0;
  v_done int := 0; v_total int := 0; v_today int := 0; v_review int := 0; v_review_sig text;
  v_exam date; v_dday int;
  v_daily_done boolean := false; v_daily_target int; v_daily_completed int := 0;  -- 톤앤매너 상태용
  v_today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select level_estimate, coalesce(streak_count,0), exam_date
    into v_level, v_streak, v_exam
    from public.users_profile where user_id = v_uid;
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
  -- 오늘 목표 달성 여부(홈 인사말 톤: 첫진입/학습전/학습중/완료 구분).
  select coalesce(is_completed,false), target_sessions, coalesce(completed_sessions,0)
    into v_daily_done, v_daily_target, v_daily_completed
    from public.daily_studies where user_id = v_uid and study_date = v_today_date;
  -- 시험 D-day = 사용자 exam_date 기준(위 profile에서 조회). 미설정이면 dday null → 홈 "시험 일정 등록" 카드.
  -- 시험일 설정: list_exam_dates()(매년 7·12월 "첫째 일요일"을 호출 시점에 동적 계산 → 크론 불필요,
  --   항상 최신) → 사용자가 시트에서 선택 → set_exam_date(date). (register_upcoming_exam()=원탭 등록 유지.)
  if v_exam is not null then v_dday := v_exam - v_today_date; end if;
  return jsonb_build_object(
    'level', v_level,
    'has_level', v_level is not null,
    'streak', coalesce(v_streak,0),
    'vocab_done', coalesce(v_done,0),
    'vocab_total', coalesce(v_total,0),
    'today_sessions', coalesce(v_today,0),
    'studied_today', coalesce(v_today,0) > 0,
    'daily_done', coalesce(v_daily_done,false),
    'daily_target', v_daily_target,
    'daily_completed', coalesce(v_daily_completed,0),
    'review_count', coalesce(v_review,0),
    'review_sig', v_review_sig,
    'exam_date', to_char(v_exam, 'YYYY-MM-DD'),
    'dday', v_dday
  );
end $$;

grant execute on function public.record_vocab_known(text[]) to authenticated;
grant execute on function public.load_home_progress() to authenticated;

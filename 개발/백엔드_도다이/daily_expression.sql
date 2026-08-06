-- 오늘의 표현 — expression_items 콘텐츠 + 일자 결정 픽 RPC (2026-08-07)
-- Supabase 마이그레이션: daily_expression(_v2). 이 파일은 저장소 기록용.
--
-- 설계:
--  · expression_items(스키마 기존) = 급수별 표현. 여기에 words jsonb([{ja,ko}]) 컬럼 추가(단어 분해).
--  · 오늘의 표현 = 사용자 급수의 공개 표현 중 "일자 결정 인덱스"로 1개
--    (epoch-day % 개수) → 하루 동안 고정, 매일 회전. 랜덤 아님(같은 날 새로고침해도 동일).
--  · 홈 v4 「오늘의 N3 표현」 카드가 load_daily_expression() 로 로드(ja/후리가나/해석/단어).
-- 🅿️ 시드는 N3 3건(검증된 명언)뿐 — 다른 급수/추가 표현은 콘텐츠 확장(슈슈/대표님) 필요.
--    verify 컬럼은 verify_status 도메인('draft' 등) — 시드는 'draft'.

-- 단어 분해 컬럼(없으면 추가)
alter table public.expression_items add column if not exists words jsonb;

-- 시드 예(N3 3건). 실제 값은 마이그레이션 daily_expression_v2 참조.
--  jlpt.n3.expr.0001 夢は逃げない。逃げるのはいつも自分だ
--  jlpt.n3.expr.0002 継続は力なり
--  jlpt.n3.expr.0003 千里の道も一歩から

create or replace function public.load_daily_expression()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid(); v_level text; v_cnt int; v_idx int; v_row jsonb;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select level_estimate into v_level from public.users_profile where user_id = v_uid;
  if v_level is null then return null; end if;
  select count(*) into v_cnt
    from public.expression_items ei join public.course_levels cl on cl.id = ei.course_level_id
    where cl.code = v_level and ei.is_published;
  if v_cnt = 0 then return null; end if;
  v_idx := ((v_today - date '2000-01-01') % v_cnt);
  select jsonb_build_object(
    'ja_text', p.ja_text, 'reading', p.reading, 'ruby', p.ruby, 'romaji_ko', p.romaji_ko,
    'meaning_ko', p.meaning_ko, 'words', p.words, 'situation', p.situation, 'level', v_level)
  into v_row from (
    select ei.*, row_number() over (order by ei.content_key) - 1 rn
    from public.expression_items ei join public.course_levels cl on cl.id = ei.course_level_id
    where cl.code = v_level and ei.is_published
  ) p where p.rn = v_idx;
  return v_row;
end $$;
grant execute on function public.load_daily_expression() to authenticated;

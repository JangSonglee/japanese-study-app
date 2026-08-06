-- saved_words — 나만의 단어장(통합) 저장 단어. 마이그레이션 `saved_words_wordbook`(2026-08-07) 기록본.
-- 목적: 단어 카드(카탈로그)·오늘의 표현(비카탈로그) 등에서 별(★)로 저장한 단어를 한 곳에 모은다.
--       PRD §6 통합 단어장: 단어당 단일 태그(현재 JLPT만) + 급수(level) 속성. 향후 카메라 OCR 단어도 여기로.
-- 설계: content_key FK가 아니라 단어 데이터를 직접 보관(카탈로그 밖 단어도 저장 가능하도록).
--       dedup_key = 카탈로그면 content_key, 아니면 'x:<source>:<ja>'.
-- FE: 개발/프론트엔드_무스부/tomori-app/src/data/wordbook.js (saveWord/unsaveWord/loadSavedWords/loadSavedKeys)
--     별 배선: WordCardScreen(카탈로그) · HomeV4Screen 오늘의 표현(비카탈로그). 화면: VocabBookScreen.

create table if not exists public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedup_key text not null,               -- content_key 또는 'x:<source>:<ja>'
  ja text not null,                      -- 표제(일본어)
  reading text not null default '',
  ruby jsonb,                            -- {base, ruby:[{s,e,rt}]} — 있으면 후리가나 좌표
  meaning_ko text not null default '',
  tag text not null default 'JLPT',      -- 단일 태그(현재 JLPT만)
  level text,                            -- N5~N1 (있으면)
  source text not null default 'vocab',  -- vocab | expression | ...
  content_key text,                      -- 카탈로그면 vocab_items.content_key
  saved_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.saved_words enable row level security;
drop policy if exists saved_words_owner on public.saved_words;
create policy saved_words_owner on public.saved_words
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists saved_words_user_saved_idx on public.saved_words (user_id, saved_at desc);

-- save_word: upsert(같은 dedup_key면 최신값 갱신). 게스트 no-op.
-- unsave_word: 삭제. 게스트 no-op.
-- load_saved_words: 저장 단어 전체 jsonb 배열(최신순). 게스트면 [].
-- (본문은 마이그레이션 saved_words_wordbook 참조. 모두 SECURITY DEFINER, search_path=public,
--  grant execute to authenticated, anon.)

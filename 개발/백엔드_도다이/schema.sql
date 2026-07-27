-- =============================================================================
-- 토모리(Tomori) — schema.sql  (v1.1 / 2026-07-24)
-- =============================================================================
-- 전제: Supabase (PostgreSQL). auth.users 참조 · gen_random_uuid() · timestamptz.
-- 기준: 스키마_설계.md v1.1 · 콘텐츠_입력규격.md v1.0 (5장 12건 반영 완료)
--
-- 이 파일이 만드는 것 (우선순위):
--   ① 설정값        app_configs
--   ② 콘텐츠 마스터  courses, course_levels, course_tracks, lessons,
--                   vocab_items(★완성), expression_items, grammar_items,
--                   listening_items, listening_lines, reading_texts,
--                   reading_sentences, tips, questions, question_choices
--   ③ 학습 진행      daily_studies, study_sessions, session_attempts,
--                   vocab_states, track_progress, reading_progress
--   ④ 우표 원장      stamp_ledger(★원장+멱등키), stamp_balances
--   ⑤ 계정          users_profile (auth.users FK 데모용 최소본)
--   나머지 34-테이블은 파일 하단에 "Phase 2" 주석 스텁으로만 둔다.
--
-- 🔴 규칙 (스키마_설계 4장):
--   · is_locked 류 컬럼 없음.  단 is_published 는 둔다 (미공개 ≠ 잠금)
--   · 수치 하드코딩 금지 → app_configs
--   · stamp_ledger 는 원장 + idempotency_key unique, 앱 직접 insert 불가(RLS는 rls_policy.md)
--   · content_key / source / verify 는 전 콘텐츠 마스터 공통 (규격 5장 ①②)
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- =============================================================================
-- ① 설정값 — 수치는 전부 여기로 (스키마_설계 1.3 / 규칙 9)
-- =============================================================================
-- PRD 수치(우표 7/5/10, 월 3회, 세션 10/5/1/3, 구독가, 구독 증정 350장 …)는
-- 코드·스키마에 하드코딩하지 않는다. 밸런스는 출시 후 반드시 조정된다.
create table app_configs (
  key         text primary key,           -- 예: 'stamp.cost.daily_summary'
  value       jsonb not null,             -- 예: 7  ·  {"free":3,"stamp_extra_max":2}
  description text,
  updated_at  timestamptz not null default now()
);

-- 시드 예시 (값은 밸런싱 대상 — 진실은 이 테이블, 코드가 아님)
insert into app_configs(key, value, description) values
  ('stamp.cost.export.daily_summary', '7',  'PDF 오늘의 편지 소비 우표'),
  ('stamp.cost.export.wrong_note',    '5',  'PDF 오답노트 소비 우표'),
  ('stamp.cost.export.vocab_book',    '10', 'PDF 단어장 소비 우표'),
  ('export.monthly_free',             '3',  '월 무료 발행 횟수'),
  ('export.vocab.stamp_extra_max',    '2',  '단어장 우표 추가발행 월 상한'),
  ('subscription.monthly_stamp_grant','350','구독자 월 증정 우표'),
  ('session.size',                    '{"vocab":10,"grammar":5,"reading":1,"listening":3}', '트랙별 1세션 분량'),
  ('offline.retro_days_max',          '7',  '오프라인 우표 소급 인정 최대 일수')
on conflict (key) do nothing;


-- =============================================================================
-- ⑤ 계정 (데모용 최소본 — 전체 정의는 스키마_설계 ①, Phase 2에서 확장)
-- =============================================================================
create table users_profile (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  nickname             text,
  main_course_id       uuid,              -- FK는 courses 생성 후 (아래 alter)
  sub_course_id        uuid,
  level_estimate       text,              -- 'N5'~'N1'
  daily_session_target int  not null default 1,   -- Q3 스냅샷 (1/2/3~4)
  motivation_type      text,              -- 'streak'/'progress'/'stamp'
  streak_count         int  not null default 0,
  last_studied_on      date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);


-- =============================================================================
-- ② 콘텐츠 마스터
-- =============================================================================
-- 🆕v1.1 전 콘텐츠 마스터 공통 컬럼 (규격 5장 ①②):
--   content_key text unique not null · source text not null · license text
--   · verify text not null · is_published bool not null default false
-- Postgres엔 컬럼 상속(LIKE 매크로 재사용)이 제한적이라 각 테이블에 명시 반복한다.
-- 아래 CHECK 도메인으로 값 집합을 강제한다.

create domain verify_status  as text check (value in ('draft','team','native'));
create domain content_source as text;   -- 자유 텍스트(own / ref_only:* / aozora:* …), 빈칸만 금지(not null)

-- courses — 5개 코스 (기능은 5개 전부, 콘텐츠는 3개) --------------------------
create table courses (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,     -- jlpt/travel/business/news/folktale
  name_ko        text not null,
  format_type    text not null,            -- reading/phrase/mixed
  progress_model text not null,            -- collect/cycle/read_count/mixed
  content_status text not null default 'coming_soon',  -- open/coming_soon
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now()
);
-- content_status 가 11.0 스코프를 구현: 뉴스·전래동화는 행은 있고 coming_soon.
-- 코스엔 content_key/verify 불필요(콘텐츠 아이템이 아니라 구조).

alter table users_profile
  add constraint fk_profile_main_course foreign key (main_course_id) references courses(id),
  add constraint fk_profile_sub_course  foreign key (sub_course_id)  references courses(id);

-- course_levels — 축1 (급수/여행동선/난이도) ---------------------------------
create table course_levels (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  code            text not null,           -- N3 / restaurant / basic ...
  label           text not null,
  sort_order      int  not null default 0,
  recommend_rule  text,                    -- recommended/challenge 계산 기준
  vocab_goal_count int,                    -- 수집형 분모(잠정). 화면 미노출(규격 7.4-2)
  is_published    bool not null default false,   -- 🔴 미공개 ≠ 잠금. is_locked 없음
  created_at      timestamptz not null default now(),
  unique (course_id, code)
);
-- 🔴 is_locked 컬럼을 두지 않는다(급수 잠금 폐기, 설계 4장 규칙2).
--    추천/도전은 사용자 레벨과 런타임 비교로 계산.
-- vocab_goal_count 는 대략치 → 규격 7.4: 화면엔 분모 대신 누적 카운터로 표시,
--    최종 분모는 "우리 앱의 해당 급수 총 단어 수"로 확정.

-- course_tracks — 축2 (영역/탭) ---------------------------------------------
create table course_tracks (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses(id) on delete cascade,
  code           text not null,            -- vocab/grammar/reading/listening/default
  label          text not null,
  screen_format  text not null,            -- card/question/reading/doc_template/dialog_sim
  progress_model text not null,            -- collect/cycle/read_count (★트랙 단위)
  session_size   int,                      -- 미지정 시 app_configs.session.size 사용
  sort_order     int  not null default 0,
  is_published   bool not null default false,
  unique (course_id, code)
);
-- ⭐ 진행률 모델이 코스가 아니라 트랙 단위인 게 핵심(설계 규칙10).

-- lessons — 여행·비즈니스만 사용 (JLPT는 행 없음) ----------------------------
create table lessons (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_id       uuid not null references courses(id) on delete cascade,
  course_level_id uuid references course_levels(id),
  track_id        uuid references course_tracks(id),
  title           text not null,
  sort_order      int not null default 0,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vocab_items — 단어  ★ 이번 실임포트 검증 대상, 완성본
-- ---------------------------------------------------------------------------
-- CSV 17열(규격 4.1)이 손대지 않고 들어오는지 import_vocab.py 로 검증한다.
-- 헤더: content_key,level_code,headword,reading,ruby,romaji_ko,pos,conj_type,
--       transitivity,meaning_ko,meaning_ko_alt,example_ja,example_ko,
--       audio_file,source,verify,note
create table vocab_items (
  id              uuid primary key default gen_random_uuid(),

  -- 🆕v1.1 ① 자연키 (음성 파일명·재임포트 UPSERT·오류보고의 근거)
  content_key     text unique not null,

  -- 급수 = 속성 (설계). CSV의 level_code(text)를 임포터가 course_level_id(uuid)로 매핑
  course_level_id uuid not null references course_levels(id),

  headword        text not null,           -- 表記 (한자 없으면 가나)
  reading         text not null,           -- かな 전체 (검증용). ruby에서 재구성해 대조
  ruby            jsonb not null,           -- 🆕v1.1 ③ 좌표 JSON {base, ruby:[{s,e,rt}]}
                                            --   브래킷 표기를 임포터가 변환. 한자 없으면 ruby:[]
  romaji_ko       text not null,           -- 한글 발음. ruby에서 기계생성해 대조(규격 6.1-6)

  pos             text not null,           -- noun/verb/i_adj/na_adj/adv/conj/pron/
                                            --   counter/prefix/suffix/interj/expr
  conj_type       text not null default '-',   -- 🆕v1.1 ⑥ g1/g2/g3_suru/g3_kuru/
                                                --   suru_noun/i_adj/na_adj/-
  transitivity    text not null default '-',   -- 🆕v1.1 ⑥ vi/vt/vi_vt/-

  meaning_ko      text not null,           -- 대표 뜻 1개 (여러 개면 ; 구분)
  meaning_ko_alt  text,                    -- 🆕v1.1 ⑩ 부가뜻·뉘앙스 (; 구분). 없으면 null

  example_ja      text,                    -- 🆕v1.1 ⑨ 예문 (브래킷 루비 포함 원본)
  example_ruby    jsonb,                   -- 🆕v1.1 ⑨ 예문 후리가나 좌표 (파생)
  example_ko      text,                    -- 🆕v1.1 ⑨ 예문 해석

  audio_url       text,                    -- audio/jlpt/n5/vocab/{content_key}.m4a

  -- 🆕v1.1 ② 공통: 출처·라이선스·검수·공개
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,   -- 🔴 미공개 ≠ 잠금

  note            text,                    -- 제작자 메모 (임포트 참고용, 노출 안 함)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 값 집합 방어 (규격 6.1-7)
  constraint chk_vocab_pos  check (pos in ('noun','verb','i_adj','na_adj','adv','conj',
                                           'pron','counter','prefix','suffix','interj','expr')),
  constraint chk_vocab_conj check (conj_type in ('g1','g2','g3_suru','g3_kuru','suru_noun',
                                                 'i_adj','na_adj','-')),
  constraint chk_vocab_trans check (transitivity in ('vi','vt','vi_vt','-'))
);
create index idx_vocab_level on vocab_items(course_level_id);
create index idx_vocab_pos   on vocab_items(pos);
-- ruby 검증(규격 6.1 2·3): {}벗김==headword, 읽기이음==reading — 임포터가 담당(CHECK 불가).

-- ---------------------------------------------------------------------------
-- expression_items — 표현·문장 (여행·비즈니스)
-- ---------------------------------------------------------------------------
create table expression_items (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_level_id uuid not null references course_levels(id),   -- 🆕v1.1 ⑦ (설계 누락 수정)
  ja_text         text not null,
  reading         text not null,
  ruby            jsonb not null,          -- 🆕v1.1 ⑤/③ 좌표 JSON
  romaji_ko       text not null,
  meaning_ko      text not null,
  situation       text,                    -- 공항/식당 … 또는 하위 상황
  politeness      text,                    -- casual/polite/humble/honorific/-
  is_tip          bool not null default false,  -- TIP은 별도 테이블 아님(라벨로, PRD 4.1 B')
  audio_url       text,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_expr_level on expression_items(course_level_id);

-- ---------------------------------------------------------------------------
-- grammar_items — 문형
-- ---------------------------------------------------------------------------
create table grammar_items (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_level_id uuid not null references course_levels(id),   -- 🆕v1.1 ⑦ (설계 누락 수정)
  pattern         text not null,           -- 〜ばかりで
  pattern_ruby    jsonb,
  connection      text,                    -- 🆕v1.1 ⑧ 접속형태 '동사 た형 + ばかり'
  romaji_ko       text,
  meaning_ko      text not null,
  usage_note      text,
  politeness      text,                    -- casual/polite/humble/honorific/-
  example_ja      text,
  example_ruby    jsonb,
  example_ko      text,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_grammar_level on grammar_items(course_level_id);

-- ---------------------------------------------------------------------------
-- listening_items + listening_lines  🆕v1.1 ④ (통짜 script 폐기 → 발화 단위 자식)
-- ---------------------------------------------------------------------------
create table listening_items (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_level_id uuid not null references course_levels(id),
  track_id        uuid references course_tracks(id),
  title           text,
  duration_ms     int,
  speaker_count   int not null default 1,
  voice_preset    text,                    -- 🆕v1.1 ⑫ TTS 재생성 대비(목소리 고정)
  speed           numeric,                 -- 🆕v1.1 ⑫
  audio_url       text,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  note            text,
  created_at      timestamptz not null default now()
);
-- 🆕v1.1 ④ 대본 발화 단위 자식 — 회화형 청해 화자 분리 (규격 4.4 / JLPT 검토 ⑥-2)
create table listening_lines (
  id                 uuid primary key default gen_random_uuid(),
  listening_item_id  uuid not null references listening_items(id) on delete cascade,
  seq                int  not null,        -- 발화 순서
  speaker            text,                 -- 'A'/'B' …
  ja                 text not null,        -- 브래킷 루비 포함 원본
  ruby               jsonb,                -- 좌표 JSON (파생)
  romaji_ko          text,
  ko                 text,
  unique (listening_item_id, seq)
);

-- ---------------------------------------------------------------------------
-- reading_texts + reading_sentences  (지문을 문장 단위로 쪼갬 — 설계 핵심3)
-- ---------------------------------------------------------------------------
create table reading_texts (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_level_id uuid not null references course_levels(id),   -- 난이도 = 3단 중 하나
  group_key       text,                    -- 같은 이야기의 3단 난이도 묶음 키('-'이면 단독)
  title           text not null,
  published_at    date,                    -- 뉴스 시의성
  has_memo        bool not null default false,
  est_minutes     int,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  note            text,
  created_at      timestamptz not null default now()
);
-- 🔴 지문을 문장 단위로 쪼갠다 — PRD 8.4 "문장 탭 → 그 문장만 해석"이 통짜 저장이면 불가.
create table reading_sentences (
  id         uuid primary key default gen_random_uuid(),
  text_id    uuid not null references reading_texts(id) on delete cascade,
  seq        int  not null,
  ja         text not null,               -- 원문(브래킷 루비 포함)
  reading    jsonb,                       -- 후리가나 좌표 JSON
  romaji_ko  text,
  ko         text not null,               -- 이 문장의 해석 (전체해석은 seq순 이어붙임)
  unique (text_id, seq)
);
-- 검수 경고: ja 문장 60자 초과 시(규격 6.1-11) — 임포터가 담당.

-- ---------------------------------------------------------------------------
-- tips — (표현 안 라벨 방식과 별개로, 코스 팁이 독립 콘텐츠일 때)
-- ---------------------------------------------------------------------------
create table tips (
  id              uuid primary key default gen_random_uuid(),
  content_key     text unique not null,
  course_level_id uuid references course_levels(id),
  body_ko         text not null,
  source          content_source not null,
  license         text,
  verify          verify_status not null default 'draft',
  is_published    bool not null default false,
  created_at      timestamptz not null default now()
);


-- =============================================================================
-- ③ 문제·퀴즈
-- =============================================================================
create table questions (
  id                uuid primary key default gen_random_uuid(),
  content_key       text unique not null,
  question_type     text not null,          -- mcq/dictation/matching/listening/ordering/speaking
  course_id         uuid references courses(id),
  course_level_id   uuid references course_levels(id),
  track_id          uuid references course_tracks(id),
  target_item_type  text,                   -- vocab/grammar/expression/reading/listening (다형)
  target_item_key   text,                   -- content_key 참조(다형이라 FK 대신 키)
  stem_ja           text,
  stem_ruby         jsonb,                  -- 🆕v1.1 ⑤ 문제면 후리가나 좌표(켤 수 있어야)
  audio_url         text,
  asset_url         text,                   -- 자료 이미지(견적서·결산표 …, PRD 4.2.4)
  explanation       text,
  explanation_axis  text,                   -- grammar(JLPT) / appropriateness(여행·비즈니스)
  is_auto_generated bool not null default false,
  source            content_source not null,
  license           text,
  verify            verify_status not null default 'draft',
  is_published      bool not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  constraint chk_q_type check (question_type in
    ('mcq','dictation','matching','listening','ordering','speaking'))
);
create index idx_q_level on questions(course_level_id);

create table question_choices (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  seq          int  not null,
  choice_text  text not null,
  choice_ruby  jsonb,                       -- 🆕v1.1 ⑤ 선택지 후리가나 좌표
  is_correct   bool not null default false,
  pair_key     text,                        -- 🆕v1.1 ⑪ matching 짝. 그 외 유형 null
  wrong_reason text,                        -- 3단 해설 ③ (JLPT만 채움, 그 외 '-')
  unique (question_id, seq)
);
-- 검증(규격 6.1-12): mcq 정답 정확히 1개 · speaking 은 choices 없음 — 임포터가 담당.


-- =============================================================================
-- ④ 학습 진행  ⭐ 핵심
-- =============================================================================
-- daily_studies — "오늘의 학습" 1단위 = 우표 1장 (PRD 12.2)
create table daily_studies (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  study_date       date not null,
  target_sessions  int  not null,           -- Q3 스냅샷 (설정 변경 소급 방지)
  completed_sessions int not null default 0,
  is_completed     bool not null default false,   -- completed >= target
  stamp_granted    bool not null default false,   -- 중복 적립 방지
  created_at       timestamptz not null default now(),
  unique (user_id, study_date)
);

-- study_sessions — 세션 1회 (오프라인 조작방지 컬럼 포함, 설계 6.1)
create table study_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid references courses(id),
  course_level_id uuid references course_levels(id),
  track_id        uuid references course_tracks(id),
  source          text not null default 'curriculum',  -- curriculum/my_vocab
  started_at      timestamptz,
  finished_at     timestamptz,
  correct_count   int not null default 0,
  wrong_count     int not null default 0,
  -- 오프라인 우표 조작방지 (설계 6.1) — 판정은 서버, 로컬은 잔액을 못 만짐
  is_offline      bool not null default false,
  device_time     timestamptz,             -- 기기가 주장하는 시각
  monotonic_ms    bigint,                  -- 부팅 후 경과(시계 조작 불가)
  synced_at       timestamptz,
  verify_status   text not null default 'verified',  -- pending/verified/held
  created_at      timestamptz not null default now()
);
create index idx_sess_user on study_sessions(user_id);

-- session_attempts — 문항별 시도
create table session_attempts (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references study_sessions(id) on delete cascade,
  question_id   uuid references questions(id),
  attempt_no    int not null default 1,
  is_correct    bool,
  outcome       text not null,            -- correct/wrong/skipped (✕와 ⤼는 다름)
  self_judgement text,                    -- known/unknown/null (단어 카드 자가판정)
  created_at    timestamptz not null default now(),
  constraint chk_outcome check (outcome in ('correct','wrong','skipped'))
);
create index idx_attempt_session on session_attempts(session_id);

-- vocab_states — 수집형 진행률
create table vocab_states (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  vocab_item_id    uuid not null references vocab_items(id) on delete cascade,
  status           text not null default 'new',   -- new/learning/acquired
  known_count      int not null default 0,
  test_wrong_count int not null default 0,
  last_seen_at     timestamptz,
  unique (user_id, vocab_item_id),
  constraint chk_vstate check (status in ('new','learning','acquired'))
);
-- 수집형 진행률 = count(status='acquired') / course_levels.vocab_goal_count
--   단 분모는 화면 미노출, 누적 카운터로 표시(규격 7.4).

-- track_progress — 회독형 진행률
create table track_progress (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  course_level_id       uuid not null references course_levels(id),
  track_id              uuid not null references course_tracks(id),
  cycle_no              int not null default 1,       -- N회독째
  items_done            int not null default 0,
  items_total           int,
  cycle_wrong_rate      numeric,
  prev_cycle_wrong_rate numeric,        -- 회독 모델의 목적: 오답률 감소를 보여주기
  completed_cycles      jsonb not null default '[]',  -- 회독별 도장/배지
  unique (user_id, course_level_id, track_id)
);

-- reading_progress — "N회 읽음" (프로그레스바 아님, 카운터)
create table reading_progress (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  reading_text_id  uuid not null references reading_texts(id) on delete cascade,
  read_count       int not null default 0,   -- [읽기 완료] 버튼으로만 +1
  last_read_at     timestamptz,
  quiz_taken_count int not null default 0,
  unique (user_id, reading_text_id)
);


-- =============================================================================
-- ⑦ 우표 원장  🔴 원장 + 멱등키. 앱 직접 insert 불가(RLS는 rls_policy.md)
-- =============================================================================
create table stamp_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  delta           int  not null,            -- +1 적립 / -7 소비. 양수 구매처는 없음
  reason          text not null,            -- daily_study/daily_study_offline/
                                            --   subscription_grant/export_summary/
                                            --   export_wrongnote/export_vocab
  ref_type        text,
  ref_id          uuid,
  idempotency_key text not null,            -- 🔴 멱등키
  created_at      timestamptz not null default now(),
  constraint uq_stamp_idem unique (idempotency_key),
  -- 🔴 우표는 결제로 구매 불가(PRD 11 Won't) → reason 에 purchase 를 정의하지 않는 것으로
  --    규칙을 스키마에 새긴다. delta>0 은 적립/증정만.
  constraint chk_stamp_reason check (reason in
    ('daily_study','daily_study_offline','subscription_grant',
     'export_summary','export_wrongnote','export_vocab'))
);
create index idx_ledger_user on stamp_ledger(user_id, created_at);
-- 멱등키 예: 'user:{uid}:daily:2026-07-22' · 'user:{uid}:grant:2026-07'
-- 🔴 stamp_ledger 는 서버 함수(SECURITY DEFINER)로만 insert. 앱 RLS insert 차단.
--    → rls_policy.md 참조. 오프라인 우표 조작방지의 뼈대.

-- stamp_balances — 읽기 캐시 (진실은 언제나 원장)
create table stamp_balances (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  balance        int not null default 0,
  last_ledger_id uuid references stamp_ledger(id),
  updated_at     timestamptz not null default now()
);


-- =============================================================================
-- Phase 2 — 나머지 테이블 스텁 (설계 34테이블 중 위에서 안 만든 것)
-- =============================================================================
-- 아래는 이번 스코프(콘텐츠 마스터·학습 진행·우표 원장) 밖. 설계는 확정,
-- DDL은 FE가 해당 화면에 착수할 때 채운다. 컬럼은 스키마_설계.md 참조.
--
--  ① 계정·설정   : user_settings, user_goals, onboarding_answers
--  ⑤ 오답노트    : wrong_notes            (user_id+question_id unique, 상태전이·비삭제)
--  ⑥ 나만의단어장 : vocab_tags, user_vocabs (단일 태그 FK, 값 스냅샷)
--  ⑦ 내보내기    : exports, export_quotas  (토글/필터 스냅샷, 월 상한)
--  ⑧ 기록·리워드 : daily_summaries, tomo_notes, user_tomo_notes
--  ⑨ 구독·오프라인: subscriptions, offline_captures, content_downloads
--
-- create table user_settings ( ... );        -- Phase 2
-- create table wrong_notes ( ... );           -- Phase 2
-- create table vocab_tags ( ... );            -- Phase 2
-- create table user_vocabs ( ... );           -- Phase 2
-- create table exports ( ... );               -- Phase 2
-- create table export_quotas ( ... );         -- Phase 2
-- create table daily_summaries ( ... );       -- Phase 2
-- create table subscriptions ( ... );         -- Phase 2
-- create table offline_captures ( ... );      -- Phase 2
-- create table content_downloads ( ... );     -- Phase 2
-- =============================================================================

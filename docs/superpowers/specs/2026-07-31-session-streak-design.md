# 실데이터 배선 A — 세션 기록 + 스트릭 (설계 문서)

- 작성일: 2026-07-31
- 결정자: 대표님
- 상태: 확정 (구현 계획 = writing-plans 후속)
- 관련: 인증 스캐폴드(`auth.uid()` RLS)·스키마 `daily_studies`·`study_sessions`·`users_profile`·PRD 10.x

## 배경

인증이 붙었으니 학습 활동을 실 DB로 기록한다. 3개 서브프로젝트(오답노트·스트릭·우표) 중
**A = 세션 기록 + 스트릭**이 토대(우표·오답노트가 이 위에 올라감). 현재 FE 세션 흐름은 DB에
아무것도 쓰지 않으므로(데모), "완료된 세션 기록"을 처음 심는다.

## 결정 사항

1. **스트릭 규칙 = 세션 1개만 완료해도 그날 인정**(대표님). 관대한 규칙 — "학습 의지를 꺾지 않고
   북돋는다"(1.3)와 정합. 바쁜 날도 한 조각이면 스트릭 유지.
2. **서버 계산**(SECURITY DEFINER RPC) — 클라이언트가 스트릭·완료를 조작 못 하게. 날짜 = **KST(Asia/Seoul)**.
3. **범위 = 스트릭 위젯만 실데이터.** 우표 적립(B)·진도·D-day·이어서학습은 데모 유지. 게스트는 기록 안 함.

## 아키텍처

### ① BE — `record_session_complete(p_source, p_correct, p_wrong)` RPC (신규)

`SECURITY DEFINER`, `set search_path = public`. 세션 완료 시 FE가 1회 호출. 로직(원자적):

1. `v_uid := auth.uid()`; null 이면 예외(비로그인 호출 차단).
2. `v_today := (now() at time zone 'Asia/Seoul')::date`.
3. **study_sessions** insert: `(user_id, source, correct_count, wrong_count, finished_at=now(), started_at=now(), is_offline=false, verify_status='team')`.
4. **daily_studies** upsert `(user_id, study_date=v_today)`:
   - 신규: `completed_sessions=1, target_sessions=profile.daily_session_target, is_completed=(1>=target)`.
   - 기존: `completed_sessions+=1, is_completed=(completed_sessions>=target_sessions)`.
   - 🔴 `unique(user_id, study_date)` 필요(upsert 기준) — 없으면 마이그레이션에서 추가.
5. **스트릭**(users_profile): 그날 첫 세션일 때만(`last_studied_on IS DISTINCT FROM v_today`):
   - `last_studied_on = v_today - 1` → `streak_count += 1`
   - 그 외(갭·null) → `streak_count = 1`
   - `last_studied_on = v_today`.
6. 반환 `jsonb {streak_count, last_studied_on, completed_sessions, target_sessions, is_completed}`.

- EXECUTE grant = authenticated. public/anon 회수(handle_new_user 선례). 어드바이저 0 유지.
- 🔴 서버 전용 컬럼(is_completed 등)을 DEFINER로 안전하게 쓴다(RLS 컬럼 제약 우회는 서버 함수만).

### ② FE — `data/study.js` (신규)

- `recordSessionComplete(source, correct, wrong) → Promise<result|null>`: 세션 있으면 `supabase.rpc('record_session_complete', {p_source, p_correct, p_wrong})`, 비로그인 null.
- `loadStreak() → Promise<{days, week:[bool×7]}|null>`: `users_profile.streak_count` + `daily_studies` 최근 7일(study_date)로 주간 점. 비로그인 null.
- `source` 값: `'vocab' | 'grammar' | 'reading' | 'listening'`.

### ③ FE — 세션 완료 훅

세션 요약(DoneView)에 도달하면 **1회** `recordSessionComplete` 호출(로그인 시). `useEffect([])` +
ref 가드로 중복 방지. `source`·`correct`·`wrong`(또는 known/total)을 DoneView(또는 요약 지점)에 전달.
- 단어=vocab(known, total-known) / 문법=grammar / 독해=reading / 청해=listening.
- 🔴 QuizScreen 요약이 DoneView 재사용인지 구현 시 확인 — 아니면 그 지점에도 호출.

### ④ FE — 홈 스트릭 위젯

`HomeScreen` 마운트 시 로그인이면 `loadStreak()` → 스트릭 위젯(`연속 학습 N일째` + 주간 점)을 실데이터로.
게스트/미로그인/로딩 실패 시 기존 데모(HOME_DEMO.streak) 폴백. 다른 위젯은 데모 유지.

## 무엇이 로그인 전제인가
- 세션 기록·스트릭 = 로그인 필요(사용자 데이터). 게스트는 학습은 되지만 기록 안 됨(데모 표시).

## 범위 밖 (후속)
- **우표 적립 + 편지 마일스톤**(서브프로젝트 B) — daily_studies.is_completed → grant_stamp.
- **오답노트**(C) — session_attempts 기록 + 화면.
- 진도·D-day·이어서학습 실데이터, 오프라인 세션 기록(PRD 5.6·우표 5규칙), 주간 점의 정교한 표기.

## 검증
- BE: 마이그레이션 적용 + 함수 정의(SECURITY DEFINER·search_path)·advisor 0 확인. RPC 로직은
  auth 컨텍스트가 필요해 MCP 단독 호출은 제한 → 정의 검토 + 실 세션 완료(대표님/컨트롤러 로그인 세션)로 검증.
- FE: 빌드0 + @5599. 게스트 홈=데모 폴백(회귀 없음). **로그인 세션에서 세션 완료 → 홈 스트릭 반영**,
  Supabase MCP로 `study_sessions`·`daily_studies`·`users_profile.streak_count` 행 확인. 콘솔0.

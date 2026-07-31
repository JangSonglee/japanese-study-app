# 오답노트 배선 — 설계 (서브프로젝트 C)

> 날짜: 2026-07-31 · 상태: 승인됨(대표님 2026-07-31)
> 선행: A(세션 기록+스트릭)·B(우표 적립+편지 마일스톤) 완료·배포. `record_session_complete` RPC 존재.
> 근거: PRD §8.2(요약)·§8.6(O/X 안 씀, 단 47 모아보기는 ✕/⤼ 유지)·화면 47(오답노트 모아보기)·§8.4(후리가나 규칙).

## 목표 (한 문장)
퀴즈(독해·청해 객관식)에서 틀리거나 넘어간 문항을 실제로 기록하고, MY에서 "오답노트 모아보기"로 누적 오답을 복습하며 "이제 알아요"로 졸업할 수 있게 한다.

## 결정 (대표님 2026-07-31)
- **범위 = C1 기록 + C2 모아보기 화면**(둘 다). 기록만 하면 볼 곳이 없어 반쪽.
- **기록 대상 = 퀴즈 객관식만**(독해·청해, 진짜 `question_id` 있음). 단어·문법 플래시카드 자가판정은 `vocab_states`(별도 루프)로 남김 — 오답노트="틀린 문제의 질문+정답" 형식과 맞음.
- (컨트롤러 세부 확정) 기록=**1차 시도만**(성적=1차 기준, PRD 정합), 졸업 저장=**`wrong_note_graduated` 테이블**(날짜 인지 — 졸업 후 또 틀리면 재등장).

## 지금 있는 것 / 없는 것
**이미 있음:**
- `session_attempts`(session_id FK→study_sessions CASCADE, question_id FK→questions, attempt_no default 1, is_correct, outcome NOT NULL, self_judgement, created_at). RLS `attempt_all`=세션 소유자. **0행.**
  - 🔴 `chk_outcome` CHECK: outcome ∈ **{`correct`, `wrong`, `skipped`}**. 넘어감=**`skipped`**.
- `record_session_complete(p_source,p_correct,p_wrong)` — 세션·daily·스트릭·우표. attempts는 아직 안 받음.
- `questions`(id, content_key, question_type, stem_ja, stem_ruby, explanation, …), `question_choices`(is_correct, choice_text, choice_ruby). RLS 공개 read.
- QuizScreen: submit/skip/2라운드, `card.question`(VM). `loadReading`/`loadListening`.

**없음(C에서):**
- 퀴즈 카드에 **question uuid**(현재 select에 `id` 없음).
- 시도 수집·전달·기록 배선.
- `wrong_note_graduated` 테이블 + `load_wrong_notes`/`graduate_wrong_note` RPC.
- 오답노트 모아보기 화면·라우트·MY 진입.

## C1 — 오답 기록
### FE: question_id 배선
- `vocab.js` `loadReading`·`loadListening`의 questions select에 **`id` 추가**, `questionVM(q)`가 `id`를 카드 question에 실음(`card.question.id`).

### 시도 수집 (QuizScreen)
- 세션 동안 **1차 시도**를 클라이언트 배열에 모음. 각 항목:
  `{ question_id: card.question.id, outcome: 'correct'|'wrong'|'skipped', is_correct: boolean }`
  - submit 정답 → `correct`/true, submit 오답 → `wrong`/false, skip(모르겠어요) → `skipped`/false.
  - **round 1에서만** 수집(2차 재도전 미기록). `question.id` 없으면(예외) 그 항목은 건너뜀(null FK 방지).
- 세션 완료(DoneView) 시 `recordSessionComplete(source, correct, wrong, attempts)`로 전달.

### BE: `record_session_complete` 확장
- 시그니처에 **`p_attempts jsonb default '[]'`** 추가(기존 3인자 호출 무회귀 — 단어·문법 DoneView는 미전달). ⚠️ Postgres 함수 오버로드 충돌 방지: 기존 `(text,int,int)`를 **drop 후** `(text,int,int,jsonb)`로 재생성(본문은 기존+attempts 삽입). EXECUTE는 authenticated에 재부여.
- 세션 insert 후 그 `session_id`로 `p_attempts` 각 원소를 `session_attempts(session_id, question_id, attempt_no=1, is_correct, outcome)` 삽입. outcome은 CHECK 3값만 허용(그 외는 방어적으로 skip).

## C2 — 오답노트 모아보기
### 데이터 모델: `wrong_note_graduated`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | uuid not null | auth.users, RLS 기준 |
| question_id | uuid not null | questions |
| graduated_at | timestamptz not null default now() | "이제 알아요" 시각 |
- PK `(user_id, question_id)`. RLS select-own(쓰기는 RPC로).

### `load_wrong_notes() returns jsonb` (SECURITY DEFINER, authenticated)
본인 `study_sessions`의 `session_attempts` 중 `outcome in ('wrong','skipped')`를 questions와 조인, **문항별 집계**:
- question_id, content_key, question_type(reading/listening), stem_ja, stem_ruby(jsonb),
- correct_text·correct_ruby(question_choices where is_correct), explanation,
- `latest_outcome`(가장 최근 wrong/skipped), `wrong_count`(틀림+넘어감 횟수), `last_at`.
- **졸업 필터(날짜 인지)**: `wrong_note_graduated`에 행이 없거나 `last_at > graduated_at`인 문항만 포함. 최근순 정렬. jsonb 배열 반환.

### `graduate_wrong_note(p_question_id uuid) returns void` (SECURITY DEFINER, authenticated)
`insert wrong_note_graduated(user_id, question_id) values(auth.uid(), p_question_id) on conflict (user_id,question_id) do update set graduated_at = now()`. → 목록에서 빠짐(다음 오답 시 재등장).

### FE: `data/wrongNotes.js`
- `loadWrongNotes()` → RPC 결과(게스트 null). `graduateWrongNote(questionId)` → RPC(게스트 no-op).

### 화면 `WrongNoteScreen` (라우트 `wrongNote`)
- MY 「보관함 › 오답노트」 → push. (편지함과 같은 자리 계열.)
- 목록: 문항별 카드 — **✕(틀림)/⤼(넘어감)** 배지(latest_outcome), 질문(stem+후리가나 Ruby), **정답**(correct+후리가나), 탭 시 **해설 펼침**, 최근 날짜·틀린 횟수, **「이제 알아요」** 버튼(→graduate→목록에서 제거).
- 후리가나: 기본 ON(PRD 8.4, 오답노트도 동일 규칙). 상단 후리가나 토글(편지 상세와 결 통일) — MVP는 기본 ON 고정, 토글은 선택.
- 게스트/`null`: 로그인 안내(편지함 게스트 결) 또는 데모 비움. **빈 상태** 담담하게(토모 sit, 압박·빨간점 없음, PRD 784).

## 게스트·검증
- 기록·조회 RPC 모두 `auth.uid()` 필요. 게스트는 FE에서 기록 생략·`null` 반환.
- BE 검증(MCP): 테이블·RPC 생성, 임시 데이터로 집계·졸업 필터 시뮬레이션(FK 때문에 실 insert는 대표님 계정 필요 → 순수/롤백 검증 + 대표님 로그인 end-to-end 이월).
- FE 검증: `npm run build`, 프리뷰(5599) 게스트 — 퀴즈 완주 시 콘솔·네트워크 오류 없음(게스트는 기록 생략), MY→오답노트 게스트 화면 정상.

## 범위 밖 (C 아님)
- 요약(DoneView) 오답노트 추가분 표시.
- 오답노트 PDF·따라쓰기 영역([[idea-wrongnote-pdf-tracing]] — PDF 내보내기 기능 때).
- 플래시카드 자가판정(vocab_states)·오늘의 조언 실생성.
- 2차 재도전 기록·오답 패턴 통계.

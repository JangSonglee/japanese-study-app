# 우표 적립 + 편지 마일스톤 배선 — 설계 (서브프로젝트 B)

> 날짜: 2026-07-31 · 상태: 승인 대기
> 선행: 서브프로젝트 A(세션 기록 + 스트릭, `record_session_complete` RPC) 완료·배포됨.
> 근거 문서: PRD v2.9 §12.2(우표 컬렉션 모델)·§8.3(편지함)·§14.5(편지 정의)·§7.4(우표 진행바).

## 목표 (한 문장)
"학습한 하루"마다 우표 1장을 실제로 적립하고, 우표가 마일스톤(첫 3장·이후 14장)에 닿으면 토모의 편지가 실제로 도착해 홈 위젯·편지함에 실데이터로 반영한다.

## 지금 있는 것 / 없는 것
**이미 있음 (A에서 생성):**
- `grant_stamp(p_user, p_delta, p_reason, p_idem, p_ref_type, p_ref_id)` — 멱등 적립(원장 insert + 잔액 재계산). `idempotency_key` unique.
- `stamp_ledger`(delta·reason·ref_type·ref_id·idempotency_key), `stamp_balances`(balance·last_ledger_id).
- `daily_studies.stamp_granted boolean default false`.
- `record_session_complete(p_source, p_correct, p_wrong)` — 세션·`daily_studies`·스트릭 갱신. **우표는 아직 지급 안 함.**

**없음 (B에서 생성):**
- 적립 배선 — 완료한 하루당 우표 1장.
- 편지 마일스톤 엔진 — 잔액이 임계에 닿으면 편지 배달.
- `user_letters` 테이블 — 배달 기록(도착일·읽음).
- 편지 상수 — `app_configs`에 첫/간격/작성편지수.
- 조회 RPC — `load_stamp_state`, `mark_letter_read`.
- FE 실데이터 — `data/stamps.js`, 홈 우표 위젯, 편지함 배달 목록.

## 결정 사항 (대표님 승인 2026-07-31)
- **③ 편지 배달 저장 = `user_letters` 테이블.** 파생 방식이 아니라 배달 시 row 생성 → 도착일·읽음 상태가 명확하고 `letter_replies`(seq 기준)와 짝. PRD 8.3 편지함이 "날짜별로 받은 편지"라 도착일이 필요.
- **콘텐츠 병목 = 엔진만 배선, 문안은 별도 작업.** 편지 템플릿이 현재 2통(seq 1·2)뿐. 엔진은 N통을 지원하되 `app_configs.letters.total_available`(=2)를 상한으로 두어 문안이 없는 seq는 배달하지 않는다. 편지 문안 추가는 후속 콘텐츠 작업.

## 적립 규칙
"오늘의 학습" 1단위(하루 목표) **완료 순간 우표 1장** (PRD 12.2 "1단위 완료당 1장", 모듈 단위 아님). 하루 목표 기본=1세션이라 실질 "학습한 날마다 1장". 우표는 소비되지 않고 영구 누적.

- 트리거: `record_session_complete` 안에서 `daily_studies`를 갱신한 **직후**, 그날이 `is_completed = true` **이고** `stamp_granted = false`이면:
  1. `grant_stamp(v_uid, 1, 'daily_complete', 'day:'||v_uid||':'||v_today, 'daily_studies', <daily_studies.id>)`
  2. `update daily_studies set stamp_granted = true`
  3. 편지 배달 검사(아래) 실행.
- 멱등: `stamp_granted` 플래그 + `grant_stamp`의 `idempotency_key`(하루 1키) 이중 방어. 같은 날 세션을 여러 번 완료해도 우표는 1장.

## 편지 마일스톤 엔진
누적 잔액 기준. 상수는 `app_configs`에서 읽는다.
- `letters.milestone_first` = 3 (첫 편지)
- `letters.milestone_interval` = 14 (이후 간격)
- `letters.total_available` = 2 (현재 작성된 편지 수 = 배달 상한)

k번째 편지 임계값 `threshold(k) = first + interval*(k-1)` → k=1:3, k=2:17, k=3:31 …

**배달 검사** (적립 직후, `record_session_complete` 트랜잭션 내):
```
D := (select count(*) from user_letters where user_id = v_uid);
while D < total_available and balance >= threshold(D+1):
    insert into user_letters(user_id, letter_seq, delivered_on)
      values (v_uid, D+1, v_today);   -- unique(user_id, letter_seq)로 중복 방지
    D := D + 1;
```
- 한 번의 적립으로 여러 통이 동시에 임계를 넘길 수 있으니 while 루프.
- `total_available`가 상한 → 문안 없는 seq는 배달 안 됨. 대표님이 편지 문안을 추가하고 config를 올리면 그때 도착.

## 데이터 모델 — `user_letters`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid not null | `auth.users` 참조, RLS 기준 |
| `letter_seq` | int not null | 편지 콘텐츠 seq(FE `letters.js`) |
| `delivered_on` | date not null | KST 도착일 |
| `read_at` | timestamptz null | 열람 시각(null=안읽음) |
| `created_at` | timestamptz not null default now() | |

- `unique(user_id, letter_seq)` — 재배달 방지.
- RLS: 본인 row만 select/update(읽음 표시). insert는 SECURITY DEFINER RPC에서만(직접 insert 정책 없음).

## 조회·상태 RPC
### `load_stamp_state() returns jsonb` (SECURITY DEFINER, authenticated)
FE가 마일스톤 상수를 중복 계산하지 않도록 표시값을 서버가 계산해 반환.
- `balance` — 현재 우표 수(`stamp_balances`, 없으면 0)
- `delivered` — 배달된 편지 수
- `cycle_have`, `cycle_need` — 현재 주기 진행("다음 편지까지" 게이지). 더 배달할 편지가 없으면(`delivered >= total_available`) `cycle_need = null`.
  - `prev := delivered==0 ? 0 : threshold(delivered)`
  - `next := threshold(delivered+1)`
  - `cycle_have := max(0, balance - prev)`, `cycle_need := next - prev`
- `newest_unread_seq` — `read_at is null`인 편지 중 max seq(없으면 null) → 홈 "편지 도착" 배지.

### `mark_letter_read(p_seq int) returns void` (SECURITY DEFINER, authenticated)
`update user_letters set read_at = now() where user_id = auth.uid() and letter_seq = p_seq and read_at is null`. 편지를 열 때 호출 → 도착 배지 해제.

## FE 배선
### `data/stamps.js` (신규)
- `loadStampState()` → `load_stamp_state` RPC 결과 반환. **게스트/미인증이면 `null`** (스트릭 `loadStreak`와 동일 패턴 → 홈이 데모로 폴백).
- `markLetterRead(seq)` → `mark_letter_read` RPC. 게스트면 no-op.
- `loadDeliveredLetters()` → 본인 `user_letters`(seq·delivered_on·read_at) select, seq 내림차순. 게스트면 `null`.

### 홈 우표 위젯 (`HomeScreen.jsx`)
- `useEffect`로 `loadStampState()` → state. `null`이면 기존 데모(`D.stamp`, `D.letterWaiting`) 유지.
- 실데이터일 때:
  - `newest_unread_seq != null` → "편지가 도착했어요" + 탭 시 `letter` 화면(그 seq).
  - 아니면 "모은 우표" `cycle_have / cycle_need`(+ 진행바) + "다음 편지까지 N장"(`cycle_need - cycle_have`). `cycle_need == null`이면 "다음 편지 준비 중" 류 표기, 탭 시 편지함.
- 스트릭과 동일하게 게스트는 데모 수치 그대로.

### 편지함 (`LetterBoxScreen.jsx`)
- `loadDeliveredLetters()` 결과(배달 목록) × `letters.js` 콘텐츠(seq 조인)로 목록 렌더. 도착일 = `delivered_on`. 안읽음 표시 = `read_at is null`.
- 게스트/`null`이면 기존 데모 목록 유지.

### 편지 상세 (`LetterScreen.jsx`)
- 편지를 열면 `markLetterRead(seq)` 호출(게스트 no-op). 본문·후리가나·해석·답장은 기존 그대로.
- seq→콘텐츠 매핑: `letters.js`에 `getLetterBySeq(seq)` 추가.

## 마일스톤 상수 이중화 방지
`load_stamp_state`가 표시값을 계산해 반환하므로 FE는 first/interval/total을 알 필요가 없다. 상수의 단일 원본 = `app_configs`(BE가 읽음). FE는 RPC 결과만 렌더.

## 게스트·오프라인
- 모든 RPC는 `auth.uid()` 필요. 게스트는 FE에서 `null` 반환 → 홈·편지함 데모 폴백(스트릭과 동일).
- 오프라인 적립은 A 범위 밖(추후). B는 온라인 경로만.

## 검증
- BE: MCP로 `user_letters`·`app_configs` 생성 확인, `record_session_complete` 재실행 시 우표 1장·중복 방지, 잔액 3→편지1·17→편지2 배달, `load_stamp_state` 반환값 스팟 체크(대표님 계정 실데이터는 대표님이 세션 완료 후 확인).
- FE: `npm run build` → preview(5599) 게스트 데모 폴백 정상, 콘솔·네트워크 오류 없음. 로그인 실 배선 end-to-end는 대표님 계정에서 대표님이 확인(내가 대표님 계정에 학습 데이터를 조작하지 않음).

## 범위 밖 (B 아님)
- 편지 문안 추가(seq 3+) — 별도 콘텐츠 작업.
- 오답노트 실데이터(서브프로젝트 C).
- 옛 소비모델 `app_configs` 잔재(`stamp.cost.export.*`, `subscription.monthly_stamp_grant`) 정리 — 별도 정리 작업.
- `record_session_complete`의 다기기 동시성 락(A에서 이월된 사소 항목).

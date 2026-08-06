# Google OAuth 설정 체크리스트 (대표님용)

> 이 단계를 마치면 토모리 앱의 "Google로 시작하기"가 실제로 동작합니다.
> 🔴 클라이언트 시크릿은 Supabase 대시보드에만 입력하세요. 코드·문서·메신저에 남기지 않습니다.

## 1. Google Cloud — OAuth 동의 화면
1. https://console.cloud.google.com → 프로젝트 선택(또는 새로 만들기).
2. `API 및 서비스 → OAuth 동의 화면` → User Type = **외부** → 만들기.
3. 앱 이름 `토모리`, 사용자 지원 이메일, 개발자 연락처 입력 → 저장.
4. 범위(Scopes)는 기본(email·profile)이면 충분 → 저장.

## 2. Google Cloud — OAuth 클라이언트 ID
1. `API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID`.
2. 애플리케이션 유형 = **웹 애플리케이션**.
3. **승인된 리디렉션 URI** 에 아래를 추가:
   `https://vtbprgphfksfffivfnrf.supabase.co/auth/v1/callback`
4. 만들기 → **클라이언트 ID** 와 **클라이언트 보안 비밀** 이 나옵니다(이 창의 값 사용).

## 3. Supabase — Google provider 활성화
1. https://supabase.com/dashboard → 프로젝트 `tomori` → `Authentication → Providers → Google`.
2. **Enable** 켜고, 위 클라이언트 ID·보안 비밀 붙여넣기 → 저장.

## 4. Supabase — Redirect URL 등록
1. `Authentication → URL Configuration`.
2. **Site URL** 과 **Redirect URLs** 에 앱 주소 추가:
   - 개발 프리뷰: `http://localhost:5599`
   - (배포 후) 실제 서비스 URL
3. 저장.

## 5. 앱 코드 — 로그인 활성화 플래그
1. 위 1~4단계를 마쳐 Supabase에 Google provider가 켜졌으면, 앱 코드에서 로그인 잠금을 풉니다.
2. 파일 `개발/프론트엔드_무스부/tomori-app/src/auth/AuthContext.jsx` 에서
   `const GOOGLE_AUTH_READY = false;` 를 `const GOOGLE_AUTH_READY = true;` 로 바꿉니다.
   (이 플래그가 false인 동안은 "Google로 시작하기"가 "로그인 준비 중이에요"만 띄우고 실제 로그인은 하지 않아요 — provider가 아직 없을 때 에러 페이지로 튕기는 걸 막는 안전장치입니다.)
3. 앱을 다시 빌드합니다: `개발/프론트엔드_무스부/tomori-app` 에서 `npm run build`.
4. 이 한 줄 변경은 제(클로드)가 대신 해드릴 수 있어요 — provider를 켜셨다고 알려주시면 됩니다.

## 6. 확인
- 앱에서 MY → "Google로 시작하기" → Google 로그인 → 앱으로 복귀 → MY에 이름·이메일 표시.
- 첫 로그인 시 `users_profile` 행이 자동 생성됩니다(handle_new_user 트리거).

문제가 생기면 저(클로드)에게 화면 캡처와 함께 알려주세요 — 값은 가리고 보내셔도 됩니다.

## 🔴 자주 겪는 문제 (2026-08-07 실검증에서 확인)
- **증상: 로그인 후 빈 화면이 뜨거나 `localhost:3000`으로 튕기고, 주소에 `error_code=bad_oauth_state / OAuth state has expired` 가 붙는다.**
  - **원인**: 4단계의 **Redirect URLs에 `http://localhost:5599`(앱 프리뷰 주소)가 빠져 있음.** 그러면 Supabase가 기본값 Site URL(`http://localhost:3000`)로 되돌려 보내는데, 거기엔 앱이 없어 빈 화면이 된다.
  - **해결**: `Authentication → URL Configuration` → **Redirect URLs**에 `http://localhost:5599` 추가(+ Site URL도 `:3000`이면 `:5599`로) → Save → 로그인 재시도.
  - 🔴 **배포 후엔 실제 서비스 URL도 같은 목록에 추가**해야 함(프리뷰 주소만 넣으면 배포판에서 같은 증상 재발).
- **검증 완료(2026-08-07)**: 위 설정 반영 후 MY → Google 로그인 → :5599 복귀 → 세션 저장(`sb-…-auth-token`) → MY에 `송이 / songl0351@gmail.com` 표시 → `users_profile` 행 확인까지 end-to-end 통과.

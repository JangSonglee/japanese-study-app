# 인증(Google OAuth) 사전설계 · 스캐폴딩 (설계 문서)

- 작성일: 2026-07-31
- 결정자: 대표님
- 상태: 확정 (구현 계획 = writing-plans 후속)
- 관련: PRD 온보딩(10장)·`개발/백엔드_도다이/rls_policy.sql`·`스키마_설계.md` ①계정·설정

## 배경 — 왜 지금 "사전설계·스캐폴딩"인가

인증은 크리티컬 패스다. 오답노트 실저장·스트릭·진도·우표 실데이터가 전부 `auth.uid()`에
의존한다. 그러나 실제 Google OAuth 연결은 **대표님 GCP OAuth 키**가 있어야 완성된다.
그래서 이번 범위는 **키 없이 지금 만들 수 있는 것**(FE 인증 셸·세션·게스트/로그인 분기,
BE 프로필 트리거)과 **키 나오면 붙일 것**(Supabase Google provider 설정)을 분리한다.
키가 도착하면 곧바로 연결되도록 준비만 완비한다.

### 현재 상태 (파악 완료)
- **BE는 준비됨**: RLS가 사용자 데이터 전 테이블(`users_profile`·`study_sessions`·
  `vocab_states`·`track_progress`·`reading_progress`·`daily_studies`·`stamp_ledger`·
  `stamp_balances`)을 `user_id = auth.uid()` 기준으로 보호. 로그인만 되면 본인 데이터가 열린다.
- **프로필 스키마 존재**: `users_profile`(user_id PK → auth.users.id, nickname, main_course_id,
  level_estimate, daily_session_target, motivation_type, streak_count, last_studied_on),
  `user_settings`, `user_goals`(D-day), `onboarding_answers`.
- **FE는 게스트 전용**: `supabaseClient.js` = `persistSession:false`(anon 읽기만),
  MY = "게스트 · 로그인 곧 열려요", 온보딩 없음, 손수 스택 네비(`useRouter`).

## 결정 사항

1. **로그인 후 진입 = 홈으로 바로** (대표님). 로그인 → 세션 확보 → `users_profile` 보장(트리거)
   → 홈. 닉네임은 Google 계정명 임시 사용. **4문항 진단 온보딩·코스 추천 UI는 범위 밖 후속.**
2. **프로필 생성 = DB 트리거**(`handle_new_user`). FE upsert가 아니라 서버에서 원자적으로.
3. **게스트 우선 원칙 유지**: 콘텐츠 열람·학습은 게스트도 무제한(anon RLS = is_published 읽기).
   로그인은 "내 데이터를 남기기 위한" 선택이지 학습의 전제가 아니다(PRD 1.3 철학과 정합).

## 아키텍처

### ① FE 인증 셸 (지금 구현)

**`supabaseClient.js` 개정**
```
auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
```
- OAuth 리다이렉트 후 URL 해시의 토큰을 `detectSessionInUrl`이 세션으로 흡수.
- 게스트(세션 없음)는 여전히 anon 키로 공개 콘텐츠를 읽는다 — 회귀 없음.

**`AuthContext` + `useAuth` 훅 (신설, `ThemeContext` 패턴)**
- 상태: `{ session, user, loading }`.
- 액션: `signInWithGoogle()` = `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <앱 URL> } })`,
  `signOut()` = `supabase.auth.signOut()`.
- 마운트 시 `getSession()`으로 초기화 + `onAuthStateChange`로 구독(로그인/로그아웃/토큰갱신 반영).
- 🔴 **provider 미설정(키 없음) 방어**: `signInWithGoogle()`이 반환/throw하는 provider 관련
  에러를 잡아, 화면에는 "로그인 준비 중이에요"만 노출(콘솔 크래시 금지). 키 붙으면 자동 정상화.
- 인터페이스가 좁아 Expo 이식 때 교체 지점이 작다.

**`App.jsx`**: `<AuthProvider>`로 감싼다(`ThemeProvider`와 동급). 로그인 후 진입=홈이라
네비 게이팅은 최소 — 세션 변화 시 MY 화면만 자동 갱신(전역 리셋 없음).

**`MyScreen.jsx` 분기**
- 게스트: 프로필 카드에 "Google로 시작하기" 버튼(`signInWithGoogle`) + "로그인하면 오답노트·
  스트릭·진도가 기기 너머로 이어져요" 안내. 토모 = 평소 밝기.
- 로그인: 닉네임(=계정명)·이메일 표시 + "로그아웃" 행. 실 통계 배선은 후속(로그인 전제 데이터).

### ② BE (지금 구현, 키 불필요)

**`handle_new_user` 트리거 마이그레이션**
- `auth.users` INSERT AFTER 트리거 → `public.handle_new_user()` (SECURITY DEFINER, `search_path=public`)가
  `users_profile(user_id, nickname)` 행 삽입(`on conflict do nothing`).
  nickname = `new.raw_user_meta_data->>'name'` (Google 계정명) 또는 이메일 로컬파트 폴백.
- 🔴 **구현 시 확정(2026-07-31)**: 스키마 *설계 문서*엔 `user_settings`가 있으나 **라이브 DB엔 미존재**(테이블 24개, user_settings 없음). 현재 읽기도움 설정은 FE localStorage(`tomori.readAid`)라 실사용이 없으므로 **트리거는 `users_profile`만 생성**하고 user_settings 삽입은 뺐다. 테이블 생성은 실사용 시 후속.
- 🔴 SECURITY DEFINER 함수의 EXECUTE는 public/anon/authenticated에서 회수(어드바이저 경고 0). 트리거 발화는 내부 호출이라 무관.
- 실제 발화는 실 가입 시점이지만 미리 심어두면 키 연결 즉시 프로필이 채워진다.

### ③ 대표님 GCP 준비 체크리스트 (문서 산출물)

별도 안내 문서(`개발/백엔드_도다이/GOOGLE_OAUTH_설정_체크리스트.md`)로:
1. Google Cloud Console → OAuth 동의 화면(외부, 앱 이름·지원 이메일·스코프 email/profile).
2. 사용자 인증 정보 → OAuth 2.0 클라이언트 ID(웹 애플리케이션) → **클라이언트 ID·시크릿** 발급.
3. 승인된 리디렉션 URI = **Supabase 콜백** `https://vtbprgphfksfffivfnrf.supabase.co/auth/v1/callback`.
4. Supabase 대시보드 → Authentication → Providers → Google → ID·시크릿 입력·활성화.
5. Authentication → URL Configuration → Site URL·Redirect URLs에 앱 URL 등록
   (개발 프리뷰 `http://localhost:5599` + 배포 URL).
- 🔴 키·시크릿은 커밋 금지. 대표님이 Supabase 대시보드에 직접 입력(제가 값을 보지 않는다).

## 무엇이 로그인 전제인가 (경계)

| 기능 | 게스트 | 로그인 |
|---|---|---|
| 콘텐츠 열람·학습(단어·문법·독해·청해) | ✅ 무제한 | ✅ |
| 오답노트 **실저장**, 스트릭·진도·우표 **실데이터** | ❌(현재 데모·로컬) | ✅(`auth.uid()` RLS) |
| PDF 다운로드 | (월 5회 정책은 인증 후 카운트) | ✅ |

## 범위 밖 (후속)
- 4문항 진단 온보딩 UI + 코스 추천(PRD 10장) — 별도 브레인스토밍.
- 실 스트릭/우표 적립·오답노트 저장 로직 — 트리거·엣지함수·FE 배선.
- 세션 만료·재로그인 UX 정교화, 계정 삭제(프로필·데이터 파기).

## 검증
- FE: 빌드0 + @5599에서 게스트 MY에 "Google로 시작하기" 노출·클릭 시 "준비 중" 안내(키 전),
  콘솔0. persistSession 켠 뒤 공개 콘텐츠 읽기 회귀 없음 확인.
- BE: 트리거 마이그레이션 적용 + `pg_trigger`로 존재 검증(실 가입은 키 후이므로 로직 검증까지).

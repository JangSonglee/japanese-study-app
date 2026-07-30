# 인증(Google OAuth) 사전설계·스캐폴딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google OAuth 인증의 FE 셸·세션·게스트/로그인 분기와 BE 프로필 트리거를 GCP 키 없이 미리 완성해, 키가 도착하면 곧바로 로그인이 동작하도록 한다.

**Architecture:** FE는 `AuthContext`(ThemeContext 패턴)가 Supabase 세션을 구독하고 `useAuth`로 노출한다. MyScreen이 이를 소비해 게스트/로그인을 분기한다. BE는 `handle_new_user` 트리거가 회원가입 시 `users_profile`+`user_settings` 기본행을 만든다. 실제 OAuth 연결은 대표님이 Supabase 대시보드에 GCP 키를 넣는 순간 활성화된다.

**Tech Stack:** React + React Native Web + Vite, `@supabase/supabase-js`, Supabase Auth(Google provider), Supabase MCP(마이그레이션·검증).

## Global Constraints

- 🔴 이 프로젝트엔 유닛 테스트 프레임워크가 없다. **검증 = `npm run build` 성공 + 브라우저 프리뷰(@5599, `.claude/launch.json`의 `fe`) + 콘솔0**, BE는 **Supabase MCP**로 검증. dev 서버·HMR 금지(빌드 후 preview).
- 🔴 원시 hex 를 컴포넌트가 직접 쓰지 않는다 — 반드시 `theme/tokens.js` 토큰(디자인시스템 v3.2/v3.3). 앰버=`t.brand`·`t.onBrand`.
- 🔴 한국어 문장형 텍스트엔 `keepAll`(어절 줄바꿈) 스프레드.
- 🔴 커밋은 각 태스크 끝에서. GCP 키·시크릿·`db_url.txt`는 커밋 금지(대표님이 Supabase 대시보드에 직접 입력, 값을 코드/로그에 남기지 않는다).
- 🔴 게스트 콘텐츠 읽기 회귀 금지 — anon RLS(is_published) 읽기가 persistSession 변경 후에도 동일하게 동작해야 한다.
- Supabase 프로젝트 ref = `vtbprgphfksfffivfnrf`. 콜백 = `https://vtbprgphfksfffivfnrf.supabase.co/auth/v1/callback`.

---

## File Structure

- `개발/프론트엔드_무스부/tomori-app/src/data/supabaseClient.js` — **수정**. persistSession 등 auth 옵션.
- `개발/프론트엔드_무스부/tomori-app/src/auth/AuthContext.jsx` — **신규**. `AuthProvider` + `useAuth`.
- `개발/프론트엔드_무스부/tomori-app/src/App.jsx` — **수정**. `<AuthProvider>`로 감싸기.
- `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx` — **수정(렌더 재작성)**. 게스트/로그인 분기.
- BE 마이그레이션 `handle_new_user_trigger` — Supabase MCP `apply_migration`.
- `개발/백엔드_도다이/GOOGLE_OAUTH_설정_체크리스트.md` — **신규**. 대표님 GCP 준비 안내.

---

## Task 1: FE 인증 세션 레이어 (supabaseClient + AuthContext + App)

세 파일이 함께여야 처음으로 빌드·구동 가능하므로 한 태스크로 묶는다. 화면 변화는 없고, "게스트로 여전히 동작 + 세션 배관 존재"가 산출물.

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/data/supabaseClient.js:10-12`
- Create: `개발/프론트엔드_무스부/tomori-app/src/auth/AuthContext.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/App.jsx` (return 트리를 AuthProvider로 감쌈)

**Interfaces:**
- Produces: `AuthProvider` (React 컴포넌트, `children`), `useAuth()` → `{ session, user, loading, signInWithGoogle, signOut }`.
  - `signInWithGoogle(): Promise<{ ok: boolean, error?: string }>` — 성공 시 Google로 페이지 리다이렉트(반환 전 이탈 가능), provider 미설정 시 `{ ok:false, error }`.
  - `signOut(): Promise<void>`.
  - `user`: Supabase User 객체 또는 `null`. `session`: Session 또는 `null`.

- [ ] **Step 1: supabaseClient 의 auth 옵션 교체**

`supabaseClient.js` 의 createClient 호출을 아래로 바꾼다. 주석도 슬라이스→인증 준비로 갱신.

```js
// supabaseClient.js — 토모리 실 DB 접속.
// 🔴 publishable(anon) 키는 클라이언트 공개용 — RLS가 데이터를 보호한다.
//    게스트는 이 키로 is_published=true 콘텐츠만 읽고, 로그인하면 auth.uid() 로 본인 데이터가 열린다.
// 정식에서는 vite env(import.meta.env.VITE_*)로 빼는 게 맞지만, 슬라이스라 상수로 둔다.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vtbprgphfksfffivfnrf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-FbMIZH5xxfMH43S8VRLTQ_BZ8fdFF6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  // 인증 스캐폴드(2026-07-31): OAuth 리다이렉트 세션 감지 + 유지 + 자동 갱신.
  // 세션이 없으면 anon 키로 공개 콘텐츠만 읽는다(게스트) — 회귀 없음.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```

- [ ] **Step 2: AuthContext.jsx 생성**

`src/auth/AuthContext.jsx` 신규. ThemeContext 패턴을 따른다.

```jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../data/supabaseClient';

/**
 * 인증 컨텍스트 (2026-07-31 스캐폴드).
 *  · Supabase 세션을 구독해 { session, user, loading } 로 노출.
 *  · signInWithGoogle: Google OAuth 시작. provider 미설정(GCP 키 전)이면 { ok:false } 로 방어.
 *  · Expo 이식 때 교체 지점이 좁도록 인터페이스를 얇게 유지.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true }; // 성공 시엔 Google 로 리다이렉트되어 이 코드 이후는 실행 안 될 수 있음
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = { session, user: session?.user ?? null, loading, signInWithGoogle, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: App.jsx 를 AuthProvider 로 감싸기**

`App.jsx` 상단 import 에 추가:

```js
import { AuthProvider } from './auth/AuthContext';
```

그리고 `export default function App()` 의 `return (` 직후 최상위 `<View style={styles.stage}>` 를 `<AuthProvider>...</AuthProvider>` 로 감싼다. 즉:

```jsx
  return (
    <AuthProvider>
      <View style={styles.stage}>
        {/* ...기존 내용 그대로... */}
      </View>
    </AuthProvider>
  );
```

App 상단의 훅(useState/useRouter/useEffect)은 그대로 두고, AuthProvider 는 반환 트리만 감싼다.

- [ ] **Step 4: 빌드 검증**

Run: `cd "개발/프론트엔드_무스부/tomori-app" && npm run build`
Expected: `✓ built` (에러 0). import 경로(`./auth/AuthContext`) 해결 확인.

- [ ] **Step 5: 프리뷰 회귀 검증 (게스트 무회귀)**

`.claude/launch.json` 의 `fe`(port 5599) 프리뷰를 띄우고 `http://localhost:5599` 로드.
- 홈이 게스트로 정상 렌더되는지 확인(스크린샷 또는 read_page).
- 단어 세션 하나 진입해 실 Supabase 콘텐츠가 여전히 읽히는지 확인(persistSession 변경 회귀 없음).
- `read_console_messages(onlyErrors:true)` = 에러 0.

- [ ] **Step 6: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/data/supabaseClient.js" "개발/프론트엔드_무스부/tomori-app/src/auth/AuthContext.jsx" "개발/프론트엔드_무스부/tomori-app/src/App.jsx"
git commit -m "feat(auth): FE 인증 세션 레이어 — supabase persistSession + AuthContext/useAuth"
```

---

## Task 2: MyScreen 게스트/로그인 분기

`useAuth` 를 소비해 게스트=「Google로 시작하기」, 로그인=닉네임·이메일+로그아웃. 화면으로 검증 가능한 산출물.

**Files:**
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx` (렌더 재작성 + 스타일 3개 추가)

**Interfaces:**
- Consumes: `useAuth()` → `{ user, signInWithGoogle, signOut }` (Task 1).

- [ ] **Step 1: MyScreen.jsx 를 아래 전체 내용으로 교체**

(MenuRow·makeStyles 는 유지하되 googleBtn/googleText/authMsg 스타일을 추가한다.)

```jsx
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { fonts, radius, keepAll } from '../theme/tokens';

/**
 * MY 홈 (Hi-fi 34) — 프로필 요약 + 메뉴.
 * 인증 스캐폴드(2026-07-31): 게스트=「Google로 시작하기」, 로그인=닉네임·이메일+로그아웃.
 *  · 콘텐츠 학습은 게스트도 무제한(PRD 1.3). 로그인은 내 데이터(오답노트·스트릭·진도·우표)를 남기는 선택.
 *  · 🔴 provider 미설정(GCP 키 전)엔 signInWithGoogle이 에러 → 「준비 중」 안내로 방어(크래시 금지).
 */
export default function MyScreen({ nav }) {
  const { t } = useTheme();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [authMsg, setAuthMsg] = useState('');
  const S = makeStyles(t);

  const nickname = user ? (user.user_metadata?.name || user.email?.split('@')[0] || '학습자') : null;

  async function onGoogle() {
    setAuthMsg('');
    const r = await signInWithGoogle();
    if (!r.ok) setAuthMsg('로그인 준비 중이에요. 곧 열려요.');
    // 성공 시엔 Google 로 리다이렉트되어 이 화면을 떠난다.
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={() => nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.title, { color: t.textHigh }]}>MY</Text>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 프로필 요약 — 게스트/로그인 분기. 토모(평소 밝기·말 없음). */}
        <View style={[S.profile, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
          <View style={S.tomoWrap}>
            <Tomo scale={0.7} pose="bright" showNote={false} />
          </View>
          <View style={S.profileText}>
            <Text style={[S.name, { color: t.textHigh }]}>{user ? nickname : '게스트'}</Text>
            <Text style={[S.subtle, { color: t.textMid }, keepAll]}>
              {user ? user.email : '로그인하면 오답노트·스트릭·진도가 기기 너머로 이어져요'}
            </Text>
          </View>
        </View>

        {/* 로그인 액션 (게스트일 때만) */}
        {!user ? (
          <>
            <Pressable
              onPress={onGoogle}
              accessibilityRole="button"
              accessibilityLabel="Google로 시작하기"
              style={[S.googleBtn, { backgroundColor: t.brand }]}
            >
              <Text style={[S.googleText, { color: t.onBrand }]}>Google로 시작하기</Text>
            </Pressable>
            {authMsg ? <Text style={[S.authMsg, { color: t.textMid }, keepAll]}>{authMsg}</Text> : null}
          </>
        ) : null}

        {/* 학습 — 코스 전환. IA(03·Core Flows): 코스 전환은 MY·설정에서. */}
        <Text style={[S.section, { color: t.textLow }]}>학습</Text>
        <MenuRow t={t} label="코스 전환" onPress={() => nav.push('courses')} />

        {/* 설정 */}
        <Text style={[S.section, { color: t.textLow }]}>설정</Text>
        <MenuRow t={t} label="설정 · 읽기 도움" onPress={() => nav.push('settings')} />
        <MenuRow t={t} label="서비스 정보" onPress={() => nav.push('about')} />

        {/* 계정 (로그인일 때만) */}
        {user ? (
          <>
            <Text style={[S.section, { color: t.textLow }]}>계정</Text>
            <MenuRow t={t} label="로그아웃" onPress={signOut} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MenuRow({ t, label, onPress }) {
  const S = makeStyles(t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[S.row, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}
    >
      <Text style={[S.rowLabel, { color: t.textHigh }]}>{label}</Text>
      <Icon name="forward" size={20} color={t.textLow} />
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    back: { fontSize: 26, width: 20 },
    title: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 10 },
    profile: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.lg, padding: 16,
    },
    tomoWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    profileText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.ko, fontSize: 16, fontWeight: '700' },
    subtle: { fontFamily: fonts.ko, fontSize: 12, ...keepAll },
    googleBtn: { height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    googleText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    authMsg: { fontFamily: fonts.ko, fontSize: 12, textAlign: 'center', ...keepAll },
    section: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600', marginTop: 6 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: radius.lg, padding: 16,
    },
    rowLabel: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
    chev: { fontFamily: fonts.ko, fontSize: 22 },
  });
}
```

- [ ] **Step 2: 빌드 검증**

Run: `cd "개발/프론트엔드_무스부/tomori-app" && npm run build`
Expected: `✓ built` (에러 0).

- [ ] **Step 3: 프리뷰 — 게스트 상태 검증**

프리뷰 리로드 → 홈 → MY 진입.
- 프로필 = "게스트" + "로그인하면 오답노트·스트릭·진도가 기기 너머로 이어져요".
- "Google로 시작하기"(앰버) 버튼 노출.
- 버튼 클릭 → provider 미설정이라 **"로그인 준비 중이에요. 곧 열려요."** 안내가 뜨고 크래시/콘솔에러 없음.
- `read_console_messages(onlyErrors:true)` = 에러 0. 스크린샷 1장 확보.

- [ ] **Step 4: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/screens/MyScreen.jsx"
git commit -m "feat(auth): MyScreen 게스트/로그인 분기 — Google 시작 버튼 + 준비중 방어"
```

---

## Task 3: BE — handle_new_user 트리거

회원가입(auth.users INSERT) 시 `users_profile`+`user_settings` 기본행을 서버에서 원자적으로 생성. Supabase MCP 로 적용·검증.

**Files:**
- Supabase 마이그레이션 `handle_new_user_trigger` (MCP `apply_migration`).

**Interfaces:**
- Produces: `public.handle_new_user()` 함수 + `on_auth_user_created` 트리거(auth.users AFTER INSERT).

- [ ] **Step 1: 사전 확인 — 기존 트리거·컬럼 검증**

Supabase MCP `execute_sql` 로 아래를 확인(적용 전 안전 점검):
```sql
-- 기존 트리거 유무
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- users_profile / user_settings 의 NOT NULL 컬럼(디폴트 없는 것) 파악
select table_name, column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('users_profile','user_settings')
order by table_name, ordinal_position;
```
Expected: `on_auth_user_created` 부재. `users_profile` 는 user_id 외 대부분 nullable, `user_settings` 는 theme/furigana_default/romaji_default 존재. NOT NULL·무디폴트 컬럼이 더 있으면 Step 2 insert 에 그 컬럼도 채운다.

- [ ] **Step 2: 마이그레이션 적용**

Supabase MCP `apply_migration` (name: `handle_new_user_trigger`):
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users_profile (user_id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id, theme, furigana_default, romaji_default)
  values (new.id, 'light', true, false)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```
🔴 Step 1 에서 NOT NULL·무디폴트 컬럼이 더 발견되면 해당 insert 컬럼 목록에 추가한 뒤 적용한다.

- [ ] **Step 3: 적용 검증**

Supabase MCP `execute_sql`:
```sql
select tgname, tgenabled from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
select proname, prosecdef from pg_proc where proname = 'handle_new_user';
```
Expected: 트리거 1행(`tgenabled='O'`), 함수 1행(`prosecdef=true`). 보안 어드바이저(`get_advisors type=security`) 신규 경고 0 확인.

- [ ] **Step 4: 기록 (git 아님 — DB는 클라우드)**

`기획/진행상태.md` 에 마이그레이션명·검증결과 한 줄 기록하고 커밋:
```bash
git add "기획/진행상태.md"
git commit -m "docs(auth): handle_new_user 트리거 적용 기록"
```

---

## Task 4: 대표님 GCP 설정 체크리스트 문서

키 없이 준비 완료. 대표님이 GCP OAuth 키를 만들어 Supabase 에 넣는 단계별 안내.

**Files:**
- Create: `개발/백엔드_도다이/GOOGLE_OAUTH_설정_체크리스트.md`

- [ ] **Step 1: 체크리스트 문서 작성**

아래 내용으로 파일 생성:

```markdown
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

## 5. 확인
- 앱에서 MY → "Google로 시작하기" → Google 로그인 → 앱으로 복귀 → MY에 이름·이메일 표시.
- 첫 로그인 시 `users_profile`·`user_settings` 행이 자동 생성됩니다(handle_new_user 트리거).

문제가 생기면 저(클로드)에게 화면 캡처와 함께 알려주세요 — 값은 가리고 보내셔도 됩니다.
```

- [ ] **Step 2: 커밋**

```bash
git add "개발/백엔드_도다이/GOOGLE_OAUTH_설정_체크리스트.md"
git commit -m "docs(auth): 대표님 Google OAuth 설정 체크리스트"
```

---

## 완료 후 (진행상태 기록)

모든 태스크 후 `기획/진행상태.md` 에 세션 요약 기록(무엇을 스캐폴드했는지·키 후 무엇이 동작하는지·범위 밖 후속=진단 온보딩·실 적립). 이미 Task 3 Step 4 에서 트리거를 기록했으므로 FE·문서 완료분을 덧붙인다.

## Self-Review 결과 (작성자 점검)

- **Spec coverage**: FE 셸(supabaseClient·AuthContext·App=Task1, MyScreen=Task2), BE 트리거(Task3), GCP 체크리스트(Task4), 경계 문서화(spec+진행상태) — 스펙 ①②③④ 전부 태스크로 매핑됨. 4문항 온보딩·실 적립은 스펙에서 명시적 범위 밖 → 태스크 없음(정상).
- **Placeholder scan**: 코드·SQL·문서 전부 실제 내용. "적절히 처리" 류 없음. Task3 Step1의 컬럼 확인은 조건부 실제 지시(무디폴트 NOT NULL 발견 시 컬럼 추가).
- **Type consistency**: `useAuth()` 반환 `{session,user,loading,signInWithGoogle,signOut}` 이 Task1 정의 = Task2 소비와 일치. `signInWithGoogle` 반환 `{ok,error}` 형태 Task1↔Task2 일치. 트리거명 `on_auth_user_created`·함수명 `handle_new_user` Step2↔Step3 일치.

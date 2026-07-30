import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../data/supabaseClient';

/**
 * 인증 컨텍스트 (2026-07-31 스캐폴드).
 *  · Supabase 세션을 구독해 { session, user, loading } 로 노출.
 *  · signInWithGoogle: Google OAuth 시작. provider 미설정(GCP 키 전)이면 { ok:false } 로 방어.
 *  · Expo 이식 때 교체 지점이 좁도록 인터페이스를 얇게 유지.
 */

// Google provider가 Supabase에 아직 설정되지 않았다(대표님 GCP 키 대기).
// 설정 전에 signInWithOAuth를 호출하면 Supabase authorize 에러 페이지로 리다이렉트되어버린다.
// → 준비되기 전엔 호출하지 않고 즉시 { ok:false }로 돌려보내 「준비 중」 안내만 띄운다.
// 🔴 대표님이 Google provider를 켠 뒤 이 값을 true로 바꾼다(GOOGLE_OAUTH_설정_체크리스트.md 참조).
const GOOGLE_AUTH_READY = false;

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
    if (!GOOGLE_AUTH_READY) return { ok: false, error: 'provider-not-ready' };
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

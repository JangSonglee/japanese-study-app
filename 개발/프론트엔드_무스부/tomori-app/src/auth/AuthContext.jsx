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

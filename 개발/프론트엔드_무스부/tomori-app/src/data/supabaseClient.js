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

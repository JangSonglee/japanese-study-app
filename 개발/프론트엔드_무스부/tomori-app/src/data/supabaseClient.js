// supabaseClient.js — 토모리 실 DB 접속(읽기 슬라이스).
// 🔴 publishable(anon) 키는 클라이언트 공개용 — RLS가 데이터를 보호한다.
//    이 키로는 is_published=true 인 콘텐츠만 읽힌다(사용자 데이터·미공개는 RLS가 차단).
// 정식에서는 vite env(import.meta.env.VITE_*)로 빼는 게 맞지만, 슬라이스라 상수로 둔다.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vtbprgphfksfffivfnrf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-FbMIZH5xxfMH43S8VRLTQ_BZ8fdFF6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },   // 슬라이스는 로그인 없음(anon 읽기만)
});

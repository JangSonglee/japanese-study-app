// 홈 실데이터 — 이어서 학습(단어 진도)·오늘 진행한 학습·복습 대상.
// 로그인 시 실 Supabase, 게스트면 null(→ 화면 데모 폴백).
import { supabase } from './supabaseClient';

// { level, has_level, vocab_done, vocab_total, today_sessions, studied_today, today_known } | null
export async function loadHomeProgress() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_home_progress');
  if (error) return null;
  return data;
}

// 「안다」로 표시한 단어(content_key 배열)를 진도에 적립. 게스트면 no-op.
export async function recordVocabKnown(keys) {
  const arr = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!arr.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('record_vocab_known', { p_keys: arr });
}

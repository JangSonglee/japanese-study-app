// 우표·편지 실데이터(로그인 시). 서버 RPC가 마일스톤 표시값을 계산해 반환.
// 게스트/미인증이면 null(또는 no-op) → 화면이 데모로 폴백(스트릭 study.js와 동일).
import { supabase } from './supabaseClient';

// { balance, delivered, cycle_have, cycle_need, newest_unread_seq } | null
export async function loadStampState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_stamp_state');
  if (error) return null;
  return data;
}

// 편지 열람 시 도착 배지 해제. 게스트면 no-op.
export async function markLetterRead(seq) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('mark_letter_read', { p_seq: seq });
}

// 배달된 편지 목록(seq·도착일·읽음). 게스트면 null. seq 내림차순.
export async function loadDeliveredLetters() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_letters')
    .select('letter_seq, delivered_on, read_at')
    .order('letter_seq', { ascending: false });
  if (error) return null;
  return data;
}

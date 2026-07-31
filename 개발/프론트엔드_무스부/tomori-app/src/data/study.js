// 학습 세션 실데이터(로그인 시). 서버 RPC가 기록·스트릭을 원자 처리.
import { supabase } from './supabaseClient';

// YYYY-MM-DD (클라 로컬=KST 사용자 기준, 서버 KST study_date와 매칭).
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function recordSessionComplete(source, correct, wrong, attempts = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('record_session_complete', {
    p_source: source, p_correct: correct | 0, p_wrong: wrong | 0,
    p_attempts: Array.isArray(attempts) ? attempts : [],
  });
  if (error) throw error;
  return data;
}

export async function loadStreak() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof, error: e1 } = await supabase
    .from('users_profile').select('streak_count').maybeSingle();
  if (e1) throw e1;
  const { data: days, error: e2 } = await supabase
    .from('daily_studies').select('study_date').order('study_date', { ascending: false }).limit(30);
  if (e2) throw e2;
  const studied = new Set((days || []).map((d) => d.study_date));
  const week = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    week.push(studied.has(localISO(d)));
  }
  return { days: prof?.streak_count || 0, week };
}

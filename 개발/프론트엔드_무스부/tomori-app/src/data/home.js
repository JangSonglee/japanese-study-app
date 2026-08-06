// 홈 실데이터 — 이어서 학습(단어 진도)·오늘 진행한 학습·복습 대상.
// 로그인 시 실 Supabase, 게스트면 null(→ 화면 데모 폴백).
import { supabase } from './supabaseClient';
import { loadCardsByKeys, loadGrammarByKeys, loadReadingByKeys, loadListeningByKeys } from './vocab';

// 세션 서명 "source|level|k1,k2,..." → { source, level, keys }
export function parseSessionSig(sig) {
  if (!sig || typeof sig !== 'string') return null;
  const [source = '', level = '', keysCsv = ''] = sig.split('|');
  const keys = keysCsv ? keysCsv.split(',').filter(Boolean) : [];
  return { source, level, keys };
}

// 3분복습 — 서명으로 그 세션의 실제 항목을 로드(복습용, 읽기 전용 표시).
export async function loadReviewItems(sig) {
  const p = parseSessionSig(sig);
  if (!p || !p.keys.length) return { source: p ? p.source : '', level: p ? p.level : '', items: [] };
  let items = [];
  if (p.source === 'vocab') items = await loadCardsByKeys(p.keys);
  else if (p.source === 'grammar') items = await loadGrammarByKeys(p.keys);
  else if (p.source === 'reading') items = await loadReadingByKeys(p.keys);
  else if (p.source === 'listening') items = await loadListeningByKeys(p.keys);
  return { source: p.source, level: p.level, items };
}

// 오늘의 표현 — 사용자 급수의 공개 표현 중 일자 결정 1개. { ja_text, reading, ruby, meaning_ko, words, level } | null
export async function loadDailyExpression() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_daily_expression');
  if (error) return null;
  return data;
}

// "시험 일정 등록" — 다가오는 JLPT(config)를 사용자 시험일로 등록. 게스트 no-op.
export async function registerUpcomingExam() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('register_upcoming_exam');
  if (error) return null;
  return data; // 등록된 날짜(YYYY-MM-DD) | null
}

// 다가오는 JLPT 회차 목록(YYYY-MM-DD 배열). 게스트면 [].
export async function listExamDates() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.rpc('list_exam_dates');
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

// 사용자 시험일을 선택한 날짜로 설정. 게스트 no-op.
export async function setExamDate(dateStr) {
  if (!dateStr) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('set_exam_date', { p_date: dateStr });
}

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

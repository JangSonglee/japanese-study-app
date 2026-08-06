// 나만의 단어장(통합) — 저장 단어 실데이터. 로그인 시 실 Supabase, 게스트면 no-op/[].
//  · PRD §6: 저장 단어를 한 곳에 모으고 단일 태그(현재 JLPT만) + 급수(level) 속성.
//  · dedup_key = 카탈로그 단어면 content_key, 아니면 'x:<source>:<ja>'(표현 단어 등).
import { supabase } from './supabaseClient';

// 저장 식별키. 카탈로그(content_key) 우선, 없으면 source+표제로 생성.
export function wordDedup({ contentKey, source = 'vocab', ja = '' }) {
  return contentKey || `x:${source}:${ja}`;
}

// 저장(별 켬). w = { dedup, ja, reading, ruby, meaning, tag, level, source, contentKey }
export async function saveWord(w) {
  if (!w || !w.dedup) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('save_word', {
    p_dedup: w.dedup,
    p_ja: w.ja || '',
    p_reading: w.reading || '',
    p_ruby: w.ruby || null,
    p_meaning: w.meaning || '',
    p_tag: w.tag || 'JLPT',
    p_level: w.level || null,
    p_source: w.source || 'vocab',
    p_content_key: w.contentKey || null,
  });
}

// 해제(별 끔).
export async function unsaveWord(dedup) {
  if (!dedup) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('unsave_word', { p_dedup: dedup });
}

// 저장 단어 전체(최신순). 게스트면 []. 각 원소 = { dedup, ja, reading, ruby, meaning, tag, level, source, content_key }
export async function loadSavedWords() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.rpc('load_saved_words');
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

// 저장된 dedup_key 집합(별 상태 프리로드용). 게스트면 빈 Set.
export async function loadSavedKeys() {
  const rows = await loadSavedWords();
  return new Set(rows.map((r) => r.dedup));
}

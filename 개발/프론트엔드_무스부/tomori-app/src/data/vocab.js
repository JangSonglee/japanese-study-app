// vocab.js — N5 단어 CSV(규격 4.1, 17열)를 런타임에 읽어 카드 데이터로.
// 🔴 이 슬라이스는 「실데이터가 진짜로 물리는가」를 보는 것이라, 슈슈의 CSV 원본을
//    그대로 fetch 해 파싱한다. 정식 파이프라인에서는 도다이의 서버 JSON(좌표 완료본)을
//    받으므로 rubyToJson 호출이 사라지고 파싱도 서버가 한다.

import { rubyToJson } from './rubyParse';
import { supabase } from './supabaseClient';

// RFC4180 최소 파서 — 따옴표 안 쉼표/줄바꿈 보존 (example_ja 에 쉼표·브래킷 있음).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  // BOM 제거
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function rowsToObjects(rows) {
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.length > 1 && r[0])
    .map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = r[idx] ?? ''; });
      return o;
    });
}

// CSV 한 행 → 카드 뷰모델. 후면 표기(headword)의 루비, 예문 루비까지 좌표화.
export function toCard(o) {
  let front, example;
  try {
    front = rubyToJson(o.ruby);
  } catch (e) {
    // 조용히 넘어가지 않는다 — 화면에 깨진 케이스로 노출 (규격 3.1-4)
    front = { base: o.headword, ruby: [], reading: o.reading, error: String(e.message || e) };
  }
  if (o.example_ja && o.example_ja !== '-') {
    try { example = rubyToJson(o.example_ja); }
    catch { example = { base: o.example_ja, ruby: [], reading: '' }; }
  }
  return {
    key: o.content_key,
    level: o.level_code,
    headword: o.headword,
    reading: o.reading,
    front,                      // {base, ruby:[{s,e,rt}], reading}
    romajiKo: o.romaji_ko,      // 한글 발음
    pos: o.pos,
    meaning: o.meaning_ko,
    meaningAlt: o.meaning_ko_alt && o.meaning_ko_alt !== '-' ? o.meaning_ko_alt : '',
    example,                    // {base, ruby} | undefined
    exampleKo: o.example_ko && o.example_ko !== '-' ? o.example_ko : '',
  };
}

// DB 행 → 카드. 🔴 DB의 ruby 는 이미 좌표 JSON({base,ruby})이라 변환 불필요.
//   예문은 브래킷 원문(example_ja)만 저장돼 있어 클라이언트에서 좌표화한다(기존 로직 재사용).
export function dbRowToCard(o) {
  let example;
  if (o.example_ja && o.example_ja !== '-') {
    try { example = rubyToJson(o.example_ja); }
    catch { example = { base: o.example_ja, ruby: [], reading: '' }; }
  }
  const front = o.ruby && o.ruby.base
    ? { base: o.ruby.base, ruby: o.ruby.ruby || [], reading: o.reading }
    : { base: o.headword, ruby: [], reading: o.reading };
  return {
    key: o.content_key,
    level: o.course_levels?.code || o.level_code || '',
    headword: o.headword,
    reading: o.reading,
    front,
    romajiKo: o.romaji_ko,
    pos: o.pos,
    meaning: o.meaning_ko,
    meaningAlt: o.meaning_ko_alt && o.meaning_ko_alt !== '-' ? o.meaning_ko_alt : '',
    example,
    exampleKo: o.example_ko && o.example_ko !== '-' ? o.example_ko : '',
  };
}

// 앱에 노출하는 급수(사용자가 만나는 순서). RLS가 is_published=false·미공개 레벨을 차단하므로
// anon 키로도 공개 콘텐츠만 온다.
export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CARD_SELECT =
  'content_key, headword, reading, ruby, romaji_ko, pos, meaning_ko, meaning_ko_alt, example_ja, example_ko, course_levels!inner(code)';

// 🔴 실 Supabase에서 지정 급수(is_published=true)만 읽는다.
export async function loadCards(level = 'N5', limit = 10) {
  const { data, error } = await supabase
    .from('vocab_items')
    .select(CARD_SELECT)
    .eq('course_levels.code', level)
    .order('content_key', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!data || !data.length) throw new Error(`${level} 공개 콘텐츠가 0건 (is_published 확인 필요)`);
  return data.map(dbRowToCard);
}

// 하위호환 별칭.
export async function loadN5Cards(limit = 10) {
  return loadCards('N5', limit);
}

// 이미지 있는 content_key 목록(public/images/vocab/manifest.json). optimize 스크립트가 생성.
export async function loadImageManifest() {
  try {
    const res = await fetch('images/vocab/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// 특정 content_key 목록으로 카드 로드(순서 유지). 이미지 데모·매니페스트 우선노출용.
export async function loadCardsByKeys(keys) {
  const { data, error } = await supabase.from('vocab_items').select(CARD_SELECT).in('content_key', keys);
  if (error) throw new Error('Supabase: ' + error.message);
  const byKey = {};
  (data || []).forEach((o) => { byKey[o.content_key] = o; });
  return keys.map((k) => byKey[k]).filter(Boolean).map(dbRowToCard);
}

// ── 문법 (grammar_items) ────────────────────────────────────────────────
// 🔴 단어와 달리 ruby(pattern_ruby·example_ruby)가 이미 좌표 jsonb라 변환 불필요.
const GRAMMAR_SELECT =
  'content_key, pattern, pattern_ruby, connection, romaji_ko, meaning_ko, usage_note, politeness, example_ja, example_ruby, example_ko, course_levels!inner(code)';

export function grammarRowToCard(o) {
  const front = o.pattern_ruby && o.pattern_ruby.base
    ? { base: o.pattern_ruby.base, ruby: o.pattern_ruby.ruby || [] }
    : { base: o.pattern, ruby: [] };
  const example = o.example_ruby && o.example_ruby.base
    ? { base: o.example_ruby.base, ruby: o.example_ruby.ruby || [] }
    : (o.example_ja && o.example_ja !== '-' ? { base: o.example_ja, ruby: [] } : null);
  return {
    key: o.content_key,
    pattern: o.pattern,
    front,                        // 문형 {base, ruby}
    connection: o.connection && o.connection !== '-' ? o.connection : '',
    romajiKo: o.romaji_ko || '',  // 문형 한글 발음
    meaning: o.meaning_ko,
    usageNote: o.usage_note && o.usage_note !== '-' ? o.usage_note : '',
    politeness: o.politeness && o.politeness !== '-' ? o.politeness : '',
    example,                      // 예문 {base, ruby} | null
    exampleKo: o.example_ko && o.example_ko !== '-' ? o.example_ko : '',
  };
}

// 실 Supabase에서 지정 급수(is_published=true)의 문법만 읽는다. RLS가 미공개를 차단.
export async function loadGrammar(level = 'N5', limit = 12) {
  const { data, error } = await supabase
    .from('grammar_items')
    .select(GRAMMAR_SELECT)
    .eq('course_levels.code', level)
    .order('content_key', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!data || !data.length) throw new Error(`${level} 공개 문법이 0건 (is_published 확인 필요)`);
  return data.map(grammarRowToCard);
}

// ── 독해 (reading_texts + reading_sentences + questions + question_choices) ──
// 🔴 questions는 target_item_key(text)로 지문을 가리켜 진짜 FK가 아니다 → 2쿼리 후 클라이언트 조인.
const rubyOr = (j, ja) => (j && j.base ? { base: j.base, ruby: j.ruby || [] } : { base: ja || '', ruby: [] });

export async function loadReading(level = 'N5', limit = 10) {
  const { data: texts, error } = await supabase
    .from('reading_texts')
    .select('content_key, title, note, reading_sentences(seq, ja, reading, romaji_ko, ko), course_levels!inner(code)')
    .eq('course_levels.code', level)
    .order('content_key', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!texts || !texts.length) throw new Error(`${level} 공개 독해가 0건 (is_published 확인 필요)`);
  const keys = texts.map((t) => t.content_key);
  const { data: qs, error: qe } = await supabase
    .from('questions')
    .select('content_key, target_item_key, stem_ja, stem_ruby, explanation, question_choices(seq, choice_text, choice_ruby, is_correct)')
    .eq('target_item_type', 'reading')
    .in('target_item_key', keys);
  if (qe) throw new Error('Supabase: ' + qe.message);
  const qByItem = {};
  (qs || []).forEach((q) => { qByItem[q.target_item_key] = q; });
  return texts.map((t) => readingRowToCard(t, qByItem[t.content_key]));
}

export function readingRowToCard(t, q) {
  const sentences = (t.reading_sentences || [])
    .slice().sort((a, b) => a.seq - b.seq)
    .map((s) => ({ seq: s.seq, front: rubyOr(s.reading, s.ja), romajiKo: s.romaji_ko || '', ko: s.ko || '' }));
  return { key: t.content_key, kind: 'reading', title: t.title, note: t.note || '', sentences, question: questionVM(q) };
}

// ── 청해 (listening_items + listening_lines + questions + question_choices) ──
export async function loadListening(level = 'N5', limit = 10) {
  const { data: items, error } = await supabase
    .from('listening_items')
    .select('content_key, title, audio_url, speaker_count, listening_lines(seq, speaker, ja, ruby, romaji_ko, ko), course_levels!inner(code)')
    .eq('course_levels.code', level)
    .order('content_key', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!items || !items.length) throw new Error(`${level} 공개 청해가 0건 (is_published 확인 필요)`);
  const keys = items.map((i) => i.content_key);
  const { data: qs, error: qe } = await supabase
    .from('questions')
    .select('content_key, target_item_key, stem_ja, stem_ruby, explanation, question_choices(seq, choice_text, choice_ruby, is_correct)')
    .eq('target_item_type', 'listening')
    .in('target_item_key', keys);
  if (qe) throw new Error('Supabase: ' + qe.message);
  const qByItem = {};
  (qs || []).forEach((q) => { qByItem[q.target_item_key] = q; });
  return items.map((i) => listeningRowToCard(i, qByItem[i.content_key]));
}

export function listeningRowToCard(i, q) {
  const lines = (i.listening_lines || [])
    .slice().sort((a, b) => a.seq - b.seq)
    .map((l) => ({ seq: l.seq, speaker: l.speaker || '', front: rubyOr(l.ruby, l.ja), romajiKo: l.romaji_ko || '', ko: l.ko || '' }));
  return { key: i.content_key, kind: 'listening', title: i.title, audioUrl: i.audio_url || '', lines, question: questionVM(q) };
}

// ── 지문/대본 ↔ 단어 (content_vocab_links) ────────────────────────────────
// 🔴 BE(link_passage_vocab.py)가 fugashi로 채운 링크. RLS가 부모·단어 공개로 게이트하므로
//    anon 키로도 공개분만 온다. 「이 글의 단어」(급수별·후리가나·뜻·즐겨찾기)의 실데이터.
export async function loadPassageWords(itemType, contentKey) {
  if (!contentKey) return [];
  const { data, error } = await supabase
    .from('content_vocab_links')
    .select('surface, first_seq, vocab_items!inner(content_key, headword, reading, ruby, meaning_ko, course_levels!inner(code))')
    .eq('item_type', itemType)
    .eq('item_content_key', contentKey)
    .order('first_seq', { ascending: true });
  if (error) throw new Error('Supabase: ' + error.message);
  return (data || []).map((row) => {
    const v = row.vocab_items || {};
    const front = v.ruby && v.ruby.base
      ? { base: v.ruby.base, ruby: v.ruby.ruby || [] }
      : { base: v.headword || row.surface, ruby: v.reading ? [{ s: 0, e: Array.from(v.headword || row.surface || '').length, rt: v.reading }] : [] };
    return {
      key: v.content_key || `${row.item_content_key}.${row.surface}`,
      level: v.course_levels?.code || '',
      word: v.headword || row.surface,
      reading: v.reading || '',
      meaning: v.meaning_ko || '',
      front,                       // {base, ruby} — 단어 카드와 동일한 후리가나 좌표
    };
  });
}

// 문항 뷰모델 — 선택지 seq 정렬, 정답 표시. 없으면 null.
function questionVM(q) {
  if (!q) return null;
  const choices = (q.question_choices || [])
    .slice().sort((a, b) => a.seq - b.seq)
    .map((c) => ({ seq: c.seq, front: rubyOr(c.choice_ruby, c.choice_text), correct: !!c.is_correct }));
  return { stem: rubyOr(q.stem_ruby, q.stem_ja), explanation: q.explanation || '', choices };
}

// 폴백: 로컬 CSV (오프라인/DB 미가용 시)
export async function loadN5CardsFromCsv(limit = 10) {
  const res = await fetch('data/N5_vocab.csv');
  const text = await res.text();
  const objs = rowsToObjects(parseCsv(text));
  return objs.map(toCard).slice(0, limit);
}

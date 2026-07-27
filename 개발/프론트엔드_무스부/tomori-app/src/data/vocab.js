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
    level: 'N5',
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

// 🔴 실 Supabase에서 N5(is_published=true)만 읽는다. RLS가 미공개를 차단하므로
//    anon 키로도 공개 콘텐츠만 온다. 예전 CSV fetch 는 폴백으로 남겨둔다(loadN5CardsFromCsv).
export async function loadN5Cards(limit = 10) {
  const { data, error } = await supabase
    .from('vocab_items')
    .select('content_key, headword, reading, ruby, romaji_ko, pos, meaning_ko, meaning_ko_alt, example_ja, example_ko, course_levels!inner(code)')
    .eq('course_levels.code', 'N5')
    .order('content_key', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!data || !data.length) throw new Error('N5 공개 콘텐츠가 0건 (is_published 확인 필요)');
  return data.map(dbRowToCard);
}

// 폴백: 로컬 CSV (오프라인/DB 미가용 시)
export async function loadN5CardsFromCsv(limit = 10) {
  const res = await fetch('data/N5_vocab.csv');
  const text = await res.text();
  const objs = rowsToObjects(parseCsv(text));
  return objs.map(toCard).slice(0, limit);
}

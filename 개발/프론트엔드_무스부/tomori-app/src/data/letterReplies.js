// 토모에게 보내는 답장 — 데이터 계층(가이드 문구 + Supabase load/save).
// 답장은 auth.uid() RLS로 보호되는 letter_replies 에 letter_seq(편지 회차) 기준 upsert.
import { supabase } from './supabaseClient';
import { rubyToJson } from './rubyParse';

// 가이드 답장 문구 카드(N5, 토모 향). jp=브래킷 후리가나({漢字|よみ}) → rubyToJson 좌표.
const PHRASES_RAW = [
  { key: 'thanks', jp: 'ありがとう。', ko: '고마워요.' },
  { key: 'glad', jp: 'うれしいです。', ko: '기뻐요.' },
  { key: 'comeback', jp: 'また{来|き}ますね。', ko: '또 올게요.' },
  { key: 'try', jp: 'がんばります。', ko: '열심히 할게요.' },
  { key: 'todaytoo', jp: '{今日|きょう}もありがとう。', ko: '오늘도 고마워요.' },
  { key: 'youtoo', jp: 'トモもね。', ko: '토모도요.' },
];

export const REPLY_PHRASES = PHRASES_RAW.map((p) => ({ ...p, ...rubyToJson(p.jp) }));

export function phraseByKey(key) {
  return REPLY_PHRASES.find((p) => p.key === key) || null;
}

// 본인 답장 1행 로드(없으면 null). 로그인 세션이 있어야 RLS 통과(게스트는 0행 → null).
export async function loadReply(letterSeq) {
  const { data, error } = await supabase
    .from('letter_replies')
    .select('letter_seq, phrase_keys, body_ko, updated_at')
    .eq('letter_seq', letterSeq)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// 답장 저장(편지당 1개 upsert). user_id 는 세션에서 명시(기본값 없음). RLS with_check 가 세션과 일치 강제.
export async function saveReply(letterSeq, phraseKeys, bodyKo) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('login-required');
  const { error } = await supabase.from('letter_replies').upsert(
    {
      user_id: user.id,
      letter_seq: letterSeq,
      phrase_keys: phraseKeys,
      body_ko: bodyKo ? bodyKo : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,letter_seq' },
  );
  if (error) throw error;
}

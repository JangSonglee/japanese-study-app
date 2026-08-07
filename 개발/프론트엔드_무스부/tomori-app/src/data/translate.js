// 번역 엔진 — 텍스트 번역(한↔일). MVP는 무료 MyMemory API(키 불필요).
//  · 🔴 교체 지점을 좁게 유지: 화면은 translate()만 부른다. 추후 Google/DeepL 전환 시
//    이 함수 본문만 엣지 함수 호출로 바꾸면 된다(화면 무수정).
//  · 무료 엔진은 일일 한도·품질 한계가 있어 데모/MVP용. 한도 초과 시 안내 문구를 정상 반환하므로 감지해 에러 처리.

const ENDPOINT = 'https://api.mymemory.translated.net/get';

// { text, source, target } → { ok, text } | { ok:false, error }
export async function translate({ text, source, target }) {
  const q = (text || '').trim();
  if (!q) return { ok: true, text: '' };
  if (q.length > 500) return { ok: false, error: '한 번에 500자까지 번역할 수 있어요.' };
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&langpair=${source}|${target}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `번역 서버 오류 (${res.status})` };
    const j = await res.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (typeof out !== 'string' || !out) return { ok: false, error: '번역 결과를 받지 못했어요.' };
    // 무료 한도 초과·경고는 translatedText 에 대문자 경고로 온다.
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(out)) {
      return { ok: false, error: '무료 번역 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.' };
    }
    return { ok: true, text: out };
  } catch (e) {
    return { ok: false, error: '네트워크 오류로 번역하지 못했어요.' };
  }
}

// rubyParse.js — 브래킷 표기 → 좌표 JSON.
// 🔴 개발/백엔드_도다이/import_vocab.py 의 ruby_to_json 을 JS 로 이식한 것.
// 백엔드는 임포트 시점에 이 변환을 미리 해 vocab_items.ruby(jsonb)에 넣는다.
// 실제 앱에서 <Ruby> 는 그 좌표 JSON({base, ruby:[{s,e,rt}]})을 받는다.
// 프론트가 CSV 원문(브래킷)을 직접 렌더할 일은 이 슬라이스(CSV 직접 로드)뿐이라,
// 여기서 파서를 함께 둔다. 정식 파이프라인에서는 서버 JSON 을 그대로 받으면 된다.

// 🔴 코드포인트 기준. JS 문자열은 UTF-16 이라 서로게이트 한자(𠮟)에서 어긋난다.
//    반드시 Array.from 으로 쪼갠다 (규격 3.1 / 사양서 3.1).

const TOKEN = /\{([^|{}]+)((?:\|[^|{}]*)+)\}/g;

/**
 * @param {string} ruby  예: "お{父|とう}さん", "{時間|じ|かん}", "おはようございます"
 * @returns {{base:string, ruby:{s:number,e:number,rt:string}[], reading:string}}
 */
export function rubyToJson(ruby) {
  const baseParts = [];
  const readingParts = [];
  const rubyList = [];
  let baseLen = 0;       // 코드포인트 단위 누적 길이
  let pos = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(ruby)) !== null) {
    // 브래킷 앞 순가나
    const plain = ruby.slice(pos, m.index);
    if (plain) {
      baseParts.push(plain);
      readingParts.push(plain);
      baseLen += Array.from(plain).length;
    }
    const surface = m[1];                         // 표기
    const readings = m[2].split('|').slice(1);    // 읽기들 (맨 앞 '' 제거)
    const nS = Array.from(surface).length;
    const nR = readings.length;
    const start = baseLen;
    baseParts.push(surface);
    readingParts.push(readings.join(''));
    baseLen += nS;
    if (nR === 1) {
      // 그룹 루비 — 표기 전체 위에 하나
      rubyList.push({ s: start, e: start + nS, rt: readings[0] });
    } else if (nR === nS) {
      // 글자별 모노 루비
      for (let i = 0; i < nR; i++) {
        rubyList.push({ s: start + i, e: start + i + 1, rt: readings[i] });
      }
    } else {
      // 조용히 넘어가지 않는다 (규격 3.1-4)
      throw new Error(`읽기 개수(${nR})가 표기 글자수(${nS})와 안 맞음: ${m[0]}`);
    }
    pos = m.index + m[0].length;
  }
  const tail = ruby.slice(pos);
  if (tail) {
    baseParts.push(tail);
    readingParts.push(tail);
  }
  return {
    base: baseParts.join(''),
    ruby: rubyList,
    reading: readingParts.join(''),
  };
}

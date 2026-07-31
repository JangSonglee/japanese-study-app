// 토모의 편지 — 데모 데이터.
// 편지 = 토모의 이정표 편지. 🔴 본문은 「일본어」(대표님 2026-07-31) — 편지도 학습이 되게.
//   후리가나(기본 ON) + 해석(기본 OFF, 우상단 토글). 톤: 조용한 관찰자(PRD 14.4), 짧고 절제.
//   일본어는 학습자가 편히 읽을 수준(N5~N4). 실 생성(학습 데이터 집계+문안)·적립은 인증 후.
//
// lines[].jp = 브래킷 후리가나 표기({漢字|よみ}) → rubyToJson 으로 {base, ruby} 좌표 변환(Ruby 렌더러용).
// lines[].ko = 해석(한국어). title/preview 는 편지함 목록 스캔용(한국어).
import { rubyToJson } from './rubyParse';

const RAW = [
  {
    id: 'l2',
    seq: 2,
    dateLabel: '7월 30일',
    title: '2주가 지났어요',
    preview: '2주간, 열네 번 함께였네요.',
    lines: [
      { jp: 'ソンイさんへ', ko: '송이 님께' },
      { jp: '{二週間|にしゅうかん}、{十四回|じゅうよんかい}{一緒|いっしょ}でしたね。', ko: '2주간, 열네 번 함께였네요.' },
      { jp: '{動詞|どうし}でよく{止|と}まっていたけど、{最近|さいきん}は{少|すこ}し{楽|らく}になったみたい。', ko: '동사에서 자주 멈췄는데, 요즘은 조금 편해진 것 같아요.' },
      { jp: '{急|いそ}がなくても{大丈夫|だいじょうぶ}。{灯|あか}りは、つけておきます。', ko: '서두르지 않아도 괜찮아요. 불은, 켜 둘게요.' },
    ],
    signoff: '— トモ',
    unread: true,
  },
  {
    id: 'l1',
    seq: 1,
    dateLabel: '7월 16일',
    title: '첫 편지예요',
    preview: '사흘 연속 와 줬네요.',
    lines: [
      { jp: 'ソンイさんへ', ko: '송이 님께' },
      { jp: '{三日|みっか}{続|つづ}けて{来|き}てくれましたね。', ko: '사흘 연속 와 줬네요.' },
      { jp: 'はじめは{誰|だれ}でも{少|すこ}しだけ。それでも、いいんです。', ko: '처음엔 누구나 조금뿐이에요. 그래도, 괜찮아요.' },
      { jp: '{今日|きょう}{覚|おぼ}えた{言葉|ことば}、ちゃんと{見|み}ていました。', ko: '오늘 외운 단어, 잘 보고 있었어요.' },
    ],
    signoff: '— トモ',
    unread: false,
  },
];

// 브래킷 → 좌표({base, ruby, reading}) 변환. 각 line = {base, ruby, reading, ko}.
export const LETTERS = RAW.map((l) => ({
  ...l,
  lines: l.lines.map((ln) => ({ ...rubyToJson(ln.jp), ko: ln.ko })),
}));

export function getLetter(id) {
  return LETTERS.find((l) => l.id === id) || null;
}

export function getLetterBySeq(seq) {
  return LETTERS.find((l) => l.seq === seq) || null;
}

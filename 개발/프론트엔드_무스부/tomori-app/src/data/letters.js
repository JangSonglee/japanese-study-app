// 토모의 편지 — 데모 데이터. 편지 = 토모의 이정표 편지(감성 회고, 한국어).
// 톤: 조용한 관찰자(PRD 14.4) — 짧고 절제, 허용체, 재촉·과장 없음.
// 🔴 실 생성(학습 데이터 집계+문안 채움)·적립은 인증 후. 지금은 데모 2통.
export const LETTERS = [
  {
    id: 'l2',
    seq: 2,
    dateLabel: '7월 30일',
    title: '2주가 지났어요',
    preview: '2주 동안, 열네 번 함께했어요.',
    paragraphs: [
      '송이 님께,',
      '2주 동안, 열네 번 함께했어요.',
      '동사 활용에서 자주 멈췄는데, 요즘은 덜 멈추더라고요. 저는 봤어요.',
      '서두르지 않아도 돼요. 불은 계속 켜 둘게요.',
    ],
    signoff: '— 토모',
    unread: true,
  },
  {
    id: 'l1',
    seq: 1,
    dateLabel: '7월 16일',
    title: '첫 편지예요',
    preview: '사흘째, 불을 켜러 와 줬어요.',
    paragraphs: [
      '송이 님께,',
      '사흘째, 불을 켜러 와 줬어요.',
      '아직 시작이지만, 시작을 세 번 한 사람은 많지 않아요.',
      '오늘 배운 말들, 제가 다 봤어요.',
    ],
    signoff: '— 토모',
    unread: false,
  },
];

export function getLetter(id) {
  return LETTERS.find((l) => l.id === id) || null;
}

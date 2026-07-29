// 토모리 디자인 토큰 — 사양서 v3.2 (design_system_spec.md 2장·3.3)
// 🔴 원시 hex 를 컴포넌트가 직접 쓰지 않는다. 반드시 이 토큰만 참조 (사양서 1.2).
// 라이트/다크 두 벌. RN 에서는 hex/rgba 문자열이 그대로 통한다.

export const light = {
  bgBase: '#FAF7F3',
  bgSurface: '#FFFFFF',
  bgElevated: '#FFFFFF',
  border: '#E8E1D9',
  borderStrong: '#D4C9BC',
  textHigh: '#1A1613',
  textMid: '#6B6259',
  textLow: '#9C948B',
  sunk: '#F3EDE5',

  brand: '#F5B942',
  brandText: '#8F5E08',
  onBrand: '#1A1613',

  // Primary 액션 면 — 반드시 「쌍」 (사양서 2.2). text-high 를 면으로 재사용 금지.
  action: '#1A1613',
  onAction: '#FFF9EC',

  courseJlpt: '#2F6FD0',
  courseJlptText: '#2F6FD0',

  success: '#2E7D4F',
  error: '#B5533D',
  info: '#2F6FD0',

  // 그림자 (사양서 2.8) — 웹에서는 boxShadow 문자열. RN 에서는 elevation/shadow* 로 매핑 필요.
  sh1: '0 .5px 1px rgba(122,84,30,.06), 0 1px 2.5px rgba(122,84,30,.085)',
  sh2: '0 2px 6px rgba(122,84,30,.10), 0 10px 26px rgba(122,84,30,.13)',

  scrim: 'rgba(26,22,19,.44)',
};

export const dark = {
  bgBase: '#14110F',
  bgSurface: '#1E1A17',
  bgElevated: '#2A2521',
  border: '#3A332D',
  borderStrong: '#544A41',
  textHigh: '#F5F1EC',
  textMid: '#B5ADA4',
  textLow: '#7D766E',
  sunk: '#100E0C',

  brand: '#F5B942',
  brandText: '#F5B942',
  onBrand: '#1A1613',

  action: '#DAD2C7',
  onAction: '#1A1613',

  courseJlpt: '#5B9BF5',
  courseJlptText: '#5B9BF5',

  success: '#5FD08A',
  error: '#E8705F',
  info: '#6FA8DC',

  sh1: '0 1px 2px rgba(0,0,0,.4)',
  sh2: '0 10px 26px rgba(0,0,0,.5)',

  scrim: 'rgba(0,0,0,.60)',
};

// Radius (사양서 v3.3 — EOND UI 검토 반영 2026-07-30). 6단 위계:
//   sm=칩·인풋 / md=버튼 / lg=카드 / xl=바텀시트·히어로 / full=pill·점
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

// Spacing — 4px 그리드(EOND UI 계승 2026-07-30). 임의 여백값을 만들지 않는다.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, x2: 24, x3: 32, x4: 40, x5: 48, x6: 64 };

// 조판 — 한국어는 어절 단위 줄바꿈(word-break: keep-all). 한글 Text에 스프레드해서 쓴다.
export const keepAll = { wordBreak: 'keep-all' };

// 타이포 스케일 (사양서 v3.3 — EOND UI 검토 반영 2026-07-30).
//   화면 위계용 8단(size·weight) + 후리가나 렌더러가 쓰는 기존 값 유지.
export const type = {
  hero: { size: 28, weight: '700' },   // 큰 숫자·히어로
  h1: { size: 22, weight: '700' },     // 화면 제목
  h2: { size: 19, weight: '700' },     // 히어로 카드 제목
  h3: { size: 17, weight: '700' },     // 카드 제목
  body: { size: 15, weight: '400' },   // 본문
  bodySm: { size: 13, weight: '400' }, // 보조 본문
  caption: { size: 12, weight: '500' },// 라벨·캡션
  micro: { size: 11, weight: '500' },  // 최소 캡션·뱃지
  bodyJp: { fontSize: 18, lineHeight: 2.0 }, // 후리가나 본문(사양서 3.2)
  rubyRatio: 0.5, // 루비 크기 = 본문의 50%
};

// 폰트 패밀리 (사양서 3.1.1). 웹은 @font-face(fonts.css)로 로드.
//   RN(Expo)에서는 expo-font 로 같은 이름을 등록해야 한다 (보고 참조).
export const fonts = {
  ko: "Pretendard, -apple-system, system-ui, sans-serif",
  jp: "'Noto Sans JP', sans-serif",       // 일본어 학습 콘텐츠 (단어·예문·후리가나)
  jpBrand: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
};

export function getTheme(mode) {
  return mode === 'dark' ? dark : light;
}

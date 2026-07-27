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

// Radius (사양서 2.9 — 3단 고정)
export const radius = { sm: 9, md: 15, full: 999 };

// 타이포 스케일 (사양서 3.3). 후리가나 렌더러가 쓰는 값:
//   body-jp 18 / line-height 2.0 (루비 공간 확보) / ruby = 본문의 50%
export const type = {
  bodyJp: { fontSize: 18, lineHeight: 2.0 },
  rubyRatio: 0.5, // 사양서 3.2 — 루비 크기 = 본문의 50%
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

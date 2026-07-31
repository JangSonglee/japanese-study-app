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

// Radius (디자인 토큰 v4 — design_tokens.md 정본). 실제 매핑(코드 기준, 옛 주석 정정):
//   sm=버튼·칩·인풋·토글 / md=이미지·중첩 블록 / lg=콘텐츠 카드 / xl=바텀시트·대형 / full=pill·원형
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

// Spacing — 4px 그리드(design_tokens.md). 임의 여백값을 만들지 않는다.
//   판별: 요소 안 ≤12 / 카드 안 16 / 카드 사이 x2(24) / 섹션 x3~x4(32~40) / 화면 좌우 xl(20).
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, x2: 24, x3: 32, x4: 40, x5: 48, x6: 64 };

// 조판 — 한국어는 어절 단위 줄바꿈(word-break: keep-all). 한글 Text에 스프레드해서 쓴다.
export const keepAll = { wordBreak: 'keep-all' };

// 타이포 스케일 (디자인 토큰 v4 — design_tokens.md 정본, 2026-07-31).
//   각 역할 = size(px)·line(행간 px)·weight·ls(자간 px). 근거: 본문 16 기준·헤딩 1.25~1.5배·행간 본문~1.5/제목~1.2.
//   🔴 화면들은 아직 개별 fontSize 하드코딩 — 이 스케일로 점진 이관(정합 후속). 지금 값 변경은 화면 무영향.
//   🔴 bodyJp.fontSize·rubyRatio 는 Ruby(후리가나 렌더러)가 참조하므로 형태·키 유지.
export const type = {
  display:  { size: 32, line: 40, weight: '700', ls: -0.5 }, // 온보딩 대제목·빈 상태
  title:    { size: 24, line: 32, weight: '700', ls: -0.5 }, // 화면 제목
  heading:  { size: 20, line: 28, weight: '700', ls: -0.3 }, // 섹션 헤더
  subtitle: { size: 18, line: 26, weight: '500', ls: -0.3 }, // 히어로 카드 제목
  body:     { size: 16, line: 24, weight: '400', ls: 0 },    // 한국어 본문(기본)
  bodySm:   { size: 14, line: 20, weight: '400', ls: 0 },    // 보조 본문
  label:    { size: 12, line: 16, weight: '500', ls: 0 },    // 라벨·캡션
  caption:  { size: 11, line: 16, weight: '500', ls: 0 },    // 배지·타임스탬프
  number:   { size: 28, line: 32, weight: '700', ls: -0.5 }, // 큰 통계 수치(tabular-nums)
  numberSm: { size: 20, line: 24, weight: '700', ls: -0.5 }, // 카드 안 보조 수치
  bodyJp: { fontSize: 18, lineHeight: 2.0 }, // 후리가나 본문 — Ruby가 .fontSize 참조(형태 고정)
  rubyRatio: 0.5, // 루비 = 본문의 50% — Ruby 참조
};

// 역할 → RN 텍스트 스타일. 화면 이관용: 스타일에 {...typeStyle('body'), fontFamily: fonts.ko} 로 스프레드.
//   필요 시 fontWeight 등은 뒤에 덧써서 오버라이드(예: 라벨을 굵게).
export function typeStyle(role) {
  const x = type[role];
  return { fontSize: x.size, lineHeight: x.line, fontWeight: x.weight, letterSpacing: x.ls };
}

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

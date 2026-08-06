import React from 'react';

/**
 * 하단 탭 아이콘 — 색상 변경 가능한 선 아이콘(활성 앰버 / 비활성 회색).
 *  · Figma ic-*.svg는 색이 박혀 있어 활성 상태별 색 변경 불가 → 탭 셸용으로 currentColor 선 아이콘 재작성.
 *  · 웹(react-native-web)은 인라인 <svg>를 그대로 렌더(Icon.jsx와 동일 원칙).
 */
export default function TabIcon({ name, size = 24, color = '#737373', width = 1.7 }) {
  const s = { fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let body = null;
  switch (name) {
    case 'home':
      body = (
        <>
          <path d="M3.5 11.3 L12 4.5 L20.5 11.3" {...s} />
          <path d="M6 10 V19.5 a0.5 0.5 0 0 0 0.5 0.5 H17.5 a0.5 0.5 0 0 0 0.5 -0.5 V10" {...s} />
          <path d="M10 20 V14.5 h4 V20" {...s} />
        </>
      );
      break;
    case 'learn': // 학습하기 — 문서
      body = (
        <>
          <path d="M6.5 3.5 H14 L18 7.5 V20.5 H6.5 Z" {...s} />
          <path d="M14 3.5 V7.5 H18" {...s} />
          <path d="M9 12.5 H15 M9 16 H15" {...s} />
        </>
      );
      break;
    case 'vocab': // 단어장 — 북마크
      body = <path d="M6.5 4 H17.5 V20.5 L12 16 L6.5 20.5 Z" {...s} />;
      break;
    case 'trans': // 번역 — 지구본
      body = (
        <>
          <circle cx="12" cy="12" r="8.2" {...s} />
          <path d="M3.8 12 H20.2" {...s} />
          <path d="M12 3.8 C8 7 8 17 12 20.2 C16 17 16 7 12 3.8 Z" {...s} />
        </>
      );
      break;
    case 'my': // 내 정보 — 사람
      body = (
        <>
          <circle cx="12" cy="8" r="3.4" {...s} />
          <path d="M5.3 20 a6.7 6.7 0 0 1 13.4 0" {...s} />
        </>
      );
      break;
    default:
      body = null;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden="true">
      {body}
    </svg>
  );
}

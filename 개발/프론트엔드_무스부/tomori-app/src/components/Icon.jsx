import React from 'react';

/**
 * 선 아이콘 — 이모지 대체 (design_system_spec 5.9 / 8.x).
 *
 * 🔴 이모지를 쓰지 않는 이유(사양서): ① OS마다 다른 그림이라 우리가 디자인한 게 아니다
 *    ② 컬러 글리프라 다크에서 안 뒤집히고 코스 5색과 충돌 ③ 안쪽만 이모지면 같은 앱으로 안 보인다.
 * → 전 아이콘을 **단색 선 아이콘(stroke 1.7)**으로 통일. 색은 토큰(text-*·brand-text 등)으로 주입.
 *
 * 🔴 웹(react-native-web)에서는 인라인 <svg>가 그대로 DOM에 렌더된다.
 *    Expo 정식 이식 때 react-native-svg로 교체(형태 사양 동일 유지) — vite 배선처럼 예고된 교체 지점.
 *
 * 사용: <Icon name="back" size={22} color={t.textHigh} />
 */
export default function Icon({ name, size = 20, color = '#000', width = 1.7, filled = false }) {
  const s = { fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let body = null;
  switch (name) {
    case 'back':
      body = <polyline points="14.5 5 8 12 14.5 19" {...s} />;
      break;
    case 'forward':
      body = <polyline points="9.5 5 16 12 9.5 19" {...s} />;
      break;
    case 'down':
      body = <polyline points="5 9 12 15.5 19 9" {...s} />;
      break;
    case 'moon':
      body = <path d="M20.5 13.2A8 8 0 1 1 10.8 3.5 6.3 6.3 0 0 0 20.5 13.2Z" {...s} />;
      break;
    case 'sun':
      body = (
        <>
          <circle cx="12" cy="12" r="4" {...s} />
          <line x1="12" y1="2.5" x2="12" y2="5" {...s} />
          <line x1="12" y1="19" x2="12" y2="21.5" {...s} />
          <line x1="2.5" y1="12" x2="5" y2="12" {...s} />
          <line x1="19" y1="12" x2="21.5" y2="12" {...s} />
          <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" {...s} />
          <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" {...s} />
          <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" {...s} />
          <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" {...s} />
        </>
      );
      break;
    case 'star':
      // 라운드 별 — 각 꼭짓점을 2차 베지어로 둥글린 5각 별(즐겨찾기 톤).
      body = (
        <path
          d="M12.47 4.15 L13.88 7.61 Q14.35 8.76 15.59 8.85 L19.32 9.13 Q20.56 9.22 19.61 10.02 L16.75 12.44 Q15.8 13.24 16.1 14.45 L16.99 18.07 Q17.29 19.28 16.23 18.62 L13.06 16.66 Q12 16 10.94 16.66 L7.77 18.62 Q6.71 19.28 7.01 18.07 L7.9 14.45 Q8.2 13.24 7.25 12.44 L4.39 10.02 Q3.44 9.22 4.68 9.13 L8.41 8.85 Q9.65 8.76 10.12 7.61 L11.53 4.15 Q12 3 12.47 4.15 Z"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={width}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
      break;
    case 'play':
      body = <path d="M8 5.4 L18 12 L8 18.6 Z" fill={color} stroke={color} strokeWidth={width} strokeLinejoin="round" />;
      break;
    case 'pause':
      body = (
        <>
          <rect x="7.5" y="5" width="3.2" height="14" rx="1.1" fill={color} stroke="none" />
          <rect x="13.3" y="5" width="3.2" height="14" rx="1.1" fill={color} stroke="none" />
        </>
      );
      break;
    case 'external':
      body = (
        <>
          <path d="M17 12.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h6.5" {...s} />
          <line x1="20" y1="4" x2="10.5" y2="13.5" {...s} />
          <polyline points="14 4 20 4 20 10" {...s} />
        </>
      );
      break;
    case 'warning':
      body = (
        <>
          <path d="M12 4.2 21 20H3z" {...s} />
          <line x1="12" y1="10" x2="12" y2="14.5" {...s} />
          <circle cx="12" cy="17.4" r="0.4" fill={color} stroke={color} strokeWidth={width} />
        </>
      );
      break;
    case 'gear':
      body = (
        <>
          <circle cx="12" cy="12" r="3.2" {...s} />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" {...s} />
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

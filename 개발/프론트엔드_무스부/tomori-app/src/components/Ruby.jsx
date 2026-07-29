import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts, type } from '../theme/tokens';

/**
 * Ruby — 후리가나 렌더러 (토모리 핵심 컴포넌트)
 *
 * 좌표 JSON 을 받아 해당 글자 위에만 루비를 얹는다.
 *   <Ruby base="お手伝い" ruby={[{s:1,e:2,rt:"て"},{s:2,e:3,rt:"つだ"}]} show />
 *
 * 🔴 설계 핵심 (사양서 3.2 / PRD 8.4):
 *  1. 레이아웃 점프 없음 — 루비 줄 높이를 「항상」 확보하고 표시만 opacity 로 전환.
 *     show 를 껐다 켜도 본문 글자의 세로 위치가 1px 도 움직이지 않는다.
 *  2. 좌표는 코드포인트 기준 — Array.from(base) 로 쪼갠다 (서로게이트 한자 대응, 규격 3.1).
 *  3. 루비 크기 = 본문의 50% (사양서 3.2).
 *  4. 일본어는 Noto Sans JP (fonts.jp). lang="ja" 상당.
 *
 * 세그먼트 모델:
 *  - 각 ruby 엔트리([s,e))를 「깨지지 않는 한 덩어리 열」로 만든다 → 한자 복합어가
 *    줄바꿈으로 쪼개지지 않는다(그룹 루비 유지).
 *  - 루비 없는 글자는 낱개 열. 열마다 [루비 슬롯(항상 존재)] + [본문] 스택.
 */
export default function Ruby({
  base,
  ruby = [],
  show = true,
  size = type.bodyJp.fontSize, // 본문 px (기본 18)
  color = '#1A1613',
  rubyColor,                    // 루비 색 (기본 = 본문색)
  bold = false,
  style,
}) {
  const rubySize = Math.round(size * type.rubyRatio); // 50%
  // 루비 슬롯은 항상 이 높이를 차지한다 (표시 여부와 무관) → 점프 방지의 핵심
  const rubySlotHeight = Math.ceil(rubySize * 1.35);
  const baseLineHeight = Math.ceil(size * 1.35);

  const segments = useMemo(() => buildSegments(base, ruby), [base, ruby]);

  return (
    <View style={[styles.row, style]} accessibilityLabel={base}>
      {segments.map((seg, i) => (
        <View key={i} style={styles.unit}>
          {/* 세로 공간 확보 스페이서 — 후리가나는 절대배치(오버행)라 본문을 아래로 밀 자리만 잡는다. */}
          <View style={{ height: rubySlotHeight }} />
          {/* 🔴 루비 슬롯 = 절대배치 + 좌우로 넓혀 「글자 위 가운데」에 얹되 본문 폭엔 영향 0.
              읽기가 본문보다 넓어도(新=あたら) 옆 글자를 밀지 않아 「따로 노는」 여백이 사라진다. */}
          <View style={[styles.rubySlot, { height: rubySlotHeight }]} pointerEvents="none">
            <Text
              // @ts-ignore RN Web 에서 lang 속성 통과
              lang="ja"
              style={[
                styles.rubyText,
                {
                  fontSize: rubySize,
                  lineHeight: rubySlotHeight,
                  color: rubyColor || color,
                  opacity: show && seg.rt ? 1 : 0,
                },
              ]}
              numberOfLines={1}
            >
              {seg.rt || ' '}
            </Text>
          </View>
          {/* 본문 — 그룹이면 여러 글자가 한 줄로 */}
          <Text
            lang="ja"
            style={[
              styles.baseText,
              {
                fontSize: size,
                lineHeight: baseLineHeight,
                color,
                fontWeight: bold ? '700' : '400',
              },
            ]}
          >
            {seg.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * 루비(후리가나) 슬롯 높이 — 본문 위에 「항상」 확보되는 여백.
 * Ruby 옆에 놓는 라벨(화자·선택지 번호)을 본문 첫 줄에 눈높이 맞출 때 paddingTop 으로 쓴다.
 */
export function rubyTopReserve(size = type.bodyJp.fontSize) {
  const rubySize = Math.round(size * type.rubyRatio);
  return Math.ceil(rubySize * 1.35);
}

/** 좌표 → 세그먼트 배열. 각 세그먼트 = {text, rt|null}. */
export function buildSegments(base, ruby) {
  const chars = Array.from(base); // 🔴 코드포인트 단위
  // 시작 인덱스 → 엔트리
  const byStart = new Map();
  for (const r of ruby) byStart.set(r.s, r);
  const segs = [];
  let i = 0;
  while (i < chars.length) {
    const entry = byStart.get(i);
    if (entry) {
      const e = Math.min(entry.e, chars.length);
      segs.push({ text: chars.slice(i, e).join(''), rt: entry.rt });
      i = e;
    } else {
      segs.push({ text: chars[i], rt: null });
      i += 1;
    }
  }
  return segs;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  unit: {
    alignItems: 'center',   // 본문 글자를 루비 아래 가운데 정렬
    justifyContent: 'flex-end',
    position: 'relative',   // 절대배치 루비의 기준
  },
  rubySlot: {
    position: 'absolute',   // 본문 폭에 영향 없이 위로 오버행
    top: 0,
    left: -100,             // 좌우로 크게 넓혀 읽기가 넘쳐도 잘리지·줄바꿈 되지 않게(가운데 정렬)
    right: -100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  rubyText: {
    fontFamily: fonts.jp,
    textAlign: 'center',
    includeFontPadding: false,
  },
  baseText: {
    fontFamily: fonts.jp,
    includeFontPadding: false,
  },
});

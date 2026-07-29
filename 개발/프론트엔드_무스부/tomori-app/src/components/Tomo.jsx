import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

/**
 * 토모 — 등불(작은 불빛) 임시 스탠드인.
 *
 * 사양 근거:
 *  · 밝기 = 「학습 상태」 신호. 통신 상태로 어두워지지 않는다(PRD).
 *  · 밝아짐(헤일로 확대)은 「새 쪽지」 전용 — 여기선 평소 밝기·말 없음(PRD 14.2.1).
 *  · 실제 아트는 아토 컴포넌트 대기 → 이 스탠드인 한 곳만 교체하면 홈·세션요약에 동시 반영.
 *
 * props:
 *   size  = 등불 크기 배율 기준(기본 44 몸통 높이 근사)
 *   note  = 아래 캡션(기본 '토모 — 임시 스탠드인')
 *   showNote = 캡션 표시 여부
 */
export default function Tomo({ scale = 1, note = '토모 — 임시 스탠드인', showNote = true }) {
  const { t } = useTheme();
  const s = makeStyles(scale);
  return (
    <View style={s.stage}>
      <View style={[s.glow, { backgroundColor: t.brand }]} />
      <View style={[s.body, { backgroundColor: t.brand }]}>
        <View style={[s.flame, { backgroundColor: t.onBrand }]} />
      </View>
      {showNote ? <Text style={[s.note, { color: t.textLow }]}>{note}</Text> : null}
    </View>
  );
}

function makeStyles(k) {
  return StyleSheet.create({
    stage: { alignItems: 'center', justifyContent: 'center', gap: 6 },
    glow: { position: 'absolute', top: 6 * k, width: 64 * k, height: 64 * k, borderRadius: 999, opacity: 0.28 },
    body: {
      width: 34 * k, height: 44 * k, borderRadius: 17 * k,
      alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 * k,
    },
    flame: {
      width: 10 * k, height: 14 * k,
      borderTopLeftRadius: 8 * k, borderTopRightRadius: 8 * k,
      borderBottomLeftRadius: 5 * k, borderBottomRightRadius: 5 * k,
    },
    note: { fontFamily: fonts.ko, fontSize: 11 },
  });
}

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

/**
 * 토모 — 등불 캐릭터. 표정 아트(SVG, public/images/tomo/{pose}.svg).
 *
 * 사양 근거:
 *  · 밝기 = 「학습 상태」 신호. 밝아짐(헤일로 확대)은 「새 쪽지」 전용(PRD 14.2.1) — 여기선 표정만.
 *  · pose 한 곳으로 홈·요약·모달·MY·소개에 동시 반영.
 *  · 🔴 웹 슬라이스는 <Image>가 <img>로 SVG를 렌더. Expo 정식 이식 땐 expo-image/react-native-svg로 교체.
 *
 * props:
 *   scale = 크기 배율(기본 높이 96px 기준)
 *   pose  = 표정 키(파일명). 기본 'sit'
 *   note / showNote = 아래 캡션
 */
// 표정마다 원본 viewBox 비율(폭/높이)이 달라 pose별로 aspect를 둔다. 높이를 통일하고 폭만 aspect로 맞춰 찌그러짐을 막는다.
const POSE_ASPECT = {
  bright: 253 / 258, 'cheer-up': 217 / 272, 'desperate+tears': 188 / 258,
  encouragement: 215 / 246, intellectual: 188 / 258, read: 192 / 272,
  resolution: 188 / 258, shine: 312 / 306, shyness: 188 / 258,
  sit: 248 / 326, surprise: 225 / 258, 'to-wait': 315 / 258,
  'well-done': 205 / 264, worry: 188 / 258,
};
const BASE_H = 96;          // scale 1 기준 높이(px)

export default function Tomo({ scale = 1, pose = 'sit', note = '토모', showNote = true }) {
  const { t } = useTheme();
  const h = BASE_H * scale;
  const w = h * (POSE_ASPECT[pose] || 248 / 326);
  return (
    <View style={styles.stage}>
      <Image
        source={{ uri: `images/tomo/${pose}.svg` }}
        style={{ width: w, height: h }}
        resizeMode="contain"
        accessibilityLabel="토모"
      />
      {showNote ? <Text style={[styles.note, { color: t.textLow }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  note: { fontFamily: fonts.ko, fontSize: 11 },
});

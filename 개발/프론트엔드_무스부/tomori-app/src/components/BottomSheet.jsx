import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 바텀 시트 — 폰 프레임 안쪽 absolute 오버레이(전역 Modal 아님, 프레임 illusion 유지).
 *
 * 사양 근거:
 *  · 스크림(t.scrim) 탭 → 닫힘. 🔴 다크 모달엔 테두리 필수(사양서 — 다크 표면은 딤만으로 분리 불가).
 *  · 부모 화면 root View(flex:1) 안에 형제로 두면 absoluteFill 이 그 화면 기준으로 채워진다.
 */
export default function BottomSheet({ visible, title, onClose, children }) {
  const { t } = useTheme();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="닫기"
      />
      <View style={[S.sheet, { backgroundColor: t.bgElevated, borderColor: t.borderStrong }]}>
        <View style={[S.handle, { backgroundColor: t.borderStrong }]} />
        <View style={S.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
            <Icon name="back" size={22} color={t.textHigh} />
          </Pressable>
          <Text style={[S.title, { color: t.textHigh }]}>{title}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
    borderWidth: 1, paddingBottom: 16, maxHeight: '86%',
  },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: 'center', marginTop: 8, opacity: 0.7 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  title: { flex: 1, fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
});

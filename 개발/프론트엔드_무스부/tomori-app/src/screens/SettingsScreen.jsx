import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

// 🔴 Tanos CC BY 출처 표기는 「서비스 정보」(AboutScreen)로 옮겼다(2026-07-28, 대표님 결정).
//    설정 화면엔 두지 않는다 — 출처는 서비스 개요와 함께 About 하단에 보인다.

/**
 * MY › 설정 — 읽기 도움 기본값 (PRD 8.4).
 *  · 여기서 정한 값이 「그 외 전부(정답면·단어목록·오답노트·PDF)」의 기본값이 된다.
 *  · 🔴 카드 「앞면」(스스로 부딪히는 면)은 이 설정과 무관하게 항상 OFF에서 시작한다.
 *  · 후리가나/한글발음은 개별 — 수명이 다르다(8.4). 한글 발음은 빨리 떼야 할 보조바퀴.
 */
export default function SettingsScreen({ settings, onChange, onBack }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>설정 · 읽기 도움</Text>
      </View>

      <View style={S.body}>
        <Text style={[S.section, { color: t.textLow }]}>읽기 도움 기본값</Text>

        <SettingRow
          t={t}
          label="후리가나"
          desc="한자 위 읽기. 단어 목록·오답노트 등에서 기본으로 보일지 정해요."
          value={settings.furigana}
          onToggle={() => onChange({ ...settings, furigana: !settings.furigana })}
        />
        <SettingRow
          t={t}
          label="한글 발음"
          desc="보조바퀴예요 — 익숙해지면 끄는 게 좋아요(つ·ざ·ん 등은 정확히 못 적어요)."
          value={settings.pron}
          onToggle={() => onChange({ ...settings, pron: !settings.pron })}
        />

        <Text style={[S.note, { color: t.textLow }]}>
          단어 카드에서는 후리가나·한글 발음이 이 설정과 무관하게 항상 꺼진 채로 시작하고,
          뜻 보기도 그걸 건드리지 않아요 — 카드 안의 토글로 직접 켜고 꺼요.
          이 기본값은 앞으로 단어 목록·오답노트 같은 화면에 적용돼요.
        </Text>
      </View>
    </View>
  );
}

function SettingRow({ t, label, desc, value, onToggle }) {
  const S = makeStyles(t);
  return (
    <View style={[S.row, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
      <View style={S.rowText}>
        <Text style={[S.rowLabel, { color: t.textHigh }]}>{label}</Text>
        <Text style={[S.rowDesc, { color: t.textMid }]}>{desc}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={`${label} 기본값`}
        style={[
          S.track,
          { backgroundColor: value ? t.action : t.sunk, borderColor: value ? t.action : t.borderStrong },
        ]}
      >
        <View style={[S.thumb, { backgroundColor: value ? t.onAction : t.bgSurface, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </Pressable>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    back: { fontSize: 26, width: 20 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    body: { padding: 16, gap: 12 },
    section: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: radius.md, padding: 14,
    },
    rowText: { flex: 1, gap: 3 },
    rowLabel: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    rowDesc: { fontFamily: fonts.ko, fontSize: 12, lineHeight: 17 },
    track: {
      width: 48, height: 28, borderRadius: 999, borderWidth: 1, padding: 3, justifyContent: 'center',
    },
    thumb: { width: 20, height: 20, borderRadius: 999 },
    note: { fontFamily: fonts.ko, fontSize: 12, lineHeight: 18, marginTop: 4 },
  });
}

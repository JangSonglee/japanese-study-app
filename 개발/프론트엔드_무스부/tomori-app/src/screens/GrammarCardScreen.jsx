import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ruby from '../components/Ruby';
import Icon from '../components/Icon';
import { DoneView } from './WordCardScreen';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll } from '../theme/tokens';

/**
 * 문법 카드 화면 (JLPT · 리콜 카드). 단어 카드와 같은 학습 흐름, 필드만 문법용.
 *
 * 사양 근거:
 *  · 앞면 = 문형 + 접속(구조 힌트, 뜻은 안 드러냄). 뜻을 떠올리는 면.
 *  · 뜻 보기 → 뜻 + 용법 + 예문. 🔴 후리가나·발음·뜻보기 완전 독립(PRD 8.4 3차) — 뜻 보기는 뜻/예문만.
 *  · 후리가나·발음은 각자 토글로만, 새 카드마다 OFF. 발음 줄은 공간 항상 확보(점프 금지).
 *  · 세션 요약 = DoneView 재사용(noun='문형').
 */
export default function GrammarCardScreen({ nav, level = '', cards }) {
  const { t, mode } = useTheme();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [furi, setFuri] = useState(false);
  const [pron, setPron] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [known, setKnown] = useState(0);

  const done = idx >= cards.length;
  const card = done ? null : cards[idx];

  function next(gotKnown) {
    if (gotKnown) setKnown((k) => k + 1);
    setRevealed(false);
    setFuri(false);
    setPron(false);
    setIdx((i) => i + 1);
  }
  function toggleSave() {
    setSaved((s) => {
      const n = new Set(s);
      if (n.has(card.key)) n.delete(card.key); else n.add(card.key);
      return n;
    });
  }

  if (done) return <DoneView t={t} mode={mode} known={known} total={cards.length} savedCount={saved.size} noun="문형" onRestart={() => { setIdx(0); setKnown(0); }} onBack={() => nav && nav.pop()} />;

  const isSaved = saved.has(card.key);
  const S = makeStyles(t);
  const isDark = mode === 'dark';

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={[S.appbar, isDark && { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
        <Pressable onPress={() => nav && nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>{level ? `${level} · 문법` : '레슨 · 문법'}</Text>
        <View style={[S.kbd, { backgroundColor: t.sunk }]}>
          <Text style={[S.kbdText, { color: t.textMid }]}>{idx + 1}/{cards.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        <View style={S.areaRow} accessibilityRole="header">
          <View style={[S.areaBar, { backgroundColor: t.courseJlpt }]} />
          <Text style={[S.areaLabel, { color: t.courseJlptText }]}>문법·문형</Text>
          <Text style={[S.areaHint, { color: t.textMid }]}>영역 이동은 뒤로 버튼</Text>
        </View>

        <View style={[
          S.card,
          { backgroundColor: t.bgSurface, boxShadow: t.sh1 },
          isDark && { borderWidth: 1, borderColor: t.border },
        ]}>
          <View style={S.cardHead}>
            <Text style={[S.lblLow, { color: t.textLow }]}>{revealed ? '뜻 · 용법 · 예문' : '문형 — 뜻을 떠올려요'}</Text>
            <Pressable onPress={toggleSave} accessibilityRole="button" accessibilityLabel={isSaved ? '저장 해제' : '문형 저장'} hitSlop={10}>
              <Icon name="star" size={24} color={isSaved ? t.brand : t.textLow} filled={isSaved} />
            </Pressable>
          </View>

          {/* 문형 */}
          <View style={S.patternArea}>
            <Ruby base={card.front.base} ruby={card.front.ruby} show={furi} size={30} bold color={t.textHigh} />
            <Text style={[S.romaji, { color: t.textMid, opacity: pron ? 1 : 0 }]}>{card.romajiKo}</Text>
          </View>

          {/* 접속 — 앞면에도 노출(구조 힌트, 뜻 아님) */}
          {card.connection ? (
            <View style={[S.connRow, { backgroundColor: t.sunk }]}>
              <Text style={[S.connLbl, { color: t.textLow }]}>접속</Text>
              <Text style={[S.connText, { color: t.textMid }]}>{card.connection}</Text>
            </View>
          ) : null}

          {/* 정답면 */}
          {revealed ? (
            <View style={S.answer}>
              <View style={[S.divider, { backgroundColor: t.border }]} />
              <Text style={[S.lblLow, { color: t.textLow }]}>뜻</Text>
              <Text style={[S.meaning, { color: t.textHigh }]}>{card.meaning}</Text>
              {card.usageNote ? (
                <>
                  <Text style={[S.lblLow, { color: t.textLow, marginTop: 8 }]}>용법{card.politeness ? ` · ${card.politeness}` : ''}</Text>
                  <Text style={[S.usage, { color: t.textMid }]}>{card.usageNote}</Text>
                </>
              ) : null}
              {card.example ? (
                <>
                  <Text style={[S.lblLow, { color: t.textLow, marginTop: 8 }]}>예문</Text>
                  <Ruby base={card.example.base} ruby={card.example.ruby} show={furi} size={17} color={t.textHigh} />
                  {card.exampleKo ? (
                    <Text style={[S.exKo, { color: t.textMid, opacity: pron ? 1 : 0 }]}>{card.exampleKo}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {/* 읽기 도움 토글 2개 — 개별(PRD 8.4) */}
          <View style={S.toggleRow}>
            <ToggleBtn t={t} on={furi} label="후리가나" onPress={() => setFuri((v) => !v)} />
            <ToggleBtn t={t} on={pron} label="한글 발음" onPress={() => setPron((v) => !v)} />
          </View>

          <Pressable
            style={[S.btnSec, { backgroundColor: t.bgSurface, borderColor: t.textLow }]}
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: revealed }}
          >
            <Text style={[S.btnSecText, { color: t.textHigh }]}>{revealed ? '뜻 끄기' : '뜻 보기'}</Text>
          </Pressable>

          <View style={S.cta}>
            <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={() => next(true)}>
              <Text style={[S.btnPriText, { color: t.onBrand }]}>알고있음</Text>
            </Pressable>
            <Pressable style={[S.btnGhost, { backgroundColor: t.border }]} onPress={() => next(false)}>
              <Text style={[S.btnGhostText, { color: t.textMid }]}>모르겠어요</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleBtn({ t, on, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[
        tStyles.toggle,
        on ? { backgroundColor: t.action, borderColor: t.action } : { backgroundColor: t.bgSurface, borderColor: t.textLow },
      ]}
    >
      <Text style={[tStyles.toggleText, { color: on ? t.onAction : t.textMid }]}>{on ? `${label} 끄기` : `${label} 보기`}</Text>
    </Pressable>
  );
}

const tStyles = StyleSheet.create({
  toggle: { flex: 1, height: 40, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
});

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    kbd: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
    kbdText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    body: { padding: 14, gap: 10, minHeight: '100%' },
    areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    areaBar: { width: 4, height: 16, borderRadius: radius.full },
    areaLabel: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700' },
    areaHint: { fontFamily: fonts.ko, fontSize: 12, ...keepAll },
    card: { flex: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lblLow: { fontFamily: fonts.ko, fontSize: 13 },
    patternArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 },
    romaji: { fontFamily: fonts.ko, fontSize: 15 },
    connRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
    connLbl: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600' },
    connText: { fontFamily: fonts.ko, fontSize: 13, flex: 1, ...keepAll },
    answer: { gap: 4 },
    divider: { height: 1, marginBottom: 6 },
    meaning: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700', ...keepAll },
    usage: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 19, ...keepAll },
    exKo: { fontFamily: fonts.ko, fontSize: 13, marginTop: 2, ...keepAll },
    toggleRow: { flexDirection: 'row', gap: 6 },
    btnSec: { height: 44, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    btnSecText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
    cta: { flexDirection: 'row', gap: 8 },
    btnPri: { flex: 1, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    btnGhost: { flex: 1, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnGhostText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
  });
}

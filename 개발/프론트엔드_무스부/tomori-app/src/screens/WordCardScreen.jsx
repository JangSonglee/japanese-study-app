import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ruby from '../components/Ruby';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

/**
 * 단어 카드 화면 (Hi-fi 14번) — JLPT N5, 10개 세션.
 *
 * 사양 근거:
 *  · 앞면 = 일본어 표기만. 후리가나·발음 기본 OFF (스스로 부딪히는 면, PRD 8.4).
 *  · 후리가나 토글 / 발음 토글은 「개별」 (PRD 8.4 — 수명이 다르다). 하나로 묶지 않는다.
 *  · 후리가나 = 공간 항상 확보 + 표시만 전환 (점프 금지). 발음 = 공간 회수 (별도 줄).
 *  · 정답면 = 뜻 + 예문. 후리가나/발음 정답면 기본 ON.
 *  · Primary 버튼 = 잉크(action). 앰버는 안 씀(단어 카드엔 우표 없음).
 *  · 카드 = 그림자(sh-1), 테두리 없음.
 */
export default function WordCardScreen({ cards }) {
  const { t, mode } = useTheme();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [furi, setFuri] = useState(false); // 후리가나 (앞면 기본 OFF)
  const [pron, setPron] = useState(false); // 한글 발음 (앞면 기본 OFF)
  const [saved, setSaved] = useState(() => new Set());
  const [known, setKnown] = useState(0);

  const done = idx >= cards.length;
  const card = done ? null : cards[idx];

  // 정답면으로 넘어가면 후리가나/발음 기본 ON (사양 8.4)
  useEffect(() => {
    if (revealed) { setFuri(true); setPron(true); }
  }, [revealed]);

  function next(gotKnown) {
    if (gotKnown) setKnown((k) => k + 1);
    setRevealed(false);
    setFuri(false);   // 새 카드 앞면 = 기본 OFF
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

  if (done) return <DoneView t={t} mode={mode} known={known} total={cards.length} savedCount={saved.size} onRestart={() => { setIdx(0); setKnown(0); }} />;

  const isSaved = saved.has(card.key);
  const S = makeStyles(t);

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      {/* appbar */}
      <View style={[S.appbar, dark(mode) && { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
        <Text style={[S.back, { color: t.textHigh }]}>‹</Text>
        <Text style={[S.appTitle, { color: t.textHigh }]}>레슨 · 혼합형</Text>
        <View style={[S.kbd, { backgroundColor: t.sunk }]}>
          <Text style={[S.kbdText, { color: t.textMid }]}>{idx + 1}/{cards.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        {/* 현재 영역 라벨 — 「탭 전환」이 아니다.
            혼합형 4영역(단어·문법·독해·청해)은 구조·분량이 달라 한 화면에서 갈아끼울 수 없다.
            영역 선택은 진입 리스트(JLPT_플로우 섹션 C: 세로 리스트 + 영역별 진행률 + >)에서 하고,
            여기서는 「지금 어느 영역인지」만 보여준다. peer 칩(문법/독해/청해)을 두지 않아 전환 착시를 없앤다. */}
        <View style={S.areaRow} accessibilityRole="header">
          {/* 코스색은 4px 액센트 바 + 글자로만 (사양서 2장: 대면적 코스색 배경 금지, 코스색 꽉 찬 칩 폐지).
              면을 채우면 다크에서 흰 글자 2.82:1로 미달 — 액센트 바+course-text는 두 테마 다 통과. */}
          <View style={[S.areaBar, { backgroundColor: t.courseJlpt }]} />
          <Text style={[S.areaLabel, { color: t.courseJlptText }]}>단어·어휘</Text>
          <Text style={[S.areaHint, { color: t.textLow }]}>혼합형 · 영역 이동은 ‹ 뒤로</Text>
        </View>

        {/* 카드 — 그림자, 테두리 없음(라이트) / 다크는 테두리 */}
        <View style={[
          S.card,
          { backgroundColor: t.bgSurface, boxShadow: t.sh1 },
          dark(mode) && { borderWidth: 1, borderColor: t.border },
        ]}>
          <View style={S.cardHead}>
            <Text style={[S.lblLow, { color: t.textLow }]}>
              {revealed ? '뜻과 예문' : '카드 앞면 — 일본어만'}
            </Text>
            <Pressable
              onPress={toggleSave}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? '저장 해제' : '단어 저장'}
              hitSlop={10}
            >
              <Text style={[S.saveStar, { color: isSaved ? t.brandText : t.textLow, fontWeight: '700' }]}>
                {isSaved ? '★' : '☆'}
              </Text>
            </Pressable>
          </View>

          {/* 표제어 — 후리가나 렌더러. show=furi 로 점프 없이 전환 */}
          <View style={S.wordArea}>
            <Ruby
              base={card.front.base}
              ruby={card.front.ruby}
              show={furi}
              size={revealed ? 30 : 38}
              bold
              color={t.textHigh}
            />
            {/* 한글 발음 — 공간 회수(display none 상당): pron 일 때만 렌더 */}
            {pron ? (
              <Text style={[S.romaji, { color: t.textMid }]}>{card.romajiKo}</Text>
            ) : null}
            {card.front.error ? (
              <Text style={[S.errText, { color: t.error }]}>⚠ 루비 파싱 실패: {card.front.error}</Text>
            ) : null}
          </View>

          {/* 정답면 내용 */}
          {revealed ? (
            <View style={S.answer}>
              <View style={[S.divider, { backgroundColor: t.border }]} />
              <Text style={[S.lblLow, { color: t.textLow }]}>뜻</Text>
              <Text style={[S.meaning, { color: t.textHigh }]}>
                {card.meaning}{card.meaningAlt ? `  ·  ${card.meaningAlt}` : ''}
              </Text>
              {card.example ? (
                <>
                  <Text style={[S.lblLow, { color: t.textLow, marginTop: 8 }]}>예문</Text>
                  <Ruby
                    base={card.example.base}
                    ruby={card.example.ruby}
                    show={furi}
                    size={17}
                    color={t.textHigh}
                  />
                  {pron && card.exampleKo ? (
                    <Text style={[S.exKo, { color: t.textMid }]}>{card.exampleKo}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {/* 읽기 도움 토글 2개 — 개별 (PRD 8.4). 라벨은 「할 수 있는 동작」으로 (보기/끄기) */}
          <View style={S.toggleRow}>
            <ToggleBtn t={t} on={furi} label="후리가나" onPress={() => setFuri((v) => !v)} />
            <ToggleBtn t={t} on={pron} label="한글 발음" onPress={() => setPron((v) => !v)} />
          </View>

          {/* 뜻 보기 / 뜻 끄기 — 토글. 「정답」이 아니다(정오 개념 없음, PRD 8.6) */}
          <Pressable
            style={[S.btnSec, { backgroundColor: t.bgSurface, borderColor: t.textLow }]}
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: revealed }}
          >
            <Text style={[S.btnSecText, { color: t.textHigh }]}>{revealed ? '뜻 끄기' : '뜻 보기'}</Text>
          </Pressable>

          {/* 알고있음 / 모르겠어요 — Primary=action(잉크), 오답은 상태색 아님(ghost) */}
          <View style={S.cta}>
            <Pressable style={[S.btnPri, { backgroundColor: t.action }]} onPress={() => next(true)}>
              <Text style={[S.btnPriText, { color: t.onAction }]}>알고있음</Text>
            </Pressable>
            <Pressable
              style={[S.btnGhost, { borderColor: t.borderStrong }]}
              onPress={() => next(false)}
            >
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
        on
          ? { backgroundColor: t.action, borderColor: t.action }
          : { backgroundColor: t.bgSurface, borderColor: t.textLow },
      ]}
    >
      <Text style={[tStyles.toggleText, { color: on ? t.onAction : t.textMid }]}>
        {on ? `${label} 끄기` : `${label} 보기`}
      </Text>
    </Pressable>
  );
}

/**
 * 세션 완료 = Hi-fi 14번 「단어 세션 결과」 1단계(테스트 전, 자가판정 집계).
 * 사양 근거:
 *  · 토모 등장 — 결과 화면은 「세션이 끝났는가?」=예 라 토모가 나오는 자리(PRD 14.2.1).
 *    단, alert(헤일로 확대) 미사용: 밝아짐은 「새 쪽지」 전용. 평소 밝기 + 말 없음(말풍선/따옴표 없음).
 *  · 아는/모르는 = 같은 크기·같은 카드. 모르는 쪽을 숨기거나 키우지 않는다(관찰자 톤 14.4).
 *  · 진행률 = 수집형(누적). 완주에 success색 안 씀 — 완주는 정오가 아니라 진행.
 *  · CTA 2개 [다시 보기](sec) + [테스트 시작하기](pri). 다시 보기를 지우지 않는다(강제 진행 없음 PRD 1.3).
 *  · 「안다고 했는데 틀린 단어」 lift 카드는 2단계(테스트 후) 전용 — 이 슬라이스엔 테스트가 없어 미표시.
 */
function DoneView({ t, mode, known, total, savedCount, onRestart }) {
  return (
    <View style={[doneStyles.wrap, { backgroundColor: t.bgBase }]}>
      {/* 토모 — 평소 밝기, 말 없음. (실제 아트는 아토 컴포넌트 대기 → 임시 스탠드인) */}
      <View style={doneStyles.tomoStage}>
        <View style={[doneStyles.tomoGlow, { backgroundColor: t.brand }]} />
        <View style={[doneStyles.tomoBody, { backgroundColor: t.brand }]}>
          <View style={[doneStyles.tomoFlame, { backgroundColor: t.onBrand }]} />
        </View>
        <Text style={[doneStyles.tomoNote, { color: t.textLow }]}>토모 — 임시 스탠드인 (평소 밝기)</Text>
      </View>

      <Text style={[doneStyles.title, { color: t.textHigh }]}>단어 세션 결과</Text>

      <View style={doneStyles.stats}>
        <View style={[doneStyles.stat, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
          <Text style={[doneStyles.big, { color: t.textHigh }]}>{known}<Text style={[doneStyles.unit, { color: t.textMid }]}>개</Text></Text>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>아는 단어</Text>
        </View>
        <View style={[doneStyles.stat, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
          <Text style={[doneStyles.big, { color: t.textHigh }]}>{total - known}<Text style={[doneStyles.unit, { color: t.textMid }]}>개</Text></Text>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>모르는 단어</Text>
        </View>
      </View>

      {/* 진행률 · 수집형 — 채움은 course-jlpt. 누적 분모는 스키마 연결 후(현재 세션 증가분만 정직 표기) */}
      <View style={[doneStyles.progCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
        <View style={doneStyles.progHead}>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>진행률 · 수집형</Text>
          <Text style={[doneStyles.progKbd, { color: t.textMid, backgroundColor: t.sunk }]}>이번 세션 +{known}</Text>
        </View>
        <View style={[doneStyles.progTrack, { backgroundColor: t.sunk }]}>
          <View style={[doneStyles.progFill, { backgroundColor: t.courseJlpt, width: `${Math.round((known / total) * 100)}%` }]} />
        </View>
        <Text style={[doneStyles.progNote, { color: t.textLow }]}>누적 수치(N / 급수 총량)는 백엔드 연결 후 표시</Text>
      </View>

      {savedCount > 0 ? (
        <Text style={[doneStyles.savedNote, { color: t.brandText }]}>★ 저장한 단어 {savedCount}개 · 단어장에 담김</Text>
      ) : null}

      {/* CTA — [다시 보기] sec + [테스트 시작하기] pri (슬라이스엔 테스트 없어 둘 다 재시작으로 연결) */}
      <View style={doneStyles.cta}>
        <Pressable style={[doneStyles.btnSec, { borderColor: t.textLow }]} onPress={onRestart}>
          <Text style={[doneStyles.btnSecText, { color: t.textHigh }]}>다시 보기</Text>
        </Pressable>
        <Pressable style={[doneStyles.btnPri, { backgroundColor: t.action }]} onPress={onRestart}>
          <Text style={[doneStyles.btnText, { color: t.onAction }]}>테스트 시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const dark = (mode) => mode === 'dark';

const tStyles = StyleSheet.create({
  toggle: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
});

const doneStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },

  // 토모 임시 스탠드인 — 등불(글로우 + 몸통 + 불꽃)
  tomoStage: { alignItems: 'center', justifyContent: 'center', height: 96, gap: 6 },
  tomoGlow: { position: 'absolute', top: 6, width: 64, height: 64, borderRadius: 999, opacity: 0.28 },
  tomoBody: { width: 34, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },
  tomoFlame: { width: 10, height: 14, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  tomoNote: { fontFamily: fonts.ko, fontSize: 11 },

  title: { fontFamily: fonts.ko, fontSize: 19, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { width: 128, borderRadius: radius.md, padding: 14, gap: 4, alignItems: 'flex-start' },
  big: { fontFamily: fonts.ko, fontSize: 27, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '400' },
  statLbl: { fontFamily: fonts.ko, fontSize: 13 },

  progCard: { width: 266, borderRadius: radius.md, padding: 13, gap: 8 },
  progHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progKbd: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  progTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  progFill: { height: 8, borderRadius: radius.full },
  progNote: { fontFamily: fonts.ko, fontSize: 11 },

  savedNote: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },

  cta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnSec: { width: 129, height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSecText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
  btnPri: { width: 129, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
});

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: {
      height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10,
    },
    back: { fontSize: 26, width: 20 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    kbd: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
    kbdText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    body: { padding: 14, gap: 10, minHeight: '100%' },
    areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    areaBar: { width: 4, height: 16, borderRadius: radius.full },
    areaLabel: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700' },
    areaHint: { fontFamily: fonts.ko, fontSize: 12 },
    card: { flex: 1, borderRadius: radius.md, padding: 16, gap: 12 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lblLow: { fontFamily: fonts.ko, fontSize: 13 },
    saveStar: { fontFamily: fonts.ko, fontSize: 14 },
    wordArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
    romaji: { fontFamily: fonts.ko, fontSize: 16 },
    errText: { fontFamily: fonts.ko, fontSize: 12 },
    answer: { gap: 4 },
    divider: { height: 1, marginBottom: 6 },
    meaning: { fontFamily: fonts.ko, fontSize: 17, fontWeight: '700' },
    exKo: { fontFamily: fonts.ko, fontSize: 13, marginTop: 2 },
    toggleRow: { flexDirection: 'row', gap: 6 },
    btnSec: {
      height: 44, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    btnSecText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
    cta: { flexDirection: 'row', gap: 8 },
    btnPri: { flex: 1, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    btnGhost: {
      flex: 1, height: 48, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },
    btnGhostText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
  });
}

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image } from 'react-native';
import Ruby from '../components/Ruby';
import Tomo from '../components/Tomo';
import Icon from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { recordSessionComplete, sessionSignature } from '../data/study';
import { recordVocabKnown } from '../data/home';
import { saveWord, unsaveWord, loadSavedKeys } from '../data/wordbook';

/**
 * 단어 카드 화면 (Hi-fi 14번) — JLPT N5, 10개 세션.
 *
 * 사양 근거:
 *  · 앞면 = 일본어 표기만. 후리가나·발음 기본 OFF (스스로 부딪히는 면, PRD 8.4).
 *  · 후리가나 토글 / 발음 토글은 「개별」 (PRD 8.4 — 수명이 다르다). 하나로 묶지 않는다.
 *  · 후리가나 = 공간 항상 확보 + 표시만 전환 (점프 금지). 발음 = 공간 회수 (별도 줄).
 *  · 🔴 후리가나·발음·뜻보기 완전 독립 (2026-07-28 3차 개정). 뜻 보기는 뜻·예문만 열고
 *    후리가나·발음은 절대 건드리지 않는다. 후리가나·발음은 오직 각자 토글로만 켜지고,
 *    새 카드마다 OFF에서 시작(챌린지). MY›설정 기본값 자동 적용은 폐기.
 *  · Primary 버튼 = 앰버(brand, 대표님 결정 2026-07-29). 오답(모르겠어요) = 중립 채움(sunk), 점선 아님.
 *  · 카드 = 그림자(sh-1), 테두리 없음.
 */

// 🔴 카드 이미지 표시 OFF (대표님 결정 2026-08-03). 이미지 제작이 병목이라 지금 단계는 이미지 없이 보여준다.
//    기능·파이프라인(hasImage 매니페스트·images/vocab·optimize 스크립트)은 그대로 보존 —
//    이미지 준비되면 이 한 줄만 true 로 돌리면 즉시 복원된다. (이미지 없는 카드는 원래 빈 자리 없이 렌더돼 구멍 안 생김.)
const SHOW_CARD_IMAGES = false;

export default function WordCardScreen({ nav, level = '', cards }) {
  const { t, mode } = useTheme();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [furi, setFuri] = useState(false); // 후리가나 — 사용자 토글로만 켜짐
  const [pron, setPron] = useState(false); // 한글 발음 — 사용자 토글로만 켜짐
  const [saved, setSaved] = useState(() => new Set());
  const [known, setKnown] = useState(0);
  const [imgFailed, setImgFailed] = useState(false); // 이미지 없으면 플레이스홀더로 폴백
  const advancingRef = useRef(false); // 전환 중 중복 탭 무시(빠른 더블탭이 known을 total 초과로 올려 요약이 음수 표시되던 버그)
  const knownKeysRef = useRef([]);    // 「안다」로 표시한 카드의 content_key → 완료 시 진도 적립(이어서 학습)
  useEffect(() => { advancingRef.current = false; }, [idx]); // 새 카드 렌더되면 다시 탭 허용

  // 저장(별) 상태 프리로드 — 이미 단어장에 담긴 카드는 별이 켜져 보이게(로그인 시).
  useEffect(() => {
    let alive = true;
    loadSavedKeys().then((set) => { if (alive) setSaved((prev) => new Set([...prev, ...set])); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const done = idx >= cards.length;
  const card = done ? null : cards[idx];

  // 🔴 후리가나·한글발음·뜻보기는 완전 독립 (PRD 8.4, 2026-07-28 3차 개정 — 대표님 지시).
  //  · 뜻 보기(정답면)는 뜻·예문만 연다. 후리가나·발음은 절대 건드리지 않는다.
  //  · 후리가나·발음은 오직 각자 토글을 눌렀을 때만 켜진다(설정값 자동 적용 폐기).
  //  · 앞면(부딪히는 면)뿐 아니라 정답면에서도 기본 OFF — 새 카드마다 OFF에서 시작(챌린지).
  //    (이전 「정답면=MY›설정 기본값 따름」은 뜻 보기가 원치 않은 보조를 얹는다는 지적으로 폐기.)

  function next(gotKnown) {
    if (advancingRef.current) return; // 전환 중 두 번째 탭 무시(중복 카운트·카드 스킵 방지)
    advancingRef.current = true;
    if (gotKnown) {
      setKnown((k) => k + 1);
      if (card && card.key) knownKeysRef.current.push(card.key);
    }
    setRevealed(false);
    setFuri(false);   // 새 카드 = 항상 OFF (챌린지)
    setPron(false);
    setImgFailed(false);
    setIdx((i) => i + 1);
  }

  function toggleSave() {
    if (!card || !card.key) return;
    const willSave = !saved.has(card.key);
    setSaved((s) => {
      const n = new Set(s);
      if (n.has(card.key)) n.delete(card.key); else n.add(card.key);
      return n;
    });
    // 실 저장/해제(로그인 시). 게스트는 no-op → 로컬 표시만.
    if (willSave) {
      saveWord({
        dedup: card.key, contentKey: card.key, source: 'vocab', tag: 'JLPT', level: card.level || null,
        ja: (card.front && card.front.base) || card.headword, reading: card.reading || '',
        ruby: card.front && card.front.base ? { base: card.front.base, ruby: card.front.ruby || [] } : null,
        meaning: card.meaning || '',
      }).catch(() => {});
    } else {
      unsaveWord(card.key).catch(() => {});
    }
  }

  if (done) return <DoneView t={t} mode={mode} known={known} total={cards.length} savedCount={saved.size} knownKeys={knownKeysRef.current} sessionSig={sessionSignature('vocab', level, cards)} onRestart={() => { setIdx(0); setKnown(0); knownKeysRef.current = []; }} onBack={() => nav && nav.pop()} source="vocab" />;

  const isSaved = saved.has(card.key);
  const S = makeStyles(t);

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      {/* appbar */}
      <View style={[S.appbar, dark(mode) && { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
        <Pressable onPress={() => nav && nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>{level ? `${level} · 단어` : '레슨 · 혼합형'}</Text>
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
          <Text style={[S.areaHint, { color: t.textMid }]}>혼합형 · 영역 이동은 뒤로 버튼</Text>
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
              <Icon name="star" size={24} color={isSaved ? t.brand : t.textLow} filled={isSaved} />
            </Pressable>
          </View>

          {/* 표제어 — 좌상단 정렬(레퍼런스 플래시카드). 🔴 폰트 크기는 뜻보기 상태와 동일하게 고정
              (size 30) — 뜻 보기 시 표제어 크기가 바뀌던 점프를 없앤다(대표님 지시). */}
          <View style={S.wordArea}>
            <Ruby
              base={card.front.base}
              ruby={card.front.ruby}
              show={furi}
              size={30}
              bold
              color={t.textHigh}
            />
            {/* 한글 발음 — 공간 항상 확보 + opacity 전환(점프 금지, PRD 8.4 3차). */}
            <Text style={[S.romaji, { color: t.textMid, opacity: pron ? 1 : 0 }]}>{card.romajiKo}</Text>
            {card.front.error ? (
              <View style={S.errRow}>
                <Icon name="warning" size={13} color={t.error} />
                <Text style={[S.errText, { color: t.error }]}>루비 파싱 실패: {card.front.error}</Text>
              </View>
            ) : null}
          </View>

          {/* 중간 이미지 슬롯 — content_key 규칙(images/vocab/{content_key}.png, 점→밑줄)으로 자동 로드.
              🔴 이미지 있으면 표시, 없으면 아무것도 안 보여준다(플레이스홀더 없음 — 대표님 결정 2026-07-29).
              🔴 card.hasImage(매니페스트 태그, App.jsx)일 때만 렌더 — 이미지 없는 카드에 Image를 마운트하면
                 404→onError→언마운트로 고정 슬롯(134px)이 붕괴해 카드 전환마다 깜빡임(레이아웃 점프)이 났다.
              DB 스키마 변경 불필요(웹 슬라이스). */}
          {SHOW_CARD_IMAGES && card.hasImage && !imgFailed ? (
            <Image
              source={{ uri: `images/vocab/${card.key.replace(/\./g, '_')}.png` }}
              style={S.image}
              resizeMode="contain"
              onError={() => setImgFailed(true)}
              accessibilityLabel={`${card.meaning} 일러스트`}
            />
          ) : null}

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
                  {card.exampleKo ? (
                    <Text style={[S.exKo, { color: t.textMid, opacity: pron ? 1 : 0 }]}>{card.exampleKo}</Text>
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

          {/* 알고있음 / 모르겠어요 — Primary=앰버(brand, 대표님 결정 2026-07-29), 오답은 상태색 아님(ghost) */}
          <View style={S.cta}>
            <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={() => next(true)}>
              <Text style={[S.btnPriText, { color: t.onBrand }]}>알고있음</Text>
            </Pressable>
            <Pressable
              style={[S.btnGhost, { backgroundColor: t.border }]}
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
export function DoneView({ t, mode, known, total, savedCount, onRestart, onBack, noun = '단어', source, attempts = [], knownKeys = [], sessionSig = null, onWrongNote }) {
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || !source) return;
    recordedRef.current = true;
    // sessionSig = 같은 세션(다시보기) 판별용 서명 → 오늘 진행한 학습 카운트에서 중복 제거.
    recordSessionComplete(source, Math.min(known, total), Math.max(0, total - known), attempts, sessionSig).catch(() => {});
    // 이어서 학습(단어 진도) — 「안다」로 표시한 단어를 vocab_states 에 적립(단어 세션만).
    if (knownKeys && knownKeys.length) recordVocabKnown(knownKeys).catch(() => {});
  }, [source, known, total, attempts, knownKeys, sessionSig]);
  // 오답노트 추가분 — 이번 세션 1차 시도 중 틀리거나 넘어간 문항 수(퀴즈만; 단어·문법은 attempts 없음).
  const wrongCount = (attempts || []).filter((a) => a && a.outcome !== 'correct').length;
  return (
    <View style={[doneStyles.wrap, { backgroundColor: t.bgBase }]}>
      {/* 뒤로 — 세션 요약에서 허브로 나가는 길 */}
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로" style={doneStyles.backBtn}>
        <Icon name="back" size={22} color={t.textHigh} />
      </Pressable>

      {/* 토모 — 평소 밝기, 말 없음(밝아짐은 「새 쪽지」 전용). 실제 아트는 아토 대기 → Tomo 한 곳만 교체 */}
      <Tomo scale={1} pose={total > 0 && known / total >= 0.7 ? 'well-done' : 'sit'} note="토모" />

      <Text style={[doneStyles.title, { color: t.textHigh }]}>{noun} 세션 결과</Text>

      <View style={doneStyles.stats}>
        <View style={[doneStyles.stat, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
          <Text style={[doneStyles.big, { color: t.textHigh }]}>{Math.min(known, total)}<Text style={[doneStyles.unit, { color: t.textMid }]}>개</Text></Text>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>아는 {noun}</Text>
        </View>
        <View style={[doneStyles.stat, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
          <Text style={[doneStyles.big, { color: t.textHigh }]}>{Math.max(0, total - known)}<Text style={[doneStyles.unit, { color: t.textMid }]}>개</Text></Text>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>모르는 {noun}</Text>
        </View>
      </View>

      {/* 진행률 · 수집형 — 채움은 course-jlpt. 누적 분모는 스키마 연결 후(현재 세션 증가분만 정직 표기) */}
      <View style={[doneStyles.progCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, dark(mode) && { borderWidth: 1, borderColor: t.border }]}>
        <View style={doneStyles.progHead}>
          <Text style={[doneStyles.statLbl, { color: t.textMid }]}>진행률 · 수집형</Text>
          <Text style={[doneStyles.progKbd, { color: t.textMid, backgroundColor: t.sunk }]}>이번 세션 +{known}</Text>
        </View>
        <View style={[doneStyles.progTrack, { backgroundColor: t.sunk }]}>
          <View style={[doneStyles.progFill, { backgroundColor: t.brand, width: `${Math.min(100, Math.round((known / total) * 100))}%` }]} />
        </View>
        <Text style={[doneStyles.progNote, { color: t.textMid }]}>누적 수치(N / 급수 총량)는 백엔드 연결 후 표시</Text>
      </View>

      {savedCount > 0 ? (
        <View style={doneStyles.savedRow}>
          <Icon name="star" size={14} color={t.brandText} filled />
          <Text style={[doneStyles.savedNote, { color: t.brandText }]}>저장한 {noun} {savedCount}개 · 단어장에 담김</Text>
        </View>
      ) : null}

      {/* 오답노트 추가분(PRD 8.2) — 이번 세션 틀림·넘어감 문항. 탭하면 오답노트로(퀴즈만; onWrongNote 있을 때만 이동). */}
      {wrongCount > 0 ? (
        <Pressable style={doneStyles.savedRow} onPress={onWrongNote} disabled={!onWrongNote} accessibilityRole={onWrongNote ? 'button' : undefined} accessibilityLabel={onWrongNote ? '오답노트에서 다시 보기' : undefined}>
          <Text style={[doneStyles.wrongMark, { color: t.textMid }]}>✕</Text>
          <Text style={[doneStyles.savedNote, { color: t.textMid }, keepAll]}>틀리거나 넘어간 {wrongCount}문제 · 오답노트에 담겼어요{onWrongNote ? ' · 다시 보기 ›' : ''}</Text>
        </Pressable>
      ) : null}

      {/* CTA — [다시 보기] sec + [테스트 시작하기] pri (슬라이스엔 테스트 없어 둘 다 재시작으로 연결) */}
      <View style={doneStyles.cta}>
        <Pressable style={[doneStyles.btnSec, { borderColor: t.textLow }]} onPress={onRestart}>
          <Text style={[doneStyles.btnSecText, { color: t.textHigh }]}>다시 보기</Text>
        </Pressable>
        <Pressable style={[doneStyles.btnPri, { backgroundColor: t.brand }]} onPress={onRestart}>
          <Text style={[doneStyles.btnText, { color: t.onBrand }]}>테스트 시작하기</Text>
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
  toggleText: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
});

const doneStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },

  backBtn: { position: 'absolute', top: 12, left: 12 },
  back: { fontSize: 26 },

  title: { fontFamily: fonts.ko, ...typeStyle('heading'), fontWeight: '700', ...keepAll },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { width: 128, borderRadius: radius.lg, padding: 14, gap: 4, alignItems: 'flex-start' },
  big: { fontFamily: fonts.ko, ...typeStyle('number'), fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.ko, ...typeStyle('bodySm') },
  statLbl: { fontFamily: fonts.ko, ...typeStyle('bodySm'), ...keepAll },

  progCard: { width: 266, borderRadius: radius.lg, padding: 13, gap: 8 },
  progHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progKbd: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  progTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  progFill: { height: 8, borderRadius: radius.full },
  progNote: { fontFamily: fonts.ko, ...typeStyle('caption'), ...keepAll },

  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  savedNote: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600', ...keepAll },
  wrongMark: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '700' },

  cta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnSec: { width: 129, height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSecText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600' },
  btnPri: { width: 129, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600' },
});

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: {
      height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10,
    },
    back: { fontSize: 26, width: 20 },
    appTitle: { flex: 1, fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    kbd: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
    kbdText: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '600', fontVariant: ['tabular-nums'] },
    body: { padding: 14, gap: 10, minHeight: '100%' },
    areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    areaBar: { width: 4, height: 16, borderRadius: radius.full },
    areaLabel: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '700' },
    areaHint: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', ...keepAll },
    card: { flex: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lblLow: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400' },
    saveStar: { fontFamily: fonts.ko, ...typeStyle('bodySm') },
    wordArea: { alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 4, gap: 6 },
    romaji: { fontFamily: fonts.ko, ...typeStyle('body') },
    image: { width: '100%', height: 118, borderRadius: radius.md, marginBottom: 16 },
    errRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    errText: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400' },
    answer: { gap: 4 },
    divider: { height: 1, marginBottom: 6 },
    meaning: { fontFamily: fonts.ko, ...typeStyle('subtitle'), fontWeight: '700', ...keepAll },
    exKo: { fontFamily: fonts.ko, ...typeStyle('bodySm'), marginTop: 2, ...keepAll },
    toggleRow: { flexDirection: 'row', gap: 6 },
    btnSec: {
      height: 44, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    btnSecText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600' },
    cta: { flexDirection: 'row', gap: 8 },
    btnPri: { flex: 1, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    btnGhost: {
      flex: 1, height: 48, borderRadius: radius.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    btnGhostText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600' },
  });
}

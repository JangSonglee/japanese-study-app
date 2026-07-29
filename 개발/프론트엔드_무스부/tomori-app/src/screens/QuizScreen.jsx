import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ruby, { rubyTopReserve } from '../components/Ruby';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import Tomo from '../components/Tomo';
import { DoneView } from './WordCardScreen';
import { loadPassageWords } from '../data/vocab';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

// 「이 글의 단어」 급수 정렬 순서. 실데이터는 BE(content_vocab_links) → loadPassageWords 로 온다.
const WORD_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/**
 * 독해·청해 공용 문제 화면 (JLPT). kind='reading' | 'listening'.
 *
 * 흐름(대표님 결정 2026-07-29) — 풀이 → 토모 모달 → 결과:
 *  1. 풀이: 후리가나·해석·단어 없음(부딪히는 면). 독해=지문(순수)+문제, 청해=음성만(대본 숨김)+문제.
 *     선택지를 고르고 「제출하기」.
 *  2. 제출 → 토모 반응 모달: 정답=축하 / 오답=위로+「해설 보기」.
 *     🔴 밝기(헤일로 확대)로 축하하지 않는다 — 그건 「새 쪽지」 전용(PRD 14.2.1). 문구·색으로 표현.
 *  3. 결과: 지문/대본 + 내 정답/오답 + 해설 + 후리가나·해석 토글 + 이 글의 단어(급수별·즐겨찾기).
 *     정답도 결과화면으로 올 수 있다(복습·단어 저장). 세션 요약 = DoneView 재사용.
 */
export default function QuizScreen({ nav, level = '', kind = 'reading', cards }) {
  const { t, mode } = useTheme();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);  // 고른 choice.seq (제출 전엔 자유 변경)
  const [phase, setPhase] = useState('solve');      // 'solve' | 'result'
  const [reaction, setReaction] = useState(null);   // null | 'correct' | 'wrong' (토모 모달)
  const [furi, setFuri] = useState(false);
  const [trans, setTrans] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wordSheet, setWordSheet] = useState(false);
  const [savedWords, setSavedWords] = useState(() => new Set());
  const [words, setWords] = useState([]);        // 이 지문/대본의 단어(급수별) — BE 매핑 실데이터
  const [wordsState, setWordsState] = useState('idle'); // idle|loading|ready|error
  const [round, setRound] = useState(1);          // 1=전체, 2=오답 재노출
  const [roundCards, setRoundCards] = useState(cards);  // 현재 라운드가 푸는 목록(원본 cards는 불변)
  const wrongRef = useRef([]);                     // 1차에서 못 맞춘 카드 누적(오답+모름) → 2차 목록

  const done = idx >= roundCards.length;
  const card = done ? null : roundCards[idx];
  const isReading = kind === 'reading';
  const areaName = isReading ? '독해' : '청해';
  const q = card ? card.question : null;

  // 지문/대본이 바뀔 때마다 「이 글의 단어」를 실 Supabase(content_vocab_links)에서 로드.
  useEffect(() => {
    if (!card) return undefined;
    let alive = true;
    setWordsState('loading');
    loadPassageWords(kind, card.key)
      .then((ws) => { if (alive) { setWords(ws); setWordsState('ready'); } })
      .catch(() => { if (alive) { setWords([]); setWordsState('error'); } });
    return () => { alive = false; };
  }, [card && card.key, kind]);

  function submit() {
    if (selected == null || !q) return;
    const chosen = q.choices.find((c) => c.seq === selected);
    const ok = !!(chosen && chosen.correct);
    if (ok) {
      if (round === 1) setCorrect((c) => c + 1);
    } else if (round === 1) {
      wrongRef.current.push(card);   // 1차 오답 → 2차 재노출 큐
    }
    setReaction(ok ? 'correct' : 'wrong');
  }
  function skip() {
    if (!q) return;
    if (round === 1) wrongRef.current.push(card);   // 모름도 '못 맞춤' → 재노출
    setReaction('unknown');
  }
  function toResult() { setPhase('result'); }   // reaction 유지 → 모달만 닫힘
  function advance() {
    const atEnd = idx + 1 >= roundCards.length;
    if (round === 1 && atEnd && wrongRef.current.length > 0) {
      setRoundCards(wrongRef.current);   // 2차 진입: 못 맞춘 문제만
      wrongRef.current = [];
      setRound(2);
      setIdx(0);
    } else {
      setIdx((i) => i + 1);
    }
    setPhase('solve');
    setSelected(null);
    setReaction(null);
    setFuri(false);
    setTrans(false);
    setWordSheet(false);
  }
  function retry() {   // 2연속에서 같은 문제 다시(같은 idx)
    setPhase('solve');
    setSelected(null);
    setReaction(null);
  }

  if (done) {
    return (
      <DoneView
        t={t} mode={mode} known={correct} total={cards.length} savedCount={savedWords.size} noun="문제"
        onRestart={() => { setIdx(0); setCorrect(0); setSelected(null); setPhase('solve'); setReaction(null); setRound(1); setRoundCards(cards); wrongRef.current = []; }}
        onBack={() => nav && nav.pop()}
      />
    );
  }

  const S = makeStyles(t);
  const isDark = mode === 'dark';
  const showAnswers = phase === 'result';   // 결과 화면(정답·해설·읽기도움·단어 공개)
  const cardShadow = [S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }, isDark && { borderWidth: 1, borderColor: t.border }];
  const audioSrc = card.audioUrl ? `audio/listening/${card.audioUrl}` : '';

  const wordCounts = WORD_LEVELS
    .map((lv) => ({ lv, n: words.filter((w) => w.level === lv).length }))
    .filter((x) => x.n > 0);
  const countText =
    wordsState === 'loading' ? '불러오는 중…'
    : wordCounts.length ? wordCounts.map((x) => `${x.lv} ${x.n}`).join(' · ')
    : '없음';

  function toggleWord(key) {
    setSavedWords((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={[S.appbar, isDark && { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
        <Pressable onPress={() => nav && nav.pop()} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        <Text style={[S.appTitle, { color: t.textHigh }]}>{level ? `${level} · ${areaName}` : areaName}</Text>
        <View style={[S.kbd, { backgroundColor: t.sunk }]}>
          <Text style={[S.kbdText, { color: t.textMid }]}>{idx + 1}/{cards.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={S.body}>
        <View style={S.areaRow} accessibilityRole="header">
          <View style={[S.areaBar, { backgroundColor: t.courseJlpt }]} />
          <Text style={[S.areaLabel, { color: t.courseJlptText }]}>{areaName}</Text>
          <Text style={[S.areaHint, { color: t.textMid }]}>{showAnswers ? '결과 · 복습' : '문제를 풀어요'}</Text>
        </View>

        {/* ── 청해 풀이: 음성만(대본 숨김) ── */}
        {!isReading && !showAnswers ? (
          <View style={cardShadow}>
            <ListeningAudio t={t} S={S} src={audioSrc} />
            <Text style={[S.hint, { color: t.textMid }]}>먼저 들어보세요. 여러 번 들어도 좋아요. 대본은 문제를 풀면 볼 수 있어요.</Text>
          </View>
        ) : null}

        {/* ── 독해 지문(풀이·결과 공통) / 청해 대본(결과에서만) ── */}
        {(isReading || showAnswers) ? (
          <View style={cardShadow}>
            {!isReading && showAnswers ? <ListeningAudio t={t} S={S} src={audioSrc} scriptBelow /> : null}
            <Text style={[S.lblLow, { color: t.textLow }]}>{isReading ? '지문' : '대본'}</Text>

            {isReading
              ? card.sentences.map((s) => (
                  <View key={s.seq} style={S.sentence}>
                    <Ruby base={s.front.base} ruby={s.front.ruby} show={showAnswers && furi} size={17} color={t.textHigh} />
                    {showAnswers && s.ko ? <Text style={[S.transKo, { color: t.textMid, opacity: trans ? 1 : 0 }]}>{s.ko}</Text> : null}
                  </View>
                ))
              : card.lines.map((l) => (
                  <View key={l.seq} style={S.line}>
                    {l.speaker ? <Text style={[S.speaker, { color: t.courseJlptText }]}>{l.speaker}</Text> : null}
                    <View style={S.lineBody}>
                      <Ruby base={l.front.base} ruby={l.front.ruby} show={furi} size={17} color={t.textHigh} />
                      {l.ko ? <Text style={[S.transKo, { color: t.textMid, opacity: trans ? 1 : 0 }]}>{l.ko}</Text> : null}
                    </View>
                  </View>
                ))}

            {/* 읽기 도움·단어 = 결과에서만. 풀이 땐 부딪히는 면. */}
            {showAnswers ? (
              <>
                <View style={S.toggleRow}>
                  <ToggleBtn t={t} on={furi} label="후리가나" onPress={() => setFuri((v) => !v)} />
                  <ToggleBtn t={t} on={trans} label="해석" onPress={() => setTrans((v) => !v)} />
                </View>
                <Pressable style={[S.wordChip, { backgroundColor: t.sunk, borderColor: t.border }]} onPress={() => setWordSheet(true)} accessibilityRole="button" accessibilityLabel="이 글의 단어 보기">
                  <Text style={[S.wordChipLabel, { color: t.textMid }]}>이 글의 단어</Text>
                  <Text style={[S.wordChipCount, { color: t.courseJlptText }]}>{countText}</Text>
                  <View style={S.wordChipCta}>
                    <Text style={[S.wordChipCtaText, { color: t.textHigh }]}>단어 보기</Text>
                    <Icon name="forward" size={16} color={t.textMid} />
                  </View>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {/* ── 문제 카드 ── */}
        {q ? (
          <View style={cardShadow}>
            <Text style={[S.lblLow, { color: t.textLow }]}>문제</Text>
            <Text style={[S.stemText, { color: t.textHigh }]}>{q.stem.base}</Text>

            <View style={S.choices}>
              {q.choices.map((c) => {
                const isSel = c.seq === selected;
                let border; let badgeBg; let badgeOn; let dim = false;
                if (!showAnswers) {
                  border = isSel ? t.courseJlpt : t.borderStrong;
                  badgeBg = isSel ? t.courseJlpt : t.sunk;
                  badgeOn = isSel ? '#FFF9EC' : t.textMid;
                } else {
                  border = c.correct ? t.success : (isSel ? t.error : t.border);
                  badgeBg = c.correct ? t.success : (isSel ? t.error : t.sunk);
                  badgeOn = (c.correct || isSel) ? t.onAction : t.textMid;
                  dim = !c.correct && !isSel;
                }
                const filled = isSel || (showAnswers && c.correct);
                return (
                  <Pressable
                    key={c.seq}
                    onPress={() => { if (!showAnswers) setSelected(c.seq); }}
                    disabled={showAnswers}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    style={[S.choice, { borderColor: border, backgroundColor: filled ? t.sunk : t.bgSurface, opacity: dim ? 0.5 : 1 }]}
                  >
                    <View style={[S.numBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[S.numBadgeText, { color: badgeOn }]}>{c.seq}</Text>
                    </View>
                    <View style={S.choiceBody}>
                      <Text style={[S.choiceText, { color: t.textHigh }]}>{c.front.base}</Text>
                    </View>
                    {showAnswers && c.correct ? <Text style={[S.mark, { color: t.success }]}>정답</Text> : null}
                    {showAnswers && !c.correct && isSel ? <Text style={[S.mark, { color: t.error }]}>오답</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            {!showAnswers ? (
              <>
                <Pressable
                  style={[S.btnPri, { backgroundColor: selected == null ? t.border : t.brand }]}
                  onPress={submit}
                  disabled={selected == null}
                  accessibilityRole="button"
                >
                  <Text style={[S.btnPriText, { color: selected == null ? t.textLow : t.onBrand }]}>제출하기</Text>
                </Pressable>
                <Pressable
                  style={[S.btnGhost, { borderColor: t.borderStrong }]}
                  onPress={skip}
                  accessibilityRole="button"
                  accessibilityLabel="모르겠어요, 해설 보기"
                >
                  <Text style={[S.btnGhostText, { color: t.textMid }]}>모르겠어요</Text>
                </Pressable>
              </>
            ) : (
              <>
                {q.explanation ? (
                  <View style={[S.explain, { backgroundColor: t.sunk }]}>
                    <Text style={[S.lblLow, { color: t.textLow }]}>해설</Text>
                    <Text style={[S.explainText, { color: t.textMid }]}>{q.explanation}</Text>
                  </View>
                ) : null}
                {/* TODO: 인증 후 오답노트 저장 배선 — 지금은 안내 문구만 */}
                {round === 2 && reaction !== 'correct' ? (
                  <>
                    <Text style={[S.retryNote, { color: t.textMid }]}>넘어가도 오답노트에 남아요.</Text>
                    <View style={S.retryRow}>
                      <Pressable style={[S.btnGhost, { borderColor: t.borderStrong, flex: 1, marginTop: 0 }]} onPress={advance} accessibilityRole="button">
                        <Text style={[S.btnGhostText, { color: t.textMid }]}>넘어가기</Text>
                      </Pressable>
                      <Pressable style={[S.btnPri, { backgroundColor: t.brand, flex: 1, marginTop: 0 }]} onPress={retry} accessibilityRole="button">
                        <Text style={[S.btnPriText, { color: t.onBrand }]}>다시 풀기</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={advance} accessibilityRole="button">
                    <Text style={[S.btnPriText, { color: t.onBrand }]}>
                      {round === 1 && idx + 1 >= roundCards.length && wrongRef.current.length > 0
                        ? '틀린 문제 다시 보기'
                        : idx + 1 >= roundCards.length ? '결과 보기' : '계속하기'}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={cardShadow}>
            <Text style={[S.note, { color: t.textMid }]}>이 지문에 연결된 문항이 없어요.</Text>
            <Pressable style={[S.btnPri, { backgroundColor: t.brand }]} onPress={advance}>
              <Text style={[S.btnPriText, { color: t.onBrand }]}>{idx + 1 < roundCards.length ? '다음' : '결과 보기'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* 토모 반응 모달 — 제출 직후 */}
      {reaction && phase === 'solve' ? <TomoReaction t={t} S={S} kind={reaction} onReview={toResult} onNext={advance} /> : null}

      {/* 이 글의 단어 — 급수별 목록 + 즐겨찾기(내 단어장). 뜻·후리가나 기본 노출(열람면). */}
      <BottomSheet visible={wordSheet} title="이 글의 단어" onClose={() => setWordSheet(false)}>
        <View style={S.wordSheet}>
          <Text style={[S.wordSheetNote, { color: t.textMid }]}>
            {isReading ? '지문' : '대본'}에 나온 단어예요. 별표로 내 단어장에 담아요.
          </Text>
          {wordsState === 'loading' ? (
            <Text style={[S.wordEmpty, { color: t.textMid }]}>단어를 불러오는 중이에요…</Text>
          ) : words.length === 0 ? (
            <Text style={[S.wordEmpty, { color: t.textMid }]}>
              {wordsState === 'error' ? '단어를 불러오지 못했어요.' : '이 글에서 사전에 담긴 단어를 찾지 못했어요.'}
            </Text>
          ) : (
            WORD_LEVELS.map((lv) => {
              const ws = words.filter((w) => w.level === lv);
              if (!ws.length) return null;
              return (
                <View key={lv} style={S.wordGroup}>
                  <View style={[S.wordLevelBadge, { backgroundColor: t.courseJlpt }]}>
                    <Text style={[S.wordLevelText, { color: '#FFF9EC' }]}>{lv}</Text>
                  </View>
                  {ws.map((w) => {
                    const saved = savedWords.has(w.key);
                    return (
                      <View key={w.key} style={[S.wordRow, { borderBottomColor: t.border }]}>
                        <View style={S.wordJa}>
                          <Ruby base={w.front.base} ruby={w.front.ruby} show size={18} color={t.textHigh} />
                        </View>
                        <Text style={[S.wordMeaning, { color: t.textMid }]}>{w.meaning}</Text>
                        <Pressable onPress={() => toggleWord(w.key)} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? '단어장에서 빼기' : '단어장에 저장'}>
                          <Icon name="star" size={22} color={saved ? t.brand : t.textLow} filled={saved} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

// mm:ss 포맷.
function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// 청해 음성 재생 — 브라우저 Audio(HTML5) + 시크바(경과·총시간·진행막대, 탭으로 이동).
// 🔴 Expo 정식 이식 때 expo-av 로 교체(예고된 배선 지점, Icon·vite 와 동일).
function ListeningAudio({ t, S, src, scriptBelow = false }) {
  const audioRef = useRef(null);
  const barRef = useRef(null);              // 시크 막대 DOM(RN Web) — 정확한 탭 위치 환산용
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState(false);
  const [cur, setCur] = useState(0);       // 경과(초)
  const [dur, setDur] = useState(0);        // 총 길이(초)

  useEffect(() => {
    setPlaying(false); setErr(false); setCur(0); setDur(0);
    if (!src) { audioRef.current = null; return undefined; }
    const a = new Audio(src);
    audioRef.current = a;
    const onMeta = () => setDur(Number.isFinite(a.duration) ? a.duration : 0);
    const onTime = () => setCur(a.currentTime);
    const onEnd = () => { setPlaying(false); setCur(a.duration || 0); };
    const onErr = () => { setErr(true); setPlaying(false); };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    return () => {
      a.pause();
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      audioRef.current = null;
    };
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else {
      if (dur && a.currentTime >= dur - 0.05) { a.currentTime = 0; setCur(0); } // 끝났으면 처음부터
      a.play().then(() => setPlaying(true)).catch(() => { setErr(true); setPlaying(false); });
    }
  }
  function seek(e) {
    const a = audioRef.current;
    const node = barRef.current;
    if (!a || !dur) return;
    // 🔴 RN Web 에선 locationX 가 요소기준이 아닐 수 있어, DOM 사각형으로 절대 pageX 를 환산.
    let f;
    const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    const pageX = e.nativeEvent.pageX;
    if (rect && rect.width && pageX != null) f = (pageX - rect.left) / rect.width;
    else f = 0;
    f = Math.max(0, Math.min(1, f));
    a.currentTime = f * dur;
    setCur(f * dur);
  }

  if (!src) {
    return (
      <View style={[S.audioBox, { backgroundColor: t.sunk, borderColor: t.border }]}>
        <Text style={[S.audioText, { color: t.textMid }]}>음성이 아직 없어요 · 대본으로 확인해요</Text>
      </View>
    );
  }

  const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
  const status = err ? '음성을 불러오지 못했어요'
    : playing ? '재생 중…'
    : (cur > 0.05 && dur && cur < dur - 0.05) ? '일시정지됨'
    : (scriptBelow ? '음성 다시 듣기' : '음성 듣기');

  return (
    <View style={[S.audioBar, { backgroundColor: t.sunk }]}>
      <Pressable
        onPress={toggle}
        disabled={err}
        accessibilityRole="button"
        accessibilityLabel={playing ? '음성 일시정지' : '음성 듣기'}
        style={[S.audioBtn, { backgroundColor: err ? t.border : t.brand }]}
      >
        <Icon name={playing ? 'pause' : 'play'} size={20} color={err ? t.textLow : t.onBrand} />
      </Pressable>
      <View style={S.audioMain}>
        <Text style={[S.audioTitle, { color: t.textHigh }]}>{status}</Text>
        {err ? (
          <Text style={[S.audioSub, { color: t.textMid }]}>대본으로 확인해요</Text>
        ) : (
          <View style={S.progressRow}>
            <Text style={[S.timeText, { color: t.brandText }]}>{fmtTime(cur)}</Text>
            <Pressable
              style={S.progressHit}
              onPress={seek}
              accessibilityRole="adjustable"
              accessibilityLabel="재생 위치"
            >
              <View ref={barRef} style={[S.progressTrack, { backgroundColor: t.border }]}>
                <View style={[S.progressFill, { width: `${pct}%`, backgroundColor: t.brand }]} />
                <View style={[S.progressThumb, { left: `${pct}%`, backgroundColor: t.brand }]} />
              </View>
            </Pressable>
            <Text style={[S.timeText, { color: t.textMid }]}>{fmtTime(dur)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// 토모 반응 모달 — 정답=축하 / 오답=위로. 🔴 밝기 확대는 「새 쪽지」 전용이라 여기선 문구·색으로만.
function TomoReaction({ t, S, kind, onReview, onNext }) {
  const ok = kind === 'correct';
  const unknown = kind === 'unknown';
  const title = ok ? '최고예요!' : unknown ? '솔직하게 말해줘서 좋아요' : '괜찮아요, 같이 봐요';
  const sub = ok ? '정확해요. 이 기세로 가요.'
    : unknown ? '모르는 걸 아는 것도 실력이에요. 같이 볼까요?'
    : '틀린 건 배움의 시작이에요. 해설을 같이 볼까요?';
  return (
    <View style={S.modalOverlay}>
      <View style={[S.modalCard, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
        <Tomo scale={1.15} pose={ok ? 'well-done' : unknown ? 'cheer-up' : 'encouragement'} showNote={false} />
        <Text style={[S.modalTitle, { color: ok ? t.success : t.textHigh }]}>
          {title}
        </Text>
        <Text style={[S.modalSub, { color: t.textMid }]}>
          {sub}
        </Text>
        <View style={S.modalBtns}>
          {ok ? (
            <>
              <Pressable style={[S.modalGhost, { borderColor: t.borderStrong }]} onPress={onReview} accessibilityRole="button">
                <Text style={[S.modalGhostText, { color: t.textHigh }]} numberOfLines={1}>해설 보기</Text>
              </Pressable>
              <Pressable style={[S.modalPri, { backgroundColor: t.brand }]} onPress={onNext} accessibilityRole="button">
                <Text style={[S.modalPriText, { color: t.onBrand }]} numberOfLines={1}>다음 문제 풀기</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={[S.modalPri, { backgroundColor: t.brand, flex: 1 }]} onPress={onReview} accessibilityRole="button">
              <Text style={[S.modalPriText, { color: t.onBrand }]}>해설 보기</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function ToggleBtn({ t, on, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[tStyles.toggle, on ? { backgroundColor: t.action, borderColor: t.action } : { backgroundColor: t.bgSurface, borderColor: t.textLow }]}
    >
      <Text style={[tStyles.toggleText, { color: on ? t.onAction : t.textMid }]}>{label}</Text>
    </Pressable>
  );
}

const tStyles = StyleSheet.create({
  toggle: { flex: 1, height: 40, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
});

function makeStyles(t) {
  const rTop17 = rubyTopReserve(17); // 본문 17px 옆 라벨을 첫 줄에 맞추는 여백
  const rTop15 = rubyTopReserve(15); // 선택지 15px 용
  const bodyLH17 = Math.ceil(17 * 1.35); // 본문 줄 높이(=Ruby base lineHeight) — 화자 라벨 정렬 기준
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
    appTitle: { flex: 1, fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    kbd: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
    kbdText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    body: { padding: 14, gap: 12, minHeight: '100%' },
    areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    areaBar: { width: 4, height: 16, borderRadius: radius.full },
    areaLabel: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700' },
    areaHint: { fontFamily: fonts.ko, fontSize: 12 },
    card: { borderRadius: radius.md, padding: 16, gap: 10 },
    lblLow: { fontFamily: fonts.ko, fontSize: 13 },
    audioBox: { borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
    audioText: { fontFamily: fonts.ko, fontSize: 12.5 },
    audioBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.sm, padding: 10 },
    audioBtn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    audioTextWrap: { flex: 1, gap: 2 },
    audioMain: { flex: 1, gap: 6 },
    audioTitle: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700' },
    audioSub: { fontFamily: fonts.ko, fontSize: 12 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressHit: { flex: 1, paddingVertical: 9, justifyContent: 'center' }, // 손가락 탭 여유
    progressTrack: { height: 5, borderRadius: radius.full, position: 'relative' },
    progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full },
    progressThumb: { position: 'absolute', top: 2.5, width: 12, height: 12, borderRadius: radius.full, marginTop: -6, marginLeft: -6 },
    timeText: { fontFamily: fonts.ko, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'center' },
    hint: { fontFamily: fonts.ko, fontSize: 12.5, lineHeight: 18 },
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
    modalCard: { width: '100%', maxWidth: 340, borderRadius: radius.md, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 12 },
    modalTitle: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '800', marginTop: 4 },
    modalSub: { fontFamily: fonts.ko, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
    modalBtns: { flexDirection: 'row', gap: 8, marginTop: 8, alignSelf: 'stretch' },
    modalPri: { height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flex: 1 },
    modalPriText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '700' },
    modalGhost: { height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flex: 1 },
    modalGhostText: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '600' },
    toggleRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    sentence: { gap: 2 },
    line: { flexDirection: 'row', gap: 8 },
    speaker: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700', width: 18, paddingTop: rTop17, lineHeight: bodyLH17 },
    lineBody: { flex: 1, gap: 2 },
    transKo: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 18 },
    choices: { gap: 8, marginTop: 4 },
    choice: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.sm, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 13 },
    numBadge: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    numBadgeText: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    choiceBody: { flex: 1 },
    choiceText: { fontFamily: fonts.jp, fontSize: 15, lineHeight: 22 },
    stemText: { fontFamily: fonts.jp, fontSize: 16, fontWeight: '700', lineHeight: 26 },
    mark: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700' },
    explain: { borderRadius: radius.sm, padding: 12, gap: 4 },
    explainText: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 20 },
    btnPri: { height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    btnPriText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
    btnGhost: { height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    btnGhostText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '600' },
    retryRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    retryNote: { fontFamily: fonts.ko, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    note: { fontFamily: fonts.ko, fontSize: 13, padding: 12 },
    wordChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
    wordChipLabel: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
    wordChipCount: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '700', flex: 1 },
    wordChipCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    wordChipCtaText: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
    wordSheet: { paddingHorizontal: 12, paddingBottom: 12 },
    wordSheetNote: { fontFamily: fonts.ko, fontSize: 12, lineHeight: 17, marginBottom: 4 },
    wordEmpty: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 19, paddingVertical: 14, textAlign: 'center' },
    wordGroup: { marginTop: 6 },
    wordLevelBadge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2, marginBottom: 2 },
    wordLevelText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    wordJa: { width: 96 },
    wordMeaning: { flex: 1, fontFamily: fonts.ko, fontSize: 14 },
  });
}

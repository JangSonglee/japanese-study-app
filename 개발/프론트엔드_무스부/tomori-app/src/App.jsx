import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { getTheme, fonts } from './theme/tokens';
import { useRouter } from './nav/router';
import Icon from './components/Icon';
import HomeScreen from './screens/HomeScreen';
import CourseListScreen from './screens/CourseListScreen';
import JlptHubScreen from './screens/JlptHubScreen';
import MyScreen from './screens/MyScreen';
import SettingsScreen from './screens/SettingsScreen';
import AboutScreen from './screens/AboutScreen';
import LetterBoxScreen from './screens/LetterBoxScreen';
import LetterScreen from './screens/LetterScreen';
import WrongNoteScreen from './screens/WrongNoteScreen';
import WordCardScreen from './screens/WordCardScreen';
import GrammarCardScreen from './screens/GrammarCardScreen';
import QuizScreen from './screens/QuizScreen';
import HomeV3Screen from './screens/HomeV3Screen';
import HomeV4Screen from './screens/HomeV4Screen';
import OnboardingScreen from './screens/OnboardingScreen';
import RecommendScreen from './screens/RecommendScreen';
import { isOnboardingDone, saveOnboarding, readAidFromQ2 } from './data/onboarding';
import { loadCards, loadGrammar, loadReading, loadListening, loadCardsByKeys, loadImageManifest } from './data/vocab';

/**
 * App — FE 본편 첫 조각(JLPT 단어 수직선)의 셸.
 *  · 손수 만든 스택 네비(useRouter)로 화면 전환. 하단 5탭 바 없음(이 조각).
 *  · 라우트: home → courses → jlptHub → wordSession(level) / home → my → settings.
 *  · 폰 프레임(320px) 안에 현재 화면. 바깥 topbar 는 개발용(라이트/다크 확인).
 *  · 읽기 도움 설정(settings)은 App 이 보유(localStorage) → 세션·설정 화면에 주입.
 */
export default function App() {
  const [mode, setMode] = useState('light');
  // 딥링크(미리보기 편의): ?screen=homeV4 처럼 특정 화면으로 바로 진입.
  const initialScreen = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('screen')) || null;
  const nav = useRouter(initialScreen || (isOnboardingDone() ? 'home' : 'onboarding'));
  const [settings, setSettings] = useState(() => {
    // MY›설정 읽기 도움 기본값 — localStorage 유지. 없으면 「조금 안다」 기본(후리 ON·발음 OFF).
    try {
      const s = JSON.parse(localStorage.getItem('tomori.readAid'));
      if (s && typeof s.furigana === 'boolean' && typeof s.pron === 'boolean') return s;
    } catch { /* ignore */ }
    return { furigana: true, pron: false };
  });
  const t = getTheme(mode);

  useEffect(() => {
    try { localStorage.setItem('tomori.readAid', JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  function handleOnboardingFinish(answers) {
    const result = saveOnboarding(answers);        // 저장 + 추천 계산
    setSettings(readAidFromQ2(answers.q2));         // Q2 → 읽기도움 기본값(localStorage 반영)
    nav.replace('recommend', { result });
  }
  function handleStart() {
    nav.reset('home');
    nav.push('courses');                            // 홈 + 학습 코스(추천 태그)로 랜딩
  }

  const { name, params } = nav.current;

  return (
    <AuthProvider>
      <View style={styles.stage}>
        <View style={styles.topbar}>
          <Text style={styles.brand}>토모리 · FE 본편 (JLPT 단어 수직선)</Text>
          <Pressable style={styles.modeBtn} onPress={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
            <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={15} color="#FFF9EC" />
            <Text style={styles.modeBtnText}>{mode === 'dark' ? '라이트' : '다크'}</Text>
          </Pressable>
        </View>

        <View style={[styles.phone, { backgroundColor: t.bgBase, borderColor: t.borderStrong }]}>
          <ThemeProvider mode={mode}>
            {name === 'onboarding' ? (
              <OnboardingScreen onFinish={handleOnboardingFinish} onExit={() => nav.reset('home')} />
            ) : name === 'recommend' ? (
              <RecommendScreen result={params.result} onStart={handleStart} />
            ) : name === 'homeV3' ? (
              <HomeV3Screen nav={nav} />
            ) : name === 'homeV4' ? (
              <HomeV4Screen nav={nav} />
            ) : name === 'home' ? (
              <HomeScreen nav={nav} />
            ) : name === 'courses' ? (
              <CourseListScreen nav={nav} />
            ) : name === 'jlptHub' ? (
              <JlptHubScreen nav={nav} />
            ) : name === 'wordSession' ? (
              <WordSession nav={nav} level={params.level || 'N5'} />
            ) : name === 'grammarSession' ? (
              <GrammarSession nav={nav} level={params.level || 'N5'} />
            ) : name === 'readingSession' ? (
              <QuizSession nav={nav} level={params.level || 'N5'} kind="reading" />
            ) : name === 'listeningSession' ? (
              <QuizSession nav={nav} level={params.level || 'N5'} kind="listening" />
            ) : name === 'my' ? (
              <MyScreen nav={nav} />
            ) : name === 'settings' ? (
              <SettingsScreen settings={settings} onChange={setSettings} onBack={() => nav.pop()} />
            ) : name === 'about' ? (
              <AboutScreen nav={nav} />
            ) : name === 'letterBox' ? (
              <LetterBoxScreen nav={nav} />
            ) : name === 'letter' ? (
              <LetterScreen nav={nav} id={params.id} seq={params.seq} />
            ) : name === 'wrongNote' ? (
              <WrongNoteScreen nav={nav} />
            ) : null}
          </ThemeProvider>
        </View>

        <Text style={styles.note}>실 Supabase · 스택 네비 · 현재: {name}{params.level ? ` · ${params.level}` : ''}</Text>
      </View>
    </AuthProvider>
  );
}

/**
 * 단어 세션 로더 — 라우트 진입 시 해당 급수의 공개 단어를 실 Supabase에서 읽는다.
 * 카드 세트는 급수가 곧 고정이라 key 불필요(진입마다 새 마운트).
 */
function WordSession({ nav, level }) {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState('');
  const t = getTheme('light'); // 메시지 색만 — 실제 화면은 ThemeProvider 하위

  useEffect(() => {
    let alive = true;
    setCards(null);
    setErr('');
    // 🖼️ 이미지 있는 단어를 세션 앞에 노출(전 급수). manifest.json(optimize 스크립트 생성) 기반.
    //   급수의 이미지 단어가 없으면 그냥 첫 10개. 이미지가 쌓일수록 자연스럽게 앞에 뜬다.
    (async () => {
      try {
        const prefix = `jlpt.${level.toLowerCase()}.vocab.`;
        const imagedKeys = (await loadImageManifest()).filter((k) => k.startsWith(prefix));
        let cards;
        if (imagedKeys.length) {
          // 매니페스트 키 = 실제 이미지가 있는 카드 → hasImage 태그.
          // 이미지 없는 카드(rest)에 <Image>를 마운트하면 404→붕괴로 카드 전환 시 깜빡임(레이아웃 점프)이 생긴다.
          const imaged = (await loadCardsByKeys(imagedKeys)).map((c) => ({ ...c, hasImage: true }));
          const rest = await loadCards(level, 10);
          const seen = new Set(imaged.map((c) => c.key));
          cards = [...imaged, ...rest.filter((c) => !seen.has(c.key))];
        } else {
          cards = await loadCards(level, 10);
        }
        if (alive) setCards(cards);
      } catch (e) {
        if (alive) setErr(String(e.message || e));
      }
    })();
    return () => { alive = false; };
  }, [level]);

  if (err) return <View style={styles.center}><Text style={[styles.msg, { color: '#B5533D' }]}>데이터 로드 실패: {err}</Text></View>;
  if (!cards) return <View style={styles.center}><ActivityIndicator /><Text style={[styles.msg, { color: t.textMid }]}>{level} 카드 불러오는 중…</Text></View>;
  return <WordCardScreen nav={nav} level={level} cards={cards} />;
}

/** 문법 세션 로더 — 라우트 진입 시 해당 급수의 공개 문법을 실 Supabase에서 읽는다. */
function GrammarSession({ nav, level }) {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState('');
  const t = getTheme('light');

  useEffect(() => {
    let alive = true;
    setCards(null);
    setErr('');
    loadGrammar(level, 12)
      .then((cs) => { if (alive) setCards(cs); })
      .catch((e) => { if (alive) setErr(String(e.message || e)); });
    return () => { alive = false; };
  }, [level]);

  if (err) return <View style={styles.center}><Text style={[styles.msg, { color: '#B5533D' }]}>데이터 로드 실패: {err}</Text></View>;
  if (!cards) return <View style={styles.center}><ActivityIndicator /><Text style={[styles.msg, { color: t.textMid }]}>{level} 문법 불러오는 중…</Text></View>;
  return <GrammarCardScreen nav={nav} level={level} cards={cards} />;
}

/** 독해·청해 세션 로더 — 실 Supabase에서 공개 지문/대본+문항을 읽는다(kind로 분기). */
function QuizSession({ nav, level, kind }) {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState('');
  const t = getTheme('light');
  const label = kind === 'reading' ? '독해' : '청해';

  useEffect(() => {
    let alive = true;
    setCards(null);
    setErr('');
    const load = kind === 'reading' ? loadReading : loadListening;
    load(level, 12)
      .then((cs) => { if (alive) setCards(cs); })
      .catch((e) => { if (alive) setErr(String(e.message || e)); });
    return () => { alive = false; };
  }, [level, kind]);

  if (err) return <View style={styles.center}><Text style={[styles.msg, { color: '#B5533D' }]}>데이터 로드 실패: {err}</Text></View>;
  if (!cards) return <View style={styles.center}><ActivityIndicator /><Text style={[styles.msg, { color: t.textMid }]}>{level} {label} 불러오는 중…</Text></View>;
  return <QuizScreen nav={nav} level={level} kind={kind} cards={cards} />;
}

const styles = StyleSheet.create({
  stage: {
    minHeight: '100%', alignItems: 'center', paddingVertical: 28, gap: 14,
    backgroundColor: '#EFE9E1',
  },
  topbar: {
    width: 320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', color: '#5D554C', flex: 1 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1A1613' },
  modeBtnText: { fontFamily: fonts.ko, fontSize: 12, fontWeight: '600', color: '#FFF9EC' },
  phone: {
    width: 320, height: 640, borderRadius: 26, borderWidth: 1, overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(26,22,19,.18)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  msg: { fontFamily: fonts.ko, fontSize: 13, padding: 16, textAlign: 'center' },
  note: { fontFamily: fonts.ko, fontSize: 12, color: '#9C948B' },
});

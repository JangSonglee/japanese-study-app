import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { translate } from '../data/translate';
import { saveWord, unsaveWord } from '../data/wordbook';

/**
 * 번역 탭 (텍스트 번역 MVP) — 한↔일 입력 번역.
 *  · 엔진 = 무료 MyMemory(data/translate.js). 키 불필요·데모용, 추후 Google/DeepL 교체(화면 무수정).
 *  · 일본어 쪽 발음 듣기(브라우저 Web Speech). 결과를 단어장에 저장(한↔일 쌍 → ja+뜻).
 *  · 게스트도 번역 가능. 저장만 로그인 필요(saveWord가 게스트 no-op → 안내).
 *  · 🅿️ 카메라 OCR·후리가나(형태소 분석 필요)는 추후. 후리가나는 콘텐츠 파이프라인과 동일한 분석기 필요.
 */
export default function TranslateScreen() {
  const { t } = useTheme();
  const { user } = useAuth();
  const S = makeStyles(t);

  const [dir, setDir] = useState('koja');   // koja: 한→일 / jako: 일→한
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const reqRef = useRef(0);

  const jaInput = dir === 'jako';           // 입력이 일본어인가
  const srcLabel = dir === 'koja' ? '한국어' : '日本語';
  const tgtLabel = dir === 'koja' ? '日本語' : '한국어';
  const source = dir === 'koja' ? 'ko' : 'ja';
  const target = dir === 'koja' ? 'ja' : 'ko';

  function flip() {
    setDir((d) => (d === 'koja' ? 'jako' : 'koja'));
    setInput(result); setResult(input); setErr(''); setSaved(false); setNote('');
  }

  async function onTranslate() {
    const q = input.trim();
    setErr(''); setSaved(false); setNote('');
    if (!q) { setResult(''); return; }
    const my = ++reqRef.current;
    setBusy(true);
    const r = await translate({ text: q, source, target });
    if (my !== reqRef.current) return;      // 뒤늦은 응답 무시
    setBusy(false);
    if (!r.ok) { setErr(r.error || '번역하지 못했어요.'); setResult(''); return; }
    setResult(r.text);
  }

  // 일본어 발음 듣기(브라우저 TTS). 일본어 텍스트에만 노출.
  function speak(text) {
    try {
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* 미지원 환경 무시 */ }
  }

  // 결과를 단어장에 저장 — 한↔일 쌍에서 일본어=표제, 한국어=뜻.
  const jaText = dir === 'koja' ? result : input;
  const koText = dir === 'koja' ? input : result;
  const dedup = `x:translate:${(jaText || '').trim()}`;
  async function toggleSave() {
    if (!jaText.trim() || !koText.trim()) return;
    if (!user) { setNote('저장은 로그인 후 이용할 수 있어요. (내 정보 탭)'); return; }
    const willSave = !saved;
    setSaved(willSave);
    if (willSave) {
      setNote('단어장에 담았어요.');
      await saveWord({ dedup, contentKey: null, source: 'translate', tag: 'JLPT', level: null, ja: jaText.trim(), reading: '', ruby: null, meaning: koText.trim() }).catch(() => {});
    } else {
      setNote('');
      await unsaveWord(dedup).catch(() => {});
    }
  }

  const canSave = !!result && !err;

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.head}><Text style={[S.title, { color: t.textHigh }]}>번역</Text></View>

      <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">
        {/* 방향 토글 */}
        <View style={S.dirRow}>
          <View style={[S.langPill, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}><Text style={[S.langText, { color: t.textHigh }]}>{srcLabel}</Text></View>
          <Pressable onPress={flip} hitSlop={10} accessibilityRole="button" accessibilityLabel="번역 방향 바꾸기" style={S.swap}>
            <Icon name="forward" size={18} color={t.textMid} />
          </Pressable>
          <View style={[S.langPill, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}><Text style={[S.langText, { color: t.textHigh }]}>{tgtLabel}</Text></View>
        </View>

        {/* 입력 */}
        <View style={[S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
          <TextInput
            value={input}
            onChangeText={(v) => { setInput(v); setErr(''); }}
            onSubmitEditing={onTranslate}
            placeholder={dir === 'koja' ? '번역할 한국어를 입력하세요' : '日本語を入力してください'}
            placeholderTextColor={t.textLow}
            multiline
            style={[S.input, { color: t.textHigh, fontFamily: jaInput ? fonts.jp : fonts.ko }]}
            accessibilityLabel="번역 입력"
            {...(jaInput ? { lang: 'ja' } : {})}
          />
          <View style={S.inputFoot}>
            {input ? (
              <Pressable onPress={() => { setInput(''); setResult(''); setErr(''); setSaved(false); setNote(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="지우기">
                <Text style={[S.clear, { color: t.textLow }]}>지우기</Text>
              </Pressable>
            ) : <View />}
            <Pressable onPress={onTranslate} disabled={busy || !input.trim()} style={[S.btn, { backgroundColor: busy || !input.trim() ? t.sunk : t.brand }]} accessibilityRole="button" accessibilityLabel="번역하기">
              <Text style={[S.btnText, { color: busy || !input.trim() ? t.textLow : t.onBrand }]}>{busy ? '번역 중…' : '번역하기'}</Text>
            </Pressable>
          </View>
        </View>

        {/* 결과 */}
        {err ? (
          <View style={[S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
            <Text style={[S.errText, { color: t.textMid }, keepAll]}>{err}</Text>
          </View>
        ) : result ? (
          <View style={[S.card, { backgroundColor: t.bgSurface, boxShadow: t.sh1 }]}>
            <Text style={[S.result, { color: t.textHigh, fontFamily: jaInput ? fonts.ko : fonts.jp }, keepAll]} {...(!jaInput ? { lang: 'ja' } : {})}>{result}</Text>
            <View style={S.resultFoot}>
              {/* 일본어 쪽 발음 듣기 */}
              <Pressable onPress={() => speak(jaText)} hitSlop={8} style={S.footBtn} accessibilityRole="button" accessibilityLabel="일본어 발음 듣기">
                <Icon name="play" size={18} color={t.textMid} />
                <Text style={[S.footLabel, { color: t.textMid }]}>발음</Text>
              </Pressable>
              {/* 단어장 저장 */}
              {canSave ? (
                <Pressable onPress={toggleSave} hitSlop={8} style={S.footBtn} accessibilityRole="button" accessibilityLabel={saved ? '단어장에서 빼기' : '단어장에 저장'}>
                  <Icon name="star" size={18} color={saved ? t.brand : t.textMid} filled={saved} />
                  <Text style={[S.footLabel, { color: saved ? t.brand : t.textMid }]}>{saved ? '저장됨' : '단어장'}</Text>
                </Pressable>
              ) : null}
            </View>
            {note ? <Text style={[S.note, { color: t.textLow }, keepAll]}>{note}</Text> : null}
          </View>
        ) : (
          <View style={S.center}>
            <Tomo scale={0.62} pose="read" showNote={false} />
            <Text style={[S.hint, { color: t.textLow }, keepAll]}>한국어와 일본어를 서로 번역해요.</Text>
          </View>
        )}

        <Text style={[S.engineNote, { color: t.textLow }, keepAll]}>무료 번역 엔진(MyMemory)을 써요. 결과가 어색할 수 있어요.</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    head: { height: 56, justifyContent: 'center', paddingHorizontal: 20 },
    title: { fontFamily: fonts.ko, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    body: { padding: 16, gap: 12, paddingBottom: 100 },

    dirRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    langPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, minWidth: 88, alignItems: 'center' },
    langText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
    swap: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

    card: { borderRadius: radius.lg, padding: 16, gap: 12 },
    input: { minHeight: 64, fontSize: 17, lineHeight: 25.5, textAlignVertical: 'top', padding: 0 },
    inputFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    clear: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '500' },
    btn: { height: 40, paddingHorizontal: 20, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },

    result: { fontSize: 19, lineHeight: 28.5 },
    resultFoot: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    footBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    footLabel: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '600' },
    note: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400' },
    errText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '500' },

    center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
    hint: { fontFamily: fonts.ko, fontSize: 14, fontWeight: '500', textAlign: 'center' },
    engineNote: { fontFamily: fonts.ko, ...typeStyle('label'), fontWeight: '400', textAlign: 'center', marginTop: 4 },
  });
}

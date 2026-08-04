import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import Tomo from '../components/Tomo';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, keepAll, typeStyle } from '../theme/tokens';
import { QUESTIONS } from '../data/onboarding';

/**
 * 온보딩 진단 — 4문항, 한 문항씩. 시험이 아니라 취향·상황 파악(PRD 10.2).
 *  · 진행 점 4개, 뒤로로 이전 문항 수정, 단일 선택 → 다음.
 *  · 토모 동행(담담·응원). 밝기 헤일로 없음(새 쪽지 전용 14.2.1).
 */
export default function OnboardingScreen({ onFinish, onExit }) {
  const { t } = useTheme();
  const S = makeStyles(t);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = QUESTIONS[step];
  const selected = answers[q.key];
  const isLast = step === QUESTIONS.length - 1;

  function choose(value) {
    setAnswers((a) => ({ ...a, [q.key]: value }));
  }
  function next() {
    if (selected == null) return;
    if (isLast) { onFinish(answers); return; }
    setStep((s) => s + 1);
  }
  function back() {
    if (step === 0) { onExit && onExit(); return; }
    setStep((s) => s - 1);
  }

  return (
    <View style={[S.screen, { backgroundColor: t.bgBase }]}>
      <View style={S.appbar}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={step === 0 ? '닫기' : '이전 문항'}>
          <Icon name="back" size={22} color={t.textHigh} />
        </Pressable>
        {/* 진행 점 */}
        <View style={S.dots}>
          {QUESTIONS.map((_, i) => (
            <View key={i} style={[S.dot, { backgroundColor: i <= step ? t.brand : t.border }]} />
          ))}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={S.body}>
        <View style={S.tomoWrap}><Tomo scale={0.5} pose="bright" showNote={false} /></View>
        <Text style={[S.step, { color: t.textLow }]}>{step + 1} / {QUESTIONS.length}</Text>
        <Text style={[S.title, { color: t.textHigh }, keepAll]}>{q.title}</Text>
        {q.hint ? <Text style={[S.hint, { color: t.textMid }, keepAll]}>{q.hint}</Text> : null}

        <View style={S.options}>
          {q.options.map((o) => {
            const on = selected === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => choose(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[S.option, { backgroundColor: t.bgSurface, borderColor: on ? t.brand : t.border }, on && { borderWidth: 2 }]}
              >
                {o.emoji ? <Text style={S.emoji}>{o.emoji}</Text> : null}
                <Text style={[S.optionText, { color: t.textHigh }, keepAll]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={S.foot}>
        <Pressable
          onPress={next}
          disabled={selected == null}
          accessibilityRole="button"
          style={[S.btnPri, { backgroundColor: selected == null ? t.sunk : t.brand }]}
        >
          <Text style={[S.btnPriText, { color: selected == null ? t.textLow : t.onBrand }, keepAll]}>
            {isLast ? '결과 보기' : '다음'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    screen: { flex: 1 },
    appbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 18, height: 6, borderRadius: radius.full },
    body: { padding: 20, gap: 8, alignItems: 'center' },
    tomoWrap: { marginBottom: 4 },
    step: { fontFamily: fonts.ko, ...typeStyle('label') },
    title: { fontFamily: fonts.ko, ...typeStyle('heading'), textAlign: 'center', marginTop: 2 },
    hint: { fontFamily: fonts.ko, ...typeStyle('bodySm'), fontWeight: '400', textAlign: 'center' },
    options: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 16 },
    // 이모지 글리프 — 아이콘처럼 고정 크기(타입 스케일 대상 아님, back/chev 선례와 동일).
    emoji: { fontSize: 22 },
    optionText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '600', flex: 1 },
    foot: { padding: 16 },
    btnPri: { height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    btnPriText: { fontFamily: fonts.ko, ...typeStyle('body'), fontWeight: '700' },
  });
}

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Ruby from './Ruby';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { fonts, radius, keepAll } from '../theme/tokens';
import { REPLY_PHRASES, phraseByKey, loadReply, saveReply } from '../data/letterReplies';

/**
 * 답장 영역 — 편지 상세 하단.
 *  · 가이드형 일본어 작문(문구 카드 선택) + 선택 한국어 한 줄. 저장=letter_replies(RLS 본인).
 *  · 게스트=담담한 로그인 안내(재촉 없음). 🔴 밝기 헤일로·폭죽 없음(토모 톤). 답장은 철저히 선택.
 */
export default function LetterReply({ letterSeq, nav, furi = true }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const S = makeStyles(t);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(false);
  const [keys, setKeys] = useState([]);
  const [bodyKo, setBodyKo] = useState('');
  const [saving, setSaving] = useState(false);
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!user) { setLoading(false); setReply(null); return () => { alive = false; }; }
    setLoading(true);
    loadReply(letterSeq)
      .then((r) => { if (!alive) return; setReply(r); setLoading(false); if (r) { setKeys(r.phrase_keys || []); setBodyKo(r.body_ko || ''); } })
      .catch(() => { if (alive) { setReply(null); setLoading(false); } });
    return () => { alive = false; };
  }, [user, letterSeq]);

  function toggleKey(k) {
    setKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function send() {
    if (keys.length === 0 && !bodyKo.trim()) return;
    setSaving(true); setErr('');
    try {
      await saveReply(letterSeq, keys, bodyKo.trim());
      const r = await loadReply(letterSeq);
      setReply(r); setEditing(false); setAck(true);
    } catch (e) {
      setErr('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setSaving(false); }
  }

  // 게스트 — 담담한 안내(재촉 없음)
  if (!user) {
    return (
      <View style={S.wrap}>
        <View style={[S.divider, { backgroundColor: t.border }]} />
        <Text style={[S.guide, { color: t.textMid }, keepAll]}>로그인하면 토모에게 답장을 남길 수 있어요.</Text>
        <Pressable style={[S.ghostBtn, { borderColor: t.borderStrong }]} onPress={() => nav.push('my')} accessibilityRole="button" accessibilityLabel="로그인하러 가기">
          <Text style={[S.ghostText, { color: t.textHigh }]}>로그인하러 가기</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) return null;

  // 저장된 답장(수정 아님)
  if (reply && !editing) {
    return (
      <View style={S.wrap}>
        <View style={[S.divider, { backgroundColor: t.border }]} />
        <Text style={[S.myLabel, { color: t.brandText }, keepAll]}>내 답장</Text>
        {ack ? <Text style={[S.ack, { color: t.textMid }, keepAll]}>토모에게 전해졌어요.</Text> : null}
        <View style={S.savedBox}>
          {(reply.phrase_keys || []).map((k) => {
            const p = phraseByKey(k);
            return p ? <Ruby key={k} base={p.base} ruby={p.ruby} show={furi} size={16} color={t.textHigh} /> : null;
          })}
          {reply.body_ko ? <Text style={[S.savedKo, { color: t.textMid }, keepAll]}>{reply.body_ko}</Text> : null}
        </View>
        <Pressable style={[S.ghostBtn, { borderColor: t.borderStrong }]} onPress={() => { setEditing(true); setAck(false); }} accessibilityRole="button" accessibilityLabel="답장 수정">
          <Text style={[S.ghostText, { color: t.textHigh }]}>답장 수정</Text>
        </Pressable>
      </View>
    );
  }

  // 컴포저(답장 없음 or 수정)
  const canSend = keys.length > 0 || bodyKo.trim().length > 0;
  return (
    <View style={S.wrap}>
      <View style={[S.divider, { backgroundColor: t.border }]} />
      <Text style={[S.myLabel, { color: t.brandText }, keepAll]}>답장하기</Text>
      <Text style={[S.guide, { color: t.textMid }, keepAll]}>토모에게 보낼 말을 골라 보세요. (선택)</Text>
      <View style={S.cards}>
        {REPLY_PHRASES.map((p) => {
          const on = keys.includes(p.key);
          return (
            <Pressable
              key={p.key}
              onPress={() => toggleKey(p.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[S.card, { backgroundColor: on ? t.sunk : t.bgSurface, borderColor: on ? t.brand : t.border }]}
            >
              <Ruby base={p.base} ruby={p.ruby} show size={15} color={t.textHigh} />
              <Text style={[S.cardKo, { color: t.textMid }, keepAll]}>{p.ko}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={[S.input, { backgroundColor: t.bgSurface, borderColor: t.borderStrong, color: t.textHigh }]}
        placeholder="한국어로 한 줄 덧붙여도 돼요 (선택)"
        placeholderTextColor={t.textLow}
        value={bodyKo}
        onChangeText={setBodyKo}
        maxLength={80}
      />
      {err ? <Text style={[S.err, { color: t.error }, keepAll]}>{err}</Text> : null}
      <Pressable
        style={[S.sendBtn, { backgroundColor: canSend ? t.brand : t.sunk }]}
        onPress={send}
        disabled={saving || !canSend}
        accessibilityRole="button"
        accessibilityLabel="답장 보내기"
      >
        <Text style={[S.sendText, { color: canSend ? t.onBrand : t.textLow }]}>{saving ? '보내는 중…' : '보내기'}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    wrap: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
    divider: { height: 1, marginBottom: 4 },
    myLabel: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '700' },
    ack: { fontFamily: fonts.ko, fontSize: 12 },
    guide: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 20 },
    ghostBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
    ghostText: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '600' },
    savedBox: { gap: 6, paddingVertical: 4 },
    savedKo: { fontFamily: fonts.ko, fontSize: 13, marginTop: 2 },
    cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2, alignItems: 'flex-start' },
    cardKo: { fontFamily: fonts.ko, fontSize: 11 },
    input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.ko, fontSize: 14 },
    err: { fontFamily: fonts.ko, fontSize: 12 },
    sendBtn: { height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    sendText: { fontFamily: fonts.ko, fontSize: 15, fontWeight: '700' },
  });
}

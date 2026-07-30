# 토모에게 답장하기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편지 상세에서 가이드형 일본어 문구로 토모에게 답장을 쓰고, `auth.uid()` RLS로 보호되는 `letter_replies` 테이블에 실제로 저장·재표시한다.

**Architecture:** 신규 `letter_replies` 테이블(RLS 본인만) + FE 데이터 헬퍼(`data/letterReplies.js`, Supabase 세션으로 load/save) + 답장 UI 컴포넌트(`components/LetterReply.jsx`)를 `LetterScreen`에 배선. 답장은 편지 회차(`letter_seq`)로 건다. 로그인 필요(게스트는 담담한 안내).

**Tech Stack:** React Native Web + Vite, Supabase(테이블·RLS·MCP), `Ruby` 후리가나 렌더러 + `rubyParse`, `useAuth`(2026-07-31 인증).

## Global Constraints

- 🔴 유닛 테스트 없음. 검증 = `npm run build` + 프리뷰(@5599) + Supabase MCP.
  🔴 **로그인 검증 분리**: 컨트롤러 프리뷰는 **게스트**(로그인=대표님 계정, 대행 불가). ⇒ BE(테이블·RLS·advisor)는 MCP로 완전 검증 / FE는 빌드+게스트 상태(로그인 안내)+코드 리뷰 / **로그인 상태의 답장→저장→유지 end-to-end는 대표님이 클릭**하고 컨트롤러가 `letter_replies` 행을 MCP로 확인.
- 🔴 원시 hex 금지 — `theme/tokens.js` 토큰만(앰버=t.brand/t.brandText/t.onBrand). 카드=radius.lg, 버튼·칩=radius.sm/full.
- 🔴 한국어 문장형 텍스트엔 `keepAll`. 일본어는 `Ruby`(내부적으로 fonts.jp·lang=ja).
- 🔴 **밝기 헤일로·폭죽 없음**(토모 톤 14.2.1). **답장은 철저히 선택** — 안 해도 재촉·빨간점 없음(1.3·14.4).
- 🔴 DB 접속은 앱 supabase 클라이언트(publishable 키 + 세션). 커밋은 각 태스크 끝. Bash(POSIX) 커밋(PowerShell heredoc 금지).
- Supabase ref = `vtbprgphfksfffivfnrf`. FE = `개발/프론트엔드_무스부/tomori-app`.

---

## File Structure

- 마이그레이션 `letter_replies_table` (Supabase MCP) — 테이블 + RLS + grant.
- `개발/프론트엔드_무스부/tomori-app/src/data/letterReplies.js` — **신규**. `REPLY_PHRASES`·`phraseByKey`·`loadReply`·`saveReply`.
- `개발/프론트엔드_무스부/tomori-app/src/components/LetterReply.jsx` — **신규**. 답장 UI(게스트 안내·컴포저·저장된 답장).
- `개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx` — **수정**. `<LetterReply>` 배선.
- `기획/PRD.md` · `기획/진행상태.md` — **수정**. 답장 정합.

---

## Task 1: BE — `letter_replies` 테이블 + RLS

**Files:** 마이그레이션 `letter_replies_table` (Supabase MCP `apply_migration`).

**Interfaces:** Produces `public.letter_replies`(user_id·letter_seq·phrase_keys jsonb·body_ko·타임스탬프, unique(user_id,letter_seq)) + RLS 본인만.

- [ ] **Step 1: 마이그레이션 적용**

Supabase MCP `apply_migration` (name `letter_replies_table`, project `vtbprgphfksfffivfnrf`):
```sql
create table if not exists public.letter_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  letter_seq int not null,
  phrase_keys jsonb not null default '[]'::jsonb,
  body_ko text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, letter_seq)
);

alter table public.letter_replies enable row level security;

create policy lreply_sel on public.letter_replies for select using (user_id = auth.uid());
create policy lreply_ins on public.letter_replies for insert with check (user_id = auth.uid());
create policy lreply_upd on public.letter_replies for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lreply_del on public.letter_replies for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.letter_replies to authenticated;
```

- [ ] **Step 2: 검증**

Supabase MCP `execute_sql`:
```sql
select relrowsecurity from pg_class where oid = 'public.letter_replies'::regclass;               -- true
select polname, cmd from pg_policies where tablename = 'letter_replies' order by polname;          -- 4 policies
select count(*) from public.letter_replies;                                                        -- 0
```
그리고 `get_advisors` (type security) 신규 경고 0 확인. 🔴 anon 은 접근 불가여야(정책이 auth.uid() 기반이라 anon=0행).

- [ ] **Step 3: 기록 커밋**

`기획/진행상태.md` 에 마이그레이션명·검증 한 줄 기록(Edit, 파일 끝 러닝노트 앵커) → `git add "기획/진행상태.md"` → `git commit -m "docs(reply): letter_replies 테이블 적용 기록"`.

---

## Task 2: FE 데이터 — `data/letterReplies.js`

가이드 문구 + Supabase load/save 헬퍼. 빌드로 검증(런타임은 Task 3 UI에서).

**Files:** Create `개발/프론트엔드_무스부/tomori-app/src/data/letterReplies.js`

**Interfaces:**
- Produces: `REPLY_PHRASES`(각 `{key, jp, ko, base, ruby, reading}`), `phraseByKey(key)→phrase|null`,
  `loadReply(letterSeq)→Promise<{letter_seq,phrase_keys,body_ko,updated_at}|null>`,
  `saveReply(letterSeq, phraseKeys:string[], bodyKo:string)→Promise<void>`(upsert, 미로그인 시 throw 'login-required').

- [ ] **Step 1: 파일 생성**

```js
// 토모에게 보내는 답장 — 데이터 계층(가이드 문구 + Supabase load/save).
// 답장은 auth.uid() RLS로 보호되는 letter_replies 에 letter_seq(편지 회차) 기준 upsert.
import { supabase } from './supabaseClient';
import { rubyToJson } from './rubyParse';

// 가이드 답장 문구 카드(N5, 토모 향). jp=브래킷 후리가나({漢字|よみ}) → rubyToJson 좌표.
const PHRASES_RAW = [
  { key: 'thanks', jp: 'ありがとう。', ko: '고마워요.' },
  { key: 'glad', jp: 'うれしいです。', ko: '기뻐요.' },
  { key: 'comeback', jp: 'また{来|き}ますね。', ko: '또 올게요.' },
  { key: 'try', jp: 'がんばります。', ko: '열심히 할게요.' },
  { key: 'todaytoo', jp: '{今日|きょう}もありがとう。', ko: '오늘도 고마워요.' },
  { key: 'youtoo', jp: 'トモもね。', ko: '토모도요.' },
];

export const REPLY_PHRASES = PHRASES_RAW.map((p) => ({ ...p, ...rubyToJson(p.jp) }));

export function phraseByKey(key) {
  return REPLY_PHRASES.find((p) => p.key === key) || null;
}

// 본인 답장 1행 로드(없으면 null). 로그인 세션이 있어야 RLS 통과(게스트는 0행 → null).
export async function loadReply(letterSeq) {
  const { data, error } = await supabase
    .from('letter_replies')
    .select('letter_seq, phrase_keys, body_ko, updated_at')
    .eq('letter_seq', letterSeq)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// 답장 저장(편지당 1개 upsert). user_id 는 세션에서 명시(기본값 없음). RLS with_check 가 세션과 일치 강제.
export async function saveReply(letterSeq, phraseKeys, bodyKo) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('login-required');
  const { error } = await supabase.from('letter_replies').upsert(
    {
      user_id: user.id,
      letter_seq: letterSeq,
      phrase_keys: phraseKeys,
      body_ko: bodyKo ? bodyKo : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,letter_seq' },
  );
  if (error) throw error;
}
```

- [ ] **Step 2: 빌드 검증**

Run: `cd "개발/프론트엔드_무스부/tomori-app" && npm run build` → `✓ built` 0 errors(import·rubyToJson 파싱 확인).

- [ ] **Step 3: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/data/letterReplies.js"
git commit -m "feat(reply): 답장 데이터 계층 — 가이드 문구 + Supabase load/save"
```

---

## Task 3: FE UI — `LetterReply` 컴포넌트 + `LetterScreen` 배선

**Files:**
- Create: `개발/프론트엔드_무스부/tomori-app/src/components/LetterReply.jsx`
- Modify: `개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx`

**Interfaces:**
- Consumes: `letterReplies`(Task 2), `useAuth`, `Ruby`. `LetterScreen` 은 `<LetterReply letterSeq={letter.seq} nav={nav} furi={furi} />`.

- [ ] **Step 1: `components/LetterReply.jsx` 생성**

```jsx
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
              style={[S.card, { backgroundColor: on ? t.onBrand : t.bgSurface, borderColor: on ? t.brand : t.border }]}
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
    guide: { fontFamily: fonts.ko, fontSize: 13, lineHeight: 19 },
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
```

- [ ] **Step 2: `LetterScreen.jsx` 배선**

import 추가:
```js
import LetterReply from '../components/LetterReply';
```
편지 `paper` `<View>…</View>` **닫힘 바로 다음**(닫기 버튼 `<Pressable>` 앞)에 삽입:
```jsx
            <Text style={[S.signoff, { color: t.brandText }]} lang="ja">{letter.signoff}</Text>
          </View>

          <LetterReply letterSeq={letter.seq} nav={nav} furi={furi} />

          <Pressable style={[S.btn, { backgroundColor: t.brand }]} onPress={() => nav.pop()} accessibilityRole="button" accessibilityLabel="닫기">
```
(즉 `signoff` Text로 끝나는 paper View 를 닫은 뒤, 닫기 버튼 앞에 `<LetterReply>` 한 줄.)

- [ ] **Step 3: 빌드 + 게스트 검증**

Run: `npm run build` → 0 errors.
프리뷰(@5599, **게스트**): 홈 편지 도착 → 편지 상세 하단에 **「로그인하면 토모에게 답장을 남길 수 있어요」 + 「로그인하러 가기」** 노출(컴포저·재촉 없음). 라이트/다크·콘솔0. 스크린샷 1장.
🔴 로그인 상태(컴포저·저장·유지)는 대표님 검증분(아래 「완료 후」).

- [ ] **Step 4: 커밋**

```bash
git add "개발/프론트엔드_무스부/tomori-app/src/components/LetterReply.jsx" "개발/프론트엔드_무스부/tomori-app/src/screens/LetterScreen.jsx"
git commit -m "feat(reply): 편지 답장 UI — 가이드 문구 컴포저·저장 표시·게스트 안내"
```

---

## Task 4: 문서 정합

**Files:** Modify `기획/PRD.md`(14.5 답장 한 줄), `기획/진행상태.md`(세션 기록).

- [ ] **Step 1: PRD 14.5 에 답장 한 줄**

`기획/PRD.md` 14.5 의 v2.9 개정 노트(`> **v2.9 개정**:` 또는 편지 관련 노트) 끝에 append:
```
 ⑤편지 **답장하기**(2026-07-31): 가이드형 일본어 문구로 토모에게 답장(작문 학습), `letter_replies`(RLS 본인)에 실저장, 편지함=토모 편지+내 답장 왕복. 답장은 철저히 선택(재촉 없음)·로그인 필요·토모는 담담히 받음(진짜 응답은 후속).
```
(고유 매칭되게 편지 v2.9 노트 라인을 잡아 끝에 붙임.)

- [ ] **Step 2: 진행상태 기록 + 커밋**

`기획/진행상태.md` 러닝노트에 답장 기능 요약 한 줄 기록 후:
```bash
git add "기획/PRD.md" "기획/진행상태.md"
git commit -m "docs: 편지 답장하기 정합 (PRD 14.5)"
```

---

## 완료 후 (대표님 검증 = 실 저장 end-to-end)

컨트롤러가 게스트/BE/코드까지 확인한 뒤, **대표님(로그인 상태)** 이 편지 열기→답장하기→문구 선택→보내기→"토모에게 전해졌어요" 확인→**새로고침해도 남는지** 클릭 검증. 이어서 컨트롤러가 Supabase MCP로 `letter_replies` 행(본인 것, phrase_keys) 확인하면 실저장 파이프라인 완결.

## Self-Review 결과 (작성자 점검)

- **Spec coverage**: BE 테이블+RLS(Task1)·데이터(Task2)·컴포저/저장/게스트안내(Task3)·문서(Task4). 스펙 전 항목 매핑. 범위 밖(토모 진짜 응답·자유작문·실 편지 생성·편지함 뱃지)은 태스크 없음(정상).
- **Placeholder scan**: 코드·SQL 실제. 게스트/로그인/저장 분기 전부 구현. Task4만 grep-매칭 최소수정(문서 위치 가변).
- **Type consistency**: `REPLY_PHRASES`/`phraseByKey`/`loadReply`/`saveReply` Task2 정의 = Task3 소비 일치. `<LetterReply letterSeq furi nav>` props = 정의 일치. `letter.seq`(letters.js 존재) 전달. `phrase_keys` jsonb(BE)↔배열(FE) 일치. upsert onConflict `user_id,letter_seq` = unique 제약 일치.

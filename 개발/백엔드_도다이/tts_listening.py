# -*- coding: utf-8 -*-
"""tts_listening.py — 청해 대본(listening_lines) → 음성(m4a) 생성.

무엇을:
 · 공개 listening_items 의 발화(listening_lines: speaker·ja)를 Google Cloud TTS 로 화자별 음성 생성 →
   침묵(gap)으로 이어붙여 대화 1개당 파일 1개 → `public/audio/listening/{content_key}.m4a`.
 · audio_url 은 이미 `{content_key}.m4a`(파일명만)라 DB 변경 불필요 — 파일만 그 이름으로 놓으면 FE가 재생.

방법론(리서치/청해_음성_제작_검토.md):
 · 전량 TTS. 화자별 voice 지정 후 이어붙이기. 청해=상위 등급(Chirp3-HD) 권장, 단어·예문=WaveNet.
 · 🔴 「등급은 귀로 듣고 정한다」 — --sample 로 한 대화를 3등급 생성해 비교 청취 후 --all 로 확정 생성.
 · 간투사는 대본 표기(えーと……。)로 해결됨(규격 4.4.1) → 대본을 그대로 읽힌다.

설계 4조건 준수(문서 5장): ①파일 참조 저장 ②대본 원본 보관(DB) ③생성 파라미터 기록(voice_preset·speed)
 ④파일명=content_key 고정. → 언제든 재생성·성우 교체 가능.

🔴 보안: db_url.txt·GOOGLE 키는 경로로만 접근, 내용 절대 출력·로그 금지.

실행:
  python tts_listening.py --sample jlpt.n5.listening.0001   # 3등급 비교본(scratchpad)
  python tts_listening.py --grade chirp3 --all              # 전량 확정 생성(public/audio)
  python tts_listening.py --grade chirp3 --keys jlpt.n5.listening.0001 jlpt.n5.listening.0004
"""
import os, sys, io, glob, wave, argparse, subprocess

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))
AUDIO_DIR = os.path.join(PROJ, '개발', '프론트엔드_무스부', 'tomori-app', 'public', 'audio', 'listening')
SCRATCH = os.environ.get('CLAUDE_SCRATCH', HERE)

# 등급별 (여성, 남성) voice. 청해 기본 = Chirp3-HD(스펙 권장).
GRADES = {
    'wavenet': ('ja-JP-Wavenet-A', 'ja-JP-Wavenet-C'),
    'neural2': ('ja-JP-Neural2-B', 'ja-JP-Neural2-C'),
    'chirp3':  ('ja-JP-Chirp3-HD-Aoede', 'ja-JP-Chirp3-HD-Algenib'),
}
RATE = 24000
GAP_S = 0.45          # 발화 사이 침묵(초)
LEAD_S = 0.15         # 맨 앞 여백

# 🔴 TTS 오독 교정 — 같은 한자가 여러 읽기를 가져 엔진이 틀리게 읽는 단어를, ruby 정답 읽기로
#   강제(SSML <sub alias>). 대표님 청취로 발견되는 것을 여기 추가한다.
#   (예: 明日 = あした/あす/みょうにち → N5 회화는 「あした」.)
TTS_READING_OVERRIDE = {
    '明日': 'あした',
}


def _get_creds():
    if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        return
    for p in glob.glob(r'C:/Users/hd/.secrets/tomori/*.json'):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = p
        return
    print('❌ GOOGLE 키 없음 (env GOOGLE_APPLICATION_CREDENTIALS 또는 .secrets/tomori/*.json)')
    sys.exit(2)


def _get_db():
    db = os.environ.get('SUPABASE_DB_URL')
    if not db:
        for fn in ('db_url.txt', '.db_url'):
            p = os.path.join(HERE, fn)
            if os.path.exists(p):
                with io.open(p, encoding='utf-8-sig') as f:
                    db = f.read().strip()
                if db:
                    break
    if not db:
        print('❌ 연결문자열 없음 (env SUPABASE_DB_URL 또는 db_url.txt)')
        sys.exit(2)
    return db


def fetch_items(keys=None):
    import psycopg
    conn = psycopg.connect(_get_db())
    cur = conn.cursor()
    if keys:
        cur.execute("select id, content_key from listening_items where content_key = any(%s) order by content_key", (keys,))
    else:
        cur.execute("select id, content_key from listening_items where is_published order by content_key")
    items = cur.fetchall()
    out = []
    for iid, ck in items:
        cur.execute("select speaker, ja from listening_lines where listening_item_id=%s order by seq", (iid,))
        lines = [(sp or 'A', ja) for sp, ja in cur.fetchall()]
        out.append((ck, lines))
    conn.close()
    return out


def speaker_voices(lines, female, male):
    """화자 등장 순서대로 [남, 여] 슬롯 배정(2인 대화 = 첫 화자 A=남, 둘째 B=여).
    🔴 대본 작성자 의도(문항의 男/女 지칭)에 맞춤 — N5 청해 0014(女=B)·0019(男=A)가
       A=남·B=여여야 정합. (2026-07-29 대표님 QA 반영, [여,남]→[남,여] 스왑.)"""
    order = []
    for sp, _ in lines:
        if sp not in order:
            order.append(sp)
    slots = [male, female]
    return {sp: slots[i % 2] for i, sp in enumerate(order)}


def apply_reading(text):
    """오독 교정 — 한자를 정답 가나로 직접 치환(화면 표시는 DB 원문 그대로, TTS 입력만 바꿈).
    🔴 Chirp3-HD 는 SSML <sub alias> 의 읽기를 무시하므로, 텍스트 자체를 가나로 바꾼다(확실)."""
    for word, yomi in TTS_READING_OVERRIDE.items():
        text = text.replace(word, yomi)
    return text


def synth_line(client, tts, text, voice_name):
    inp = tts.SynthesisInput(text=apply_reading(text))
    voice = tts.VoiceSelectionParams(language_code='ja-JP', name=voice_name)
    cfg = tts.AudioConfig(audio_encoding=tts.AudioEncoding.LINEAR16, sample_rate_hertz=RATE)
    return client.synthesize_speech(input=inp, voice=voice, audio_config=cfg).audio_content


def concat_wav(wav_list):
    frames = []
    params = None
    for wb in wav_list:
        w = wave.open(io.BytesIO(wb), 'rb')
        if params is None:
            params = w.getparams()
        frames.append(w.readframes(w.getnframes()))
        w.close()
    nch, sw, rate = params.nchannels, params.sampwidth, params.framerate
    gap = b'\x00' * (int(rate * GAP_S) * sw * nch)
    lead = b'\x00' * (int(rate * LEAD_S) * sw * nch)
    out = io.BytesIO()
    ww = wave.open(out, 'wb')
    ww.setnchannels(nch); ww.setsampwidth(sw); ww.setframerate(rate)
    ww.writeframes(lead)
    for i, f in enumerate(frames):
        if i > 0:
            ww.writeframes(gap)
        ww.writeframes(f)
    ww.close()
    return out.getvalue()


def wav_to_m4a(wav_bytes, out_path):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    p = subprocess.run(
        [ff, '-y', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0',
         '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out_path],
        input=wav_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError('ffmpeg 실패: ' + p.stderr.decode('utf-8', 'replace')[:300])


def gen_item(client, tts, ck, lines, female, male, out_path):
    voices = speaker_voices(lines, female, male)
    wavs = [synth_line(client, tts, ja, voices[sp]) for sp, ja in lines]
    wav = concat_wav(wavs)
    wav_to_m4a(wav, out_path)
    return os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--grade', choices=list(GRADES), default='chirp3')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--keys', nargs='*')
    ap.add_argument('--sample', help='이 content_key 를 3등급으로 scratchpad 에 생성(비교청취)')
    args = ap.parse_args()

    _get_creds()
    from google.cloud import texttospeech as tts
    client = tts.TextToSpeechClient()

    if args.sample:
        items = fetch_items([args.sample])
        if not items:
            print('❌ 대상 없음:', args.sample); sys.exit(1)
        ck, lines = items[0]
        print('샘플 대상:', ck, '· 발화', len(lines), '개')
        for g, (fv, mv) in GRADES.items():
            outp = os.path.join(SCRATCH, '%s.%s.m4a' % (ck, g))
            size = gen_item(client, tts, ck, lines, fv, mv, outp)
            print('  [%s] %-8s → %s (%.0f KB)' % (g, fv.split('-')[-1] + '/' + mv.split('-')[-1], outp, size / 1024))
        return

    female, male = GRADES[args.grade]
    keys = None if args.all else (args.keys or None)
    if not args.all and not keys:
        print('대상 미지정: --all 또는 --keys ... 또는 --sample KEY'); sys.exit(1)
    items = fetch_items(keys)
    print('생성 시작: %d개 · 등급 %s (%s / %s)' % (len(items), args.grade, female, male))
    total = 0
    for ck, lines in items:
        outp = os.path.join(AUDIO_DIR, ck + '.m4a')
        size = gen_item(client, tts, ck, lines, female, male, outp)
        total += size
        print('  %s · 발화 %d · %.0f KB' % (ck, len(lines), size / 1024))
    print('-' * 60)
    print('완료: %d개 · 합계 %.1f MB · %s' % (len(items), total / 1024 / 1024, AUDIO_DIR))


if __name__ == '__main__':
    main()

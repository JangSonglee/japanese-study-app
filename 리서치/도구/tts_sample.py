# -*- coding: utf-8 -*-
"""
청해 음성 등급 비교 — 샘플 생성기
===================================================================
대본: 청해_샘플대본.md (A 대화 / B 단어 / C 즉시응답 / D 악센트 대조군)
출력: ./out/{등급}/{샘플}.mp3

[준비 — 3단계, 한 번만 하면 됩니다]

1) 구글 클라우드에서 Text-to-Speech 켜기
   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
   → 프로젝트 만들고 [사용] 클릭. 신규 계정은 $300 크레딧이 있고,
     이 작업은 무료 한도 안이라 요금이 나오지 않습니다.

2) 서비스 계정 키(JSON) 내려받기
   https://console.cloud.google.com/iam-admin/serviceaccounts
   → 서비스 계정 만들기 → 키 → JSON 다운로드

3) 이 창에서 경로만 지정 (키 내용은 어디에도 붙여넣지 마세요)
   PowerShell:
       $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\경로\\키파일.json"
   Git Bash:
       export GOOGLE_APPLICATION_CREDENTIALS="/c/경로/키파일.json"

[설치]
   pip install google-cloud-texttospeech

[실행]
   python tts_sample.py

===================================================================
⚠️ 이 파일에 키를 적지 마세요. 환경변수로만 읽습니다.
"""

import os
import sys

# Windows 콘솔 기본 인코딩(cp949)에서는 일부 문자가 출력되지 않아 죽습니다.
# 출력 스트림을 UTF-8로 바꿔 둡니다.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

# ── 비교할 등급 3종 ────────────────────────────────────────────────
# name  : 폴더명
# voices: (남성, 여성) 화자 쌍 — 대화에서 두 사람을 구분하는 데 씁니다
# note  : 단가 (100만 자 기준)
TIERS = [
    {"name": "1_WaveNet",   "voices": ("ja-JP-Wavenet-C", "ja-JP-Wavenet-A"),   "note": "$4/1M · 단어·예문 후보"},
    {"name": "2_Neural2",   "voices": ("ja-JP-Neural2-C", "ja-JP-Neural2-B"),   "note": "$16/1M · 표현 카드 후보"},
    {"name": "3_Chirp3HD",  "voices": ("ja-JP-Chirp3-HD-Charon", "ja-JP-Chirp3-HD-Aoede"), "note": "$30/1M · 청해 문항 후보"},
]

# ── 대본 ─────────────────────────────────────────────────────────
# turns: [(화자, 대사)] — 화자 "M"=남성, "F"=여성. 화자별로 따로 생성해 이어붙입니다.
SAMPLES = {
    "A_대화_課題理解": [
        ("F", "田中さん、明日の会議の資料、もうできましたか。"),
        ("M", "えーと、まだです。今日中に終わらせるつもりですが……。"),
        ("F", "そうですか。実は、部長が今日の五時までに見たいとおっしゃっていて。"),
        ("M", "えっ、五時ですか。じゃあ、コピーは後にして、先に中身を作ります。"),
        ("F", "お願いします。コピーは私がやっておきますね。"),
        ("M", "助かります。ありがとうございます。"),
        ("F", "男の人はこれから何をしますか。"),
    ],
    "B_단어_명료도": [
        ("F", "発表。出発。準備。天気。空港。場合。"),
        ("F", "来週の月曜日に、研究の発表があります。"),
        ("F", "出発の準備はもうできましたか。"),
        ("F", "空港までバスで行く場合、一時間ぐらいかかります。"),
    ],
    "C_즉시응답": [
        ("M", "あのう、すみません。この席、空いていますか。"),
        ("F", "あ、はい、どうぞ。"),
        ("F", "もう昼ご飯、食べた？"),
        ("M", "ううん、まだ。"),
    ],
    # 🔴 대조군 — 이 쌍들이 서로 다르게 안 들리면 그 등급은 탈락입니다.
    "D_악센트_대조군": [
        ("F", "箸で食べます。"),
        ("F", "橋を渡ります。"),
        ("F", "雨が降っています。"),
        ("F", "飴を買いました。"),
        ("F", "今、行きます。"),
        ("F", "居間にいます。"),
    ],
}


def main():
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print("[중단] 인증 정보가 없습니다.")
        print("  이 파일 맨 위 주석의 [준비] 3단계를 먼저 해주세요.")
        print("  키 내용을 저장하거나 공유하지 마세요 — 경로만 지정하면 됩니다.")
        return 1

    try:
        from google.cloud import texttospeech as tts
    except ImportError:
        print("[중단] 라이브러리가 없습니다.  pip install google-cloud-texttospeech")
        return 1

    client = tts.TextToSpeechClient()
    audio_cfg = tts.AudioConfig(audio_encoding=tts.AudioEncoding.MP3, speaking_rate=1.0)

    # ── 사전 점검 ────────────────────────────────────────────────
    # 짧은 한 마디를 먼저 보내 본다. 여기서 막히면 12번 실패를 반복할 이유가 없다.
    try:
        client.synthesize_speech(
            input=tts.SynthesisInput(text="テスト"),
            voice=tts.VoiceSelectionParams(language_code="ja-JP", name="ja-JP-Wavenet-A"),
            audio_config=audio_cfg,
        )
    except Exception as e:
        msg = str(e)
        print("[중단] 첫 요청부터 실패했습니다. 아래를 확인하세요.\n")
        if "SERVICE_DISABLED" in msg or "has not been used in project" in msg:
            import re
            m = re.search(r"project (\d+)", msg)
            proj = m.group(1) if m else "본인_프로젝트"
            print("  원인: 프로젝트에서 Text-to-Speech API가 아직 켜져 있지 않습니다.")
            print("       (키를 만드는 것과 API를 켜는 것은 별개입니다)")
            print(f"\n  해결: 아래 주소에서 [사용] 버튼을 누르세요.")
            print(f"       https://console.cloud.google.com/apis/library/"
                  f"texttospeech.googleapis.com?project={proj}")
            print("\n       누른 뒤 1~2분 기다렸다가 다시 실행하세요. 반영에 시간이 걸립니다.")
        elif "billing" in msg.lower():
            print("  원인: 결제 계정이 연결되어 있지 않습니다.")
            print("  해결: https://console.cloud.google.com/billing 에서 프로젝트에 결제 계정을 연결하세요.")
            print("       (이 작업은 무료 한도 안이라 실제 청구는 발생하지 않습니다)")
        elif "PermissionDenied" in type(e).__name__ or "403" in msg:
            print("  원인: 이 서비스 계정에 권한이 없습니다.")
            print("  해결: IAM에서 해당 서비스 계정에 'Cloud Text-to-Speech 사용자' 역할을 주세요.")
        else:
            print(f"  {type(e).__name__}: {msg[:400]}")
        return 1
    print("[확인] API 연결 정상. 생성을 시작합니다.")

    total_chars = 0
    made, failed = 0, 0

    for tier in TIERS:
        male, female = tier["voices"]
        outdir = os.path.join(OUT_ROOT, tier["name"])
        os.makedirs(outdir, exist_ok=True)
        print(f"\n=== {tier['name']}  ({tier['note']}) ===")

        for sample_name, turns in SAMPLES.items():
            chunks = []
            try:
                for speaker, text in turns:
                    voice = tts.VoiceSelectionParams(
                        language_code="ja-JP",
                        name=(male if speaker == "M" else female),
                    )
                    resp = client.synthesize_speech(
                        input=tts.SynthesisInput(text=text),
                        voice=voice,
                        audio_config=audio_cfg,
                    )
                    chunks.append(resp.audio_content)
                    total_chars += len(text)
            except Exception as e:
                print(f"  [실패] {sample_name}: {e}")
                failed += 1
                continue

            # MP3 프레임을 그대로 이어붙이면 대부분의 플레이어가 연속 재생합니다.
            path = os.path.join(outdir, f"{sample_name}.mp3")
            with open(path, "wb") as f:
                for c in chunks:
                    f.write(c)
            print(f"  [완료] {sample_name}.mp3")
            made += 1

    print("\n" + "=" * 55)
    print(f"생성 {made}개 / 실패 {failed}개")
    print(f"사용한 글자 수: 약 {total_chars:,}자  (무료 한도 월 400만 자)")
    print(f"저장 위치: {OUT_ROOT}")
    print("=" * 55)
    print("\n[다음] 청해_샘플대본.md 의 「청취 체크리스트」를 열고 항목별로 ○/△/✕ 를 적으세요.")
    print("       🔴 D(악센트)가 ✕ 인 등급은 다른 게 아무리 좋아도 탈락입니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

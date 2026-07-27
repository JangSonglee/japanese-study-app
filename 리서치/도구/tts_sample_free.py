# -*- coding: utf-8 -*-
"""
청해 음성 — 계정 없이 바로 듣기용 샘플 생성기
===================================================================
대본은 tts_sample.py 와 **완전히 동일**하다. 목소리만 다르다.

[이 파일이 있는 이유]
Google Cloud 는 무료 한도를 쓰더라도 **결제 계정 연결(카드 등록)** 을 요구한다.
그 전에 "TTS 음질이 우리 학습 앱에 쓸 만한가" 를 먼저 판단할 수 있어야 해서,
계정·카드 없이 쓸 수 있는 Microsoft Edge 읽어주기 음성으로 같은 대본을 만든다.
목소리는 **Azure Neural 계열**이라 우리 후보 등급 중 하나의 실제 감을 준다.

🔴 평가 전용이다. 이걸로 만든 음성을 앱에 실어서는 안 된다.
   Edge 읽어주기용 비공개 엔드포인트라 상업적 재배포 라이선스가 확인되지 않는다.
   → 등급을 정한 뒤, 제품 음성은 **정식 계약된 서비스**(Google/Azure)로 생성한다.

[실행]
   pip install edge-tts
   python tts_sample_free.py
===================================================================
"""

import asyncio
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "out", "0_EdgeNeural_평가용")

VOICE_M = "ja-JP-KeitaNeural"
VOICE_F = "ja-JP-NanamiNeural"


def load_samples():
    """대본은 tts_sample.py 를 그대로 읽어 쓴다 — 두 벌로 갈라지면 비교가 무의미해진다."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("tts_sample", os.path.join(HERE, "tts_sample.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.SAMPLES


async def synth(text, voice):
    import edge_tts
    chunks = []
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


async def main():
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("[중단] 라이브러리가 없습니다.  pip install edge-tts")
        return 1

    samples = load_samples()
    os.makedirs(OUTDIR, exist_ok=True)
    print(f"목소리: 남 {VOICE_M} / 여 {VOICE_F}\n")

    total = 0
    for name, turns in samples.items():
        try:
            parts = []
            for speaker, text in turns:
                parts.append(await synth(text, VOICE_M if speaker == "M" else VOICE_F))
                total += len(text)
            path = os.path.join(OUTDIR, f"{name}.mp3")
            with open(path, "wb") as f:
                for p in parts:
                    f.write(p)
            print(f"  [완료] {name}.mp3")
        except Exception as e:
            print(f"  [실패] {name}: {type(e).__name__} {str(e)[:160]}")

    print("\n" + "=" * 55)
    print(f"저장 위치: {OUTDIR}")
    print(f"글자 수: 약 {total:,}자")
    print("=" * 55)
    print("\n[먼저 들을 것] D_악센트_대조군.mp3")
    print("  箸(젓가락) / 橋(다리), 雨(비) / 飴(사탕) 가 서로 다르게 들리나요?")
    print("  똑같이 들린다면 그 목소리는 일본어 학습용으로 탈락입니다.")
    print("\n[그다음] 청해_샘플대본.md 의 청취 체크리스트 11항목을 채우세요.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

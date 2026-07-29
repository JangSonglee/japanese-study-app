# -*- coding: utf-8 -*-
"""n4_json_to_csv.py — 슈슈(서브에이전트) JSON 초안 → 후리가나 주석 붙인 규격 CSV.

 · 평문 일본어 JSON → furigana_annotate 로 {漢字|よみ} 브래킷 부착 → 12열(독해)/11열(청해) CSV.
 · JSON 이 ```json 펜스로 감싸여 와도 첫 '[' ~ 마지막 ']' 만 파싱.
 · answer, level_code(N4) 세팅. 即時応答 choices<4 는 '-' 로 패딩.

쓰임:
  python n4_json_to_csv.py reading  <in.json> <out.csv>
  python n4_json_to_csv.py listening <in.json> <out.csv>
"""
import sys, io, csv, json, os, re, importlib.util

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('furigana_annotate', os.path.join(HERE, 'furigana_annotate.py'))
_fa = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_fa)
furigana = _fa.furigana

def level_of(ck):
    """content_key(jlpt.n3.reading.0001) → 급수 코드 N3. 급수 자동 인식(N3·N2·N1 재사용)."""
    parts = (ck or '').split('.')
    return parts[1].upper() if len(parts) > 1 else 'N5'


def load_json(path):
    with io.open(path, encoding='utf-8') as f:
        s = f.read()
    a, b = s.find('['), s.rfind(']')
    if a == -1 or b == -1:
        raise ValueError('JSON 배열을 찾지 못함: %s' % path)
    return json.loads(s[a:b + 1])


def fu(v):
    v = (v or '').strip()
    return v if v in ('', '-') else furigana(v)


def ko_clean(s):
    """한국어 필드 정리 — 규격상 필드 내 ASCII 쉼표·줄바꿈 금지(CSV 안전) → 공백화·압축."""
    s = (s or '').strip().replace(',', ' ').replace('\n', ' ').replace('\r', ' ')
    return re.sub(r'\s+', ' ', s)


def fix_expl_pos(expl, na):
    """해설 속 '정답은 N번' 표기를 rebalance 후 실제 위치(na)로 맞춘다.
    초안은 정답번호가 고정(대개 2번)인데 rebalance가 위치를 옮기므로, 안 고치면 해설과 화면이 어긋난다."""
    return re.sub(r'정답은\s*[0-9]\s*번', '정답은 %d번' % na, expl or '')


def pad4(choices):
    ch = list(choices) + ['-'] * (4 - len(choices))
    return ch[:4]


def rebalance(choices, ans1, i):
    """정답 위치를 균등 분산 — 초안이 정답을 특정 번호에 몰아넣는 편향 교정.
    실제 선택지(‘-’ 제외) 안에서 정답을 (i % n) 위치로 옮긴다(결정적·재현가능)."""
    real = [c for c in choices if (c or '').strip() != '-']
    n = len(real)
    correct = real[ans1 - 1]
    others = [c for j, c in enumerate(real) if j != ans1 - 1]
    target = i % n
    new = others[:target] + [correct] + others[target:]
    return new, target + 1


def conv_reading(items, out_path):
    HEADER = ['content_key', 'level_code', 'genre', 'passage_ja', 'passage_ko', 'question',
              'choice1', 'choice2', 'choice3', 'choice4', 'answer', 'explanation_ko']
    with io.open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for i, it in enumerate(items):
            nc, na = rebalance(it['choices'], it['answer'], i)
            ch = pad4(nc)
            w.writerow([it['content_key'], level_of(it['content_key']), it['genre'],
                        furigana(it['passage_ja']), ko_clean(it['passage_ko']),
                        fu(it['question']),
                        fu(ch[0]), fu(ch[1]), fu(ch[2]), fu(ch[3]),
                        na, ko_clean(fix_expl_pos(it['explanation_ko'], na))])
    return len(items)


def conv_listening(items, out_path):
    HEADER = ['content_key', 'level_code', 'type', 'script_ja', 'script_ko', 'question',
              'choice1', 'choice2', 'choice3', 'choice4', 'answer']
    with io.open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for i, it in enumerate(items):
            nc, na = rebalance(it['choices'], it['answer'], i)
            ch = pad4(nc)
            w.writerow([it['content_key'], level_of(it['content_key']), it['type'],
                        furigana(it['script_ja']), ko_clean(it['script_ko']),
                        fu(it['question']),
                        fu(ch[0]), fu(ch[1]), fu(ch[2]), fu(ch[3]),
                        na])
    return len(items)


if __name__ == '__main__':
    mode, inp, out = sys.argv[1], sys.argv[2], sys.argv[3]
    items = load_json(inp)
    n = (conv_reading if mode == 'reading' else conv_listening)(items, out)
    print('%s: %d행 → %s' % (mode, n, out))

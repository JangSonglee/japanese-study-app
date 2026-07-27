# -*- coding: utf-8 -*-
"""
build_corpus.py  —  토모리 N1 어휘 「장르 편중도(genre-skew)」 엔진 · 1단계
================================================================================
목적 : 상업 이용이 안전한 다장르(多genre) 일본어 코퍼스를 직접 구축하고,
       fugashi(unidic-lite) 형태소분석으로 장르별 표제형(lemma) 빈도표를 만든다.
       skew_rank.py 가 이 빈도표를 읽어 Tanos N1 후보의 편중도를 계산한다.

⚠️  이 산출물은 방법 검증(PoC → Phase1)용이며 N1 최종 확정본이 아니다.

원천 · 상업 라이선스 (N1_어휘방법론_조사_2026-07-25.md ② 표 그대로 준수)
--------------------------------------------------------------------------------
 genre       원천                     라이선스                     상업
 ----------  -----------------------  ---------------------------  -----
 literature  青空文庫(HTML)           PD(보호기간 만료) 자유이용    OK
 opinion     国会会議録(NDL API)      NDL이용규약=정부표준이용규약  OK(出典표시)
 law         e-Gov 法令 API           著13조 법령=비저작물          OK
 academic    Wikipedia日本語(API)     CC BY-SA 4.0(빈도만 사용)     OK
 (baseline)  wordfreq(ja)             코드MIT/데이터CC BY-SA        OK
--------------------------------------------------------------------------------
 배제(리포트 판정 준수): BCCWJ pre-computed 신호(상업 회색지대), J-STAGE 논문
 (라이선스 불명), livedoor(장르 부적합). ← 이 스크립트는 절대 손대지 않는다.

 * 코퍼스 텍스트 자체는 재배포하지 않는다. 우리가 저장하는 것은 「lemma→빈도」
   집계표(JSON)뿐이며, 이는 사실(fact)의 집계라 SA 전염·복제 문제에서 자유롭다.
 * 실제 확보 토큰 수는 corpus/manifest.json 에 장르별로 정직히 기록한다.

재실행 : 원문은 corpus/raw_cache/ 에 캐시된다. 재실행 시 캐시를 재사용하므로
         네트워크 부하 없이 빈도표를 다시 만들 수 있다. --refetch 로 강제 재수집.

작성 : 슈슈(리서치) 2026-07-25
"""
import sys, os, re, json, time, io, zipfile, argparse, hashlib
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import requests
import fugashi

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(HERE, 'corpus')
RAW = os.path.join(CORPUS, 'raw_cache')
os.makedirs(RAW, exist_ok=True)

UA = {'User-Agent': 'TomoriResearch/1.0 (educational JLPT vocab research; contact songl0351@gmail.com)'}
TAGGER = fugashi.Tagger()

# ── 내용어(content word) 판정 ─────────────────────────────────────────────
# 편중도는 「어휘」의 장르 특성을 보므로 기능어·기호·고유명사·수사는 제외한다.
# 고유명사(인명·지명)를 넣으면 장르가 아니라 화제(topic)로 튀어 신호가 오염된다.
CONTENT_POS1 = {'名詞', '動詞', '形容詞', '副詞', '形状詞'}
EXCLUDE_POS2 = {'固有名詞', '数詞', '非自立可能'}  # 非自立可能은 형식동사(する등)·형식명사 노이즈

def iter_lemmas(text):
    """텍스트 → 내용어 표제형(lemma) 제너레이터."""
    for w in TAGGER(text):
        f = w.feature
        pos1 = f.pos1
        if pos1 not in CONTENT_POS1:
            continue
        pos2 = getattr(f, 'pos2', '*')
        if pos2 in EXCLUDE_POS2:
            continue
        lemma = f.lemma if (f.lemma and f.lemma != '*') else w.surface
        # 표제형에서 '-' 이후 부기(예: 行く-ユク) 제거, 공백 제거
        lemma = lemma.split('-')[0].strip()
        if not lemma:
            continue
        # 순수 기호·숫자·1자 히라가나 노이즈 컷
        if re.fullmatch(r'[\d\W_]+', lemma):
            continue
        if len(lemma) == 1 and re.fullmatch(r'[ぁ-ん]', lemma):
            continue
        yield lemma

def strip_html(html):
    html = re.sub(r'(?is)<rp>.*?</rp>', '', html)   # ruby 괄호 제거
    html = re.sub(r'(?is)<rt>.*?</rt>', '', html)    # ruby 읽기 제거(본문만)
    html = re.sub(r'(?is)<script.*?</script>', '', html)
    html = re.sub(r'(?is)<style.*?</style>', '', html)
    html = re.sub(r'<[^>]+>', '', html)
    html = re.sub(r'&[a-z]+;', ' ', html)
    return html

def cache_get(key, fetch_fn, refetch=False):
    p = os.path.join(RAW, key + '.txt')
    if os.path.exists(p) and not refetch:
        with open(p, encoding='utf-8') as f:
            return f.read()
    txt = fetch_fn()
    with open(p, 'w', encoding='utf-8') as f:
        f.write(txt)
    time.sleep(0.4)  # 원천 서버 예의
    return txt

# ── 원천별 수집기 ──────────────────────────────────────────────────────────
def fetch_aozora(refetch=False):
    """青空文庫 PD 문학(소설·평론). HTML 본문만 추출."""
    works = {
        'aozora_rashomon':   'https://www.aozora.gr.jp/cards/000879/files/127_15260.html',
        'aozora_kokoro':     'https://www.aozora.gr.jp/cards/000148/files/773_14560.html',
        'aozora_sangetsuki': 'https://www.aozora.gr.jp/cards/000119/files/624_14544.html',
        'aozora_ningen':     'https://www.aozora.gr.jp/cards/000035/files/301_14912.html',
        'aozora_ginga':      'https://www.aozora.gr.jp/cards/000081/files/456_15050.html',
        'aozora_bocchan':    'https://www.aozora.gr.jp/cards/000148/files/752_14964.html',
        'aozora_gongitsune': 'https://www.aozora.gr.jp/cards/000121/files/628_14895.html',
        'aozora_takasebune': 'https://www.aozora.gr.jp/cards/000129/files/691_14683.html',
        'aozora_meian':      'https://www.aozora.gr.jp/cards/000148/files/775_15042.html',
        'aozora_kusamakura': 'https://www.aozora.gr.jp/cards/000148/files/776_14941.html',
    }
    out = []
    for key, url in works.items():
        def fetch(u=url):
            r = requests.get(u, timeout=40, headers=UA)
            if r.status_code != 200:
                return ''
            r.encoding = 'shift_jis'
            return strip_html(r.text)
        try:
            t = cache_get(key, fetch, refetch)
            if t.strip():
                out.append(t)
                print(f'  [aozora] {key}: {len(t):,} chars')
        except Exception as e:
            print(f'  [aozora] {key} SKIP {repr(e)[:80]}')
    return '\n'.join(out)

def fetch_kokkai(refetch=False):
    """国会会議録 = 논설·행정·정치 register. 발언 텍스트만 합산."""
    # 스케일업(2026-07-25): 5→24 범위로 대폭 확대. 예산·정기·임시국회 활동일을 폭넓게
    #    걸쳐 논설·행정·교섭 register(遵守·譲歩·斡旋 등)를 최대한 확보.
    ranges = [
        ('2023-01-23','2023-01-27'), ('2023-03-01','2023-03-03'),
        ('2022-10-03','2022-10-06'), ('2022-05-16','2022-05-18'),
        ('2022-02-14','2022-02-16'), ('2021-06-14','2021-06-16'),
        ('2021-03-08','2021-03-10'), ('2021-01-25','2021-01-27'),
        ('2020-01-20','2020-01-23'), ('2020-11-16','2020-11-18'),
        ('2019-11-05','2019-11-08'), ('2019-03-04','2019-03-06'),
        ('2018-02-05','2018-02-07'), ('2018-11-19','2018-11-21'),
        ('2017-05-08','2017-05-10'), ('2017-01-30','2017-02-01'),
        ('2016-10-11','2016-10-13'), ('2016-03-07','2016-03-09'),
        ('2015-06-01','2015-06-03'), ('2015-02-16','2015-02-18'),
        ('2014-10-06','2014-10-08'), ('2013-11-11','2013-11-13'),
        ('2012-03-05','2012-03-07'), ('2011-02-14','2011-02-16'),
    ]
    out = []
    for frm, until in ranges:
        key = f'kokkai_{frm}_{until}'
        def fetch(frm=frm, until=until):
            texts = []
            start = 1
            for _ in range(2):  # ⚠️ meeting은 maximumRecords 최대 10(초과 시 400)
                u = (f'https://kokkai.ndl.go.jp/api/meeting?from={frm}&until={until}'
                     f'&maximumRecords=10&startRecord={start}&recordPacking=json')
                r = requests.get(u, timeout=90, headers=UA)
                if r.status_code != 200:
                    break
                d = r.json()
                for m in d.get('meetingRecord', []):
                    for sp in m.get('speechRecord', []):
                        s = sp.get('speech', '')
                        # 회의진행 형식어(○発言者名) 앞머리 제거
                        s = re.sub(r'^○[^ 　\n]{1,12}[ 　]', '', s)
                        texts.append(s)
                nxt = d.get('nextRecordPosition')
                if not nxt:
                    break
                start = nxt
                time.sleep(0.3)
            return '\n'.join(texts)
        try:
            t = cache_get(key, fetch, refetch)
            if t.strip():
                out.append(t)
                print(f'  [kokkai] {key}: {len(t):,} chars')
        except Exception as e:
            print(f'  [kokkai] {key} SKIP {repr(e)[:80]}')
    return '\n'.join(out)

def fetch_law(refetch=False):
    """e-Gov 法令(著13조 비저작물). 다양한 분야의 대표 법령 본문.
       ⚠️ 분산도 신뢰성 확보를 위해 「분야가 다른 여러 법령」을 넣는다(회사법 단독편중
          해소). 또한 초대형 법령(会社法 등)이 코퍼스를 지배하지 않도록 **법령당 문자수
          상한 LAW_CHAR_CAP**을 둔다 — 그러면 법률-register 어휘(施行·規定·準ずる)는
          여러 법령에 고루 남고, 한 법령 토픽어(株式=会社法)만 집중도가 높게 남는다."""
    LAW_CHAR_CAP = 300_000
    laws = {
        'law_minpo':      '129AC0000000089',  # 民法
        'law_kaishaho':   '417AC0000000086',  # 会社法
        'law_keiho':      '140AC0000000045',  # 刑法
        'law_roudou':     '347AC0000000057',  # 労働基準法
        'law_gyousei':    '426AC0000000068',  # 行政不服審査法
        'law_minso':      '408AC0000000109',  # 民事訴訟法
        'law_keiso':      '323AC0000000131',  # 刑事訴訟法
        'law_dokkin':     '322AC0000000054',  # 独占禁止法
        'law_tokkyo':     '334AC0000000121',  # 特許法
        'law_shotoku':    '340AC0000000033',  # 所得税法
        'law_chihou':     '322AC0000000067',  # 地方自治法
        'law_koumuin':    '322AC0000000120',  # 国家公務員法
        'law_shohisha':   '412AC0000000061',  # 消費者契約法
        'law_roudoukumi': '324AC0000000174',  # 労働組合法
    }
    out = []
    for key, num in laws.items():
        def fetch(num=num):
            u = f'https://laws.e-gov.go.jp/api/1/lawdata/{num}'
            r = requests.get(u, timeout=60, headers=UA)
            if r.status_code != 200:
                return ''
            return strip_html(r.text)[:LAW_CHAR_CAP]
        try:
            t = cache_get(key, fetch, refetch)[:LAW_CHAR_CAP]
            if t.strip():
                out.append(t)
                print(f'  [law] {key}: {len(t):,} chars')
        except Exception as e:
            print(f'  [law] {key} SKIP {repr(e)[:80]}')
    return '\n'.join(out)

def fetch_wikipedia(refetch=False):
    """Wikipedia日本語 = 학술·설명문 proxy(CC BY-SA, 빈도만 사용)."""
    titles = [
        '哲学', '認識論', '存在論', '社会学', '経済学', '心理学', '言語学',
        '量子力学', '進化論', '生態系', '免疫', '遺伝子', '統計学', '確率論',
        '国際関係論', '憲法', '民主主義', '資本主義', '官僚制', '倫理学',
        '現象学', '構造主義', '弁証法', '因果関係', '仮説検定', '相対性理論',
        '熱力学', '有機化学', '細胞', '生物多様性', '気候変動', '再生可能エネルギー',
        '人工知能', '機械学習', '情報理論', '暗号理論', '複雑系', '地政学',
        '財政政策', '金融政策', '労働経済学', '社会保障', '福祉国家', '環境問題',
        '文化人類学', '比較文学', '歴史学', '考古学', '美学', '論理学',
        # 스케일업 확장(2026-07-25): 50→약 120 기사
        '生物学', '化学', '物理学', '地質学', '天文学', '気象学', '海洋学',
        '神経科学', '分子生物学', '生化学', '微生物学', '薬理学', '病理学',
        '解剖学', '生理学', '疫学', '公衆衛生学', '栄養学', '発生生物学',
        '数学', '幾何学', '代数学', '解析学', '線型代数学', '微分積分学',
        '計算機科学', 'アルゴリズム', 'データ構造', '計算複雑性理論', '数理論理学',
        '政治学', '行政学', '国際法', '刑法学', '民法学', '経営学', '会計学',
        '金融工学', 'マクロ経済学', 'ミクロ経済学', '計量経済学', 'ゲーム理論',
        '社会心理学', '認知科学', '教育学', '宗教学', '神学', '倫理',
        '記号論', '解釈学', '存在', '真理', '正義', '自由', '権力', '主体',
        '近代', '啓蒙思想', '功利主義', '実存主義', '唯物論', '観念論',
        '生態学', '地球温暖化', '生物圏', '光合成', '進化', '自然選択',
        '相対論', '電磁気学', '素粒子物理学', '宇宙論', 'エントロピー',
    ]
    out = []
    for tt in titles:
        key = 'wiki_' + hashlib.md5(tt.encode()).hexdigest()[:8]
        def fetch(tt=tt):
            u = ('https://ja.wikipedia.org/w/api.php?action=query&prop=extracts'
                 '&explaintext=1&redirects=1&format=json&titles=' + requests.utils.quote(tt))
            r = requests.get(u, timeout=40, headers=UA)
            if r.status_code != 200:
                return ''
            pages = r.json().get('query', {}).get('pages', {})
            return '\n'.join(p.get('extract', '') for p in pages.values())
        try:
            t = cache_get(key, fetch, refetch)
            if t.strip():
                out.append(t)
        except Exception as e:
            print(f'  [wiki] {tt} SKIP {repr(e)[:60]}')
    print(f'  [wiki] {len(out)} articles, {sum(len(x) for x in out):,} chars')
    return '\n'.join(out)

def fetch_hakusho(refetch=False):
    """白書(행정·경제 논설문어) = 新규 장르 'admin'. 정부표준이용규약(CC BY 호환, 商用可).
       국회회의록(구어 논설)과 달리 **문어체 행정·경제 논설** register.
       미출현 790(遵守·譲歩·是正 등 행정·논설 written 어휘) 해소가 목적.
       원천: 経済財政白書(内閣府, 5개년) + 情報通信白書(総務省) HTML 章·節 페이지."""
    docs = []
    # 経済財政白書 wp-je19~23, 章01~03 × 節01~04
    for y in ['wp-je19','wp-je20','wp-je21','wp-je22','wp-je23']:
        for ch in range(1,4):
            for sec in range(1,5):
                docs.append((f'cao_{y}_{ch}{sec}',
                    f'https://www5.cao.go.jp/j-j/wp/{y}/h{ch:02d}-{sec:02d}.html', 'utf-8'))
    # 情報通信白書 総務省 r05 主要 節
    for nd in ['nd110000','nd120000','nd130000','nd140000','nd210000','nd220000']:
        docs.append((f'soumu_r05_{nd}',
            f'https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r05/html/{nd}.html', 'utf-8'))
    out = []
    for key, url, enc in docs:
        def fetch(u=url, enc=enc):
            r = requests.get(u, timeout=40, headers=UA)
            if r.status_code != 200:
                return ''
            if enc: r.encoding = enc
            return strip_html(r.text)
        try:
            t = cache_get('hakusho_'+key, fetch, refetch)
            if len(t.strip()) > 2000:   # 목차·빈페이지 컷
                out.append(t)
        except Exception as e:
            print(f'  [hakusho] {key} SKIP {repr(e)[:60]}')
    print(f'  [hakusho] {len(out)} pages, {sum(len(x) for x in out):,} chars')
    return '\n'.join(out)

GENRES = {
    'literature': fetch_aozora,
    'opinion':    fetch_kokkai,
    'law':        fetch_law,
    'academic':   fetch_wikipedia,
    'admin':      fetch_hakusho,
}

# 원천 파일 prefix → 장르 (문서빈도 계산용)
GENRE_PREFIX = {'literature':'aozora_', 'opinion':'kokkai_', 'law':'law_',
                'academic':'wiki_', 'admin':'hakusho_'}

def iter_documents(genre):
    """장르별 「독립 출처 문서」 단위로 (doc_id, text) 를 낸다. 분산도 계산용.
       ⚠️ 분산 필터의 목적 = 「한 출처(=한 토픽)에만 몰린 어휘」를 걸러내기.
          그래서 문서 단위는 **출처 파일 = 독립 텍스트 1개**로 잡는다.
          - literature : 青空文庫 작품 1개 = 1문서 (8개)
          - academic   : Wikipedia 기사 1개 = 1문서 (50개)
          - law        : 법령 1개 = 1문서 (5개)  ← 会社法에만 몰린 株式은 sdf=1 → 탈락
          - opinion    : 회의록 날짜범위 1개 = 1문서 (4개, 각기 다른 회기의 다수 회의)
       (조문/청크로 더 잘게 쪼개면 会社法 수백 조문에 퍼진 株式이 오히려 「분산됨」으로
        보여 필터를 통과한다 — 그래서 파일 레벨로 통일한다. v2.1 수정.)"""
    prefix = GENRE_PREFIX[genre]
    files = sorted(f for f in os.listdir(RAW) if f.startswith(prefix) and f.endswith('.txt'))
    for fn in files:
        text = open(os.path.join(RAW, fn), encoding='utf-8').read()
        if text.strip():
            yield fn, text

def build_docfreq(genre):
    """장르 내 분산도 2종을 계산.
       sdf[lemma]  = 몇 개 독립 출처에 등장했나(source document frequency, 이진 합).
       conc[lemma] = 최대 단일출처 점유율 = max_src(출처내 빈도)/장르내 총빈도.
                     conc가 1에 가까우면 「한 출처(=한 토픽)에만 몰린」 어휘.
                     예) 株式은 会社法에 98% → conc≈0.98 → 토픽어로 판정·제외.
                         施行은 5개 법령에 퍼짐 → conc 낮음 → 장르특징어로 유지.
       반환: (sdf, conc, n_docs)"""
    sdf = {}
    per_src = {}   # lemma -> {doc_id: count}
    n_docs = 0
    for doc_id, text in iter_documents(genre):
        n_docs += 1
        local = {}
        for lemma in iter_lemmas(text):
            local[lemma] = local.get(lemma, 0) + 1
        for lemma, c in local.items():
            sdf[lemma] = sdf.get(lemma, 0) + 1
            per_src.setdefault(lemma, {})[doc_id] = c
    conc = {}
    for lemma, srcs in per_src.items():
        tot = sum(srcs.values())
        conc[lemma] = round(max(srcs.values())/tot, 3) if tot else 1.0
    return sdf, conc, n_docs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--refetch', action='store_true')
    args = ap.parse_args()

    manifest = {}
    for genre, fn in GENRES.items():
        print(f'[{genre}] 수집...')
        text = fn(refetch=args.refetch)
        # 표제형 집계
        counts = {}
        total = 0
        for lemma in iter_lemmas(text):
            counts[lemma] = counts.get(lemma, 0) + 1
            total += 1
        # 저장(빈도표만; 원문 재배포 아님)
        with open(os.path.join(CORPUS, f'freq_{genre}.json'), 'w', encoding='utf-8') as f:
            json.dump(counts, f, ensure_ascii=False)
        # 분산도(문서빈도+집중도) 계산 — 표준화·분산필터의 재료
        sdf, conc, n_docs = build_docfreq(genre)
        with open(os.path.join(CORPUS, f'sdf_{genre}.json'), 'w', encoding='utf-8') as f:
            json.dump(sdf, f, ensure_ascii=False)
        with open(os.path.join(CORPUS, f'conc_{genre}.json'), 'w', encoding='utf-8') as f:
            json.dump(conc, f, ensure_ascii=False)
        manifest[genre] = {
            'content_tokens': total,
            'unique_lemmas': len(counts),
            'chars': len(text),
            'n_docs': n_docs,
        }
        print(f'  → content tokens {total:,} / unique {len(counts):,} / docs {n_docs:,}')

    manifest['_meta'] = {
        'built': time.strftime('%Y-%m-%d %H:%M:%S'),
        'tokenizer': 'fugashi + unidic-lite',
        'note': 'PILOT_방법검증_최종아님. 빈도표는 사실 집계이며 원문 재배포 아님.',
        'sources': {
            'literature': '青空文庫 PD',
            'opinion': '国会会議録 NDL API (정부표준이용규약)',
            'law': 'e-Gov 法令 API (著13조 비저작물)',
            'academic': 'Wikipedia日本語 CC BY-SA (빈도만)',
            'admin': '白書 経済財政/情報通信 (정부표준이용규약, CC BY 호환)',
        },
    }
    with open(os.path.join(CORPUS, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('\n=== manifest ===')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

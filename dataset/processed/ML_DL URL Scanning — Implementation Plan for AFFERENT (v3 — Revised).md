<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}</style><style>:root{color-scheme:light dark;--md-bg:#fff;--md-text:rgba(0,0,0,.8);--md-muted:rgba(0,0,0,.6);--md-fill:rgba(0,0,0,.04);--md-fill-strong:rgba(0,0,0,.06);--md-rule:rgba(0,0,0,.1);--md-rule-strong:rgba(0,0,0,.16);--md-link:hsl(210 100% 45%)}@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){--md-bg:#0d0d0d;--md-text:rgba(255,255,255,.85);--md-muted:rgba(255,255,255,.6);--md-fill:rgba(255,255,255,.06);--md-fill-strong:rgba(255,255,255,.09);--md-rule:rgba(255,255,255,.14);--md-rule-strong:rgba(255,255,255,.22);--md-link:hsl(210 100% 72%)}}:root[data-theme="dark"]{color-scheme:dark;--md-bg:#0d0d0d;--md-text:rgba(255,255,255,.85);--md-muted:rgba(255,255,255,.6);--md-fill:rgba(255,255,255,.06);--md-fill-strong:rgba(255,255,255,.09);--md-rule:rgba(255,255,255,.14);--md-rule-strong:rgba(255,255,255,.22);--md-link:hsl(210 100% 72%)}:root[data-theme="light"]{color-scheme:light}@media print{:root,:root[data-theme="dark"]{color-scheme:light;--md-bg:#fff;--md-text:rgba(0,0,0,.8);--md-muted:rgba(0,0,0,.6);--md-fill:rgba(0,0,0,.04);--md-fill-strong:rgba(0,0,0,.06);--md-rule:rgba(0,0,0,.1);--md-rule-strong:rgba(0,0,0,.16);--md-link:hsl(210 100% 45%)}}body{background:var(--md-bg);color:var(--md-text);max-width:720px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:10px;font:14px/1.55 -apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',sans-serif;overflow-wrap:break-word}body>:first-child{margin-top:0}h1,h2,h3,h4,h5,h6{margin:6px 0 0;line-height:1.25;font-weight:600;text-wrap:balance}h1{font-size:1.35em}h2{font-size:1.15em;color:var(--md-muted)}h3,h4,h5,h6{font-size:1em}p,ul,ol,blockquote,table,pre,hr{margin:0}strong{font-weight:600}a{color:var(--md-link);text-decoration:none}a:hover{text-decoration:underline}ul,ol{display:flex;flex-direction:column;gap:6px;padding-left:22px}ul{list-style:disc}ol{list-style:decimal}:is(li,td,th)>*+:is(p,ul,ol,blockquote){margin-top:6px}blockquote{display:flex;flex-direction:column;gap:10px;border-left:2px solid var(--md-rule);padding-left:10px;color:var(--md-muted)}:not(pre)>code{background:var(--md-fill);padding:1px 3px;border-radius:4px;font:.92em 'SF Mono',ui-monospace,Menlo,Consolas,monospace}a>code{background:none;color:inherit}pre{background:var(--md-fill);padding:10px 12px;border-radius:6px;overflow-x:auto;font:12px/1.5 'SF Mono',ui-monospace,Menlo,Consolas,monospace;margin-block:4px}pre code{background:none;padding:0;font:inherit}table{width:100%;border-collapse:separate;border-spacing:2px;font:inherit}th,td{padding:6px 8px;border-radius:3px;text-align:left;vertical-align:top}th{background:var(--md-fill-strong);font-weight:600}td{background:var(--md-fill)}:is(th,td) :not(pre)>code{background:transparent}hr{border:0;border-top:1px solid var(--md-rule-strong);margin-block:10px}img{max-width:100%;height:auto;border-radius:4px}</style>
</head><body>
<h1>🧠 ML/DL URL Scanning — Implementation Plan for AFFERENT (v3 — Revised)</h1>
<p>Revisi ini menjawab poin-poin dari analisis v2: arsitektur inference diubah dari &quot;selalu jalankan 3 model&quot; jadi cascade bertingkat, ditambah sinyal reputasi eksternal (bukan lexical-only), bobot ensemble tidak lagi ditebak manual, continuous learning dipecah jadi jalur cepat vs jalur retrain, dan timeline dikasih dua opsi yang realistis.</p>
<hr>
<h2>📋 Ringkasan Perubahan dari v2</h2>
<table>
<thead>
<tr>
<th>Area</th>
<th>Masalah di v2</th>
<th>Perubahan di v3</th>
</tr>
</thead>
<tbody>
<tr>
<td>Arsitektur inference</td>
<td>Selalu jalankan XGBoost + RF + DL untuk <strong>setiap</strong> URL</td>
<td>Cascade bertingkat — DL cuma dipanggil untuk kasus ragu-ragu</td>
</tr>
<tr>
<td>Random Forest</td>
<td>Fitur identik dengan XGBoost → kontribusi ensemble kecil</td>
<td>Dihapus, kapasitas dialihkan ke fitur reputasi eksternal</td>
</tr>
<tr>
<td>Fitur</td>
<td>Murni lexical (string URL saja)</td>
<td>Ditambah domain age, SSL, redirect chain, ASN reputation</td>
</tr>
<tr>
<td>Bobot ensemble</td>
<td>Hardcoded manual (0.35/0.25/0.40)</td>
<td>Dipelajari via stacker (logistic regression) dari validation set</td>
</tr>
<tr>
<td>Promosi model baru</td>
<td>Auto-promote otomatis penuh</td>
<td>Shadow eval → canary rollout bertahap → baru full promote</td>
</tr>
<tr>
<td>Retrain cadence</td>
<td>Fixed 2 minggu, tidak nyambung ke feed 4 jam</td>
<td>Dipecah: fast-path (near real-time) + retrain track (event-driven)</td>
</tr>
<tr>
<td>Kualitas data</td>
<td>Feed eksternal langsung masuk training pool</td>
<td>Quality gate: cross-source check + antrian review manual</td>
</tr>
<tr>
<td>Metrik</td>
<td>Accuracy/F1 agregat saja</td>
<td>Ditambah PR-AUC + breakdown per segmen</td>
</tr>
<tr>
<td>Timeline</td>
<td>2 hari all-in, tidak realistis</td>
<td>2 opsi: MVP scoped (2 hari) atau full version (~1.5 minggu)</td>
</tr>
</tbody>
</table>
<hr>
<h2>🏗️ Arsitektur Deteksi: Cascade Bertingkat (Bukan Selalu 3 Model)</h2>
<p>Masalah utama v2: DL (paling berat secara komputasi) dijalankan untuk <strong>setiap</strong> URL, padahal mayoritas URL sebenarnya jelas aman atau jelas jahat — tidak butuh model paling mahal untuk memutuskan. Ini boros latency dan compute tanpa menambah akurasi di kasus-kasus yang sudah jelas.</p>
<pre class="mermaid">flowchart TD
    A[&#34;URL masuk&#34;] --&gt; B{&#34;Ada di blocklist/allowlist?&#34;}
    B --&gt;|&#34;Ya, dikenal aman&#34;| C[&#34;verdict: safe (instant)&#34;]
    B --&gt;|&#34;Ya, dikenal jahat&#34;| D[&#34;verdict: malicious (instant)&#34;]
    B --&gt;|&#34;Tidak dikenal&#34;| E[&#34;Tier 1: XGBoost + fitur eksternal&#34;]
    E --&gt; F{&#34;Confidence tinggi?&#34;}
    F --&gt;|&#34;&gt; 0.85 atau &lt; 0.15&#34;| G[&#34;Verdict final dari Tier 1&#34;]
    F --&gt;|&#34;0.15 - 0.85 (ragu-ragu)&#34;| H[&#34;Tier 2: CNN-LSTM dipanggil&#34;]
    H --&gt; I[&#34;Stacker: kombinasikan skor terkalibrasi&#34;]
    I --&gt; J[&#34;Verdict final&#34;]
</pre>
<p>Dampaknya: mayoritas traffic selesai di Tier 0/1 (target &lt;20ms), DL cuma jalan untuk minoritas kasus ambigu (estimasi 10-20% traffic). Target p95 &lt;200ms jadi jauh lebih realistis karena bukan seluruh traffic yang harus lewat komponen paling lambat.</p>
<hr>
<h2>📊 Model &amp; Fitur (Revisi)</h2>
<h3>🟡 Tier 0: Blocklist / Allowlist (baru)</h3>
<p>Lookup instan ke database URL yang sudah pernah diverifikasi (dari HITL, feed, atau SOC decision). Bukan model ML — ini yang mencegah threat yang sudah dikenal harus lewat ML lagi setiap kali muncul.</p>
<h3>🔵 Tier 1: XGBoost — fitur diperluas</h3>
<p>Fitur lexical tetap seperti v2 (panjang URL, entropy, jumlah dash, TLD risk, Levenshtein ke brand dikenal, keyword login/verify, dll — ~25-30 fitur), ditambah:</p>
<pre><code>BARU — fitur reputasi eksternal:
  domain_age_days         → domain &lt; 7 hari = red flag kuat
  ssl_valid, ssl_issuer_trust_score
  redirect_count, redirect_cross_domain (boolean)
  asn_reputation_score    → reputasi hosting provider
</code></pre>
<blockquote>
<p><strong>⚠️ Catatan praktis — latency budget fitur eksternal</strong>
WHOIS/SSL/redirect-follow butuh network call, jadi tidak bisa asal ditambah tanpa strategi:</p>
<ul>
<li><strong>Cache per-domain</strong> (bukan per-URL) dengan TTL misal 24 jam — domain age dan SSL issuer jarang berubah dalam sehari, jadi URL berulang di domain yang sama tidak perlu lookup ulang.</li>
<li><strong>Timeout budget</strong> misal 300ms — kalau lookup eksternal timeout, fallback ke skor lexical-only saja, jangan blokir keputusan karena satu layanan eksternal lambat.</li>
</ul>
</blockquote>
<h3>🟣 Tier 2: CNN-LSTM (Character-Level) — dipanggil kondisional</h3>
<p>Arsitektur sama seperti v2: character tokenization → CNN (pola lokal, mis. substitusi <code>l</code>→<code>1</code>) → BiLSTM (pola global/sequential) → classification head (softmax ke 5 kelas: safe/phishing/malware/judol/scam).</p>
<p><strong>Perbedaan di v3:</strong> model ini sekarang hanya dipanggil ketika Tier 1 berada di zona ragu-ragu (confidence 0.15–0.85), bukan untuk semua URL. Ini juga melonggarkan tekanan volume data — DL cuma perlu kuat di kasus-kasus boundary, bukan menggantikan Tier 1 di seluruh spektrum.</p>
<h3>⚪ Random Forest — dihapus</h3>
<p>Di v2, Random Forest pakai fitur yang identik dengan XGBoost. Karena input sama, prediksinya sangat berkorelasi — kontribusi ke ensemble kecil, tapi tetap menambah beban training, versioning, dan maintenance. Kapasitasnya dipindah ke fitur reputasi eksternal di Tier 1, yang sinyalnya benar-benar independen dari lexical features sehingga nilai tambahnya ke ensemble lebih besar.</p>
<p><em>(Kalau ada alasan spesifik untuk tetap pakai RF — misal sebagai fallback redundancy kalau service XGBoost down — itu valid juga, tinggal dikasih role yang jelas, bukan sekadar model kedua dengan fitur sama.)</em></p>
<hr>
<h2>🎯 Kalibrasi Skor Akhir (Revisi dari Bobot Manual)</h2>
<p>Bobot ensemble hardcoded (0.35/0.25/0.40) diganti <strong>stacker</strong> — model logistic regression ringan yang di-training di validation set setiap siklus retrain, menerima input <code>[xgb_score, dl_score (kalau dihitung), external_flags]</code> dan mengeluarkan confidence terkalibrasi. Ini otomatis menyesuaikan diri tiap retrain, tidak perlu tuning manual berulang.</p>
<p>Ditambah <strong>hard override rule</strong>: kalau <code>domain_age &lt; 3 hari</code> DAN <code>levenshtein ke brand dikenal ≤ 2</code>, sistem auto-flag minimal sebagai &quot;suspicious&quot; terlepas dari skor model — kombinasi ini prior-nya terlalu kuat untuk phishing sampai tidak boleh murni bergantung ke model statistik.</p>
<p><strong>Contoh 1 — kasus jelas, DL di-skip:</strong></p>
<pre><code>URL: &#34;http://kl1kbca-secure.xyz/login/verify?id=12345&#34;

Tier 0: tidak ada di blocklist → lanjut
Tier 1: domain_age=2 hari 🔴, levenshtein_ke_klikbca=1 🔴, tld_risk=0.9 🔴
        → xgb_score = 0.94 (di luar zona ragu-ragu)
Override: domain_age&lt;3 &amp; levenshtein≤2 → TRUE → hard-flag aktif
Tier 2: di-skip (xgb_score sudah yakin)

verdict: &#34;malicious&#34;, confidence: 0.94
reason: &#34;XGBoost yakin + override domain baru &amp; typosquat. DL tidak
         perlu dipanggil.&#34;
</code></pre>
<p><strong>Contoh 2 — kasus ambigu, DL dipanggil:</strong></p>
<pre><code>URL: &#34;http://secure-payment-update.info/account&#34;

Tier 1: domain_age=400 hari, tidak mirip brand spesifik, tld_risk=0.5
        → xgb_score = 0.58 ⚠️ zona ragu-ragu
Tier 2: dl_score (phishing) = 0.81
Stacker: final_confidence = 0.76

verdict: &#34;phishing&#34;, confidence: 0.76
reason: &#34;XGBoost ragu-ragu, DL menangkap pola keyword generik +
         struktur path mencurigakan. Confidence belum setinggi kasus
         typosquatting klasik → masuk antrian review analis.&#34;
</code></pre>
<p><strong>Threshold aksi</strong> (supaya FPR&lt;2% tidak &quot;all-or-nothing&quot;):</p>
<table>
<thead>
<tr>
<th>Final confidence</th>
<th>Aksi</th>
</tr>
</thead>
<tbody>
<tr>
<td>≥ 0.85</td>
<td>Block otomatis</td>
</tr>
<tr>
<td>0.6 – 0.85</td>
<td>Block + masuk antrian review analis</td>
</tr>
<tr>
<td>&lt; 0.6</td>
<td>Allow, tapi log untuk monitoring drift</td>
</tr>
</tbody>
</table>
<hr>
<h2>🔄 Continuous Learning (Revisi)</h2>
<h3>Dua jalur berbeda kecepatan</h3>
<pre class="mermaid">flowchart TD
    A[&#34;Analis HITL Verifikasi Laporan&#34;] --&gt;|&#34;VERIFIED + label&#34;| Q[&#34;Quality Gate: dedup + cross-check&#34;]
    C[&#34;PhishTank / URLhaus Sync (4 jam)&#34;] --&gt;|&#34;URL baru&#34;| Q
    D[&#34;SOC Manual Decision&#34;] --&gt;|&#34;Ground truth&#34;| Q
    E[&#34;Proxy Traffic Logs&#34;] --&gt;|&#34;URL + outcome&#34;| Q
    Q --&gt;|&#34;Lolos validasi&#34;| B[&#34;Training Data Pool&#34;]
    Q --&gt;|&#34;Konflik label / sumber tunggal&#34;| R[&#34;Antrian Review Manual&#34;]
    R --&gt;|&#34;Setelah direview&#34;| B
    B --&gt; F{&#34;Pool cukup / trigger lain?&#34;}
    F --&gt;|&#34;≥1000 URL baru ATAU FPR/FNR drift&#34;| G[&#34;Trigger Retraining&#34;]
    F --&gt;|&#34;Belum&#34;| H[&#34;Tunggu accumulate (cek ulang max 1 minggu)&#34;]
</pre>
<ul>
<li><strong>Jalur cepat (menit-jam):</strong> begitu analis verifikasi laporan → langsung update blocklist/allowlist, tanpa nunggu retrain. Ini yang bikin sistem responsif ke campaign baru.</li>
<li><strong>Jalur retrain (event-driven):</strong> dipicu oleh data pool, performance drift, atau fallback check mingguan — bukan jadwal tetap 2 minggu yang tidak nyambung ke kecepatan feed.</li>
</ul>
<h3>Kontrol kualitas data (baru)</h3>
<p>URL dari feed eksternal hanya auto-masuk training pool kalau dikonfirmasi minimal 2 sumber independen (mis. PhishTank + URLhaus sepakat). Kalau cuma 1 sumber atau ada konflik label dengan data existing, masuk antrian review manual — jangan auto-overwrite label yang sudah ada.</p>
<h3>Konsistensi fitur training vs serving (baru)</h3>
<p>Satu modul (<code>features/extractor.py</code>) jadi satu-satunya sumber logic fitur, dipakai baik oleh training pipeline maupun serving pipeline. Ini mencegah training-serving skew — bug klasik di mana fitur yang dipakai saat training beda implementasi dengan yang dipakai saat serving.</p>
<h3>Canary rollout (revisi dari auto-promote penuh)</h3>
<p>Shadow evaluation tetap jalan seperti v2, tapi promosi tidak langsung full — model baru masuk <strong>canary</strong> (misal 5-10% traffic) dulu, dimonitor intensif 24-48 jam, baru full rollout kalau metrik stabil. Auto-promote tanpa canary/human check baru dipertimbangkan setelah sistem terbukti reliable di beberapa siklus, bukan dari hari pertama — ini sistem yang menentukan block/allow trafik user, jadi margin kesalahan di test set statis saja terlalu tipis.</p>
<h3>Metric tracking (revisi)</h3>
<table>
<thead>
<tr>
<th>Metrik</th>
<th>Target</th>
<th>Catatan v3</th>
</tr>
</thead>
<tbody>
<tr>
<td>F1-Score</td>
<td>≥ 95%</td>
<td></td>
</tr>
<tr>
<td><strong>PR-AUC (baru)</strong></td>
<td>≥ 0.95</td>
<td>Lebih representatif dari AUC-ROC untuk dataset timpang (phishing jauh lebih sedikit dari traffic normal)</td>
</tr>
<tr>
<td>False Positive Rate</td>
<td>&lt; 2%</td>
<td><strong>KRITIS</strong> — dievaluasi juga per-segmen, bukan cuma agregat</td>
</tr>
<tr>
<td>False Negative Rate</td>
<td>&lt; 5%</td>
<td></td>
</tr>
<tr>
<td>Precision</td>
<td>≥ 96%</td>
<td></td>
</tr>
<tr>
<td>Recall</td>
<td>≥ 93%</td>
<td></td>
</tr>
<tr>
<td>Latency p95 (Tier 1)</td>
<td>&lt; 20ms</td>
<td>Target terpisah — ini yang menangani mayoritas traffic</td>
</tr>
<tr>
<td>Latency p95 (sampai Tier 2)</td>
<td>&lt; 200ms</td>
<td>Berlaku hanya untuk subset yang benar-benar butuh DL</td>
</tr>
<tr>
<td>Model Drift (KL-Divergence)</td>
<td>&lt; 0.1</td>
<td></td>
</tr>
</tbody>
</table>
<p>Shadow evaluation wajib breakdown per segmen (per kategori TLD, per cluster brand-target, domain baru vs lama) — angka agregat yang tetap terlihat bagus bisa menutupi regresi di subpopulasi kecil.</p>
<h3>Kapan retrain?</h3>
<table>
<thead>
<tr>
<th>Trigger</th>
<th>Kondisi</th>
<th>Aksi</th>
</tr>
</thead>
<tbody>
<tr>
<td>Data Trigger</td>
<td>≥1000 URL baru lolos quality gate</td>
<td>Mulai retrain pipeline</td>
</tr>
<tr>
<td>Performance Trigger</td>
<td>FPR naik &gt;3% atau FNR naik signifikan di production</td>
<td>Retrain prioritas tinggi + alert</td>
</tr>
<tr>
<td>Drift Trigger</td>
<td>KL-Divergence prediksi &gt;0.1</td>
<td>Alert + investigate</td>
</tr>
<tr>
<td>Fallback Check</td>
<td>Belum ada trigger di atas dalam 1 minggu</td>
<td>Cek manual apakah pool representatif, bukan retrain otomatis buta</td>
</tr>
<tr>
<td>Fast-path (bukan retrain)</td>
<td>Report terverifikasi individual</td>
<td>Update blocklist/allowlist real-time</td>
</tr>
</tbody>
</table>
<h3>Implementasi teknis (revisi)</h3>
<pre><code class="language-python"># ml_service/features/extractor.py
# Modul TUNGGAL dipakai training &amp; serving — mencegah training-serving skew
def extract_features(url: str, use_external: bool = True) -&gt; dict:
    features = extract_lexical_features(url)
    if use_external:
        features.update(extract_external_features(url, timeout_ms=300))
    return features


# ml_service/inference/cascade.py
def score_url(url: str) -&gt; dict:
    if is_in_blocklist(url):
        return {&#34;verdict&#34;: &#34;malicious&#34;, &#34;confidence&#34;: 1.0, &#34;tier&#34;: 0}
    if is_in_allowlist(url):
        return {&#34;verdict&#34;: &#34;safe&#34;, &#34;confidence&#34;: 1.0, &#34;tier&#34;: 0}

    features = extract_features(url)
    xgb_score = xgb_model.predict_proba(features)

    if xgb_score &gt; 0.85 or xgb_score &lt; 0.15:
        final, dl_score = xgb_score, None
    else:
        dl_score = dl_model.predict_proba(url)
        final = stacker.predict_proba([xgb_score, dl_score, features[&#34;external_flags&#34;]])

    if features[&#34;domain_age_days&#34;] &lt; 3 and features[&#34;levenshtein_min&#34;] &lt;= 2:
        final = max(final, 0.7)  # hard override

    return {&#34;verdict&#34;: decide_action(final), &#34;confidence&#34;: final,
            &#34;tier&#34;: 2 if dl_score else 1}


# ml_service/training/retrain.py
def retrain_pipeline():
    new_data = collect_from_afferent_db()
    feed_data = download_latest_feeds()
    validated = quality_gate(new_data, feed_data)   # dedup + cross-source check
    merged = merge_with_historical(validated)

    new_xgb = xgb.train(params, merged, xgb_model=load_model(&#34;xgboost_current.json&#34;))
    new_dl = fine_tune(load_model(&#34;dl_current.pt&#34;), merged, epochs=5)
    new_stacker = train_stacker(new_xgb, new_dl, validation_set)

    old_metrics = evaluate(current_pipeline, test_set, segmented=True)
    new_metrics = evaluate((new_xgb, new_dl, new_stacker), test_set, segmented=True)

    if passes_promotion_gate(new_metrics, old_metrics):
        promote_to_canary(new_xgb, new_dl, new_stacker, traffic_pct=10)
        # monitor 24-48 jam sebelum full promote
    else:
        alert_admin(&#34;Model baru tidak lolos gate, tetap pakai model lama&#34;)
</code></pre>
<hr>
<h2>⚡ Timeline (Revisi: 2 Opsi)</h2>
<h3>Opsi A — MVP Scoped, tetap ~2 hari</h3>
<p>Kalau 2 hari memang hard deadline, ini scope yang realistis dicapai: Tier 0 + Tier 1 saja (tanpa DL), fitur eksternal dasar saja (domain age + SSL, tanpa ASN/redirect dulu), continuous learning otomatis penuh didorong ke fase 2.</p>
<table>
<thead>
<tr>
<th>Waktu</th>
<th>Track A (Kamu)</th>
<th>Track B (Antigravity)</th>
</tr>
</thead>
<tbody>
<tr>
<td>Hari 1 Pagi</td>
<td>Setup blocklist/allowlist schema, review dataset</td>
<td>Build shared feature extractor (lexical + domain age/SSL saja)</td>
</tr>
<tr>
<td>Hari 1 Siang</td>
<td>Train XGBoost baseline, threshold tuning</td>
<td>Caching per-domain + timeout/fallback fitur eksternal</td>
</tr>
<tr>
<td>Hari 1 Malam</td>
<td>Evaluate (termasuk PR-AUC), cek FPR per segmen</td>
<td>Cascade service (Tier 0 + Tier 1 saja)</td>
</tr>
<tr>
<td>Hari 2 Pagi</td>
<td>Finalisasi threshold, siapkan hard-override rule</td>
<td>API contract + integration test backend↔ML service</td>
</tr>
<tr>
<td>Hari 2 Siang</td>
<td><strong>Deploy MVP</strong>, monitoring dasar aktif</td>
<td>Dokumentasi apa yang di-defer ke fase 2</td>
</tr>
</tbody>
</table>
<h3>Opsi B — Full Version (ML+DL+ensemble+continuous learning penuh)</h3>
<table>
<thead>
<tr>
<th>Hari</th>
<th>Track A (Kamu)</th>
<th>Track B (Antigravity)</th>
</tr>
</thead>
<tbody>
<tr>
<td>1-2</td>
<td>Shared feature extractor + dataset historis + feed integration</td>
<td>Cascade service skeleton, blocklist/allowlist infra</td>
</tr>
<tr>
<td>2-3</td>
<td>Train &amp; tuning XGBoost (fitur eksternal lengkap)</td>
<td>Caching layer, timeout/fallback, API contract</td>
</tr>
<tr>
<td>3-5</td>
<td>Train CNN-LSTM (butuh iterasi &gt;1x, data-hungry)</td>
<td>Integrasi Tier 2 ke cascade, stacker training pipeline</td>
</tr>
<tr>
<td>5-6</td>
<td>Shadow evaluation infra (segmented)</td>
<td>Canary rollout mechanism (traffic splitting)</td>
</tr>
<tr>
<td>6-7</td>
<td>Continuous learning: fast-path + quality gate</td>
<td>Retrain pipeline otomatis + monitoring dashboard</td>
</tr>
<tr>
<td>7-8</td>
<td>End-to-end testing, buffer temuan integration</td>
<td>Dokumentasi lengkap, handoff</td>
</tr>
</tbody>
</table>
<p><strong>Rekomendasi:</strong> mulai dari Opsi A supaya cepat live dan dapat data traffic production asli — yang justru dibutuhkan untuk training DL yang bagus nantinya — baru upgrade bertahap ke Opsi B. Continuous learning pipeline juga jadi punya &quot;bahan&quot; data real lebih awal, alih-alih menunggu semua komponen selesai dulu sebelum ada satupun yang live.</p>
<hr>
<p>Kalau ada bagian yang mau dipertahankan dari v2 (misal target 2 hari itu hard constraint dari atasan, atau ada alasan khusus tetap pakai RF), kasih tau bagian mana yang paling penting — biar bisa disesuaikan lagi.</p>


<!--claude-mermaid-runtime-begin:3477-->
<style>.mermaid-diagram{margin-block:4px}.mermaid-diagram svg{display:block;margin:0 auto;max-width:100%;height:auto}</style>
<script src="/_runtime/mermaid-11.16.1.min.js"></script>
<script>(function(){
var CFG={"palettes":{"light":{"surface":"#f4efe4","text":"#42392e","line":"#8a7f6d","border":"#7a6c52","bg":"#fffdf8"},"dark":{"surface":"#262b34","text":"#f2f3f5","line":"#a8adb8","border":"#9aa4b8","bg":"#1f232b"}}};
if(typeof mermaid==='undefined')return;
var pres=Array.prototype.slice.call(document.querySelectorAll('pre.mermaid')).filter(function(p){if(p.hasAttribute('data-claude-mermaid-claimed'))return false;p.setAttribute('data-claude-mermaid-claimed','1');return true;});
if(!pres.length)return;
var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
var root=document.documentElement;
var items=pres.map(function(pre){
var mount=document.createElement('div');mount.className='mermaid-diagram';
return {pre:pre,mount:mount,src:pre.textContent||''};
});
var seq=0;
var renderGen=0;
var lastKey='';
function pageBg(fallback){
var els=[document.body,document.documentElement];
for(var i=0;i<els.length;i++){
var c=els[i]&&getComputedStyle(els[i]).backgroundColor;
if(c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)')return c;
}
return fallback;
}
function render(){
var theme=root.getAttribute('data-theme');
var dark=theme==='dark'||(!!(mq&&mq.matches)&&theme!=='light');
var pal=dark?CFG.palettes.dark:CFG.palettes.light;
var bg=pageBg(pal.bg);
var key=(dark?'d':'l')+'|'+bg;
if(key===lastKey)return;
lastKey=key;
var gen=++renderGen;
var font=getComputedStyle(document.body).fontFamily||'sans-serif';
var nat={useMaxWidth:false};
mermaid.initialize({
startOnLoad:false,securityLevel:'strict',theme:'base',
flowchart:nat,sequence:nat,er:nat,state:nat,class:nat,pie:nat,
gantt:nat,journey:nat,timeline:nat,gitGraph:nat,mindmap:nat,xyChart:nat,
quadrantChart:nat,sankey:nat,c4:nat,requirement:nat,block:nat,
packet:nat,kanban:nat,architecture:nat,radar:nat,
themeVariables:{background:bg,mainBkg:pal.surface,primaryColor:pal.surface,
primaryTextColor:pal.text,lineColor:pal.line,primaryBorderColor:pal.border,
nodeBorder:pal.border,clusterBorder:pal.border,edgeLabelBackground:bg,
clusterBkg:'rgba(127,127,127,0.07)',titleColor:pal.text,
darkMode:dark,rowOdd:bg,rowEven:'rgba(127,127,127,0.07)',
attributeBackgroundColorOdd:bg,attributeBackgroundColorEven:'rgba(127,127,127,0.07)',
fontSize:'16px',fontFamily:font},
themeCSS:'.node rect, .node circle, .node polygon, .node path, .cluster rect { stroke-width: 2px; }'
});
items.forEach(function(it){
var id='claude-mermaid-'+seq++;
mermaid.render(id,it.src).then(function(r){
if(gen!==renderGen)return;
var prev=it.pre.previousElementSibling;
if(prev&&prev.className==='mermaid-diagram'&&prev!==it.mount)return;
it.mount.innerHTML=r.svg;
if(!it.mount.parentNode)it.pre.parentNode.insertBefore(it.mount,it.pre);
it.pre.style.display='none';
},function(){
var scratch=document.getElementById(id);
if(scratch)scratch.parentNode.removeChild(scratch);
scratch=document.getElementById('d'+id);
if(scratch)scratch.parentNode.removeChild(scratch);
if(gen!==renderGen)return;
if(it.mount.parentNode)it.mount.parentNode.removeChild(it.mount);
it.pre.style.display='';
});
});
}
render();
if(mq&&mq.addEventListener)mq.addEventListener('change',render);
if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-theme']});
})();</script>
<!--claude-mermaid-runtime-end-->
</body></html>
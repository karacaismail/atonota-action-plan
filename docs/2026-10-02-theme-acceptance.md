# Eylem planı · açık/koyu tema kabulü

Kapsam: renk/kontrast, başlıktaki tema düğmesi ve bağımsız tercih kaydı. Görevler, kişi yolları, diyagramlar ve ilerleme sözleşmeleri değişmedi. Başlangıç sistem tercihini izler; açık seçim yenilemede korunur. Storage engelinde tema oturum içinde kullanılabilir.

Üretim içerik sürümü: `217a66a6a937`. İlk sayfa ve altı ortak dosya: **202144 / 204800 raw bayt**. Dört MD rehberi yalnız istendiğinde alınır; yeni harici kaynak veya tema paketi yok. İstemci veri izdüşümü tüm görev alanlarını korur; model/render eşdeğerliği regresyonla sınanır.

## Yerel doğrulama

- `npm run check`: pass.
- `npm test`: 49 pass, 0 fail; yeni tema/erişilebilir ad/teslim regresyonları önce başarısız gözlendi.
- `npm run build`: pass; 47 görev, 4 rehber.
- `QA_DIR=qa-results/theme-2026-10-02/after npm run qa`: 117 pass.
- Ortam: macOS Darwin25.5.0 arm64, Node24.19.0, Playwright1.63.0. Chromium153.0.8010.12, Firefox155.0, WebKit26.6; emüle viewport ve giriş profilleri.
- İki temada 320→360→375→390→yatay→tablet→masaüstü; computed metin/odak kontrastı, gerçek klavye eylemi, tercih/yenileme, OS/sekme değişimi, storage engeli, JavaScript’siz fallback, app yüklenmeden tercih ve print override: pass.
- Aynı ortamda önce/sonra/fark: `qa-results/theme-2026-10-02/`. Piksel farkı tanısaldır; otomatik baseline onayı değildir. Bağımsız salt okunur kaynak/görsel incelemede actionable bulgu yok.

GitHub CI ve canlı yayın ayrı doğrulama katmanlarıdır; durum [Actions](https://github.com/karacaismail/atonota-action-plan/actions) üzerinden izlenir. Canlı QA aynı komutu `QA_URL=https://karacaismail.github.io/atonota-action-plan/` ile çalıştırır ve manifest/hash/ağ kanıtını denetler.

Fiziksel iOS/Android, gerçek Safari ve ekran okuyucu: **not_run**. Sunucu, DNS, kimlik doğrulama ve MCP kurulumu bu UI tesliminin dışındadır.

# Eylem planı: UX güncellemesi

## Değişiklik

- Açılışta tek belirgin ana eylem ve üç kişinin yoluna doğrudan geçiş.
- Kapsam açıklaması ikincil açılır alanda; mevcut kararlar kaldırılmadı.
- Bölüm/aşama numaraları, görev durumları ve aktif URL hedefi daha belirgin.
- Yerel ilerleme çubuğu aynı görev kayıtlarından türetilir; gerçek kurulum/onay değildir.
- Diyagramlar içerik alanı 60rem altındayken dikey, yeterli alanda yataydır.

47 görev, üç insan görev sahibi, adresler, bağımlılıklar, koşullu kollar ve geçerli ilerleme korunur. Workbench, sunucu ve DNS değiştirilmez. Kaynak repo public; lisans seçimi kullanıcı onayı bekler.

## Kontroller

Repo kökünde Node24.19.0 ve kilitli Playwright1.63.0 ile:

- `npm run check`: pass.
- `npm test`: 45 pass; yeni üç UX regresyonu uygulamadan önce fail, sonra pass.
- `npm run build`: pass; içerik sürümü `60312f4d8074`.
- `QA_DIR=qa-results/ux-2026-10-02/after npm run qa`: 96 pass.
- İlk HTML ve altı kaynak: 203459 byte; mevcut bütçe 204800 byte, değiştirilmedi.

Chromium153.0.8010.12, Firefox155.0 ve WebKit26.6; macOS/Darwin25.5.0 arm64 üzerinde emülasyon. 320→360→375→390, yatay/kısa ekranlar, tablet/masaüstü, dokunma/fare ve klavye akışları kontrol edildi. Diyagramın gerçek içerik genişliği959/960/961px: yön, taşma,44/48px hedefler, odak ve durum korunması pass.

## Görsel kanıt ve yayın kapısı

Yerel `qa-results/ux-2026-10-02/` altında `before`, `after`, `differences` bulunur: 320px açılış, Cengiz yolu,1440px açılış ve diyagramlar. Aynı viewport piksel farkları teşhis kanıtıdır; otomatik baseline onayı değildir. Bağımsız inceleyici kaynak farkını ve görüntüleri salt okunur inceler; komutları ana ajan çalıştırır.

Bu not yerel kontrol kaydıdır. Yayın kabulü için yeni commit'in GitHub Actions `check` ve `deploy` işleri başarılı olmalı; aynı Pages adresinde96 kontrol yeniden çalışmalı ve canlı manifest bu sürümle eşleşmelidir. Bu sonuçlar ayrıca karar kaydına işlenir.

Gerçek iOS/Android/Safari, ekran okuyucu, sanal klavye ve Hetzner/auth/MCP: not_run. Emülasyon bu kabullerin yerine geçmez.

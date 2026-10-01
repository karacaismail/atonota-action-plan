# Eylem planı güncellemesi — kabul kaydı

## Değişiklik sınırı

Yalnız eylem planı verisi, arayüzü, kişi kılavuzları ve bu planın GitHub Pages teslimi. Workbench tasarımı, Hetzner, DNS, gerçek uygulamalar ve hesap bağlantıları değiştirilmez.

## Önce gözlenen sorunlar

- `#role-sen`, 320px: görev başlığı ve küçük durum etiketi var; doğrudan uygulanacak adımlar görünmüyor. Teslim bilgisi kapalı ayrıntıda.
- Holding içeriği başlangıç görevi gibi gösteriliyor; PoC/CI-CD önceliği görünmüyor.
- Blender bulut/MCP yönetimi isteğe bağlı niyet sorusu; kullanıcının verdiği tüm uygulamalar/Linux kapsamı kayıp.
- Blender'ın süren kurulumu ile yerel checkbox ilerlemesi ayrı gösterilmiyor.
- Ön koşul bağlantısı yalnız görev kodu içeriyor; görevin adı ve sahibi okunamıyor.

Eski build üzerinde `npm run qa`: Chromium/Firefox/WebKit, 84 kayıt, 179865 raw byte. Önce görselleri `qa-results/before/` içinde; özellikle `chromium-desktop-top.png` ve `chromium-vibecoding-320.png`.

## RED kanıtı

`node --test tests/current-scope.test.mjs`: 5 fail / 0 pass. Beklenen nedenler: PoC scope eksik; Blender MCP kolu isteğe bağlı; güncel Nginx/Tailscale erişim kuralı eksik; Blender durum kaydı eksik; görünür görev adımları eksik.

Delivery regresyonları: eski build'de sürümlü CSS/modül grafiği ve kişi kılavuzları yok. Değişiklik sonrası aynı testler yeniden çalıştırılır.

## Kabul ölçütü

- Önce repo/PoC/CI-CD; gerçek siteler sonra. Verilen kişi, adres, repo ve erişim kararları tekrar soru yapılmaz.
- Her görevde görünür kısa adımlar; ikincil teslim/kontrol; ön koşulda iş adı ve sahibi.
- Üç kişi, tek İsmail yolu; dört tıklanabilir akış; gerçek bağımlılıklar ve isteğe bağlı kalan kollar.
- Değişen görev kapsamı eski completion ile geçmez; ilgisiz geçerli ilerleme korunur.
- 320 → 360 → 375 → 390 → yatay → tablet → desktop; coarse/fine giriş, klavye, odak ve üç tarayıcı motoru.
- İlk HTML + ortak dosyalar raw ≤200KiB; dış kaynak isteği yok. Görev kılavuzları yalnız tıklanınca yüklenir.
- CI check ve Pages deploy ayrı doğrulanır; mevcut canlı sekme normal yenilemeyle kontrol edilir.

Fiziksel iOS/Android/macOS Safari, gerçek ekran okuyucu ve gerçek server/auth/MCP kabulü bu teslimde `not_run`. Tarayıcı emülasyonu bunların yerine geçmez. Ayrı görsel karşılaştırmalar aday kanıttır; kör toplu baseline onayı yapılmaz.

## Yerel sonuç — 2 Ekim 2026

Çalışma dizini: `outputs/atonota-action-plan`. Gerçekte kullanılan Node 24.19.0; manifest `>=24 <25`. Playwright manifest/lock/çalışma ortamı 1.63.0. Framework değişmedi; statik HTML/CSS/ESM korunur. CI ayrıca çalıştırılıp sonuçla doğrulanır.

- `npm run check`: pass; JavaScript syntax kontrolleri.
- `npm test`: pass, 42 test. Veri/bağımlılık grafiği, revision-aware eski ilerleme, görev kılavuzları ve sürümlü üretim dosyaları kapsanır.
- `npm run build`: pass; `afd71fd9177c`, 47 görev, 4 isteğe bağlı yüklenen MD kılavuzu.
- `PLAYWRIGHT_PATH=… QA_DIR=qa-results/after npm run qa`: pass, 84 kayıt. Chromium/Firefox/WebKit; 320/360/375/390 ve değişen eşiklerin N−1/N/N+1 örnekleri, yatay/kısa görünüm, coarse/fine+klavye, durum/odak, ağ ve bütçe.
- İlk HTML + ortak istemci dosyaları: 196369 raw byte / 204800 byte bütçe. Bu dosya boyutu ölçümüdür; sıkıştırılmış aktarım ya da saha performansı iddiası değildir.
- `git diff --check`: pass.

İncelemede yakalanan iki konu düzeltildi: Cengiz 320 görseli önce yatay 844px viewport'tan alınmıştı; şimdi viewport tekrar 320 yapılır ve assert edilir. DNS testi kurulumdan önce görünüyordu; artık E13 teslimi → H03 özel/loopback başlangıç → H04 özel proxy/alt yol testi → A02 DNS → H05 DNS/TLS/giriş kabulü. İkinci konu için önce başarısız regresyon gözlendi; sonra test ve üç motor QA yeniden geçti.

## Görsel değişiklik kanıtı

`qa-results/before/`, `qa-results/after/` ve `qa-results/differences/` içinde aynı Chromium/viewport ile 320 görev, masaüstü üst ve akış ekranları. `differences/results.json` kesin piksel değişim sayılarını tutar. Palet, bilgi hiyerarşisi, görünür adımlar ve boşluklar bilinçli olarak değişti. Bunlar inceleme adaylarıdır; test eşiği yükseltilmedi, eski baseline otomatik onaylanmadı. Screenshot farkı kullanıcı onayının veya fiziksel cihaz kabulünün yerine geçmez.

Gerçek cihaz, ekran okuyucu, sanal klavye/safe-area/zoom ve gerçek Hetzner uygulama/auth/MCP doğrulaması: `not_run`. WebKit emülasyonu gerçek macOS/iOS Safari kabulü değildir. Server/DNS kurulumu bu değişiklik sırasında yapılmadı.

## Bağımsız inceleme

Salt okunur standards-reviewer, gerçek diff’i/yeni kaynakları, standartları, manifest/lock/CI sözleşmesini, 42 test ve 84 QA kanıtını, önce/sonra/fark görüntülerini bağımsız inceledi. Yukarıdaki sıra ve viewport bulguları kapandı; kalan eylem gerektiren bulgu raporlanmadı. İnceleyici komut çalıştırmadı ve dosya değiştirmedi. Bu kayıt canlı yayın/CI başarısı veya görsel baseline onayı değildir; yayın kabulü ayrıca yapılır.

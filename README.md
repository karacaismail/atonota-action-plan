# Atonota eylem planı

[Planı aç](https://karacaismail.github.io/atonota-action-plan/)

Genel yol haritası, kişi/aşama bağlantıları, görev bağımlılıkları ve dört koşullu iş kolu.
İşaretler yalnız tarayıcıda tutulur. Bu uygulama Hetzner, DNS veya hesaplarda işlem yapmaz; gerçek onay/deploy kaydı değildir.

[Workbench başlatıcısını aç](https://karacaismail.github.io/atonota-workbench/) · [320px UX-first görev tanımı](https://github.com/karacaismail/atonota-workbench/blob/main/docs/workbench-mobile-320-ux-first.md)

## Kayıtlı kararlar ve görünür akışlar

- `wb.atonota.net/pp`, `/od`, `/ad`, `/b3d`, `/sbbeta`, `/sbrc`; Pen ayrı `pen.atonota.net`. Bunlar yeniden karar istenen adresler değildir.
- Hazır uygulamalar kendi upstream repolarından; özel geliştirme `karacaismail` public repolarından. Yeni özgün kod lisansı ayrı kullanıcı seçimi; kaynak hazırlığını ve statik Workbench yayınını bloke etmez.
- Dört Frappe `press-*` sunucusu kullanıcı beyanına göre kurulu/tamam ve kapsam dışı. Workbench hedefi ayrı dedicated AMD EPYC128GB RAM (beyan); OS/disk/GPU/port/kapasite Cengiz tarafından ayrıca ölçülür. Ham sunucu ekran görüntüleri, IP ve şifreler burada tutulmaz.
- Geliştirme/devir, DNS, telefon→MCP ve beta→RC→Pen diyagramlarında düğüm ilgili görevi; kişi etiketi kendi aşamasını açar. Yerel işaret değişince düğüm durumu yenilenir. Seçilen ek iş kolu görünür; gerçek ön koşullar bağlantılıdır. Diagram durumu servis health değildir.
- Görev başlığı/durumu/ön koşulları görünür; çıktı ve kabul detayı isteğe bağlı açılır. Yerel kayıt/odak ve eski rol URL'leri korunur.
- Kabul kapsamı değişen görevler eski işaretle tamamlanmış sayılmaz. Görev revision'ı ile yalnız ilgili iş ve bağımlıları yeniden doğrulamaya açılır; diğer geçerli işaretler ve kol seçimleri korunur.

## Görev sahipleri

- İsmail Karaca: kararlar, geliştirme, onay, public ürün repo içerikleri ve GitHub'a gönderim; tek birleşik yol haritası. Codex ve Claude Code kullandığı vibecoding araçlarıdır, ayrı görev sahipleri değildir.
- Hüseyin Cengiz: server runtime/güvenlik, CI/CD teknik kurulumu, deploy/rollback ve teslim doğrulaması.
- Asistan Hüseyin: Hüseyin Cengiz'in teknik föyündeki GoDaddy/DNS işlemleri.

Yalnız bu üç kişinin sahibi/filtre/yol haritası bulunur; ikinci İsmail veya ayrı geliştirme ekibi kaydı yoktur.

İsmail Karaca kurulabilir ürün/servisleri Mac'te Colima ile geliştirir. Teslim paketi: Dockerfile, Compose, `.env.example`, kilitli bağımlılıklar, CI, healthcheck ve README; hedef `linux/amd64` / Hetzner AMD EPYC, belgelenmiş tek komutla kurulum. Doğrulanmış sürüm paketini Hüseyin Cengiz'e devreder. Bunlar ürün yol haritası görevleridir; bu repoda hazır ürün kurulum scripti bulunduğu anlamına gelmez. Statik plan sitesi GitHub Pages'te çalışır, container gerekmez.

## Geliştir

Node 24.x ve kilit dosyasındaki Playwright 1.63.0 kullanılır. İstemcide üçüncü taraf bağımlılık, font veya CDN yoktur.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npx --no-install playwright install chromium firefox webkit
npm run qa
```

Görevleri `plan.mjs`, bağımlılık/durum kurallarını `model.mjs`, sunumu `render.mjs`, etkileşimi `app.mjs`, semantik tokenları `styles.css` içinde düzenle.
`site/` derleme çıktısıdır; Git'e eklenmez. Linkler repo alt yoluyla çalışır. JavaScript olmadan çekirdek plan okunabilir.

## Yayınla

PR kontrolü: syntax + unit/graph testleri + üç motor tarayıcı QA’sı + statik build.
`main` push: aynı kontrollerden geçen `site/` artefaktını GitHub Pages’e yayınla.
CI’da kişisel Mac Git hook'u bulunmaz; workflow commit oluşturmaz. İleride commit üreten bir iş eklenirse aynı yazar/committer korumasını o ortamda ayrıca uygula.

Bu repo yalnız plan sitesidir. Ürün repoları, Hetzner CI/CD’si, OAuth/MCP geçidi ve yayın köprüleri sayfadaki ayrı teslim görevleridir; kurulmuş sayılmaz.

## Kabul kanıtı

QA: Chromium/Firefox/WebKit; 320/360/375/390, yatay telefon, tablet/masaüstü ve 640/1024/1312 sınırlarının N−1/N/N+1’i; görev/kişi geçişi, klavye, koşullar, kayıt, zincir invalidasyonu ve ağ kontrolü. Kanıtlar `qa-results/` içindedir. Gerçek iOS/Android/Safari ve ekran okuyucu: `not_run`.

Başlangıç bütçesi: HTML ve tüm istemci dosyalarının sıkıştırılmamış toplamı ≤ 200 KiB; harici istek yok. Özel cihaz paketi yok; tek hafif semantik deneyim, akışkan alan ve bağımsız giriş uyarlamaları var.

## Lisans

Repo public. Açık kaynak lisansı kullanıcı seçimi bekliyor; lisans verilmiş gibi yorumlama. Secret, gerçek `.env`, IP envanteri, kişisel veri veya yedek ekleme.

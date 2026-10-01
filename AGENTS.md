# Atonota plan sitesi

- Public repo esas; lisans kullanıcı onayı bekler. Private repo önerme. Secret, gerçek .env, IP, hesap verisi veya yedek koyma.
- Yeni commit author ve committer: `karacaismail <35493655+karacaismail@users.noreply.github.com>`. Co-author, AI/bot veya session trailer ekleme. Git guard/hook yolunu değiştirme veya atlama; upstream yazarlığını koru.
- Bu site yerel plan takibidir, server/DNS/hesap değiştirme yetkisi veya gerçek onay mekanizması değildir. İşaretlere dayanarak deploy yapma.
- Kullanıcı ve insan geliştirme sorumlusu İsmail Karaca'dır; arayüzde belirsiz “Sen” etiketi kullanma. Geliştirme katılımcıları yalnız İsmail Karaca, Codex ve Claude Code olarak tanımlıdır; ek insan ekip varsayma. Codex/Claude Code İsmail Karaca'nın vibecoding araçlarıdır, gerçek onay veya hesap yetkisi sahibi değildir.
- İsmail Karaca Mac'te Colima ile geliştirir, public ürün repolarının içeriklerini hazırlar ve GitHub'a gönderir. Kurulabilir ürün/servis tesliminde Dockerfile, Compose, `.env.example`, kilitli bağımlılıklar, CI kontrolleri, healthcheck ve README bulunmalı; hedef Hetzner AMD EPYC için `linux/amd64` ve belgelenmiş tek komutla kurulumdur. Bunu ürün görevinde gerçek build/kurulum kanıtıyla doğrula; hazır olmayan scripti varmış gibi sunma. Bu statik GitHub Pages plan sitesi için container zorunluluğu yoktur.
- Asistan Hüseyin insan asistandır; GoDaddy/DNS işlemlerini uygular. Hüseyin Cengiz kıdemli DevOps’tur: teknik föyü verir, server/CI/deploy/rollback ve doğrulamayı yapar. DNS devirlerini karıştırma.
- İsmail Karaca doğrulanmış sürüm paketini Hüseyin Cengiz'e devreder; server runtime, güvenlik, CI/CD teknik kurulumu, deploy ve rollback Hüseyin Cengiz'e aittir. Asistan Hüseyin ürün geliştirme veya server deploy sorumlusu değildir.
- Emoji kullanma. İçerik Türkçe, kısa, yalnız eylem/çıktı/kabul. Teknik belirsizliği karar veya PoC görevine dönüştür; bilinmeyen değeri uydurma.
- Teknoloji: frameworkless ES modules + Node24 build/test; Playwright1.63.0 yalnız geliştirme bağımlılığı. `plan.mjs` tek görev kaynağıdır. Mevcut Pen Astro/FastAPI mimarisine bu repo dokunmaz.
- UI:320 önce; merkezi semantik tokenlar, radius0, boşluk/yüzey hiyerarşisi. Tek focus-visible göstergesi yalnız odaklı kontrolde, ≥3:1. Native select kullanma. Hedef44px/coarse48px. Hover zorunlu eylem yolu olmasın. Yerleşim/giriş/yönelim bağımsız; başka profile özel gizli indirme yok.
- İlerleme değişiminde odak ve veri korunmalı. Bağımlı görev önce tamamlanamaz; ön koşul yeniden açıldığında downstream işaretler kaldırılır. Kol açmak yetki/onay değildir; aktif koşullu işler final kabulü bekletir.
- Kayıt yalnız yerel tarayıcıdadır; storage hatasında sayfa kullanılabilir kalsın. Sunucu sync’i veya ekip onayı varmış gibi sunma.
- Kontroller: `npm run check`, `npm test`, `npm run build`, `npm run qa`. Komutları incele. Regresyon testini önce yaz; anlamlı UI tesliminde bağımsız read-only inceleme ve screenshot/ağ/ARIA kanıtı al. Kör snapshot yenileme yapma.
- QA:Chromium/Firefox/WebKit, 320→360→375→390→yatay→tablet→desktop ve içerik breakpoint’lerindeN−1/N/N+1. Gerçek cihaz/ekran okuyucu/CI çalışmadıysa `not_run` bildir; emülasyon gerçek Safari değildir.
- Bütçe: tüm ilk sayfa+ortak dosyalar raw≤200KiB, harici kaynak isteği0. Tek hafif shared layout kullanılır. Belirli test genişliği zorunlu breakpoint değildir.
- Ortak standart kaynağını bu Mac’te `/Users/w6x/.claude/skills/coding-standards/SKILL.md` ve uygun referanslarından oku. Bu Mac'te Colima; Hetzner'de Docker Engine. Çalışan servisleri izinsiz yeniden başlatma.
- CI GitHub-hosted ephemeral runner kullanır, commit oluşturmaz; Mac yazar hook'unun CI'ı kapsadığını iddia etme. Workflow izinleri minimum, action SHA’ları sabit; Pages yalnız testten geçen main artefaktını yayınlar.

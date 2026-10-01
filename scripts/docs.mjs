const livePlan = 'https://karacaismail.github.io/atonota-action-plan/';
const text = value => String(value ?? '').replace(/[\\`*_{}\[\]<>]/g, character => `\\${character}`);
const roleName = (plan, id) => plan.roles.find(role => role.id === id)?.name || id;
const taskLink = task => `[${text(task.id)} · ${text(task.title)}](${livePlan}#task-${task.id})`;

export const guideFiles = {
  sen: 'ismail-karaca.md',
  cengiz: 'huseyin-cengiz.md',
  asistan: 'asistan-huseyin.md',
};

function prerequisites(task, plan) {
  const required = (task.depends || []).map(id => {
    const dependency = plan.tasks.find(item => item.id === id);
    return dependency ? `${taskLink(dependency)} — ${text(roleName(plan, dependency.role))}` : text(id);
  });
  const optional = (task.optionalDepends || []).map(id => {
    const dependency = plan.tasks.find(item => item.id === id);
    const option = plan.options.find(item => item.id === dependency?.when);
    return dependency ? `${taskLink(dependency)} — yalnız ${text(option?.title || 'ilgili kol')} açıksa` : text(id);
  });
  return [...required, ...optional].length ? [...required, ...optional].join('; ') : 'Başka bir görevi beklemeden başlayabilirsin.';
}

function handoff(task, plan) {
  if (task.handoff) return text(task.handoff);
  if (task.role === 'asistan') return 'Hüseyin Cengiz — uygulanan kayıtlar ve işlem saati; secret gönderme.';
  const recipients = [...new Set(plan.tasks
    .filter(item => [...(item.depends || []), ...(item.optionalDepends || [])].includes(task.id) && item.role !== task.role)
    .map(item => roleName(plan, item.role)))];
  if (recipients.length) return `${recipients.map(text).join(' / ')} — yukarıdaki teslimi ve kontrol sonucunu ilet.`;
  return `${text(roleName(plan, 'sen'))} — sonucu ve açık eksikleri görev kaydına işle.`;
}

function renderTaskGuide(task, plan) {
  const option = task.when && plan.options.find(item => item.id === task.when);
  const steps = task.steps?.length ? task.steps : [task.title];
  return [
    `### ${text(task.id)} · ${text(task.title)}`,
    '',
    option ? `Koşul: ${text(option.title)}. Bu kol açılmadıysa bu görev yapılmaz.\n` : '',
    `Başlamadan: ${prerequisites(task, plan)}`,
    '',
    ...steps.map((step, index) => `${index + 1}. ${text(step)}`),
    '',
    `Teslim: ${text(task.output)}`,
    '',
    `Kime ilet: ${handoff(task, plan)}`,
    '',
    `İşi kapatmadan kontrol et: ${text(task.accept)}`,
    '',
    `[Bu görevi planda aç](${livePlan}#task-${task.id})`,
    '',
  ].filter(line => line !== null).join('\n');
}

const introduction = plan => [
  `Güncelleme: ${text(plan.date)}`,
  '',
  'Şimdi gerçek siteleri tamamlamıyoruz. Public repoları, PoC indexlerini, kurulumu, güvenli erişimi ve CI/CD’yi hazırla. Holding sitesini İsmail Karaca daha sonra geliştirecek.',
  '',
  'Kayıtlı bilgi gerçek kurulum kanıtı değildir. Sayfadaki işaretler yalnız o tarayıcıda saklanır; ekip onayı veya çalışan sunucu durumu sayılmaz. Kurulum/deploy sonucu ayrıca doğrulanır.',
  '',
  'Secret, gerçek .env, parola, IP envanteri ve ham sunucu ekran görüntülerini public repoya veya bu belgeye koyma. Özgün kod lisansı kullanıcı seçimi bekler; upstream lisans ve yazarlığını koru.',
  '',
].join('\n');

export function renderRoleGuide(plan, id) {
  const role = plan.roles.find(item => item.id === id);
  if (!role) throw new Error(`Unknown guide owner: ${id}`);
  const sections = plan.phases.flatMap((phase, index) => {
    const tasks = plan.tasks.filter(task => task.role === id && task.phase === phase.id);
    if (!tasks.length) return [];
    return [
      `## ${String(index + 1).padStart(2, '0')} · ${text(phase.title)}`,
      '',
      ...tasks.map(task => renderTaskGuide(task, plan)),
    ];
  });
  return [
    `# ${text(role.name)} — görev yol haritası`,
    '',
    introduction(plan),
    text(role.description),
    '',
    'Sırayı ön koşullar belirler. Aynı aşamadaki bağımsız işler paralel yürüyebilir. Koşullu işler yalnız ilgili kol açıldığında plana eklenir.',
    '',
    ...sections,
  ].join('\n');
}

export function renderGeneralGuide(plan) {
  const sections = plan.phases.flatMap((phase, index) => [
    `## ${String(index + 1).padStart(2, '0')} · ${text(phase.title)}`,
    '',
    `Aşama bittiğinde: ${text(phase.exit)}`,
    '',
    ...plan.tasks.filter(task => task.phase === phase.id).map(task => {
      const option = plan.options.find(item => item.id === task.when);
      return `- ${taskLink(task)} — ${text(roleName(plan, task.role))}${option ? `; koşul: ${text(option.title)}` : ''}`;
    }),
    '',
  ]);
  return [
    '# Atonota — genel DevOps ve CI/CD yol haritası',
    '',
    introduction(plan),
    '## İş paylaşımı',
    '',
    ...plan.roles.map(role => `- **${text(role.name)}:** ${text(role.description)} [Kendi görev dosyası](./${guideFiles[role.id]})`),
    '',
    'DNS akışı: Hüseyin Cengiz kayıt türü, ad ve değeri hazırlar → Asistan Hüseyin GoDaddy’de uygular → Hüseyin Cengiz sonucu doğrular.',
    '',
    'Doğal dil işi: telefon Claude veya giriş yapılmış webform → yetkilendirilmiş MCP → kalıcı iş → Linux / ilgili uygulama → durum ve izinli sonuç URL’si. Bu hat hazırlanmadan yalnız bir Workbench bağlantısı çalışıyor olması işi tamamlamaz.',
    '',
    '## Kayıtlı uygulama adresleri',
    '',
    ...plan.projects.map(project => `- **${text(project.name)}:** ${text(project.address)}. ${text(project.action)}${project.status ? ` Durum: ${text(project.status)}.` : ''}`),
    '',
    'Workbench yalnız uygulamalara götüren menüdür. Storybook Beta/RC, Penpot, Affinity ve Blender girişsiz açılmayacak. Güvenli web arayüzü varsa HTTPS ve uygulama girişi; yetersizse Nginx Basic Auth. Web arayüzü yoksa ücretsiz plan uygunluğu doğrulanmış özel Tailscale erişimi. Tailscale kendi başına web arayüzü oluşturmaz.',
    '',
    'MCP’de kullanıcı, proje ve eylem yetkisi ayrı doğrulanır. Web arayüzündeki Basic Auth, MCP OAuth yetkilendirmesi yerine geçmez. Üretim yayınları ve kritik/yıkıcı Linux işleri onay sınırını korur; ham Docker/Python/yönetim soketleri dışarı açılmaz.',
    '',
    ...sections,
    `[Canlı planı aç](${livePlan})`,
    '',
  ].join('\n');
}

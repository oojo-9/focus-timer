/* setup.js — 설정 화면 (미리보기, 입력 바인딩) */
/* ============================================================
   설정 화면 바인딩
   ============================================================ */
const pv = $('#previewCanvas');
function drawPreview() {
  sizeCanvas(pv);
  const target = targetMs() || 25 * 60000;
  drawClock(pv.getContext('2d'), pv.width, pv.height, {
    ...cfgDisplay(), elapsed: target * 0.37, target, now: Date.now() });
}
const cfgDisplay = () => ({ theme: themeOf(cfg), font: cfg.font, style: cfg.style,
  showSeconds: cfg.showSeconds, showClock: cfg.showClock, countMode: cfg.countMode });
const targetMs = () => ((+cfg.h || 0) * 3600 + (+cfg.m || 0) * 60 + (+cfg.s || 0)) * 1000;

const sw = $('#swatches');
for (const [k, t] of Object.entries(THEMES)) {
  const b = document.createElement('button');
  b.className = 'swatch'; b.dataset.theme = k; b.title = k;
  b.style.background = t.bg; b.style.color = t.accent === t.fg ? t.fg : t.accent; b.textContent = '12';
  b.onclick = () => { Object.assign(cfg, t, { theme: k }); syncForm(); onCfg(); };
  sw.appendChild(b);
}

const fields = { dh:'h', dm:'m', ds:'s', countMode:'countMode', style:'style', font:'font',
  cBg:'bg', cFg:'fg', cAccent:'accent', cSub:'sub' };
const checks = ['showSeconds','showClock','autoCapture','camera','focus','showPreview','vibrate','sound'];
function syncForm() {
  for (const [id, k] of Object.entries(fields)) $('#' + id).value = cfg[k];
  for (const id of checks) $('#' + id).checked = !!cfg[id];
  sw.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.theme === cfg.theme));
}
function onCfg() { save(); drawPreview(); }
for (const [id, k] of Object.entries(fields)) $('#' + id).addEventListener('input', e => {
  cfg[k] = e.target.type === 'number' ? Math.max(0, +e.target.value || 0) : e.target.value;
  if (id.startsWith('c')) { cfg.theme = 'custom'; syncForm(); }
  onCfg();
});
for (const id of checks) $('#' + id).addEventListener('change', e => {
  cfg[id] = e.target.checked; onCfg();
  if (id === 'camera' || id === 'focus') updateCamera();
});
document.querySelectorAll('[data-min]').forEach(b => b.onclick = () => {
  const m = +b.dataset.min; cfg.h = Math.floor(m / 60); cfg.m = m % 60; cfg.s = 0; syncForm(); onCfg();
});
window.addEventListener('resize', () => { if (document.body.classList.contains('setup')) drawPreview(); });
document.fonts?.ready.then(drawPreview);



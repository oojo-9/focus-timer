/* main.js — 공통 단축키·커서, 초기화 (마지막에 로드) */
$('#againBtn').onclick = () => {
  S = null; document.body.className = 'setup';
  if (cfg.camera || cfg.focus) updateCamera();
  renderHist(); drawPreview();
};

/* ---- 진행 중 커서 숨김 (2초간 움직임 없으면) ---- */
let idleT = 0;
addEventListener('pointermove', () => {
  document.body.classList.remove('idle'); clearTimeout(idleT);
  idleT = setTimeout(() => document.body.classList.add('idle'), 2000);
});

/* ---- 단축키: 설정 화면에서 Enter = 시작 ---- */
addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.body.classList.contains('setup')
      && !['SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) { e.preventDefault(); $('#startBtn').click(); }
});

/* ---- 초기화 ---- */
syncForm(); renderHist(); updateLectureUI(); drawPreview();
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || !document.documentElement.requestFullscreen) {
  $('#mobileNote').style.display = '';
}
if (cfg.camera || cfg.focus) updateCamera();


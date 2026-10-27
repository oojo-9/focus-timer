/* session.js — 세션 시작·진행·잠금·이탈 감지·포기 */
/* ============================================================
   세션 진행
   ============================================================ */
const clockCv = $('#clock');
let S = null, wakeLock = null;
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.opacity = 0, 2200); };

async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }
async function enterLock() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    // Chrome/Edge: 전체화면에서 Esc 등을 잡아서 "길게 눌러야" 해제되게 함
    await navigator.keyboard?.lock?.().catch(() => {});
  } catch {}
}
const onBeforeUnload = e => { e.preventDefault(); e.returnValue = ''; };
const onPopState = () => { if (S && !S.done) { history.pushState({ lock: 1 }, ''); toast('집중 중에는 뒤로 갈 수 없어요'); } };

$('#startBtn').onclick = async () => {
  const target = targetMs();
  if (target < 1000) { alert('목표 시간을 설정해 주세요.'); return; }
  const lec = lectureCheck();
  if (!lec.ok) { alert(lec.msg); return; }
  await enterLock();                // 사용자 클릭 직후에 호출해야 전체화면 허용됨
  if ((cfg.camera || cfg.focus) && !stream) await updateCamera();

  S = { start: Date.now(), target, events: [], samples: [], frames: [], cal: [], base: null,
        run: null, leftAt: null, armedAt: Date.now() + 1500, done: false, lecture: lectureLabel(),
        untilEnd: !!(cfg.lectureOn && cfg.lectureEnd) };   // true면 목표 시간이 아니라 강의가 끝날 때 종료
  document.body.className = 'running' + (stream ? ' camon' : '') + (cfg.showPreview ? '' : ' nopreview')
    + (cfg.lectureOn ? ' lecture' : '');
  startLecture();
  history.pushState({ lock: 1 }, '');
  addEventListener('popstate', onPopState);
  addEventListener('beforeunload', onBeforeUnload);
  keepAwake();

  const status = [];
  if (stream && cfg.camera) {
    S.frameEvery = Math.max(1000, target / 600);   // 약 600프레임 = 30fps로 20초 영상
    S.tlTimer = setInterval(grabFrame, S.frameEvery); grabFrame();
    status.push('● 타임랩스');
  }
  if (stream && cfg.focus) {
    if (!landmarker) loadLandmarker();
    S.anTimer = setInterval(analyze, 500);
    status.push('집중도 분석');
  }
  $('#runStatus').textContent = status.join(' · ');
  S.tick = setInterval(tick, 200); tick();
};

function tick() {
  if (!S || S.done) return;
  const elapsed = S.untilEnd ? Date.now() - S.start : Math.min(S.target, Date.now() - S.start);
  sizeCanvas(clockCv);
  drawClock(clockCv.getContext('2d'), clockCv.width, clockCv.height,
    { ...cfgDisplay(), elapsed, target: S.target, now: Date.now(), untilEnd: S.untilEnd });
  // 창 포커스 확인: 강의(iframe)를 클릭해도 같은 창 안이라 hasFocus()는 true → 이탈 아님
  if (document.hidden || !document.hasFocus()) onLeave(document.hidden ? '다른 앱/탭으로 이동' : '다른 창 클릭 / 알림 확인');
  else onReturn();
  if (!S.untilEnd && elapsed >= S.target) finish(true);
}

/* ---- 이탈 감지: 다른 앱/탭, 창 포커스 잃음(알림 클릭 등), 전체화면 해제 ---- */
function onLeave(kind) {
  if (!S || S.done || Date.now() < S.armedAt || S.leftAt != null) return;
  S.leftAt = Date.now(); S.leftKind = kind;
}
function onReturn() {
  if (!S || S.leftAt == null) return;
  const a = S.leftAt - S.start, b = Date.now() - S.start;
  if (b - a >= 500) S.events.push({ type: 'left', start: a, end: S.untilEnd ? b : Math.min(b, S.target), detail: S.leftKind });
  S.leftAt = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onLeave('다른 앱/탭으로 이동');
  else { onReturn(); if (S && !S.done) { keepAwake(); tick(); } }
});
// 창 blur 이벤트는 강의 iframe을 클릭할 때도 발생하므로 쓰지 않고, tick()에서 hasFocus()로 확인
document.addEventListener('fullscreenchange', () => {
  if (!S || S.done || !document.documentElement.requestFullscreen) return;
  if (!document.fullscreenElement) {
    S.events.push({ type: 'fs', start: Date.now() - S.start, end: Date.now() - S.start });
    $('#relock').classList.add('on');
  } else $('#relock').classList.remove('on');
});
$('#relockBtn').onclick = () => enterLock();

/* ---- 포기: 3초 길게 누르기 ---- */
(() => {
  const btn = $('#giveup'), fill = btn.querySelector('.fill');
  let t0 = 0, raf = 0;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 3000);
    fill.style.width = k * 100 + '%';
    if (k >= 1) { cancel(); finish(false); } else raf = requestAnimationFrame(step);
  };
  const cancel = () => { cancelAnimationFrame(raf); fill.style.width = 0; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(step); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, cancel));
  btn.addEventListener('contextmenu', e => e.preventDefault());
})();



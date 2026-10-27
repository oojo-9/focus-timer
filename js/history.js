/* history.js — 세션 기록과 추천 세션 길이 */
/* ---- 세션 기록 (이 브라우저에만 저장) ---- */
const HIST = 'focus-timer-history-v1';
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST) || '[]'); } catch { return []; } }
function saveHist(list) { try { localStorage.setItem(HIST, JSON.stringify(list.slice(-50))); } catch {} }
function addHist(r) {
  const list = loadHist();
  list.push({ at: S.endAt.getTime(), target: S.target, elapsed: S.elapsed, success: S.success,
    score: Math.round(r.score * 100), breakMin: r.breakMin, distractions: r.distractions, cam: r.hasCam });
  saveHist(list);
}
function renderHist() {
  const list = loadHist();
  $('#histCard').style.display = list.length ? '' : 'none';
  if (!list.length) return;
  const recent = list.slice(-10).reverse();
  const avg = Math.round(list.slice(-10).reduce((s, h) => s + h.score, 0) / Math.min(10, list.length));
  const done = list.filter(h => h.success).length;
  const breaks = list.slice(-10).map(h => h.breakMin).filter(b => b != null);
  let html = `최근 ${Math.min(10, list.length)}회 평균 집중도 <b>${avg}%</b> · 전체 ${list.length}회 중 ${done}회 달성`;
  if (breaks.length >= 2) {
    const rec = Math.max(10, Math.round(median(breaks) / 5) * 5);
    html += `<br>보통 <b>${median(breaks)}분</b> 무렵 집중이 떨어져요 → 추천 세션 <b>${rec}분</b>
      <button class="chip" id="useRec" style="margin-left:6px">${rec}분으로 설정</button>`;
    setTimeout(() => { const b = $('#useRec'); if (b) b.onclick = () => {
      cfg.h = Math.floor(rec / 60); cfg.m = rec % 60; cfg.s = 0; syncForm(); onCfg(); }; });
  }
  $('#histSummary').innerHTML = html;
  $('#histList').innerHTML = recent.map(h => {
    const d = new Date(h.at);
    return `<li><time>${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}</time>
      <span>${fmtDur(h.elapsed, true, h.target >= 3600000)} / ${fmtDur(h.target, true, h.target >= 3600000)}
      · ${h.success ? '달성' : '<span style="color:#ff6b6b">중단</span>'} · ${h.score}%
      ${h.breakMin != null ? `<span class="muted">· ${h.breakMin}분 저하</span>` : ''}</span></li>`;
  }).join('');
}
$('#histClear').onclick = () => { if (confirm('기록을 모두 지울까요?')) { saveHist([]); renderHist(); } };



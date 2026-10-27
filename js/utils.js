/* utils.js — 날짜·시간 포맷, 색 변환 등 공용 함수 */
/* ============================================================
   포맷 유틸
   ============================================================ */
const p2 = n => String(n).padStart(2, '0');
const WD = '일월화수목금토';
function fmtDur(ms, sec = true, forceH = false) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  if (!sec) return `${p2(h)}:${p2(m)}`;
  return (h || forceH) ? `${p2(h)}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
}
const clockStr = d => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const dateStr = d => `${d.getFullYear()}.${p2(d.getMonth()+1)}.${p2(d.getDate())} (${WD[d.getDay()]})`;
const stampStr = d => `${dateStr(d)} ${clockStr(d)}`;
const fileStamp = d => `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
const minLabel = ms => { const m = Math.floor(ms/60000), s = Math.floor(ms%60000/1000); return `${m}분 ${p2(s)}초`; };
function rgba(hex, a) {
  const h = hex.replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));



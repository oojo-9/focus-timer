/* config.js — 테마·글꼴·기본 설정, 설정 저장 */
/* ============================================================
   설정 / 저장
   ============================================================ */
const $ = s => document.querySelector(s);
const THEMES = {
  classic: { bg:'#000000', fg:'#ffffff', accent:'#ffffff', sub:'#777777' },
  paper:   { bg:'#f4f1ea', fg:'#1a1a1a', accent:'#c0392b', sub:'#8a8577' },
  neon:    { bg:'#05010f', fg:'#e0fbff', accent:'#00e5ff', sub:'#4d5b7c' },
  amber:   { bg:'#120a00', fg:'#ffb000', accent:'#ff7a00', sub:'#7a5200' },
  forest:  { bg:'#0d1f17', fg:'#e8f5e9', accent:'#66bb6a', sub:'#5f8270' },
  rose:    { bg:'#1a0b12', fg:'#ffe4ec', accent:'#ff6b9a', sub:'#7d5262' },
};
const FONTS = {
  mono: '"JetBrains Mono", ui-monospace, monospace',
  digital: 'Orbitron, "Noto Sans KR", sans-serif',
  sans: '"Noto Sans KR", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};
const DEFAULTS = { theme:'classic', ...THEMES.classic, font:'mono', style:'digital', countMode:'up',
  showSeconds:true, showClock:true, h:0, m:25, s:0,
  autoCapture:true, camera:false, focus:false, showPreview:true, vibrate:true, sound:false,
  lectureOn:false, lectureSrc:'youtube', ytUrl:'', lectureMatch:false };
const STORE = 'focus-timer-cfg-v1';
let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch {} };
const themeOf = c => ({ bg:c.bg, fg:c.fg, accent:c.accent, sub:c.sub });



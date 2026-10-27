/* clock.js — 시계 그리기 (화면 표시와 캡처가 같은 함수를 씀) */
/* ============================================================
   시계 그리기 (화면 표시와 캡처가 같은 함수를 씀)
   ============================================================ */
function drawClock(ctx, W, H, st) {
  const th = st.theme, F = FONTS[st.font] || FONTS.mono;
  const U = Math.min(W, H);
  const prog = st.target ? Math.min(1, st.elapsed / st.target) : 0;
  const over = Math.max(0, st.elapsed - st.target);   // "영상이 끝나면 끝내기"에서 목표를 넘긴 시간
  const shown = st.countMode === 'down' ? Math.max(0, st.target - st.elapsed) : st.elapsed;
  const forceH = Math.max(st.target, st.elapsed) >= 3600000;
  const main = (over >= 1000 && st.countMode === 'down' ? '+' + fmtDur(over, st.showSeconds) : fmtDur(shown, st.showSeconds, forceH));
  const now = new Date(st.now);

  ctx.save();
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fit = (text, weight, maxW, maxH) => {
    ctx.font = `${weight} ${maxH}px ${F}`;
    const w = ctx.measureText(text).width;
    const size = w > maxW ? maxH * maxW / w : maxH;
    ctx.font = `${weight} ${size}px ${F}`;
    return size;
  };
  const label = st.untilEnd
    ? `예상 ${fmtDur(st.target, true, forceH)} · ${over >= 1000 ? '+' + fmtDur(over) + ' 연장' : Math.floor(prog * 100) + '%'}`
    : `목표 ${fmtDur(st.target, true, forceH)} · ${Math.floor(prog * 100)}%`;

  if (st.showClock) {
    ctx.fillStyle = th.sub;
    ctx.font = `400 ${U * 0.05}px ${F}`;
    ctx.fillText(clockStr(now), W / 2, H * 0.09);
    ctx.font = `400 ${U * 0.03}px ${F}`;
    ctx.fillText(dateStr(now), W / 2, H * 0.09 + U * 0.055);
  }

  if (st.style === 'digital') {
    const cy = H * 0.5;
    const size = fit(main, 700, W * 0.88, Math.min(H * 0.34, W * 0.32));
    ctx.fillStyle = th.fg; ctx.fillText(main, W / 2, cy);
    const bw = W * 0.6, bh = Math.max(2, U * 0.008), by = cy + size * 0.62;
    ctx.fillStyle = rgba(th.sub, 0.35); ctx.fillRect(W / 2 - bw / 2, by, bw, bh);
    ctx.fillStyle = th.accent; ctx.fillRect(W / 2 - bw / 2, by, bw * prog, bh);
    ctx.fillStyle = th.sub; ctx.font = `400 ${U * 0.035}px ${F}`;
    ctx.fillText(label, W / 2, by + U * 0.07);
  } else if (st.style === 'ring') {
    const R = U * 0.33, cx = W / 2, cy = H * 0.54;
    ctx.lineWidth = U * 0.018; ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(th.sub, 0.3);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    if (prog > 0) {
      ctx.strokeStyle = th.accent;
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = th.fg; fit(main, 700, R * 1.5, R * 0.42);
    ctx.fillText(main, cx, cy);
    ctx.fillStyle = th.sub; ctx.font = `400 ${R * 0.1}px ${F}`;
    ctx.fillText(label, cx, cy + R * 0.38);
  } else { // analog
    const R = U * 0.31, cx = W / 2, cy = H * 0.55;
    ctx.strokeStyle = rgba(th.sub, 0.6);
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2 - Math.PI / 2, major = i % 5 === 0;
      ctx.lineWidth = major ? U * 0.006 : U * 0.002;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * (major ? 0.86 : 0.92), cy + Math.sin(a) * R * (major ? 0.86 : 0.92));
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.lineWidth = U * 0.012; ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(th.sub, 0.25);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.stroke();
    if (prog > 0) {
      ctx.strokeStyle = th.accent;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
    }
    const hand = (frac, len, w, color) => {
      const a = frac * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke();
    };
    const e = Math.max(0, shown);
    hand((e / 3600000 % 12) / 12, R * 0.5, U * 0.014, th.fg);
    hand((e / 60000 % 60) / 60, R * 0.78, U * 0.009, th.fg);
    if (st.showSeconds) hand((e / 1000 % 60) / 60, R * 0.88, U * 0.003, th.accent);
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(cx, cy, U * 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.fg; fit(main, 700, R * 0.9, R * 0.16);
    ctx.fillText(main, cx, cy + R * 0.42);
    ctx.fillStyle = th.sub; ctx.font = `400 ${U * 0.03}px ${F}`;
    ctx.fillText(label, cx, cy + R * 1.1 + U * 0.06 > H ? H - U * 0.03 : cy + R * 1.1 + U * 0.06);
  }
  ctx.restore();
}

function sizeCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
}



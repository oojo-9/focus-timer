/* report.js — 종료 처리, 완료 캡처, 결과 리포트 */
/* ============================================================
   종료 → 캡처 / 리포트 / 타임랩스
   ============================================================ */
async function finish(success) {
  if (!S || S.done) return;
  onReturn();
  S.done = true; S.success = success;
  S.endAt = new Date();
  S.elapsed = Math.min(S.target, S.endAt - S.start);
  clearInterval(S.tick); clearInterval(S.tlTimer); clearInterval(S.anTimer);
  closeRun(S.elapsed);

  // 캡처는 전체화면/상태를 바꾸기 전, 지금 화면 그대로
  const capBlob = await makeCapture();

  removeEventListener('beforeunload', onBeforeUnload);
  removeEventListener('popstate', onPopState);
  try { wakeLock?.release(); } catch {} wakeLock = null;
  try { navigator.keyboard?.unlock?.(); } catch {}
  $('#relock').classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  stopCamera();
  stopLecture();

  if (success) {
    if (cfg.vibrate) navigator.vibrate?.([200, 100, 200, 100, 400]);
    if (cfg.sound) beep();
  }

  const url = URL.createObjectURL(capBlob);
  const name = `focus_${fileStamp(S.endAt)}.png`;
  $('#captureImg').src = url;
  const dl = $('#capDownload'); dl.href = url; dl.download = name;
  $('#capShare').onclick = async () => {
    const file = new File([capBlob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: '집중 기록' }).catch(() => {});
    else dl.click();
  };
  if (success && cfg.autoCapture) dl.click();   // 자동 저장

  addHist(renderReport());
  document.body.className = 'result';
  scrollTo(0, 0);

  if (cfg.camera && S.frames.length) buildTimelapse();
}

async function makeCapture() {
  const cv = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, U = Math.min(W, H);
  const th = themeOf(cfg), F = FONTS[cfg.font];
  // 하단 띠: 완료 여부 + 정확한 시각 (시계는 띠 위 영역에 그림)
  const bh = U * 0.16;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  drawClock(ctx, W, H - bh, { ...cfgDisplay(), elapsed: S.elapsed, target: S.target, now: S.endAt.getTime() });
  ctx.fillStyle = rgba(th.fg, 0.08); ctx.fillRect(0, H - bh, W, bh);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = S.success ? th.accent : '#ff6b6b';
  ctx.font = `700 ${U * 0.04}px ${F}`;
  ctx.fillText(S.success ? '✓ 목표 달성' : `중단 (${fmtDur(S.elapsed)} / ${fmtDur(S.target)})`, W / 2, H - bh * 0.68);
  ctx.fillStyle = th.fg; ctx.font = `400 ${U * 0.034}px ${F}`;
  ctx.fillText(`${S.success ? '완료' : '중단'} 시각  ${stampStr(S.endAt)}`, W / 2, H - bh * 0.3);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.2);
      o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22);
    });
    setTimeout(() => ac.close(), 1200);
  } catch {}
}

/* ---- 리포트 ---- */
const LABEL = {
  away: '자리 비움 (얼굴이 안 보임)', look: '시선 이탈 (고개를 돌림)', down: '고개 숙임 (휴대폰 확인 의심)',
  eyes: '눈 감김 (졸음 의심)', left: '화면 이탈', fs: '전체화면 해제',
};
const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));

function computeBuckets() {
  const total = S.elapsed, n = Math.max(1, Math.ceil(total / 60000)), out = [];
  for (let i = 0; i < n; i++) {
    const a = i * 60000, b = Math.min((i + 1) * 60000, total), len = Math.max(1, b - a);
    let left = 0;
    for (const e of S.events) if (e.type === 'left') left += overlap(e.start, e.end, a, b);
    const sm = S.samples.filter(x => x.t >= a && x.t < b);
    const cam = sm.length ? sm.filter(x => x.s === 'focus').length / sm.length : null;
    const presence = Math.max(0, 1 - left / len);
    const eyes = sm.filter(x => x.eye != null);
    out.push({ i, len, ratio: cam == null ? presence : cam * presence,
      perclos: eyes.length ? eyes.filter(x => x.eye > 0.55).length / eyes.length : null });
  }
  return out;
}

function renderReport() {
  const hasCam = S.samples.length > 0;
  const B = computeBuckets();
  const score = B.reduce((s, b) => s + b.ratio * b.len, 0) / Math.max(1, B.reduce((s, b) => s + b.len, 0));
  const evs = S.events.filter(e => e.type !== 'fs' || true).sort((a, b) => a.start - b.start);

  // 이탈 구간을 합쳐서 '최장 연속 집중' 계산
  const iv = evs.map(e => [e.start, Math.max(e.end, e.start)]).sort((a, b) => a[0] - b[0]);
  let longest = 0, cur = 0;
  for (const [a, b] of iv) { longest = Math.max(longest, a - cur); cur = Math.max(cur, b); }
  longest = Math.max(longest, S.elapsed - cur);
  const lost = iv.reduce((s, [a, b]) => s + (b - a), 0);

  // 집중이 '무너지기 시작한' 시점: 3분 이동평균이 70% 아래로 처음 떨어진 분
  let breakMin = null;
  for (let i = 2; i < B.length; i++) {
    const avg = (B[i].ratio + B[i - 1].ratio + B[i - 2].ratio) / 3;
    if (avg < 0.7) { breakMin = i - 2; break; }
  }
  const drowsyMin = B.findIndex(b => b.perclos != null && b.perclos > 0.15);

  $('#resTitle').textContent = `${S.success ? '목표 달성' : '중단'} · ${stampStr(S.endAt)}${S.lecture ? ' · ' + S.lecture : ''}`;
  $('#resScore').textContent = Math.round(score * 100) + '%';
  $('#resScoreLabel').textContent = hasCam ? '집중도 (카메라 분석 + 화면 유지)' : '화면 유지율 (카메라 분석 없음)';

  const stat = (k, v) => `<div class="stat"><span class="muted">${k}</span><b>${v}</b></div>`;
  $('#resStats').innerHTML = [
    stat('진행 시간', fmtDur(S.elapsed, true, true)),
    stat('목표', fmtDur(S.target, true, true)),
    stat('최장 연속 집중', fmtDur(longest)),
    stat('이탈 횟수', evs.filter(e => e.type !== 'fs').length + '회'),
    stat('이탈 시간 합계', fmtDur(lost)),
    stat('첫 이탈', evs.length ? minLabel(evs[0].start) : '없음'),
  ].join('');

  const color = r => `hsl(${Math.round(r * 120)},70%,${45 + r * 10}%)`;
  $('#resTimeline').innerHTML = B.map(b =>
    `<div title="${b.i}분: ${Math.round(b.ratio * 100)}%" style="height:${Math.max(6, b.ratio * 100)}%;background:${color(b.ratio)}"></div>`).join('');
  const n = B.length;
  $('#resAxis').innerHTML = [...new Set([0, Math.round(n / 2), n])].map(m => `<span>${m}분</span>`).join('');

  let html = '';
  if (!evs.length && breakMin == null) {
    html = `끝까지 집중이 유지됐어요. 다음에는 <b>${Math.round(S.elapsed / 60000) + 10}분</b>으로 늘려봐도 좋겠어요.`;
  } else {
    if (breakMin != null) {
      const rec = Math.max(10, Math.round(breakMin / 5) * 5);
      html += `집중이 무너지기 시작한 건 <b>${breakMin}분 무렵</b>이에요 (3분 평균 집중도 70% 미만).<br>`;
      html += breakMin <= 30
        ? `연구에서 말하는 지속적 주의 저하 구간(시작 후 30분 이내)과 비슷한 패턴이에요. `
        : `일반적으로 저하가 관찰되는 30분보다 오래 버텼어요. `;
      html += `다음 세션은 <b>${rec}분 집중 + 5분 휴식</b>으로 나눠보는 걸 추천해요.<br>`;
    } else {
      html += `짧은 이탈은 있었지만 전체 흐름은 유지됐어요.<br>`;
    }
    if (drowsyMin >= 0) html += `<b>${drowsyMin}분</b>쯤부터 눈 감김 비율이 15%를 넘었어요 (졸음 신호, PERCLOS 기준).<br>`;
  }
  $('#resInsight').innerHTML = html;
  $('#resEvents').innerHTML = evs.map(e =>
    `<li><time>${minLabel(e.start)}</time><span>${LABEL[e.type]}${e.detail ? ' — ' + e.detail : ''}${e.end > e.start ? ` <span class="muted">(${Math.round((e.end - e.start) / 1000)}초)</span>` : ''}</span></li>`).join('');
  return { score, breakMin, distractions: evs.filter(e => e.type !== 'fs').length, hasCam };
}



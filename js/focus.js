/* focus.js — 집중도 분석 */
/* ---- 집중도 분석 (0.5초마다) ---- */
const TH = { away: 5000, look: 5000, down: 8000, eyes: 2000 };   // 이 시간 이상 지속되면 '이탈'로 기록
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function analyze() {
  if (!S || S.done || !landmarker || cam.readyState < 2 || document.hidden) return;
  const t = Date.now() - S.start;
  let r; try { r = landmarker.detectForVideo(cam, performance.now()); } catch { return; }
  let state = 'focus', eye = null;
  if (!r.faceLandmarks?.length) state = 'away';
  else {
    const L = r.faceLandmarks[0];
    const nose = L[1], lc = L[234], rc = L[454], top = L[10], chin = L[152];
    const yaw = (nose.x - lc.x) / ((rc.x - lc.x) || 1e-6);      // 0.5 근처 = 정면
    const pitch = (nose.y - top.y) / ((chin.y - top.y) || 1e-6);
    const cats = r.faceBlendshapes?.[0]?.categories || [];
    const g = n => cats.find(c => c.categoryName === n)?.score || 0;
    eye = (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2;
    // 처음 10초 동안 '바르게 앉은 자세'를 기준값으로 학습 (카메라 위치가 사람마다 다르므로)
    if (!S.base) {
      if (eye < 0.5) S.cal.push({ yaw, pitch });
      if (t > 10000 && S.cal.length >= 8) S.base = { yaw: median(S.cal.map(c => c.yaw)), pitch: median(S.cal.map(c => c.pitch)) };
    } else {
      const dy = yaw - S.base.yaw, dp = pitch - S.base.pitch;
      if (eye > 0.55) state = 'eyes';
      else if (Math.abs(dy) > 0.14) state = 'look';
      else if (dp > 0.07) state = 'down';
      else if (dp < -0.1) state = 'look';
    }
  }
  S.samples.push({ t, s: state, eye });
  if (!S.run || S.run.state !== state) { closeRun(t); S.run = { state, since: t }; }
}
function closeRun(t) {
  const r = S.run;
  if (r && TH[r.state] && t - r.since >= TH[r.state]) S.events.push({ type: r.state, start: r.since, end: t });
  S.run = null;
}



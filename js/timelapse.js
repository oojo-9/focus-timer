/* timelapse.js — 타임랩스 촬영과 영상 만들기 */
/* ---- 타임랩스 프레임 수집 ---- */
const tlCv = document.createElement('canvas');
function grabFrame() {
  if (!S || S.done || !cam.videoWidth || document.hidden) return;
  const w = 480, h = Math.round(480 * cam.videoHeight / cam.videoWidth / 2) * 2;
  tlCv.width = w; tlCv.height = h;
  const c = tlCv.getContext('2d');
  c.drawImage(cam, 0, 0, w, h);
  const el = Date.now() - S.start;
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, h - 28, w, 28);
  c.fillStyle = '#fff'; c.font = '600 15px "JetBrains Mono", monospace'; c.textBaseline = 'middle';
  c.textAlign = 'left'; c.fillText(fmtDur(el, true, S.target >= 3600000), 10, h - 14);
  c.textAlign = 'right'; c.fillText(clockStr(new Date()), w - 10, h - 14);
  tlCv.toBlob(b => b && S && S.frames.push(b), 'image/jpeg', 0.72);
}


/* ---- 타임랩스 인코딩: 모아둔 프레임을 30fps로 재생하며 녹화 ---- */
async function buildTimelapse() {
  $('#tlCard').style.display = '';
  $('#tlProgress').style.display = ''; $('#tlVideo').style.display = 'none'; $('#tlDownload').style.display = 'none';
  const frames = S.frames, endAt = S.endAt;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    $('#tlProgress').innerHTML = '<div class="muted">이 브라우저는 영상 만들기를 지원하지 않아요.</div>'; return;
  }
  const first = await createImageBitmap(frames[0]);
  const cv = document.createElement('canvas'); cv.width = first.width; cv.height = first.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(first, 0, 0);
  const vs = cv.captureStream(30);
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(vs, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  rec.start(500);
  for (let i = 0; i < frames.length; i++) {
    const bmp = i ? await createImageBitmap(frames[i]) : first;
    ctx.drawImage(bmp, 0, 0); bmp.close?.();
    $('#tlBar').style.width = ((i + 1) / frames.length * 100) + '%';
    await sleep(1000 / 30);
  }
  await sleep(400); rec.stop(); await stopped;
  vs.getTracks().forEach(t => t.stop());
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  const url = URL.createObjectURL(blob);
  const v = $('#tlVideo'); v.src = url; v.style.display = '';
  const a = $('#tlDownload'); a.href = url; a.download = `timelapse_${fileStamp(endAt)}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
  a.style.display = ''; $('#tlProgress').style.display = 'none';
}


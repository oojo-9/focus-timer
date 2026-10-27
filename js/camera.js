/* camera.js — 카메라와 얼굴 분석 모델 */
/* ============================================================
   카메라 / 얼굴 분석 모델
   ============================================================ */
const cam = $('#cam');
let stream = null, landmarker = null, landmarkerLoading = null;
const camStatus = msg => { $('#camStatus').textContent = msg; };

async function updateCamera() {
  const need = cfg.camera || cfg.focus;
  if (!need) { stopCamera(); camStatus(''); return; }
  if (!stream) {
    if (!navigator.mediaDevices?.getUserMedia) { camStatus('이 브라우저는 카메라를 지원하지 않아요 (HTTPS 필요).'); return; }
    try {
      camStatus('카메라 권한 요청 중…');
      // 오디오는 요청하지 않음 → 재생 중인 음악에 영향 없음
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      cam.srcObject = stream; await cam.play().catch(() => {});
      document.body.classList.add('camon');
    } catch (e) {
      camStatus('카메라를 켤 수 없어요: ' + (e.name === 'NotAllowedError' ? '권한 거부됨' : e.message));
      cfg.camera = cfg.focus = false; syncForm(); save(); return;
    }
  }
  if (cfg.focus && !landmarker) loadLandmarker();
  else camStatus('카메라 준비됨');
}
function stopCamera() {
  stream?.getTracks().forEach(t => t.stop()); stream = null; cam.srcObject = null;
  document.body.classList.remove('camon');
}
function loadLandmarker() {
  if (landmarkerLoading) return landmarkerLoading;
  camStatus('집중도 분석 모델 불러오는 중… (처음 한 번, 약 4MB)');
  const V = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  landmarkerLoading = (async () => {
    const vision = await import(V + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(V + '/wasm');
    const opts = delegate => ({
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
    try { landmarker = await vision.FaceLandmarker.createFromOptions(files, opts('GPU')); }
    catch { landmarker = await vision.FaceLandmarker.createFromOptions(files, opts('CPU')); }
    camStatus('카메라 + 집중도 분석 준비됨');
  })().catch(e => { landmarkerLoading = null; camStatus('분석 모델을 불러오지 못했어요 (인터넷 확인). 화면 이탈 기록만 합니다.'); });
  return landmarkerLoading;
}



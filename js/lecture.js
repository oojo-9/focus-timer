/* lecture.js — 강의 모드: 집중 화면 안에서 유튜브 / 내 영상 파일 틀기 */
/* ============================================================
   강의 모드
   ============================================================ */
// 고른 영상 파일은 새로고침하면 사라짐 (브라우저 보안상 파일 위치를 저장할 수 없음)
let lectureFiles = [], lectureIdx = 0;

const parseT = t => {
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
};
// watch?v= / youtu.be / shorts / live / embed / 재생목록 링크를 모두 받음
function parseYouTube(url) {
  let u; try { u = new URL((url || '').trim()); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]+)/); if (m) id = m[2]; }
  } else return null;
  if (id && !/^[\w-]{6,}$/.test(id)) id = null;
  const list = u.searchParams.get('list');
  if (!id && !list) return null;
  const t = u.searchParams.get('t') || u.searchParams.get('start');
  return { id, list, start: t ? parseT(t) : 0 };
}
function youTubeEmbed(y) {
  const p = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
  if (y.start) p.set('start', y.start);
  if (y.list) p.set('list', y.list);
  return `https://www.youtube.com/embed/${y.id || 'videoseries'}?${p}`;
}

function fileDuration(f) {
  return new Promise(res => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { res(isFinite(v.duration) ? v.duration : 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => { res(0); URL.revokeObjectURL(v.src); };
    v.src = URL.createObjectURL(f);
  });
}

/* ---- 유튜브 영상 길이: 보이지 않는 곳에 플레이어를 잠깐 만들어서 읽음 ---- */
let ytApi = null;
const ytLenCache = {};
function loadYTApi() {
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    if (window.YT?.Player) return res(window.YT);
    window.onYouTubeIframeAPIReady = () => res(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; rej(new Error('YouTube API')); };
    document.head.appendChild(s);
  });
  return ytApi;
}
async function youTubeLength(id) {
  if (ytLenCache[id]) return ytLenCache[id];
  const YT = await loadYTApi();
  return new Promise(res => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px';
    document.body.appendChild(host);
    let finished = false, p = null;
    const done = d => {
      if (finished) return; finished = true; clearTimeout(to);
      try { p?.destroy(); } catch {} host.remove();
      if (d > 0) ytLenCache[id] = d;
      res(d > 0 ? d : 0);
    };
    const to = setTimeout(() => done(0), 20000);
    p = new YT.Player(host, { videoId: id, width: 200, height: 120, playerVars: { autoplay: 0, mute: 1 },
      events: {
        onReady: e => {
          const pl = e.target; let n = 0, last = 0, same = 0;
          const poll = () => {
            if (finished) return;
            const d = pl.getDuration();
            if (n < 8 && d > 0) return done(d);   // 재생 전에 읽은 길이는 광고와 상관없음
            if (++n === 8) { pl.mute(); pl.playVideo(); }   // 일부 영상은 재생을 시작해야 길이가 나옴
            // 재생을 시작한 뒤에는 처음 광고 길이가 섞일 수 있어서, 본 영상이 재생 중이고 길이가 2초 동안 같을 때만 믿음
            if (n > 8 && d > 0 && pl.getPlayerState() === 1) {
              same = Math.abs(d - last) < 0.5 ? same + 1 : 0; last = d;
              if (same >= 8) return done(d);
            }
            if (n < 60) setTimeout(poll, 250); else done(0);
          };
          poll();
        },
        onError: () => done(0),
      } });
  });
}

let lectureLen = 0;   // 초 단위 강의 길이 (0 = 모름)
function applyLectureLen() {
  if (!cfg.lectureOn || !cfg.lectureMatch || !lectureLen) return false;
  const t = Math.ceil(lectureLen);
  cfg.h = Math.floor(t / 3600); cfg.m = Math.floor(t % 3600 / 60); cfg.s = t % 60;
  syncForm(); onCfg();
  return true;
}

/* ---- 시작 전 확인 ---- */
function lectureCheck() {
  if (!cfg.lectureOn) return { ok: true };
  if (cfg.lectureSrc === 'youtube') {
    return parseYouTube(cfg.ytUrl) ? { ok: true } : { ok: false, msg: '강의 모드: 유튜브 링크를 확인해 주세요.' };
  }
  return lectureFiles.length ? { ok: true } : { ok: false, msg: '강의 모드: 영상 파일을 골라 주세요.' };
}
function lectureLabel() {
  if (!cfg.lectureOn) return '';
  return cfg.lectureSrc === 'youtube' ? '유튜브 강의' : `영상 ${lectureFiles.length}개`;
}

/* ---- 설정 화면 ---- */
let uiToken = 0;   // 링크를 빠르게 바꿀 때 예전 결과가 덮어쓰지 않도록
async function updateLectureUI() {
  const token = ++uiToken;
  lectureLen = 0;
  $('#lectureOn').checked = !!cfg.lectureOn;
  $('#lectureMatch').checked = !!cfg.lectureMatch;
  $('#lectureEnd').checked = !!cfg.lectureEnd;
  document.querySelectorAll('input[name=lsrc]').forEach(r => r.checked = r.value === cfg.lectureSrc);
  $('#lectureOpts').style.display = cfg.lectureOn ? '' : 'none';
  $('#lsYoutube').style.display = cfg.lectureSrc === 'youtube' ? '' : 'none';
  $('#lsFile').style.display = cfg.lectureSrc === 'file' ? '' : 'none';
  if ($('#ytUrl').value !== cfg.ytUrl) $('#ytUrl').value = cfg.ytUrl || '';
  const st = $('#lectureStatus');
  if (cfg.lectureSrc === 'youtube') {
    const y = parseYouTube(cfg.ytUrl);
    let msg = !cfg.ytUrl ? '유튜브 영상이나 재생목록 링크를 붙여넣으세요.'
      : !y ? '<span style="color:#ff6b6b">유튜브 링크가 아닌 것 같아요.</span>'
      : `✓ ${y.id ? '영상' : '재생목록'} 확인됨${y.list && y.id ? ' (재생목록 이어서 재생)' : ''}${y.start ? ` · ${fmtDur(y.start * 1000)}부터` : ''}`;
    if (location.protocol === 'file:')
      msg += '<br><span style="color:#ffb000">파일을 더블클릭해서 열면 유튜브가 재생되지 않을 수 있어요. 테스트 서버(localhost)로 열어주세요.</span>';
    st.innerHTML = msg;
    if (!y || !cfg.lectureOn) return;
    if (!y.id) {   // 재생목록 링크만 있는 경우
      if (cfg.lectureMatch) st.insertAdjacentHTML('beforeend', '<br>재생목록은 전체 길이를 알 수 없어서 목표 시간을 직접 정해 주세요.');
      return;
    }
    st.insertAdjacentHTML('beforeend', ' · <span id="ytLen">길이 확인 중…</span>');
    let d = 0; try { d = await youTubeLength(y.id); } catch {}
    if (token !== uiToken) return;
    const span = $('#ytLen');
    if (!d) { if (span) span.textContent = '길이를 못 읽었어요 (목표 시간을 직접 정해 주세요)'; return; }
    lectureLen = Math.max(0, d - y.start);
    if (span) span.textContent = `길이 ${fmtDur(Math.ceil(lectureLen) * 1000, true, lectureLen >= 3600)}${y.start ? ' (시작 위치부터)' : ''}`;
    if (y.list) st.insertAdjacentHTML('beforeend', '<br>재생목록은 첫 영상 길이만 맞춰져요.');
    showLenResult(st);
  } else {
    if (!lectureFiles.length) { st.textContent = '강의 영상 파일을 고르세요. 여러 개 고르면 순서대로 이어서 재생돼요.'; return; }
    st.textContent = `${lectureFiles.length}개 파일 · 길이 확인 중…`;
    const total = (await Promise.all(lectureFiles.map(fileDuration))).reduce((a, b) => a + b, 0);
    if (token !== uiToken) return;
    lectureLen = total;
    st.innerHTML = `✓ ${lectureFiles.length}개 파일 · 총 ${fmtDur(Math.ceil(total) * 1000, true, total >= 3600)}`;
    if (total) showLenResult(st);
  }
}
// 자동 맞추기가 켜져 있으면 바로 적용, 꺼져 있으면 한 번만 적용하는 버튼을 보여줌
function showLenResult(st) {
  if (applyLectureLen()) {
    st.insertAdjacentHTML('beforeend', `<br><b style="color:#7ee2a8">→ 목표 시간을 ${fmtDur(Math.ceil(lectureLen) * 1000, true, true)}로 맞췄어요</b>`);
  } else {
    st.insertAdjacentHTML('beforeend', ` <button class="chip" id="useLecLen" style="margin-left:6px">이 길이로 목표 설정</button>`);
    $('#useLecLen').onclick = () => {
      const t = Math.ceil(lectureLen);
      cfg.h = Math.floor(t / 3600); cfg.m = Math.floor(t % 3600 / 60); cfg.s = t % 60; syncForm(); onCfg();
    };
  }
}
$('#lectureOn').addEventListener('change', e => { cfg.lectureOn = e.target.checked; save(); updateLectureUI(); });
document.querySelectorAll('input[name=lsrc]').forEach(r =>
  r.addEventListener('change', () => { cfg.lectureSrc = r.value; save(); updateLectureUI(); }));
$('#ytUrl').addEventListener('input', e => { cfg.ytUrl = e.target.value.trim(); save(); updateLectureUI(); });
$('#lectureMatch').addEventListener('change', e => { cfg.lectureMatch = e.target.checked; save(); updateLectureUI(); });
$('#lectureEnd').addEventListener('change', e => { cfg.lectureEnd = e.target.checked; save(); });
$('#lecFile').addEventListener('change', e => { lectureFiles = [...e.target.files]; updateLectureUI(); });

/* ---- 진행 화면 ---- */
let lectureUrl = null, ytPlayer = null, lectureToken = 0;
// "영상이 끝나면 타이머도 끝내기": 마지막 영상이 끝나면 세션을 완료로 끝냄
function onLectureEnded() {
  if (S && !S.done && S.untilEnd) { toast('강의가 끝났어요'); finish(true); }
}
// 영상 끝을 알 수 없게 되면 목표 시간 기준으로 되돌림
function lectureEndUnavailable(msg) {
  if (!S || S.done || !S.untilEnd) return;
  S.untilEnd = false;
  if (Date.now() - S.start >= S.target) finish(true);
  else toast(msg + ' → 목표 시간에 끝나요');
}
function startLecture() {
  const box = $('#lecture'); box.innerHTML = '';
  const token = ++lectureToken;
  if (!cfg.lectureOn) return;
  if (cfg.lectureSrc === 'youtube') {
    const y = parseYouTube(cfg.ytUrl);
    // 플레이어 API로 재생해야 영상이 끝난 걸 알 수 있음. API를 못 불러오면 그냥 영상만 띄움
    const fallback = () => {
      if (token !== lectureToken || box.querySelector('iframe')) return;
      const f = document.createElement('iframe');
      f.src = youTubeEmbed(y);
      f.allow = 'autoplay; encrypted-media; picture-in-picture';   // 영상 자체 전체화면은 막음 (집중 화면 잠금 유지)
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.appendChild(f);
      lectureEndUnavailable('영상 끝을 확인할 수 없어요');
    };
    const to = setTimeout(fallback, 8000);
    loadYTApi().then(YT => {
      if (token !== lectureToken || box.querySelector('iframe')) return;
      clearTimeout(to);
      const host = document.createElement('div'); box.appendChild(host);
      const vars = { autoplay: 1, rel: 0, playsinline: 1, fs: 0, origin: location.origin };   // fs:0 = 영상 자체 전체화면 버튼 숨김
      if (y.start) vars.start = y.start;
      if (y.list) { vars.list = y.list; vars.listType = 'playlist'; }
      ytPlayer = new YT.Player(host, { ...(y.id ? { videoId: y.id } : {}), playerVars: vars,
        events: {
          onReady: e => e.target.playVideo(),
          onStateChange: e => {
            if (e.data !== YT.PlayerState.ENDED) return;
            const list = e.target.getPlaylist?.();
            // 재생목록이면 마지막 영상이 끝났을 때만
            if (!list || !list.length || e.target.getPlaylistIndex() >= list.length - 1) onLectureEnded();
          },
          onError: () => lectureEndUnavailable('유튜브 영상을 재생할 수 없어요'),
        } });
    }).catch(fallback);
  } else {
    lectureIdx = 0;
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('controlsList', 'nofullscreen nodownload');
    v.onended = () => { if (lectureIdx < lectureFiles.length - 1) { lectureIdx++; playLectureFile(v); } else onLectureEnded(); };
    box.appendChild(v);
    playLectureFile(v);
  }
}
function playLectureFile(v) {
  if (lectureUrl) URL.revokeObjectURL(lectureUrl);
  lectureUrl = URL.createObjectURL(lectureFiles[lectureIdx]);
  v.src = lectureUrl; v.play().catch(() => {});
  v.title = lectureFiles[lectureIdx].name;
  if (lectureFiles.length > 1) toast(`강의 ${lectureIdx + 1}/${lectureFiles.length} · ${lectureFiles[lectureIdx].name}`);
}
function stopLecture() {
  const box = $('#lecture');
  lectureToken++;
  try { ytPlayer?.destroy(); } catch {} ytPlayer = null;
  box.querySelector('video')?.pause();
  box.innerHTML = '';   // iframe을 없애야 유튜브 재생도 멈춤
  if (lectureUrl) { URL.revokeObjectURL(lectureUrl); lectureUrl = null; }
}

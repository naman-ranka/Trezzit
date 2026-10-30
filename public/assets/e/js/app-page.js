/* app page: real app recordings (D's tour), lazy, muted, playing only while on screen, always pausable. */
import { initPage } from './page.js';
import { icon, reduced } from './util.js';

initPage();
document.querySelectorAll('video[data-src]').forEach((v) => {
  const btn = v.closest('.tour-stage')?.querySelector('[data-media-btn]');
  let userPaused = reduced();
  // H.264 where the browser has it, VP9 WebM where it doesn't; the poster stays if neither loads
  const h264 = v.canPlayType('video/mp4; codecs="avc1.42E01E"');
  // a clip with a start point opens there (media fragment), so its dimmed opening frames never flash
  const frag = v.dataset.start ? `#t=${v.dataset.start}` : '';
  const load = () => { if (!v.src) v.src = (!h264 && v.dataset.webm ? v.dataset.webm : v.dataset.src) + frag; };
  // a clip with a start point loops from there (its first seconds sit behind a dimmed sheet)
  if (v.dataset.start) {
    const start = Number(v.dataset.start);
    v.loop = false;
    v.addEventListener('loadedmetadata', () => { v.currentTime = start; }, { once: true });
    v.addEventListener('ended', () => { v.currentTime = start; v.play().catch(() => {}); });
  }
  v.addEventListener('error', () => { if (v.dataset.webm && !v.src.includes('.webm')) { v.src = v.dataset.webm + frag; v.play().catch(() => {}); } });
  const sync = () => {
    const playing = !v.paused;
    if (!btn) return;
    btn.innerHTML = playing ? icon.pause : icon.play;
    btn.setAttribute('aria-label', playing ? 'Pause recording' : 'Play recording');
  };
  const tryPlay = () => { load(); v.play().catch(() => {}); };
  v.addEventListener('play', sync); v.addEventListener('pause', sync);
  btn?.addEventListener('click', () => { if (v.paused) { userPaused = false; tryPlay(); } else { userPaused = true; v.pause(); } });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const visible = e.isIntersecting && e.intersectionRatio > 0.4;
      if (visible && !userPaused) tryPlay();
      else if (!visible && !v.paused) v.pause();
    }, { threshold: [0, 0.4, 1] }).observe(v);
  }
  sync();
});

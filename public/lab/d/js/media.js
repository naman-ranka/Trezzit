// Real app recordings: lazy, muted, play only while visible, always pausable.
import { $$, icon, reducedMotion } from './ui.js';

export function initMedia(root = document) {
  $$('video[data-src]', root).forEach((v) => {
    const btn = (v.closest('.stage') || v.parentElement).querySelector('[data-media-btn]');
    let userPaused = reducedMotion();
    let visible = false;
    // H.264 where the browser has it, VP9 WebM where it doesn't; the poster stays if neither loads.
    const h264 = v.canPlayType('video/mp4; codecs="avc1.42E01E"');
    const load = () => { if (!v.src) v.src = !h264 && v.dataset.webm ? v.dataset.webm : v.dataset.src; };
    v.addEventListener('error', () => { if (v.dataset.webm && !v.src.endsWith('.webm')) { v.src = v.dataset.webm; v.play().catch(() => {}); } });
    const sync = () => {
      const playing = !v.paused;
      if (btn) {
        btn.innerHTML = icon(playing ? 'pause' : 'play');
        btn.setAttribute('aria-label', playing ? 'Pause recording' : 'Play recording');
      }
    };
    const tryPlay = () => { load(); v.play().catch(() => {}); };
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    btn?.addEventListener('click', () => {
      if (v.paused) { userPaused = false; tryPlay(); } else { userPaused = true; v.pause(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting && e.intersectionRatio > 0.4;
        if (visible && !userPaused) tryPlay();
        else if (!visible && !v.paused) v.pause();
      }, { threshold: [0, 0.4, 1] }).observe(v);
    }
    sync();
  });
}

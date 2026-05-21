const supportsViewTimeline = CSS.supports('animation-timeline: view()');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!supportsViewTimeline && !reducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  );

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else if (reducedMotion) {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('in-view'));
}

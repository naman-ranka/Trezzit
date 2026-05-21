const reveal = () => {
  const targets = document.querySelectorAll<HTMLElement>("[data-animate='fade-up']:not(.is-visible)");

  if (!('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((target) => observer.observe(target));
};

reveal();
document.addEventListener('astro:page-load', reveal);

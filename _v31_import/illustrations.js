(() => {
  'use strict';

  const assets = [
    { id: 'loveIllustration', src: 'assets/optimist-love.webp' },
    { id: 'closenessIllustration', src: 'assets/closeness.webp' }
  ];

  function hydrateImage(asset) {
    const image = document.getElementById(asset.id);
    if (!image) return;

    image.addEventListener('load', () => {
      image.dataset.loaded = 'true';
      image.dataset.source = asset.src;
    }, { once: true });

    image.addEventListener('error', () => {
      image.hidden = true;
      image.closest('.footer-love-card__art, .closeness-showcase__art')
        ?.classList.add('illustration-unavailable');
      console.warn('[Vampire Dominion] Иллюстрация не загружена:', asset.id, asset.src);
    }, { once: true });

    image.src = asset.src;
  }

  function loadIllustrations() {
    assets.forEach(hydrateImage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIllustrations, { once: true });
  } else {
    loadIllustrations();
  }
})();

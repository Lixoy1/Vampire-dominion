(() => {
  'use strict';

  const assets = [
    {
      id: 'loveIllustration',
      parts: [
        'assets/dominion-love-small-00.b64',
        'assets/dominion-love-small-02.b64',
        'assets/dominion-love-small-03.b64',
        'assets/dominion-love-small-04.b64'
      ]
    },
    {
      id: 'closenessIllustration',
      parts: [
        'assets/dominion-closeness-small-01.b64',
        'assets/dominion-closeness-small-02.b64',
        'assets/dominion-closeness-small-03.b64',
        'assets/dominion-closeness-small-04.b64'
      ]
    }
  ];

  async function hydrateImage(asset) {
    const image = document.getElementById(asset.id);
    if (!image) return;

    try {
      const pieces = await Promise.all(asset.parts.map(async (path) => {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) throw new Error('Не удалось загрузить часть иллюстрации: ' + path);
        return (await response.text()).trim();
      }));
      const encoded = pieces.join('');
      if (!encoded.startsWith('UklGR')) throw new Error('Неверный заголовок WebP: ' + asset.id);

      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/webp' });
      const objectUrl = URL.createObjectURL(blob);

      image.addEventListener('load', () => {
        image.dataset.loaded = 'true';
        URL.revokeObjectURL(objectUrl);
      }, { once: true });
      image.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        image.hidden = true;
        image.closest('.footer-love-card__art, .closeness-showcase__art')?.classList.add('illustration-unavailable');
      }, { once: true });
      image.src = objectUrl;
    } catch (error) {
      image.hidden = true;
      image.closest('.footer-love-card__art, .closeness-showcase__art')?.classList.add('illustration-unavailable');
      console.warn('[Vampire Dominion] Иллюстрация не загружена:', asset.id, error);
    }
  }

  function loadIllustrations() {
    assets.forEach((asset) => { void hydrateImage(asset); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIllustrations, { once: true });
  } else {
    loadIllustrations();
  }
})();

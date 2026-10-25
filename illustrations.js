(() => {
  'use strict';

  const assets = [
    { id: 'loveIllustration', path: 'assets/optimist-love-160.webp.b64' },
    { id: 'closenessIllustration', path: 'assets/closeness-160.webp.b64' }
  ];

  async function hydrateImage(asset) {
    const image = document.getElementById(asset.id);
    if (!image) return;

    let objectUrl = null;
    try {
      const response = await fetch(asset.path, { cache: 'force-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const encoded = (await response.text()).trim().replace(/\\s+/g, '');
      if (!encoded.startsWith('UklGR') || encoded.length % 4 === 1) {
        throw new Error('Некорректный Base64 WebP: ' + asset.id);
      }

      const binary = window.atob(encoded);
      if (binary.length < 12 ||
          binary.slice(0, 4) !== 'RIFF' ||
          binary.slice(8, 12) !== 'WEBP') {
        throw new Error('Повреждённый заголовок WebP: ' + asset.id);
      }
      const riffSize = binary.charCodeAt(4) |
        (binary.charCodeAt(5) << 8) |
        (binary.charCodeAt(6) << 16) |
        (binary.charCodeAt(7) << 24);
      if (riffSize !== binary.length - 8) {
        throw new Error('Неполные данные WebP: ' + asset.id);
      }

      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));

      image.addEventListener('load', () => {
        image.dataset.loaded = 'true';
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, { once: true });
      image.addEventListener('error', () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        image.hidden = true;
        image.closest('.footer-love-card__art, .closeness-showcase__art')
          ?.classList.add('illustration-unavailable');
      }, { once: true });
      image.src = objectUrl;
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      image.hidden = true;
      image.closest('.footer-love-card__art, .closeness-showcase__art')
        ?.classList.add('illustration-unavailable');
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

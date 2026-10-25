(() => {
  'use strict';

  const assets = [
    {
      id: 'loveIllustration',
      parts: [
        'assets/love-hq-00.b64',
        'assets/love-hq-01.b64',
        'assets/love-hq-02.b64',
        'assets/love-hq-03.b64',
        'assets/love-hq-04.b64',
        'assets/love-hq-05.b64'
      ]
    },
    {
      id: 'closenessIllustration',
      parts: [
        'assets/closeness-hq-00.b64',
        'assets/closeness-hq-01.b64',
        'assets/closeness-hq-02.b64',
        'assets/closeness-hq-03.b64',
        'assets/closeness-hq-04.b64'
      ]
    }
  ];

  async function hydrateImage(asset) {
    const image = document.getElementById(asset.id);
    if (!image) return;

    let objectUrl = null;
    try {
      const chunks = await Promise.all(asset.parts.map(async (path) => {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + path);
        return (await response.text()).trim();
      }));
      const encoded = chunks.join('').replace(/\s+/g, '');
      if (!encoded.startsWith('UklGR') || encoded.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw new Error('Некорректная Base64-последовательность: ' + asset.id);
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

import { settings } from './state.js';

/**
 * Svelte action: autoscroll(node)
 * Smoothly scrolls overflowing text on hover, or continuously when $settings.autoscrollLongLabels is enabled.
 * If text fits inside container, remains static with zero overhead.
 */
export function autoscroll(node) {
  let isHovered = false;
  let autoSetting = false;
  let animId = null;
  let scrollPos = 0;
  let direction = 1; // 1 = forward, -1 = reverse
  let pauseUntil = 0;
  const speed = 28; // pixels per second

  const unsub = settings.subscribe((s) => {
    autoSetting = Boolean(s.autoscrollLongLabels);
    checkState();
  });

  function checkOverflow() {
    if (!node) return false;
    return node.scrollWidth > node.clientWidth + 1;
  }

  function start() {
    if (animId) return;
    let lastTime = performance.now();
    pauseUntil = lastTime + 350; // brief 350ms pause before initial scroll

    function step(now) {
      if (!isHovered && !autoSetting) {
        node.scrollLeft = 0;
        node.style.textOverflow = '';
        animId = null;
        scrollPos = 0;
        direction = 1;
        pauseUntil = 0;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (now < pauseUntil) {
        animId = requestAnimationFrame(step);
        return;
      }

      const maxScroll = node.scrollWidth - node.clientWidth;
      if (maxScroll <= 0) {
        node.scrollLeft = 0;
        node.style.textOverflow = '';
        animId = null;
        return;
      }

      node.style.textOverflow = 'clip';
      scrollPos += direction * speed * dt;

      if (direction === 1 && scrollPos >= maxScroll) {
        scrollPos = maxScroll;
        node.scrollLeft = maxScroll;
        direction = -1;
        pauseUntil = now + 1200; // pause at end
      } else if (direction === -1 && scrollPos <= 0) {
        scrollPos = 0;
        node.scrollLeft = 0;
        node.style.textOverflow = '';
        direction = 1;
        pauseUntil = now + 1200; // pause at start
      } else {
        node.scrollLeft = scrollPos;
      }

      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);
  }

  function stop() {
    if (!autoSetting) {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (node) {
        node.scrollLeft = 0;
        node.style.textOverflow = '';
      }
      scrollPos = 0;
      direction = 1;
      pauseUntil = 0;
    }
  }

  function checkState() {
    if (!isHovered && !autoSetting) {
      stop();
      return;
    }
    if (!checkOverflow()) {
      stop();
      return;
    }
    start();
  }

  function onMouseEnter() {
    isHovered = true;
    checkState();
  }

  function onMouseLeave() {
    isHovered = false;
    checkState();
  }

  node.addEventListener('mouseenter', onMouseEnter);
  node.addEventListener('mouseleave', onMouseLeave);

  // Initial check on mount
  const timer = setTimeout(checkState, 150);

  return {
    update() {
      setTimeout(checkState, 60);
    },
    destroy() {
      clearTimeout(timer);
      unsub();
      node.removeEventListener('mouseenter', onMouseEnter);
      node.removeEventListener('mouseleave', onMouseLeave);
      if (animId) cancelAnimationFrame(animId);
    },
  };
}

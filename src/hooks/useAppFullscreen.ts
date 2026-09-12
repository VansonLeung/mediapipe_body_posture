import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export const popupContainer = () =>
  (document.fullscreenElement as HTMLElement | null) ?? document.body;

export function useAppFullscreen(root: RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let mounted = true;
    const update = () =>
      setFullscreen(
        document.fullscreenElement === root.current ||
          document.documentElement.classList.contains('desktop-fullscreen'),
      );
    const nativeUpdate = (value: boolean) => {
      if (!mounted) return;
      document.documentElement.classList.toggle('desktop-fullscreen', value);
      update();
    };
    document.addEventListener('fullscreenchange', update);
    const unsubscribe = window.desktop?.onFullscreenChange(nativeUpdate);
    void window.desktop?.isFullscreen().then(nativeUpdate);
    update();
    return () => {
      mounted = false;
      document.removeEventListener('fullscreenchange', update);
      unsubscribe?.();
    };
  }, [root]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (window.desktop) await window.desktop.toggleFullscreen();
    else await root.current?.requestFullscreen();
  }
  return { fullscreen, toggleFullscreen };
}

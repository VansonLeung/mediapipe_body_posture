import { useCallback, useLayoutEffect, useRef } from 'react';
import { popupContainer } from './useAppFullscreen';

// Keep custom menus outside the studio's clipped/scrolling layout. Fullscreen
// popups must also live inside the fullscreen element to remain visible.
export function useDropdownLayer() {
  const layer = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = document.createElement('div');
    element.className = 'studio-dropdown-layer';
    layer.current = element;
    const attach = () => popupContainer().appendChild(element);
    attach();
    document.addEventListener('fullscreenchange', attach);
    return () => {
      document.removeEventListener('fullscreenchange', attach);
      element.remove();
      layer.current = null;
    };
  }, []);
  return useCallback(() => layer.current ?? popupContainer(), []);
}

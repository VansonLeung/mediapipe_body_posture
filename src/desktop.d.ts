export {};

declare global {
  interface Window {
    desktop?: {
      isFullscreen: () => Promise<boolean>;
      toggleFullscreen: () => Promise<void>;
      onFullscreenChange: (
        listener: (fullscreen: boolean) => void,
      ) => () => void;
    };
  }
}

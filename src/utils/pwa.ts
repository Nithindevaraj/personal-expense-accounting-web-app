// PWA utilities and hook for Web App installation and Service Worker management

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __pwa_prompt?: BeforeInstallPromptEvent | null;
  }
}

// Extend BeforeInstallPromptEvent interface
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function syncPrompt(e?: BeforeInstallPromptEvent | null) {
  if (e) {
    deferredPrompt = e;
  } else if (typeof window !== 'undefined' && window.__pwa_prompt) {
    deferredPrompt = window.__pwa_prompt;
  }
  promptListeners.forEach((listener) => listener());
}

// Register Service Worker
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers are not supported in this browser.');
    return;
  }

  // File protocol check: Service workers require HTTP/HTTPS origin
  if (window.location.protocol === 'file:') {
    console.warn('[PWA] Opened via file:// URL. Service Workers require http://localhost:5173 or https://.');
    return;
  }

  const doRegister = () => {
    const swUrl = './sw.js';
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('[PWA] ServiceWorker registered successfully with scope:', registration.scope);
        // Periodic update check
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[PWA] New content is available; please refresh.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] ServiceWorker registration failed: ', error);
      });
  };

  // If page is already loaded/interactive, register immediately
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }
}

// Global listener for beforeinstallprompt
if (typeof window !== 'undefined') {
  // Sync if prompt was already captured by inline head script
  if (window.__pwa_prompt) {
    deferredPrompt = window.__pwa_prompt;
  }

  window.addEventListener('pwa-prompt-ready', () => {
    syncPrompt(window.__pwa_prompt);
  });

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.__pwa_prompt = deferredPrompt;
    syncPrompt(deferredPrompt);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (typeof window !== 'undefined') {
      window.__pwa_prompt = null;
    }
    syncPrompt(null);
  });
}

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState<boolean>(() => {
    return !!(deferredPrompt || (typeof window !== 'undefined' && window.__pwa_prompt));
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return isStandalone || isIOSStandalone;
  });

  const [isFileProtocol] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
  });

  const [isIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream
    );
  });

  useEffect(() => {
    const updateState = () => {
      const prompt = deferredPrompt || window.__pwa_prompt;
      setIsInstallable(!!prompt);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    promptListeners.add(updateState);
    window.addEventListener('appinstalled', updateState);
    window.addEventListener('pwa-prompt-ready', updateState);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => updateState();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      promptListeners.delete(updateState);
      window.removeEventListener('appinstalled', updateState);
      window.removeEventListener('pwa-prompt-ready', updateState);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window.__pwa_prompt : null);
    if (!activePrompt) {
      return 'unsupported';
    }

    try {
      await activePrompt.prompt();
      const choiceResult = await activePrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        if (typeof window !== 'undefined') {
          window.__pwa_prompt = null;
        }
        setIsInstallable(false);
      }
      return choiceResult.outcome;
    } catch (err) {
      console.error('[PWA] Error during promptInstall:', err);
      return 'unsupported';
    }
  };

  return {
    isInstallable,
    isInstalled,
    isFileProtocol,
    isIOS,
    promptInstall,
  };
}

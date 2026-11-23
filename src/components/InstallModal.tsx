import React, { useState } from 'react';
import {
  X,
  Download,
  Share,
  PlusSquare,
  Sparkles,
  CheckCircle2,
  Smartphone,
  Laptop,
  WifiOff,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { usePWAInstall } from '../utils/pwa';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isFileProtocol, isIOS, promptInstall } = usePWAInstall();
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setTriggerStatus('Requesting browser install dialog...');
    const result = await promptInstall();
    if (result === 'accepted') {
      onClose();
    } else if (result === 'unsupported') {
      setTriggerStatus('Browser has not triggered the automatic prompt yet. Follow the manual 1-click browser menu steps below.');
    } else {
      setTriggerStatus('Install prompt was dismissed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white shadow-lg flex items-center justify-center p-2.5">
            <img src="./favicon.svg" alt="App Icon" className="w-full h-full object-contain" />
          </div>

          <h2 className="text-xl font-bold tracking-tight">Install as Web App</h2>
          <p className="text-emerald-100 text-xs mt-1 max-w-xs mx-auto">
            Install on your phone, tablet, or PC for instant offline access and standalone window execution.
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* File Protocol Warning */}
          {isFileProtocol && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Opened via file:// protocol</p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Web browsers strictly prohibit PWA installation and Service Workers from local <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">file:///</code> URLs.
                </p>
                <p className="text-amber-800 text-[11px] font-semibold pt-1">
                  Fix: Open the app via local server: <code className="bg-amber-200/80 px-1.5 py-0.5 rounded font-mono text-amber-950">http://localhost:5173</code>
                </p>
              </div>
            </div>
          )}

          {/* Key Benefits */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <WifiOff className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">100% Offline</h4>
                <p className="text-[11px] text-slate-500">Record entries with zero network</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Instant Launch</h4>
                <p className="text-[11px] text-slate-500">Zero loading delay from home screen</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Home Screen Icon</h4>
                <p className="text-[11px] text-slate-500">Opens in full standalone window</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <Laptop className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Desktop & Mobile</h4>
                <p className="text-[11px] text-slate-500">Chrome, Edge, Safari & Android</p>
              </div>
            </div>
          </div>

          {/* Current State / Actions */}
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                App is already installed!
              </div>
              <p className="text-emerald-700 text-xs mt-1">
                You are currently running the installed standalone web app.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                {isInstallable ? 'Install Web App Now' : 'Trigger Install Prompt'}
              </button>

              {triggerStatus && (
                <p className="text-center text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  {triggerStatus}
                </p>
              )}

              {/* iOS Safari Instructions */}
              {isIOS ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>How to Install on iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                    <li className="leading-relaxed">
                      Tap the <strong className="text-slate-800">Share button</strong> (
                      <Share className="w-3.5 h-3.5 inline text-blue-600 -mt-0.5" />) in the Safari toolbar.
                    </li>
                    <li className="leading-relaxed">
                      Scroll down and tap{' '}
                      <strong className="text-slate-800">"Add to Home Screen"</strong> (
                      <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 -mt-0.5" />).
                    </li>
                    <li className="leading-relaxed">
                      Tap <strong className="text-slate-800">"Add"</strong> in the top-right corner.
                    </li>
                  </ol>
                </div>
              ) : (
                /* Desktop & Android Instructions */
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2.5">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Manual 1-Click Install Steps (if prompt does not open)</span>
                  </div>

                  <div className="space-y-2 text-[11px] leading-relaxed">
                    <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                      <strong className="text-slate-900 block font-semibold mb-0.5">
                        💻 Google Chrome / Microsoft Edge (Desktop):
                      </strong>
                      <span>
                        Look at the <strong className="text-slate-900">right side of your browser URL bar</strong> (near the bookmark star ★). Click the <strong className="text-emerald-700">Install icon</strong> (computer monitor with downward arrow 📥 or ⊕).
                      </span>
                      <span className="block mt-1 text-slate-500">
                        Or click the 3 dots (<strong className="text-slate-900">⋮</strong>) at top-right → select <strong className="text-slate-900">"Install Personal Accounting..."</strong> or <strong className="text-slate-900">"Save and share" → "Install page as app"</strong>.
                      </span>
                    </div>

                    <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                      <strong className="text-slate-900 block font-semibold mb-0.5">
                        📱 Android (Chrome / Edge):
                      </strong>
                      <span>
                        Tap the 3 dots (<strong className="text-slate-900">⋮</strong>) in the top-right corner → tap <strong className="text-slate-900">"Install app"</strong> or <strong className="text-slate-900">"Add to Home screen"</strong>.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Wallet, ShieldCheck, Database, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { signInWithGoogle, isConfigured, setOfflineDemoMode } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background glowing decorations */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand / Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/30 mb-4 ring-4 ring-white/10">
            <Wallet className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Personal Accounting
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Secure, user-isolated expense management powered by PostgreSQL & Supabase
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Sign in to your private vault
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every user gets a completely isolated database partition protected by PostgreSQL Row-Level Security.
            </p>
          </div>

          {/* 1-Click Google Sign-in Button */}
          <div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] cursor-pointer group border border-slate-200"
            >
              {/* Official Google 'G' SVG Logo */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-auto" />
            </button>
          </div>

          {/* Configuration status indicator */}
          {!isConfigured && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Supabase keys pending in .env.local</p>
                <p className="mt-0.5 text-amber-200/80">
                  Add your <code className="bg-amber-950/50 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and anon key to enable live Google authentication.
                </p>
              </div>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="space-y-2.5 pt-2 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Row-Level Security: Only your Google account can read your records.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-teal-400 shrink-0" />
              <span>PostgreSQL performance: Instant calculations and monthly ledgers.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Zero-tracking, zero-ad privacy guarantee.</span>
            </div>
          </div>

          {/* Fallback Demo / Offline Access */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setOfflineDemoMode(true)}
              className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              Or explore with Offline Demo Mode (local storage)
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Personal Accounting Engine &bull; Protected by PostgreSQL RLS
        </p>
      </div>
    </div>
  );
};

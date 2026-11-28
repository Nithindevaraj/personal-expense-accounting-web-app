import React, { useState, useRef } from 'react';
import { X, Camera, Trash2, User, Check, Globe, ShieldCheck, LogOut, Link2, Copy } from 'lucide-react';
import {
  type UserProfile,
  buildIndividualUserLink,
  getOrCreateLocalUserId,
} from '../utils/storage';
import { useAuth } from '../context/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSaveProfile,
}) => {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(userProfile.name);
  const [currency, setCurrency] = useState(userProfile.currency || 'INR');
  const [avatar, setAvatar] = useState<string | undefined>(userProfile.avatar);
  const [copiedLink, setCopiedLink] = useState(false);

  const individualUserId = user?.id || getOrCreateLocalUserId();
  const individualUserLink = buildIndividualUserLink(
    individualUserId,
    name || user?.user_metadata?.full_name || userProfile.name
  );

  const handleCopyUserLink = async () => {
    try {
      await navigator.clipboard.writeText(individualUserLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = individualUserLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      const googleName = user?.user_metadata?.full_name;
      const googleAvatar = user?.user_metadata?.avatar_url;
      setName(googleName || userProfile.name);
      setCurrency(userProfile.currency || 'INR');
      setAvatar(googleAvatar || userProfile.avatar);
    }
  }

  if (!isOpen) return null;

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Profile photo size should be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatar(base64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setAvatar(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim() || 'User',
      email: user?.email || userProfile.email || '',
      currency,
      avatar,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 animate-fade-in max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">User Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Profile Photo Upload Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name || 'Profile'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-emerald-500/20 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-3xl font-bold shadow-md">
                  {name ? name.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
                </div>
              )}

              {/* Upload Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                title="Change Photo"
                aria-label="Change Photo"
              >
                <Camera className="w-6 h-6" />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer py-1"
              >
                {avatar ? 'Change Photo' : 'Upload Photo'}
              </button>
              {avatar && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer py-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Account Holder Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Holder Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nithin Devaraj"
                className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Currency Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Currency
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-800"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
                <option value="SGD">SGD (S$) - Singapore Dollar</option>
              </select>
            </div>
          </div>

          {/* 16-Digit User Code / Individual User Link (Shareable for Teams) */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Your 16-Digit User Code</span>
              </label>
              <button
                type="button"
                onClick={handleCopyUserLink}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={individualUserLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold tracking-wider bg-white border border-indigo-200 rounded-xl text-indigo-800 focus:outline-hidden text-center select-all shadow-2xs"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Provide this 16-digit code to a company administrator to be added as a member.
            </p>
          </div>

          {/* Google Account Status Badge */}
          {user && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  Linked to Google: <strong className="font-semibold text-slate-900">{user.email}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Sign out of Google and Personal Accounting?')) {
                    signOut();
                    onClose();
                  }
                }}
                className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 pb-3 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer text-center"
            >
              <Check className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

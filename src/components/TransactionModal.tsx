import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Paperclip,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import type { Project, Transaction, TransactionType } from '../types';
import { formatINR, getTodayString } from '../utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>, editingId?: string) => void;
  editingTransaction?: Transaction | null;
  projects: Project[];
  incomeCategories: string[];
  expenseCategories: string[];
  nextSlNo: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  projects,
  incomeCategories,
  expenseCategories,
  nextSlNo,
}) => {
  const fileInputId = useId();

  const [type, setType] = useState<TransactionType>('Expense');
  const [date, setDate] = useState<string>(getTodayString());
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [tag, setTag] = useState<string>('Project Alpha');
  const [subTag, setSubTag] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [slNo, setSlNo] = useState<number>(nextSlNo);

  // Sync state ONLY when opening modal or switching edited transaction (never wipe form on background sync)
  useEffect(() => {
    if (!isOpen) return;
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDate(editingTransaction.date);
      setAmount(String(editingTransaction.amount));
      setCategory(editingTransaction.category);
      setTag(editingTransaction.tag);
      setSubTag(editingTransaction.subTag || null);
      setDescription(editingTransaction.description || '');
      setNotes(editingTransaction.notes || '');
      setAttachments(editingTransaction.attachments || []);
      setSlNo(editingTransaction.slNo);
    } else {
      const firstParent = projects.find((p) => !p.parentId) || projects[0];
      setType('Expense');
      setDate(getTodayString());
      setAmount('');
      setCategory(expenseCategories[0] || 'Miscellaneous');
      setTag(firstParent?.name || 'Project Alpha');
      setSubTag(null);
      setDescription('');
      setNotes('');
      setAttachments([]);
      setSlNo(nextSlNo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction, isOpen]);

  // When type toggles, reset category to first in that list if not valid
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'Income') {
      if (!incomeCategories.includes(category)) {
        setCategory(incomeCategories[0] || 'Monthly salary');
      }
    } else {
      if (!expenseCategories.includes(category)) {
        setCategory(expenseCategories[0] || 'Food & Dining');
      }
    }
  };

  // Handle Attachment upload (with automatic image compression for mobile/camera photos)
  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const compressImageFile = async (file: File): Promise<string> => {
    const rawDataUrl = await readFileAsDataURL(file);
    if (file.size <= 350 * 1024) return rawDataUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.type.startsWith('image/')) {
          const compressed = await compressImageFile(file);
          if (compressed) uploaded.push(compressed);
        } else {
          if (file.size > 3 * 1024 * 1024) {
            alert(`"${file.name}" is larger than 3 MB. Please choose a smaller PDF.`);
            continue;
          }
          const dataUrl = await readFileAsDataURL(file);
          if (dataUrl) uploaded.push(dataUrl);
        }
      } catch (err) {
        console.error('Failed to read attachment:', err);
      }
    }

    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    onSave(
      {
        slNo: editingTransaction ? slNo : nextSlNo,
        date: date || getTodayString(),
        type,
        category: category || (type === 'Income' ? 'Monthly salary' : 'Food & Dining'),
        amount: parsedAmount,
        tag: tag || 'Project Alpha',
        subTag: subTag || null,
        description: description.trim(),
        notes: notes.trim(),
        attachments,
      },
      editingTransaction ? editingTransaction.id : undefined
    );

    onClose();
  };

  if (!isOpen) return null;

  const currentCategories = type === 'Income' ? incomeCategories : expenseCategories;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 animate-fade-in my-0 sm:my-8 max-h-[92dvh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {editingTransaction ? 'Edit Transaction' : 'Record New Transaction'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 pt-3.5">
          {/* Segmented Control: Type (Income vs Expense) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Transaction Classification
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleTypeChange('Income')}
                className={`flex items-center justify-center gap-2 py-2.5 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px] ${
                  type === 'Income'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                <span>Income (Inflow)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('Expense')}
                className={`flex items-center justify-center gap-2 py-2.5 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px] ${
                  type === 'Expense'
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                <span>Expense (Outflow)</span>
              </button>
            </div>
          </div>

          {/* Amount Input with Live INR Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹ INR) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 sm:py-3 text-xl sm:text-lg font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 tracking-tight"
              />
            </div>
            {amount && !isNaN(parseFloat(amount)) && (
              <span className="block mt-1 text-right text-xs font-semibold text-slate-500">
                {formatINR(parseFloat(amount))}
              </span>
            )}
          </div>

          {/* Date & Tag Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project
              </label>
              <select
                required
                value={subTag ? `${tag}:::${subTag}` : tag}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(':::')) {
                    const [parentName, subName] = val.split(':::');
                    setTag(parentName);
                    setSubTag(subName);
                  } else {
                    setTag(val);
                    setSubTag(null);
                  }
                }}
                className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-semibold text-slate-800"
              >
                {editingTransaction &&
                  tag &&
                  !projects.some((p) =>
                    subTag
                      ? p.parentId && p.name === subTag
                      : !p.parentId && p.name === tag
                  ) && (
                    <option value={subTag ? `${tag}:::${subTag}` : tag}>
                      {subTag ? `${tag} / ${subTag}` : tag} (Archived)
                    </option>
                  )}
                {projects
                  .filter((p) => !p.parentId)
                  .map((p) => {
                    const subs = projects.filter((s) => s.parentId === p.id);
                    if (subs.length === 0) {
                      return (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      );
                    }
                    return (
                      <optgroup key={p.id} label={p.name}>
                        <option value={p.name}>{p.name}</option>
                        {subs.map((sub) => (
                          <option key={sub.id} value={`${p.name}:::${sub.name}`}>
                            ↳ {sub.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category / Type *
            </label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-800"
            >
              {currentCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. AWS server invoice, lunch with client, salary credit"
              className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-800"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bank transaction reference, check number, additional tax notes..."
              className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-800"
            />
          </div>

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Receipts & Attachments
              </label>
              <label
                htmlFor={fileInputId}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer py-1"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Upload Bill/Receipt</span>
              </label>
              <input
                id={fileInputId}
                type="file"
                onChange={handleFileUpload}
                accept="image/*,.pdf,application/pdf"
                multiple
                className="sr-only"
              />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {attachments.map((att, idx) => {
                  const isPdf = att.startsWith('data:application/pdf');
                  return (
                    <div key={idx} className="relative group">
                      {isPdf ? (
                        <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center text-rose-600">
                          <FileText className="w-5 h-5" />
                          <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={att}
                          alt="receipt"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-sm hover:scale-110 transition-transform cursor-pointer"
                        aria-label="Remove receipt"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3.5 border-t border-slate-100 pb-3 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer text-center ${
                type === 'Income'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
              }`}
            >
              {editingTransaction ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

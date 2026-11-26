import React, { useEffect, useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: string[];
  title?: string;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  onClose,
  attachments,
  title,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
    }
  }, [isOpen, attachments]);

  useEffect(() => {
    if (!isOpen || attachments.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, attachments.length]);

  if (!isOpen || !attachments || attachments.length === 0) return null;

  const safeIndex = Math.min(activeIndex, attachments.length - 1);
  const currentUrl = attachments[safeIndex];
  const isPdf = currentUrl.startsWith('data:application/pdf');
  const hasMultiple = attachments.length > 1;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentUrl;
    a.download = `receipt_${safeIndex + 1}_${Date.now()}.${isPdf ? 'pdf' : 'png'}`;
    a.click();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-w-3xl w-full p-4 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-800 text-white gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate max-w-md">
              {title || 'Receipt / Attachment Document'}
            </span>
            {hasMultiple && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                {safeIndex + 1} / {attachments.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Download Attachment"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close attachment viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Attachment Content */}
        <div className="relative p-4 flex items-center justify-center overflow-auto grow">
          {hasMultiple && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 z-10 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg transition-colors cursor-pointer"
              aria-label="Previous attachment"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {isPdf ? (
            <iframe
              src={currentUrl}
              title={title || 'PDF Attachment'}
              className="w-full h-[65vh] rounded-xl border border-slate-800 bg-white"
            />
          ) : (
            <img
              src={currentUrl}
              alt={title || `Attachment ${safeIndex + 1}`}
              className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
            />
          )}

          {hasMultiple && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 z-10 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg transition-colors cursor-pointer"
              aria-label="Next attachment"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Thumbnail Strip when multiple attachments exist */}
        {hasMultiple && (
          <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800 overflow-x-auto no-scrollbar">
            {attachments.map((att, idx) => {
              const thumbPdf = att.startsWith('data:application/pdf');
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-400 scale-105'
                      : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`View attachment ${idx + 1}`}
                >
                  {thumbPdf ? (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-rose-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-[8px] font-bold">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={att}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

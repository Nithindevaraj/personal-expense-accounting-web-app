import React from 'react';
import { X, Download } from 'lucide-react';

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
}) => {
  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `receipt_${Date.now()}.png`;
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
        <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-800 text-white">
          <span className="text-sm font-semibold truncate max-w-md">
            {title || 'Receipt / Attachment Document'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="p-4 flex items-center justify-center overflow-auto grow">
          <img
            src={imageUrl}
            alt={title || 'Attachment Preview'}
            className="max-h-[70vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
          />
        </div>
      </div>
    </div>
  );
};

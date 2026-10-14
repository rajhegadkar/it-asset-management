import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { api } from '../api/client.js';
import { ShieldCheck, CheckSquare, FileText, Download, Check } from 'lucide-react';

interface HandoverSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any;
  onSignedSuccess?: () => void;
}

export const HandoverSignModal: React.FC<HandoverSignModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSignedSuccess,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !signatureName.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/allocations/acknowledge/${assignment.id}`, {
        signatureData: signatureName.trim(),
      });
      if (onSignedSuccess) onSignedSuccess();
      onClose();
    } catch {
      alert('Failed to submit acknowledgement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/allocations/handover-pdf/${assignment.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `handover-certificate-${assignment.asset?.assetId || 'doc'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to generate PDF document');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asset Handover & Digital Custody Acknowledgement" maxWidth="xl">
      <div className="space-y-4">
        {/* Asset summary banner */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {assignment.asset?.assetId}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {assignment.asset?.name}
            </h4>
            <p className="text-xs text-slate-500">
              Serial No: {assignment.asset?.serialNumber} • Allocated:{' '}
              {new Date(assignment.allocationDate).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Download PDF</span>
          </button>
        </div>

        {/* Terms Box */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 max-h-48 overflow-y-auto">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Terms of Asset Custody & Security Policy:
          </p>
          <p>
            1. I acknowledge that I have received the listed IT equipment and bundled peripherals in good physical and working condition.
          </p>
          <p>
            2. The asset is corporate property issued exclusively for conducting official business responsibilities in accordance with IT Security Policy.
          </p>
          <p>
            3. I agree to exercise reasonable care, not install unauthorized software, and immediately report any damage, loss, or theft to IT Operations within 24 hours.
          </p>
          <p>
            4. Upon resignation, transfer, or request by IT management, I will promptly return all assigned hardware and accessories in functional condition.
          </p>
        </div>

        {/* Signature form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              I have read, understood, and agree to the custody terms above and verify possession of the equipment.
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Electronic Signature (Type Full Legal Name)
            </label>
            <input
              type="text"
              required
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!agreed || !signatureName.trim() || submitting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Signing...' : 'Sign & Complete Acknowledgement'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

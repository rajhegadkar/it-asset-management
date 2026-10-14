import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { api } from '../api/client.js';
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'assets' | 'employees' | 'vendors' | 'locations';
  onImportSuccess?: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  type,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/imports/template/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download template file');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/imports/upload/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data.data);
      if (onImportSuccess && res.data.data.successCount > 0) {
        onImportSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error occurred during file import');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Import ${type.toUpperCase()} (CSV / XLSX)`} maxWidth="xl">
      <div className="space-y-4">
        {/* Step 1: Download Template */}
        <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-200 block">
                Standard {type} Template
              </span>
              <span className="text-blue-700 dark:text-blue-300">
                Download the official template with pre-mapped columns and sample records.
              </span>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>

        {/* Step 2: Upload Area */}
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center transition-colors">
            <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {file ? (
                <span className="font-semibold text-blue-600 dark:text-blue-400">{file.name}</span>
              ) : (
                <span>Drop file here or click to browse</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, and .csv formats (Max 25MB)</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing & Validating Records...</span>
              </>
            ) : (
              <span>Start Validation & Import</span>
            )}
          </button>
        </form>

        {/* Errors */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Import Results & Validation Summary */}
        {importResult && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <span className="text-slate-500 block">Total</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {importResult.totalProcessed}
                </span>
              </div>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <span className="text-emerald-600 dark:text-emerald-400 block font-medium">Succeeded</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  {importResult.successCount}
                </span>
              </div>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg">
                <span className="text-rose-600 dark:text-rose-400 block font-medium">Failed</span>
                <span className="font-bold text-rose-700 dark:text-rose-300">
                  {importResult.failedCount}
                </span>
              </div>
            </div>

            {/* Error detail list */}
            {importResult.errors?.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <h5 className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validation & Duplicate Conflicts ({importResult.errors.length}):</span>
                </h5>
                {importResult.errors.map((err: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2 bg-rose-50 dark:bg-rose-950/20 rounded border border-rose-100 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300"
                  >
                    <span className="font-semibold">Row {err.row}:</span> {err.reason} (Identifier:{' '}
                    {err.identifier})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

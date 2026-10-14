import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './Modal.js';
import { StatusBadge } from './StatusBadge.js';
import { api } from '../api/client.js';
import { Asset } from '../types/index.js';
import { Camera, QrCode, Search, ExternalLink, RefreshCw, CheckCircle, ArrowRightLeft, Wrench, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../customization/BrandingContext.js';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetSelected?: (asset: Asset) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onAssetSelected,
}) => {
  const navigate = useNavigate();
  const { formatCurrency } = useBranding();
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // USB physical scanner detection (rapid keystrokes followed by Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      // Normal typing vs high-speed barcode gun
      if (e.key === 'Enter' && buffer.length >= 3) {
        handleLookup(buffer);
        buffer = '';
      } else if (e.key.length === 1) {
        if (diff > 100) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Start Camera QR/Barcode Scanner
  const startCamera = async () => {
    try {
      setError(null);
      setScannerActive(true);
      const qrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = qrCode;

      await qrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopCamera();
          handleLookup(decodedText);
        },
        (errorMessage) => {
          // ignore stream scanning frame misses
        }
      );
    } catch (err: any) {
      setError('Unable to access camera. Please allow camera permissions or enter code manually.');
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && scannerActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Stop camera error:', e);
      }
      setScannerActive(false);
    }
  };

  const handleLookup = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/assets/${encodeURIComponent(code.trim())}`);
      setScannedAsset(res.data.data);
      if (onAssetSelected) onAssetSelected(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || `No asset found with barcode/ID: "${code}"`);
      setScannedAsset(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setScannedAsset(null);
    setManualCode('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Asset Barcode & QR Scanner" maxWidth="2xl">
      <div className="space-y-4">
        {/* Scanner controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {!scannerActive ? (
              <button
                onClick={startCamera}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera Scanner</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                <span>Stop Camera</span>
              </button>
            )}
          </div>

          {/* Manual / USB Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(manualCode);
            }}
            className="flex items-center space-x-2 w-full sm:w-72"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan or enter Asset ID/Serial..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </div>

        {/* Camera viewport */}
        {scannerActive && (
          <div className="relative overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center">
            <div id="qr-reader" className="w-full max-w-sm"></div>
            <div className="absolute top-2 left-2 bg-black/60 text-white px-2.5 py-1 rounded text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Camera Active • Aim at Barcode / QR Code</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-sm text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-500 space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Scanning and retrieving asset information...</span>
          </div>
        )}

        {/* Scanned Asset Details Card & Actions */}
        {scannedAsset && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                    {scannedAsset.assetId}
                  </span>
                  <StatusBadge status={scannedAsset.status} />
                  <StatusBadge status={scannedAsset.condition} type="condition" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {scannedAsset.name}
                </h4>
                <p className="text-xs text-slate-500">
                  Tag: {scannedAsset.assetTag} • S/N: {scannedAsset.serialNumber}
                </p>
              </div>

              <button
                onClick={() => {
                  handleClose();
                  navigate(`/assets/${scannedAsset.id}`);
                }}
                className="text-xs flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <span>Full Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Category</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {scannedAsset.category?.name || 'Computing'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Current Custody</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {scannedAsset.currentEmployee
                    ? `${scannedAsset.currentEmployee.firstName} ${scannedAsset.currentEmployee.lastName}`
                    : 'In Inventory (Available)'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Department / Loc</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {scannedAsset.department?.name || 'General'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Hardware Specs</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {scannedAsset.cpu || 'Standard Specs'} • {scannedAsset.ram || ''}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Warranty Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {scannedAsset.warrantyEnd ? new Date(scannedAsset.warrantyEnd).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Purchase Cost</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(scannedAsset.purchaseCost)}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              {scannedAsset.status === 'AVAILABLE' && (
                <button
                  onClick={() => {
                    handleClose();
                    navigate(`/allocations?action=allocate&assetId=${scannedAsset.id}`);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Allocate to User</span>
                </button>
              )}

              {scannedAsset.status === 'ASSIGNED' && (
                <button
                  onClick={() => {
                    handleClose();
                    navigate(`/allocations?action=return&assetId=${scannedAsset.id}`);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Return Asset</span>
                </button>
              )}

              <button
                onClick={() => {
                  handleClose();
                  navigate(`/maintenance?action=schedule&assetId=${scannedAsset.id}`);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Maintenance</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    const res = await api.post(
                      '/assets/labels/pdf',
                      { assetIds: [scannedAsset.id] },
                      { responseType: 'blob' }
                    );
                    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `label-${scannedAsset.assetId}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (e) {
                    alert('Failed to generate label');
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Barcode Label</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

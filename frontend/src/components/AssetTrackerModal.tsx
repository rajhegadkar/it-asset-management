import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Modal } from './Modal.js';
import { StatusBadge } from './StatusBadge.js';
import { Asset } from '../types/index.js';
import {
  Tag,
  Search,
  Laptop,
  User,
  Building,
  Calendar,
  Shield,
  Printer,
  ExternalLink,
  LifeBuoy,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import { CustomFieldDisplay } from '../customization/CustomFieldDisplay.js';
import { useBranding } from '../customization/BrandingContext.js';

interface AssetTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const AssetTrackerModal: React.FC<AssetTrackerModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const { formatCurrency } = useBranding();
  const [query, setQuery] = useState(initialQuery);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
        handleTrack(initialQuery);
      } else {
        setAsset(null);
        setError(null);
      }
    }
  }, [isOpen, initialQuery]);

  const handleTrack = async (searchTag: string) => {
    const q = searchTag.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/assets/${encodeURIComponent(q)}`);
      setAsset(res.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || `No asset found matching Asset Tag, ID, or Serial "${q}"`
      );
      setAsset(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTag = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLabel = async (assetId: string, assetTag: string) => {
    try {
      const res = await api.post(
        '/assets/labels/pdf',
        { assetIds: [assetId] },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `label-${assetTag}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to generate barcode label');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Asset Tracker & Custody Lookup"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Search Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrack(query);
          }}
          className="relative"
        >
          <div className="relative flex items-center">
            <Tag className="absolute left-3.5 w-4 h-4 text-blue-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter or scan Asset Tag, Asset ID, or Serial Number..."
              autoFocus
              className="w-full pl-10 pr-24 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Track</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Supports immediate lookup by Asset Tag (e.g. IT-LAP-000001), Serial Number, or Barcode scan.
          </span>
        </form>

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-3 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                Check that the Asset Tag or Serial Number matches the physical sticker.
              </p>
            </div>
          </div>
        )}

        {/* Asset Profile Card */}
        {asset && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm space-y-4">
            {/* Header / Identity */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-bold text-xs rounded-md shadow-sm flex items-center space-x-1">
                    <span>{asset.assetTag || asset.assetId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyTag(asset.assetTag || asset.assetId)}
                      title="Copy Asset Tag"
                      className="ml-1 hover:text-blue-200"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                  <StatusBadge status={asset.status} />
                  <StatusBadge status={asset.condition} type="condition" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
                  {asset.name}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Asset ID: {asset.assetId} • Serial: {asset.serialNumber}
                </span>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleDownloadLabel(asset.id, asset.assetTag || asset.assetId)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm"
                  title="Print Sticker"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sticker PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/assets/${asset.id}`);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  <span>Full View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content Details Grid */}
            <div className="p-4 space-y-4 text-xs">
              {/* Custody Information */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Current Custody & Custodian Status
                </span>
                {asset.currentEmployee ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        {asset.currentEmployee.firstName[0]}
                        {asset.currentEmployee.lastName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {asset.currentEmployee.firstName} {asset.currentEmployee.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {asset.currentEmployee.employeeId} • {asset.currentEmployee.email}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded text-[10px] font-semibold">
                      IN CUSTODY
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-500 italic">
                    Unassigned • Stored in inventory at {asset.location?.name || 'Main Warehouse'}
                  </div>
                )}
              </div>

              {/* Hardware & Organizational Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-semibold">{asset.category?.name || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Department</span>
                  <span className="font-semibold">{asset.department?.name || 'IT'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Facility / Location</span>
                  <span className="font-semibold">{asset.location?.name || 'HQ'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Make & Model</span>
                  <span className="font-semibold">
                    {asset.manufacturer || 'N/A'} {asset.model || ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">CPU & Memory</span>
                  <span className="font-semibold font-mono">
                    {asset.cpu || 'N/A'} • {asset.ram || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Storage</span>
                  <span className="font-semibold font-mono">{asset.storage || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Purchase Cost</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {asset.purchaseCost ? formatCurrency(asset.purchaseCost) : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Custom Dynamic Specifications */}
              <div className="pt-2">
                <CustomFieldDisplay
                  customFields={asset.customFields}
                  entity="ASSET"
                  categoryId={asset.categoryId}
                  title="Custom Specifications"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

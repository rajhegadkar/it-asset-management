import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import {
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  HardDrive,
  Clock,
  Trash2,
  Copy,
  ExternalLink,
  Lock,
  ArrowRight,
  Database,
  FileCheck,
  Zap,
} from 'lucide-react';

export type CloudStorageProvider = 'LOCAL_NAS' | 'GOOGLE_DRIVE' | 'MICROSOFT_ONEDRIVE' | 'AMAZON_S3' | 'WEBDAV';
export type BackupFrequency = 'MANUAL' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CloudStorageConfig {
  provider: CloudStorageProvider;
  enabled: boolean;
  frequency: BackupFrequency;
  scheduledTime: string;
  retentionDays: number;
  autoSyncCloud: boolean;
  localPath?: string;
  googleDriveFolderId?: string;
  googleServiceAccountJson?: string;
  googleAccessToken?: string;
  oneDriveFolder?: string;
  oneDriveClientId?: string;
  oneDriveTenantId?: string;
  oneDriveClientSecret?: string;
  oneDriveRefreshToken?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
}

export interface BackupHistoryItem {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  formattedSize: string;
  checksumSha256: string;
  status: 'COMPLETED' | 'CLOUD_SYNCED' | 'FAILED';
  recordCountTotal: number;
}

export const DisasterRecoveryCenter: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cloud Config State
  const [config, setConfig] = useState<CloudStorageConfig>({
    provider: 'LOCAL_NAS',
    enabled: true,
    frequency: 'DAILY',
    scheduledTime: '02:00',
    retentionDays: 30,
    autoSyncCloud: false,
    localPath: '',
    googleDriveFolderId: '',
    oneDriveFolder: '/Enterprise_Backups/ITAM',
    s3Bucket: 'itam-enterprise-backups',
    s3Region: 'us-east-1',
  });

  // Backup History State
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [selectedFileForRestore, setSelectedFileForRestore] = useState<File | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigAndHistory();
  }, []);

  const fetchConfigAndHistory = async () => {
    setLoading(true);
    try {
      const [cfgRes, histRes] = await Promise.all([
        api.get('/system/backup/config'),
        api.get('/system/backup/history'),
      ]);
      if (cfgRes.data?.data) {
        setConfig(cfgRes.data.data);
      }
      if (histRes.data?.data) {
        setHistory(histRes.data.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to load disaster recovery data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.put('/system/backup/config', config);
      setConfig(res.data.data);
      setFeedback({ type: 'success', message: 'Disaster recovery and cloud sync settings successfully saved!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to update configuration.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setActionLoading(true);
    setTestResult(null);
    try {
      const res = await api.post('/system/backup/test-cloud', config);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Connection failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!confirm('Initiate immediate full system snapshot? This captures all database tables, attachments, and customizations.')) {
      return;
    }
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.post('/system/backup/create');
      const filename = res.data.data.filename;
      setFeedback({
        type: 'success',
        message: `Backup archive created: ${filename}. Initiating automatic download...`,
      });

      // Automatically trigger download
      window.open(`/api/v1/system/backup/download/${filename}`, '_blank');

      // Refresh list
      const histRes = await api.get('/system/backup/history');
      setHistory(histRes.data.data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Backup creation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = (filename: string) => {
    window.open(`/api/v1/system/backup/download/${filename}`, '_blank');
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete backup ${filename}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/system/backup/${filename}`);
      setHistory((prev) => prev.filter((item) => item.filename !== filename));
      setFeedback({ type: 'success', message: `Backup archive ${filename} removed.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to delete backup.' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFileForRestore(e.target.files[0]);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileForRestore) {
      alert('Please choose a valid .itam-backup or .zip file to restore.');
      return;
    }

    if (!confirm('CRITICAL ACTION: Restoring will overwrite existing records and configuration with the contents of this backup archive. Proceed?')) {
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    setRestoreResult(null);

    const formData = new FormData();
    formData.append('file', selectedFileForRestore);

    try {
      const res = await api.post('/system/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRestoreResult(res.data.data);
      setFeedback({
        type: 'success',
        message: `System successfully restored! Total restored units: ${res.data.data.totalRecords}. Refresh page to load restored state.`,
      });
      setSelectedFileForRestore(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'System restore failed. Please verify the archive integrity.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                ENTERPRISE DISASTER RECOVERY & HA
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                ACTIVE
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Automated Data Protection & Cloud DR
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Continuous database checkpointing, WAL-safe snapshots, and seamless multi-cloud replication across Google Drive, Microsoft OneDrive, Amazon S3, or Local NAS. In the event of catastrophic server or disk failure, perform 1-click restoration to any clean instance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading}
              className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Create Backup Now</span>
            </button>

            <button
              onClick={() => setRestoreModalOpen(true)}
              disabled={actionLoading}
              className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Restore from Archive</span>
            </button>
          </div>
        </div>

        {/* DR KPI Badges */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">Target RPO</div>
            <div className="text-base font-bold text-white mt-0.5">
              {config.frequency === 'HOURLY' ? '< 1 Hour' : config.frequency === 'DAILY' ? '< 24 Hours' : 'On-Demand'}
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">Target RTO</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">&lt; 15 Minutes</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">Current Storage Target</div>
            <div className="text-base font-bold text-blue-300 mt-0.5">{config.provider.replace('_', ' ')}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-400">Stored Snapshots</div>
            <div className="text-base font-bold text-white mt-0.5">{history.length} Archives</div>
          </div>
        </div>
      </div>

      {/* Alerts / Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start space-x-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <div className="flex-1">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Storage Settings & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cloud Storage Provider Configuration */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Cloud Storage & Backup Schedule</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select where database and system backups are replicated automatically.
            </p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            {/* Storage Provider Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Storage Provider
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'LOCAL_NAS', label: 'Local / NAS / SMB', icon: HardDrive },
                  { id: 'GOOGLE_DRIVE', label: 'Google Drive', icon: Cloud },
                  { id: 'MICROSOFT_ONEDRIVE', label: 'Microsoft OneDrive', icon: Cloud },
                  { id: 'AMAZON_S3', label: 'Amazon S3 / R2', icon: Database },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = config.provider === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfig({ ...config, provider: item.id as CloudStorageProvider })}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        active
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-2 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Provider-Specific Configuration Fields */}
            {config.provider === 'LOCAL_NAS' && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Local / Network Attached Storage (NAS) Path
                </label>
                <input
                  type="text"
                  placeholder="e.g. \\NAS-SERVER\ITAM_Backups or C:\Backups"
                  value={config.localPath || ''}
                  onChange={(e) => setConfig({ ...config, localPath: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500">
                  Ensure the backend service process has write permissions to this directory.
                </p>
              </div>
            )}

            {config.provider === 'GOOGLE_DRIVE' && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Google Drive Folder ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                    value={config.googleDriveFolderId || ''}
                    onChange={(e) => setConfig({ ...config, googleDriveFolderId: e.target.value })}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Service Account JSON / Access Token
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Paste Google Cloud Service Account JSON or OAuth Bearer Token"
                    value={config.googleAccessToken || config.googleServiceAccountJson || ''}
                    onChange={(e) => setConfig({ ...config, googleAccessToken: e.target.value })}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>
            )}

            {config.provider === 'MICROSOFT_ONEDRIVE' && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Target Folder Path
                  </label>
                  <input
                    type="text"
                    placeholder="/ITAM_Enterprise_Backups"
                    value={config.oneDriveFolder || ''}
                    onChange={(e) => setConfig({ ...config, oneDriveFolder: e.target.value })}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Azure Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="Client ID"
                      value={config.oneDriveClientId || ''}
                      onChange={(e) => setConfig({ ...config, oneDriveClientId: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Client Secret / Token
                    </label>
                    <input
                      type="password"
                      placeholder="Secret"
                      value={config.oneDriveClientSecret || config.oneDriveRefreshToken || ''}
                      onChange={(e) => setConfig({ ...config, oneDriveClientSecret: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {config.provider === 'AMAZON_S3' && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Bucket Name
                    </label>
                    <input
                      type="text"
                      placeholder="itam-backups"
                      value={config.s3Bucket || ''}
                      onChange={(e) => setConfig({ ...config, s3Bucket: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Region
                    </label>
                    <input
                      type="text"
                      placeholder="us-east-1"
                      value={config.s3Region || ''}
                      onChange={(e) => setConfig({ ...config, s3Region: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Endpoint URL (Optional for MinIO / Cloudflare R2)
                  </label>
                  <input
                    type="text"
                    placeholder="https://s3.custom-endpoint.com"
                    value={config.s3Endpoint || ''}
                    onChange={(e) => setConfig({ ...config, s3Endpoint: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Frequency & Schedule */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Backup Frequency
                </label>
                <select
                  value={config.frequency}
                  onChange={(e) => setConfig({ ...config, frequency: e.target.value as BackupFrequency })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="HOURLY">Hourly Checkpoint</option>
                  <option value="DAILY">Daily (Recommended)</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="MANUAL">Manual Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Time
                </label>
                <input
                  type="time"
                  value={config.scheduledTime || '02:00'}
                  onChange={(e) => setConfig({ ...config, scheduledTime: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Retention Policy */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Archive Retention (Days)
                </label>
                <span className="text-[11px] text-slate-500">Auto-prune files older than threshold</span>
              </div>
              <input
                type="number"
                min={1}
                max={365}
                value={config.retentionDays || 30}
                onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value, 10) || 30 })}
                className="w-20 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-center font-bold"
              />
            </div>

            {/* Auto Cloud Sync Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Automatic Remote Sync
                </span>
                <span className="text-[11px] text-slate-500">
                  Transmit archive to remote destination after snapshot
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.autoSyncCloud}
                onChange={(e) => setConfig({ ...config, autoSyncCloud: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Test Connection Result Notice */}
            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{testResult.message}</div>
                  {testResult.latencyMs !== undefined && (
                    <div className="text-[10px] opacity-80 mt-0.5">Latency: {testResult.latencyMs} ms</div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-center transition-all disabled:opacity-50"
              >
                Test Connection
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm text-center transition-all disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Backup Archive History & Verification */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span>Backup Archive Vault & SHA-256 Hashes</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically hashed snapshots available for instant download or restoration.
              </p>
            </div>
            <button
              onClick={fetchConfigAndHistory}
              className="self-start sm:self-auto p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-800"
              title="Refresh Archives"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* History List Table */}
          {history.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Database className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No backup archives recorded yet
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Click &ldquo;Create Backup Now&rdquo; above to generate your first full system snapshot archive.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 font-semibold">Archive File</th>
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold">Size</th>
                    <th className="pb-3 font-semibold">SHA-256 Checksum</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={item.filename}>
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.recordCountTotal ? `${item.recordCountTotal} entities` : 'Full System'}
                        </div>
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {item.formattedSize}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[100px]" title={item.checksumSha256}>
                            {item.checksumSha256 ? `${item.checksumSha256.substring(0, 10)}...` : 'N/A'}
                          </span>
                          {item.checksumSha256 && (
                            <button
                              onClick={() => copyToClipboard(item.checksumSha256)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Copy SHA-256 Hash"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                          {copiedHash === item.checksumSha256 && (
                            <span className="text-[9px] text-emerald-500 font-bold">Copied!</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleDownload(item.filename)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                            title="Download Archive"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(item.filename)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Delete Archive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Disaster Recovery Hardware Replacement Runbook Guide */}
          <div className="mt-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div className="text-xs font-bold text-blue-950 dark:text-blue-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>Rapid Hardware Replacement Disaster Recovery Protocol</span>
            </div>
            <ol className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Deploy fresh ITAM instance on destination server or container.</li>
              <li>Sign in as Super Admin and navigate to Customization &gt; Disaster Recovery.</li>
              <li>Upload your downloaded or cloud-stored <code className="font-mono text-blue-600 bg-blue-100/50 dark:bg-blue-900/40 px-1 py-0.5 rounded">.itam-backup</code> snapshot.</li>
              <li>Click <strong>Restore</strong> — database schemas, assets, tickets, licenses, signatures, and custom fields are restored in seconds.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Restore Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Restore System from Disaster Recovery Snapshot
                </h3>
              </div>
              <button
                onClick={() => {
                  setRestoreModalOpen(false);
                  setSelectedFileForRestore(null);
                  setRestoreResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Important Recovery Warning</span>
                </div>
                Restoring a snapshot replaces the current database contents, custom fields, and branding state with the archive data. Ensure you have created a backup of current data if necessary.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select <code className="font-mono text-blue-600">.itam-backup</code> Archive
                </label>
                <input
                  type="file"
                  accept=".itam-backup,.json,.zip"
                  onChange={handleFileSelect}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 text-slate-500 cursor-pointer"
                />
              </div>

              {selectedFileForRestore && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    File: {selectedFileForRestore.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Size: {(selectedFileForRestore.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              )}

              {restoreResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Restore Completed Successfully</span>
                  </div>
                  <div>Snapshot ID: {restoreResult.backupId}</div>
                  <div>Total restored entities: {restoreResult.totalRecords}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setSelectedFileForRestore(null);
                  setRestoreResult(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!selectedFileForRestore || actionLoading}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute System Restore</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

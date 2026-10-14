import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Asset, AssetCategory, Department, Location, Vendor } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Pagination } from '../components/Pagination.js';
import { Modal } from '../components/Modal.js';
import { ImportModal } from '../components/ImportModal.js';
import { AssetTrackerModal } from '../components/AssetTrackerModal.js';
import { CustomFieldRenderer } from '../customization/CustomFieldRenderer.js';
import { useBranding } from '../customization/BrandingContext.js';
import { Link, useNavigate } from 'react-router-dom';
import {
  Laptop,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Printer,
  Eye,
  Trash2,
  RefreshCw,
  Tag,
  ArrowRightLeft,
  Edit2,
  Save,
} from 'lucide-react';

export const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding, formatCurrency, formatDate } = useBranding();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackTag, setTrackTag] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Master Data Options
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // New Asset Form State
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    serialNumber: '',
    status: 'AVAILABLE',
    condition: 'NEW',
    manufacturer: '',
    model: '',
    departmentId: '',
    locationId: '',
    vendorId: '',
    cpu: '',
    ram: '',
    storage: '',
    operatingSystem: '',
    purchaseCost: '',
    poNumber: '',
    warrantyStart: '',
    warrantyEnd: '',
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/assets', { params });
      setAssets(res.data.data);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [cats, depts, locs, vnds] = await Promise.all([
        api.get('/org/categories'),
        api.get('/org/departments'),
        api.get('/org/locations'),
        api.get('/org/vendors'),
      ]);
      setCategories(cats.data.data);
      setDepartments(depts.data.data);
      setLocations(locs.data.data);
      setVendors(vnds.data.data);
      if (cats.data.data.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: cats.data.data[0].id }));
      }
    } catch (e) {
      console.error('Master data load failed:', e);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [page, selectedCategory, selectedDepartment, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAssets();
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assets', {
        ...formData,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
      setCreateModalOpen(false);
      setCustomFields({});
      fetchAssets();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create asset');
    }
  };

  const handleOpenEditModal = (ast: Asset) => {
    setEditingAsset(ast);
    let initialCustom: Record<string, any> = {};
    try {
      if (ast.customFields) {
        initialCustom = typeof ast.customFields === 'string' ? JSON.parse(ast.customFields) : { ...ast.customFields };
      }
    } catch {}
    setEditCustomFields(initialCustom);
    setEditFormData({
      name: ast.name || '',
      categoryId: ast.categoryId || '',
      serialNumber: ast.serialNumber || '',
      departmentId: ast.departmentId || '',
      locationId: ast.locationId || '',
      vendorId: ast.vendorId || '',
      status: ast.status || 'AVAILABLE',
      condition: ast.condition || 'GOOD',
      manufacturer: ast.manufacturer || '',
      model: ast.model || '',
      purchaseCost: ast.purchaseCost !== undefined && ast.purchaseCost !== null ? String(ast.purchaseCost) : '',
      warrantyEnd: ast.warrantyEnd ? ast.warrantyEnd.split('T')[0] : '',
      warrantyProvider: ast.warrantyProvider || '',
      notes: ast.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setEditSaving(true);
    try {
      await api.put(`/assets/${editingAsset.id}`, {
        ...editFormData,
        purchaseCost: editFormData.purchaseCost ? parseFloat(editFormData.purchaseCost) : undefined,
        customFields: editCustomFields,
      });
      setEditModalOpen(false);
      fetchAssets();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update asset');
    } finally {
      setEditSaving(false);
    }
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
      alert('Failed to generate label');
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      const res = await api.get(`/reports/export?entity=assets&format=${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assets-export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export assets data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            IT Asset Master Registry
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-slate-500">
              Complete hardware fleet, specifications, assignment status, and lifecycle inventory
            </p>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center space-x-1.5">
              <span>Fleet Valuation:</span>
              <span className="font-bold">{formatCurrency(assets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0))}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setTrackTag('');
              setTrackerOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Track Asset</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Asset</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Asset ID, Tag, Serial Number, Model, or Assigned Employee..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="RETIRED">Retired</option>
              <option value="DISPOSED">Disposed</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Asset Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Mobile scroll hint */}
        <div className="sm:hidden px-4 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center justify-end space-x-1">
          <span>Scroll right to see all columns</span>
          <span>→</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Asset ID / Tag</th>
                <th className="py-3 px-4">Equipment Model</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Custody</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Cost / Value</th>
                <th className="py-3 px-4">Warranty End</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading assets inventory...</span>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No assets found matching the specified search criteria.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <Link
                        to={`/assets/${asset.id}`}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline block"
                      >
                        {asset.assetId}
                      </Link>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                          {asset.assetTag}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackTag(asset.assetTag || asset.assetId);
                            setTrackerOpen(true);
                          }}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          title="Track Asset"
                        >
                          Track
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {asset.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        S/N: {asset.serialNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {asset.category?.name || 'Computing'}
                    </td>
                    <td className="py-3.5 px-4">
                      {asset.currentEmployee ? (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {asset.currentEmployee.firstName} {asset.currentEmployee.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {asset.department?.name || 'General'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned (In Stock)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={asset.condition} type="condition" />
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {asset.purchaseCost !== undefined && asset.purchaseCost !== null ? (
                        formatCurrency(asset.purchaseCost)
                      ) : (
                        <span className="text-slate-400 font-normal">--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => {
                          setTrackTag(asset.assetTag || asset.assetId);
                          setTrackerOpen(true);
                        }}
                        title="Track Asset Lifecycle"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-block"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/assets/${asset.id}`}
                        title="View Details"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-block"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleOpenEditModal(asset)}
                        title="Edit Asset & Custom Specifications"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-block"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadLabel(asset.id, asset.assetTag)}
                        title="Print Barcode Label"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-block"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.page || page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* New Asset Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register New IT Hardware Asset"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Asset Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dell Latitude 7440"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serial Number *
              </label>
              <input
                type="text"
                required
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="e.g. SN-DELL-88219"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g. Dell / Apple / HP"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CPU / Processor
              </label>
              <input
                type="text"
                value={formData.cpu}
                onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                placeholder="e.g. Intel Core i7-1365U"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                RAM / Memory
              </label>
              <input
                type="text"
                value={formData.ram}
                onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                placeholder="e.g. 32GB DDR5"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Storage
              </label>
              <input
                type="text"
                value={formData.storage}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                placeholder="e.g. 1TB NVMe SSD"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Operating System
              </label>
              <input
                type="text"
                value={formData.operatingSystem}
                onChange={(e) => setFormData({ ...formData, operatingSystem: e.target.value })}
                placeholder="e.g. Windows 11 Pro"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Purchase Cost ({branding.currencySymbol || '$'})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                placeholder="1899.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warranty Expiry Date
              </label>
              <input
                type="date"
                value={formData.warrantyEnd}
                onChange={(e) => setFormData({ ...formData, warrantyEnd: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2">
            <CustomFieldRenderer
              entity="ASSET"
              values={customFields}
              onChange={setCustomFields}
              categoryId={formData.categoryId}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Save Asset & Generate Barcode
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        type="assets"
        onImportSuccess={() => fetchAssets()}
      />

      {/* Asset Tracker Modal */}
      <AssetTrackerModal
        isOpen={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        initialQuery={trackTag}
      />

      {/* Edit Asset Modal */}
      {editingAsset && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Asset & Specifications — ${editingAsset.assetTag || editingAsset.assetId}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleUpdateAsset} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={editFormData.categoryId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.serialNumber || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editFormData.status || 'AVAILABLE'}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="AVAILABLE">AVAILABLE (In Stock)</option>
                  <option value="ASSIGNED">ASSIGNED (In Use)</option>
                  <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                  <option value="REPAIR">REPAIR</option>
                  <option value="RETIRED">RETIRED</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition
                </label>
                <select
                  value={editFormData.condition || 'GOOD'}
                  onChange={(e) => setEditFormData({ ...editFormData, condition: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="NEW">NEW</option>
                  <option value="EXCELLENT">EXCELLENT</option>
                  <option value="GOOD">GOOD</option>
                  <option value="FAIR">FAIR</option>
                  <option value="POOR">POOR</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={editFormData.departmentId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- No Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                <select
                  value={editFormData.locationId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, locationId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- No Location --</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor
                </label>
                <select
                  value={editFormData.vendorId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, vendorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- No Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturer / Brand
                </label>
                <input
                  type="text"
                  value={editFormData.manufacturer || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={editFormData.model || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Cost ({branding.currencySymbol || '$'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.purchaseCost || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, purchaseCost: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty End Date
                </label>
                <input
                  type="date"
                  value={editFormData.warrantyEnd || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, warrantyEnd: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Custom Dynamic Fields for this Asset */}
            <div className="pt-2">
              <CustomFieldRenderer
                entity="ASSET"
                values={editCustomFields}
                onChange={setEditCustomFields}
                categoryId={editFormData.categoryId || editingAsset.categoryId}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editSaving ? 'Saving Changes...' : 'Update Asset'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

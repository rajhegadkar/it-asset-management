import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { AssetController } from '../controllers/assetController.js';
import { AllocationController } from '../controllers/allocationController.js';
import { TicketController, MaintenanceController } from '../controllers/ticketController.js';
import { LicenseController, ConsumableController } from '../controllers/licenseConsumableController.js';
import { EmployeeController, OrgDataController } from '../controllers/employeeOrgController.js';
import { ReportImportController } from '../controllers/reportImportController.js';
import { SettingsNotificationController } from '../controllers/settingsNotificationController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { uploadMiddleware } from '../middlewares/upload.js';

const router = Router();

// --- Public Health Endpoint ---
router.get('/health', SettingsNotificationController.getHealth);

// --- Auth Routes ---
const authRouter = Router();
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh-token', AuthController.refreshToken);
authRouter.get('/profile', authenticate, AuthController.getProfile);
authRouter.post('/setup-2fa', authenticate, AuthController.setup2FA);
authRouter.post('/enable-2fa', authenticate, AuthController.enable2FA);
authRouter.post('/change-password', authenticate, AuthController.changePassword);
router.use('/auth', authRouter);

// --- Asset Routes ---
const assetRouter = Router();
assetRouter.use(authenticate);
assetRouter.get('/', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), AssetController.getAssets);
assetRouter.get('/dashboard-metrics', AssetController.getDashboardMetrics);
assetRouter.get('/quick-search', AssetController.quickSearch);
assetRouter.get('/track/:tag', AssetController.trackAsset);
assetRouter.get('/:id', AssetController.getAssetById);
assetRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AssetController.createAsset);
assetRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), AssetController.updateAsset);
assetRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AssetController.archiveAsset);
assetRouter.post('/labels/pdf', AssetController.generateLabelsPdf);
assetRouter.get('/labels/pdf', AssetController.generateLabelsPdf);
router.use('/assets', assetRouter);

// --- Allocations, Returns, Transfers, Disposals ---
const allocRouter = Router();
allocRouter.use(authenticate);
allocRouter.get('/assignments', AllocationController.listAssignments);
allocRouter.get('/my-assets', AllocationController.myAssets);
allocRouter.post('/allocate', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), AllocationController.allocateAsset);
allocRouter.post('/acknowledge/:id', AllocationController.acknowledgeAllocation);
allocRouter.get('/handover-pdf/:id', AllocationController.downloadHandoverPdf);
allocRouter.post('/return', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), AllocationController.returnAsset);
allocRouter.post('/transfer', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AllocationController.transferAsset);
allocRouter.post('/dispose', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AllocationController.disposeAsset);
router.use('/allocations', allocRouter);

// --- Helpdesk Tickets ---
const ticketRouter = Router();
ticketRouter.use(authenticate);
ticketRouter.get('/', TicketController.getTickets);
ticketRouter.get('/:id', TicketController.getTicketById);
ticketRouter.post('/', TicketController.createTicket);
ticketRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), TicketController.updateTicket);
ticketRouter.post('/:id/comments', TicketController.addComment);
router.use('/tickets', ticketRouter);

// --- Maintenance Records ---
const maintRouter = Router();
maintRouter.use(authenticate);
maintRouter.get('/', MaintenanceController.getRecords);
maintRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), MaintenanceController.createRecord);
maintRouter.put('/:id/complete', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), MaintenanceController.completeRecord);
router.use('/maintenance', maintRouter);

// --- Software Licenses (SAM) ---
const licRouter = Router();
licRouter.use(authenticate);
licRouter.get('/', LicenseController.getLicenses);
licRouter.get('/:id', LicenseController.getLicenseById);
licRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.createLicense);
licRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.updateLicense);
licRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.deleteLicense);
licRouter.post('/:id/assign', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.assignLicense);
licRouter.delete('/assignment/:assignmentId', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.revokeLicense);
router.use('/licenses', licRouter);

// --- Consumables & Spare Parts ---
const consRouter = Router();
consRouter.use(authenticate);
consRouter.get('/', ConsumableController.getConsumables);
consRouter.get('/:id', ConsumableController.getConsumableById);
consRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.createConsumable);
consRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.updateConsumable);
consRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.deleteConsumable);
consRouter.post('/:id/transaction', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), ConsumableController.recordTransaction);
router.use('/consumables', consRouter);

// --- Employees ---
const empRouter = Router();
empRouter.use(authenticate);
empRouter.get('/', EmployeeController.getEmployees);
empRouter.get('/:id', EmployeeController.getEmployeeById);
empRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), EmployeeController.createEmployee);
empRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), EmployeeController.updateEmployee);
empRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), EmployeeController.deleteEmployee);
router.use('/employees', empRouter);

// --- Organization Master Data (Departments, Locations, Vendors, Categories) ---
const orgRouter = Router();
orgRouter.use(authenticate);
orgRouter.get('/organization', OrgDataController.getOrganization);
orgRouter.put('/organization', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.updateOrganization);
orgRouter.get('/departments', OrgDataController.getDepartments);
orgRouter.post('/departments', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.createDepartment);
orgRouter.put('/departments/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.updateDepartment);
orgRouter.delete('/departments/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.deleteDepartment);
orgRouter.get('/locations', OrgDataController.getLocations);
orgRouter.post('/locations', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.createLocation);
orgRouter.put('/locations/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.updateLocation);
orgRouter.delete('/locations/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.deleteLocation);
orgRouter.get('/vendors', OrgDataController.getVendors);
orgRouter.post('/vendors', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.createVendor);
orgRouter.put('/vendors/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.updateVendor);
orgRouter.delete('/vendors/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.deleteVendor);
orgRouter.get('/categories', OrgDataController.getCategories);
orgRouter.post('/categories', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.createCategory);
orgRouter.put('/categories/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.updateCategory);
orgRouter.delete('/categories/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), OrgDataController.deleteCategory);
router.use('/org', orgRouter);

// --- Reports & Export ---
const reportRouter = Router();
reportRouter.use(authenticate);
reportRouter.get('/inventory', ReportImportController.getInventoryReport);
reportRouter.get('/warranty', ReportImportController.getWarrantyReport);
reportRouter.get('/allocations', ReportImportController.getAllocationsReport);
reportRouter.get('/maintenance', ReportImportController.getMaintenanceReport);
reportRouter.get('/licenses', ReportImportController.getLicenseReport);
reportRouter.get('/consumables', ReportImportController.getConsumablesReport);
reportRouter.get('/disposals', ReportImportController.getDisposalReport);
reportRouter.get('/export', ReportImportController.exportData);
router.use('/reports', reportRouter);

// --- Imports & Templates ---
const importRouter = Router();
importRouter.use(authenticate);
importRouter.get('/template/:type', ReportImportController.getTemplate);
importRouter.post('/upload/:type', requireRole('SUPER_ADMIN', 'IT_ADMIN'), uploadMiddleware.single('file'), ReportImportController.importData);
router.use('/imports', importRouter);

// --- Settings, Notifications & Audit ---
const sysRouter = Router();
sysRouter.use(authenticate);
sysRouter.get('/settings', SettingsNotificationController.getSettings);
sysRouter.put('/settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.updateSettings);
sysRouter.get('/email-settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.getEmailSettings);
sysRouter.post('/email-settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.updateEmailSettings);
sysRouter.post('/email/test', requireRole('SUPER_ADMIN'), SettingsNotificationController.testEmailConnection);
sysRouter.get('/notifications', SettingsNotificationController.getNotifications);
sysRouter.put('/notifications/:id/read', SettingsNotificationController.markNotificationRead);
sysRouter.put('/notifications/read-all', SettingsNotificationController.markAllNotificationsRead);
sysRouter.get('/audit-logs', requireRole('SUPER_ADMIN'), SettingsNotificationController.getAuditLogs);
router.use('/system', sysRouter);

// --- Super Admin Customization Engine (Version 3) ---
import { customizationRouter } from '../customization/customizationRoutes.js';
router.use('/customization', customizationRouter);

// --- Disaster Recovery & Cloud Backup Engine (Version 3) ---
import { disasterRecoveryRouter } from '../disasterRecovery/index.js';
router.use('/system/backup', disasterRecoveryRouter);

export default router;


import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { AssetController } from '../controllers/assetController.js';
import { AllocationController } from '../controllers/allocationController.js';
import { TicketController, MaintenanceController } from '../controllers/ticketController.js';
import { LicenseController, ConsumableController } from '../controllers/licenseConsumableController.js';
import { EmployeeController, OrgDataController } from '../controllers/employeeOrgController.js';
import { ReportImportController } from '../controllers/reportImportController.js';
import { SettingsNotificationController } from '../controllers/settingsNotificationController.js';
import { authenticate, STAFF_ROLES, ADMIN_ROLES, isStaff } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/featureGate.js';
import { Request, Response, NextFunction } from 'express';

// The employee self-service portal can be switched off in the Customization Center (staff are unaffected)
const portalGate = requireFeature('enableEmployeePortal');
const employeePortalOnly = (req: Request, res: Response, next: NextFunction) => (isStaff(req) ? next() : portalGate(req, res, next));
import { requireRole } from '../middlewares/rbac.js';
import { uploadMiddleware } from '../middlewares/upload.js';

const router = Router();
const staff = requireRole(...STAFF_ROLES);
const admin = requireRole(...ADMIN_ROLES);
const superAdmin = requireRole('SUPER_ADMIN');

// --- Public Health Endpoint ---
router.get('/health', SettingsNotificationController.getHealth);

// --- Auth Routes ---
const authRouter = Router();
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh-token', AuthController.refreshToken);
authRouter.get('/profile', authenticate, AuthController.getProfile);
authRouter.post('/logout', authenticate, AuthController.logout);
authRouter.post('/setup-2fa', authenticate, AuthController.setup2FA);
authRouter.post('/disable-2fa', authenticate, AuthController.disable2FA);
authRouter.post('/enable-2fa', authenticate, AuthController.enable2FA);
authRouter.post('/change-password', authenticate, AuthController.changePassword);
router.use('/auth', authRouter);

// --- Asset Routes ---
const assetRouter = Router();
assetRouter.use(authenticate);
// Asset register is staff-only; employees see their own equipment through /allocations/my-assets
assetRouter.get('/', staff, AssetController.getAssets);
assetRouter.get('/dashboard-metrics', staff, AssetController.getDashboardMetrics);
assetRouter.get('/quick-search', staff, AssetController.quickSearch);
assetRouter.get('/track/:tag', staff, AssetController.trackAsset);
assetRouter.post('/labels/pdf', staff, AssetController.generateLabelsPdf);
assetRouter.get('/labels/pdf', staff, AssetController.generateLabelsPdf);
assetRouter.get('/:id', staff, AssetController.getAssetById);
assetRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AssetController.createAsset);
assetRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), AssetController.updateAsset);
assetRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), AssetController.archiveAsset);
router.use('/assets', assetRouter);

// --- Allocations, Returns, Transfers, Disposals ---
const allocRouter = Router();
allocRouter.use(authenticate, employeePortalOnly);
allocRouter.get('/assignments', AllocationController.listAssignments); // employees are scoped to their own records in the controller
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
ticketRouter.get('/', TicketController.getTickets); // employees are scoped to their own tickets in the controller
ticketRouter.get('/:id', TicketController.getTicketById);
ticketRouter.post('/', TicketController.createTicket);
ticketRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), TicketController.updateTicket);
ticketRouter.post('/:id/comments', TicketController.addComment);
router.use('/tickets', ticketRouter);

// --- Maintenance Records ---
const maintRouter = Router();
maintRouter.use(authenticate, requireFeature('enableMaintenance'));
maintRouter.get('/', staff, MaintenanceController.getRecords);
maintRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), MaintenanceController.createRecord);
maintRouter.put('/:id/complete', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), MaintenanceController.completeRecord);
router.use('/maintenance', maintRouter);

// --- Software Licenses (SAM) ---
const licRouter = Router();
licRouter.use(authenticate, requireFeature('enableSamLicenses'));
licRouter.get('/', admin, LicenseController.getLicenses);
licRouter.get('/:id', admin, LicenseController.getLicenseById);
licRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.createLicense);
licRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.updateLicense);
licRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.deleteLicense);
licRouter.post('/:id/assign', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.assignLicense);
licRouter.delete('/assignment/:assignmentId', requireRole('SUPER_ADMIN', 'IT_ADMIN'), LicenseController.revokeLicense);
router.use('/licenses', licRouter);

// --- Consumables & Spare Parts ---
const consRouter = Router();
consRouter.use(authenticate, requireFeature('enableConsumables'));
consRouter.get('/', staff, ConsumableController.getConsumables);
consRouter.get('/:id', staff, ConsumableController.getConsumableById);
consRouter.post('/', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.createConsumable);
consRouter.put('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.updateConsumable);
consRouter.delete('/:id', requireRole('SUPER_ADMIN', 'IT_ADMIN'), ConsumableController.deleteConsumable);
consRouter.post('/:id/transaction', requireRole('SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'), ConsumableController.recordTransaction);
router.use('/consumables', consRouter);

// --- Employees ---
const empRouter = Router();
empRouter.use(authenticate);
empRouter.get('/', staff, EmployeeController.getEmployees);
empRouter.get('/:id', EmployeeController.getEmployeeById); // staff, or an employee reading their own record (checked in controller)
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
// Asset inventory export is also used by support engineers on the Assets page; everything else is admin-only
reportRouter.get('/export', staff, ReportImportController.exportData);
reportRouter.use(admin);
reportRouter.get('/inventory', ReportImportController.getInventoryReport);
reportRouter.get('/warranty', ReportImportController.getWarrantyReport);
reportRouter.get('/allocations', ReportImportController.getAllocationsReport);
reportRouter.get('/maintenance', ReportImportController.getMaintenanceReport);
reportRouter.get('/licenses', ReportImportController.getLicenseReport);
reportRouter.get('/consumables', ReportImportController.getConsumablesReport);
reportRouter.get('/disposals', ReportImportController.getDisposalReport);
router.use('/reports', reportRouter);

// --- Imports & Templates ---
const importRouter = Router();
importRouter.use(authenticate);
importRouter.get('/template/:type', admin, ReportImportController.getTemplate);
importRouter.post('/upload/:type', requireRole('SUPER_ADMIN', 'IT_ADMIN'), uploadMiddleware.single('file'), ReportImportController.importData);
router.use('/imports', importRouter);

// --- Settings, Notifications & Audit ---
const sysRouter = Router();
sysRouter.use(authenticate);
sysRouter.get('/health', superAdmin, SettingsNotificationController.getHealthDetails);
sysRouter.get('/settings', superAdmin, SettingsNotificationController.getSettings);
sysRouter.put('/settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.updateSettings);
sysRouter.get('/email-settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.getEmailSettings);
sysRouter.post('/email-settings', requireRole('SUPER_ADMIN'), SettingsNotificationController.updateEmailSettings);
sysRouter.post('/email/test', requireRole('SUPER_ADMIN'), SettingsNotificationController.testEmailConnection);
sysRouter.get('/notifications', SettingsNotificationController.getNotifications);
sysRouter.put('/notifications/:id/read', SettingsNotificationController.markNotificationRead);
sysRouter.put('/notifications/read-all', SettingsNotificationController.markAllNotificationsRead);
sysRouter.get('/audit-logs', superAdmin, SettingsNotificationController.getAuditLogs);
sysRouter.get('/audit-logs/verify', superAdmin, SettingsNotificationController.verifyAuditLogs);
router.use('/system', sysRouter);

// --- Super Admin Customization Engine (Version 3) ---
import { customizationRouter } from '../customization/customizationRoutes.js';
router.use('/customization', customizationRouter);

// --- Disaster Recovery & Cloud Backup Engine (Version 3) ---
import { disasterRecoveryRouter } from '../disasterRecovery/index.js';
router.use('/system/backup', disasterRecoveryRouter);

export default router;


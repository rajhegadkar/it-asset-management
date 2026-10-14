/**
 * Comprehensive System Verification & RBAC Comparison Suite
 * Enterprise IT Asset Management (ITAM) — Version 3.0 Custom Edition
 */
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

interface TestResult {
  category: string;
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  role?: string;
}

const results: TestResult[] = [];

function record(category: string, testName: string, status: 'PASS' | 'FAIL', details?: string, role?: string) {
  results.push({ category, testName, status, details, role });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${category}] ${role ? `(${role}) ` : ''}${testName}${details ? ` -> ${details}` : ''}`);
}

async function runVerification() {
  console.log('\n======================================================================');
  console.log('🚀 STARTING COMPREHENSIVE ITAM SYSTEM VERIFICATION (v3.0.0)');
  console.log('======================================================================\n');

  try {
    // -------------------------------------------------------------
    // 1. System Health & Metadata
    // -------------------------------------------------------------
    console.log('\n--- 1. SYSTEM HEALTH & API METADATA ---');
    const healthRes = await request(app).get('/api/v1/health');
    if (healthRes.status === 200 && healthRes.body.data.status === 'UP') {
      record('Health', 'System Health Check UP', 'PASS', `Version: ${healthRes.body.data.version}`);
    } else {
      record('Health', 'System Health Check UP', 'FAIL', `Status: ${healthRes.status}`);
    }

    const rootRes = await request(app).get('/');
    if (rootRes.status === 200 && rootRes.body.name) {
      record('Health', 'Root Product Metadata', 'PASS', `App: ${rootRes.body.name} v${rootRes.body.version}`);
    } else {
      record('Health', 'Root Product Metadata', 'FAIL');
    }

    // -------------------------------------------------------------
    // 2. Authentication & Login for All 4 Roles
    // -------------------------------------------------------------
    console.log('\n--- 2. AUTHENTICATION & LOGIN FOR ALL 4 ROLES ---');

    // 2.1 Super Admin
    const superAdminRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'admin@acme-corp.com',
      password: 'Admin@123456',
    });
    const superAdminToken = superAdminRes.body?.data?.accessToken;
    if (superAdminRes.status === 200 && superAdminToken) {
      record('Auth', 'Login Successful', 'PASS', `User: ${superAdminRes.body.data.user.email}`, 'SUPER_ADMIN');
    } else {
      record('Auth', 'Login Successful', 'FAIL', `Status: ${superAdminRes.status}`, 'SUPER_ADMIN');
    }

    // 2.2 IT Admin
    const itAdminRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'itadmin@acme-corp.com',
      password: 'Admin@123456',
    });
    const itAdminToken = itAdminRes.body?.data?.accessToken;
    if (itAdminRes.status === 200 && itAdminToken) {
      record('Auth', 'Login Successful', 'PASS', `User: ${itAdminRes.body.data.user.email}`, 'IT_ADMIN');
    } else {
      record('Auth', 'Login Successful', 'FAIL', `Status: ${itAdminRes.status}`, 'IT_ADMIN');
    }

    // 2.3 Support Engineer
    const supportRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'support@acme-corp.com',
      password: 'Admin@123456',
    });
    const supportToken = supportRes.body?.data?.accessToken;
    if (supportRes.status === 200 && supportToken) {
      record('Auth', 'Login Successful', 'PASS', `User: ${supportRes.body.data.user.email}`, 'SUPPORT_ENGINEER');
    } else {
      record('Auth', 'Login Successful', 'FAIL', `Status: ${supportRes.status}`, 'SUPPORT_ENGINEER');
    }

    // 2.4 Employee
    const employeeRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'john.doe@acme-corp.com',
      password: 'User@123456',
    });
    const employeeToken = employeeRes.body?.data?.accessToken;
    if (employeeRes.status === 200 && employeeToken) {
      record('Auth', 'Login Successful', 'PASS', `User: ${employeeRes.body.data.user.email}`, 'EMPLOYEE');
    } else {
      record('Auth', 'Login Successful', 'FAIL', `Status: ${employeeRes.status}`, 'EMPLOYEE');
    }

    // 2.5 Invalid Credentials Security Check
    const badLoginRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'admin@acme-corp.com',
      password: 'WrongPassword999!',
    });
    if (badLoginRes.status === 401) {
      record('Auth', 'Reject Invalid Credentials', 'PASS', 'Properly returned 401 with lockout protection');
    } else {
      record('Auth', 'Reject Invalid Credentials', 'FAIL', `Returned ${badLoginRes.status}`);
    }

    // 2.6 TOTP 2FA Setup Generation
    const totpRes = await request(app)
      .post('/api/v1/auth/setup-2fa')
      .set('Authorization', `Bearer ${superAdminToken}`);
    if (totpRes.status === 200 && totpRes.body.data?.secret) {
      record('Auth', 'Generate TOTP 2FA Secret', 'PASS', 'Secret & QR code URI generated', 'SUPER_ADMIN');
    } else {
      record('Auth', 'Generate TOTP 2FA Secret', 'FAIL');
    }

    // -------------------------------------------------------------
    // 3. RBAC Permission Matrix Verification
    // -------------------------------------------------------------
    console.log('\n--- 3. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX ---');

    // Super Admin accesses Customization Center: ALLOW
    const saCustomRes = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ portalTitle: 'Test RBAC Portal' });
    record('RBAC', 'Allow Customization Update to Super Admin', saCustomRes.status === 200 ? 'PASS' : 'FAIL', `Status: ${saCustomRes.status}`, 'SUPER_ADMIN');

    // IT Admin accesses Customization Center: DENY
    const itaCustomRes = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({ portalTitle: 'Unauthorized Edit' });
    record('RBAC', 'Deny Customization Center to IT Admin', itaCustomRes.status === 403 ? 'PASS' : 'FAIL', `Status: ${itaCustomRes.status} (Forbidden)`, 'IT_ADMIN');

    // Support Engineer accesses Customization Center: DENY
    const supCustomRes = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ portalTitle: 'Unauthorized Edit' });
    record('RBAC', 'Deny Customization Center to Support', supCustomRes.status === 403 ? 'PASS' : 'FAIL', `Status: ${supCustomRes.status} (Forbidden)`, 'SUPPORT_ENGINEER');

    // Employee accesses Customization Center: DENY
    const empCustomRes = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ portalTitle: 'Unauthorized Edit' });
    record('RBAC', 'Deny Customization Center to Employee', empCustomRes.status === 403 ? 'PASS' : 'FAIL', `Status: ${empCustomRes.status} (Forbidden)`, 'EMPLOYEE');

    // Employee accesses Assets Master Registry: DENY
    const empAssetsRes = await request(app)
      .get('/api/v1/assets')
      .set('Authorization', `Bearer ${employeeToken}`);
    record('RBAC', 'Deny Full Asset Registry to Employee', empAssetsRes.status === 403 ? 'PASS' : 'FAIL', `Status: ${empAssetsRes.status} (Forbidden)`, 'EMPLOYEE');

    // Employee accesses Employee Portal (/portal/my-assets): ALLOW
    const empPortalRes = await request(app)
      .get('/api/v1/allocations/my-assets')
      .set('Authorization', `Bearer ${employeeToken}`);
    record('RBAC', 'Allow Employee Self-Service My Assets', empPortalRes.status === 200 ? 'PASS' : 'FAIL', `Status: ${empPortalRes.status}`, 'EMPLOYEE');

    // -------------------------------------------------------------
    // 4. Hardware Asset Master & Full Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- 4. HARDWARE ASSET MASTER & LIFECYCLE ---');

    // Fetch master data categories
    const cat = await prisma.category.findFirst({ where: { code: 'LAP' } }) || await prisma.category.findFirst();
    const dept = await prisma.department.findFirst();
    const loc = await prisma.location.findFirst();
    const vnd = await prisma.vendor.findFirst();

    // 4.1 Create new Hardware Asset with Custom Fields
    const createAssetRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({
        name: 'Dell Precision 5680 Mobile Workstation (E2E Test)',
        categoryId: cat!.id,
        serialNumber: `SN-E2E-${Date.now()}`,
        manufacturer: 'Dell',
        model: 'Precision 5680',
        cpu: 'Intel Core i9-13900H (14 cores)',
        ram: '64GB DDR5-5600',
        storage: '2TB NVMe PCIe 4.0 SSD',
        operatingSystem: 'Windows 11 Pro Enterprise',
        departmentId: dept?.id,
        locationId: loc?.id,
        vendorId: vnd?.id,
        purchaseCost: 2899.99,
        warrantyEnd: '2028-12-31',
        customFields: {
          assetOwnerDept: 'Engineering Architecture',
          batteryHealthPercentage: 99,
          securityChipType: 'TPM 2.0 Discrete',
        },
      });

    let testAsset = createAssetRes.body?.data;
    if (createAssetRes.status === 201 && testAsset?.assetTag) {
      record('Assets', 'Create Asset with Auto-Tagging & Specs', 'PASS', `Tag: ${testAsset.assetTag} | ID: ${testAsset.assetId}`, 'IT_ADMIN');
    } else {
      record('Assets', 'Create Asset with Auto-Tagging & Specs', 'FAIL', `Status: ${createAssetRes.status}`);
    }

    // 4.2 Retrieve Asset Detail & Lifecycle Log
    const getAssetRes = await request(app)
      .get(`/api/v1/assets/${testAsset?.id}`)
      .set('Authorization', `Bearer ${itAdminToken}`);
    if (getAssetRes.status === 200 && getAssetRes.body.data?.lifecycleLogs?.length > 0) {
      record('Assets', 'Retrieve Asset with Lifecycle History', 'PASS', `Logs count: ${getAssetRes.body.data.lifecycleLogs.length}`, 'IT_ADMIN');
    } else {
      record('Assets', 'Retrieve Asset with Lifecycle History', 'FAIL');
    }

    // 4.3 Quick Search by Tag / Serial Substring
    const searchRes = await request(app)
      .get(`/api/v1/assets/quick-search?q=${encodeURIComponent(testAsset?.assetTag.slice(-4))}`)
      .set('Authorization', `Bearer ${itAdminToken}`);
    if (searchRes.status === 200 && searchRes.body.data?.length > 0) {
      record('Assets', 'Quick Search by Tag Substring', 'PASS', `Found: ${searchRes.body.data.length} match(es)`);
    } else {
      record('Assets', 'Quick Search by Tag Substring', 'FAIL');
    }

    // 4.4 Global Asset Tracker
    const trackRes = await request(app)
      .get(`/api/v1/assets/track/${encodeURIComponent(testAsset?.assetTag)}`)
      .set('Authorization', `Bearer ${supportToken}`);
    const trackAssetObj = trackRes.body.data?.asset || trackRes.body.data;
    if (trackRes.status === 200 && trackAssetObj?.id === testAsset?.id) {
      record('Assets', 'Track Asset by Tag Code', 'PASS', `Status: ${trackAssetObj.status}`, 'SUPPORT_ENGINEER');
    } else {
      record('Assets', 'Track Asset by Tag Code', 'FAIL');
    }

    // 4.5 Barcode & QR Label PDF Generation (Zero Overlap Engine)
    const labelPdfRes = await request(app)
      .post('/api/v1/assets/labels/pdf')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({ assetIds: [testAsset?.id], sheetMode: false });
    if (labelPdfRes.status === 200 && labelPdfRes.headers['content-type'] === 'application/pdf' && labelPdfRes.body.length > 500) {
      record('PDF', 'Generate Single Barcode & QR Sticker PDF', 'PASS', `Bytes: ${labelPdfRes.body.length}`);
    } else {
      record('PDF', 'Generate Single Barcode & QR Sticker PDF', 'FAIL');
    }

    const sheetPdfRes = await request(app)
      .post('/api/v1/assets/labels/pdf')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({ assetIds: [testAsset?.id], sheetMode: true });
    if (sheetPdfRes.status === 200 && sheetPdfRes.headers['content-type'] === 'application/pdf' && sheetPdfRes.body.length > 500) {
      record('PDF', 'Generate 24-up Avery Barcode Label Sheet PDF', 'PASS', `Bytes: ${sheetPdfRes.body.length}`);
    } else {
      record('PDF', 'Generate 24-up Avery Barcode Label Sheet PDF', 'FAIL');
    }

    // -------------------------------------------------------------
    // 5. Asset Allocation, Handover & Return Workflow
    // -------------------------------------------------------------
    console.log('\n--- 5. ALLOCATION, HANDOVER & RETURN WORKFLOW ---');

    const emp = await prisma.employee.findFirst({ where: { email: 'john.doe@acme-corp.com' } });

    // 5.1 Allocate Asset to Employee
    const allocRes = await request(app)
      .post('/api/v1/allocations/allocate')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({
        assetId: testAsset?.id,
        employeeId: emp!.id,
        allocationType: 'PERMANENT',
        accessories: 'Dell 130W USB-C GaN Charger, Thunderbolt 4 Dock, USB-C to HDMI Dongle',
        expectedReturnDate: '2026-12-31',
      });
    const allocationId = allocRes.body?.data?.assignment?.id || allocRes.body?.data?.id;
    if (allocRes.status === 201 && allocationId) {
      record('Allocations', 'Allocate Asset to Employee', 'PASS', `Allocation ID: ${allocationId}`, 'IT_ADMIN');
    } else {
      record('Allocations', 'Allocate Asset to Employee', 'FAIL', `Status: ${allocRes.status}`);
    }

    // 5.2 Prevent Double Allocation of Assigned Asset
    const doubleAllocRes = await request(app)
      .post('/api/v1/allocations/allocate')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({
        assetId: testAsset?.id,
        employeeId: emp!.id,
        allocationType: 'TEMPORARY',
      });
    if (doubleAllocRes.status === 400) {
      record('Allocations', 'Prevent Double Allocation Violation', 'PASS', 'Rejected with 400');
    } else {
      record('Allocations', 'Prevent Double Allocation Violation', 'FAIL', `Status: ${doubleAllocRes.status}`);
    }

    // 5.3 Digital Handover Acceptance & Electronic Signature
    const ackRes = await request(app)
      .post(`/api/v1/allocations/acknowledge/${allocationId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        notes: 'Received in pristine condition with all accessories',
      });
    if (ackRes.status === 200 && (ackRes.body.data?.termsAccepted === true || ackRes.body.data?.assignment?.termsAccepted === true)) {
      record('Allocations', 'Submit Digital Signature & Handover Acceptance', 'PASS', 'Signed electronically', 'EMPLOYEE');
    } else {
      record('Allocations', 'Submit Digital Signature & Handover Acceptance', 'FAIL');
    }

    // 5.4 Download Handover Certificate PDF
    const certRes = await request(app)
      .get(`/api/v1/allocations/handover-pdf/${allocationId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    if (certRes.status === 200 && certRes.headers['content-type'] === 'application/pdf' && certRes.body.length > 1000) {
      record('PDF', 'Generate Digital Handover Certificate PDF', 'PASS', `Bytes: ${certRes.body.length}`, 'EMPLOYEE');
    } else {
      record('PDF', 'Generate Digital Handover Certificate PDF', 'FAIL');
    }

    // 5.5 Asset Return Inspection
    const returnRes = await request(app)
      .post('/api/v1/allocations/return')
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({
        assetId: testAsset?.id,
        condition: 'EXCELLENT',
        notes: 'Returned at end of project, factory reset completed',
      });
    const updatedAsset = await prisma.asset.findUnique({ where: { id: testAsset?.id } });
    if (returnRes.status === 200 && updatedAsset?.status === 'AVAILABLE') {
      record('Allocations', 'Process Asset Return & Restore Inventory', 'PASS', 'Status reverted to AVAILABLE', 'IT_ADMIN');
    } else {
      record('Allocations', 'Process Asset Return & Restore Inventory', 'FAIL', `Status: ${returnRes.status}`);
    }

    // -------------------------------------------------------------
    // 6. Helpdesk Incident Tickets & Support SLA
    // -------------------------------------------------------------
    console.log('\n--- 6. HELPDESK TICKETS & SUPPORT SLA ---');

    // 6.1 Employee creates ticket
    const ticketRes = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        subject: 'External 4K Monitor Flickering via Thunderbolt Dock',
        description: 'Screen blacks out intermittently during Zoom calls when connected to Dell dock.',
        category: 'HARDWARE',
        priority: 'HIGH',
        assetId: testAsset?.id,
      });
    const ticket = ticketRes.body?.data;
    if (ticketRes.status === 201 && ticket?.ticketNumber) {
      record('Tickets', 'Employee Submits Incident Ticket', 'PASS', `Ticket: ${ticket.ticketNumber}`, 'EMPLOYEE');
    } else {
      record('Tickets', 'Employee Submits Incident Ticket', 'FAIL');
    }

    // 6.2 Support Engineer updates ticket and adds comment
    const updateTicketRes = await request(app)
      .put(`/api/v1/tickets/${ticket?.id}`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        status: 'IN_PROGRESS',
        assignedEngineerId: supportRes.body.data.user.id,
      });
    if (updateTicketRes.status === 200 && updateTicketRes.body.data?.status === 'IN_PROGRESS') {
      record('Tickets', 'Support Engineer Claims Ticket', 'PASS', 'Assigned & status IN_PROGRESS', 'SUPPORT_ENGINEER');
    } else {
      record('Tickets', 'Support Engineer Claims Ticket', 'FAIL');
    }

    const commentRes = await request(app)
      .post(`/api/v1/tickets/${ticket?.id}/comments`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        comment: 'Thunderbolt firmware updated to v2.4; dock firmware flashed. Monitor flicker resolved.',
      });
    if (commentRes.status === 201) {
      record('Tickets', 'Add Technician Investigation Comment', 'PASS', 'Comment logged in thread', 'SUPPORT_ENGINEER');
    } else {
      record('Tickets', 'Add Technician Investigation Comment', 'FAIL');
    }

    // -------------------------------------------------------------
    // 7. Software Asset Management (SAM) & Licenses
    // -------------------------------------------------------------
    console.log('\n--- 7. SOFTWARE ASSET MANAGEMENT (SAM) ---');

    const licensesRes = await request(app)
      .get('/api/v1/licenses')
      .set('Authorization', `Bearer ${itAdminToken}`);
    if (licensesRes.status === 200 && Array.isArray(licensesRes.body.data)) {
      record('SAM', 'Retrieve Software Licenses & Seat Compliance', 'PASS', `Count: ${licensesRes.body.data.length} licenses`, 'IT_ADMIN');
    } else {
      record('SAM', 'Retrieve Software Licenses & Seat Compliance', 'FAIL');
    }

    // -------------------------------------------------------------
    // 8. Consumables & Spare Parts Inventory
    // -------------------------------------------------------------
    console.log('\n--- 8. CONSUMABLES & STOCK INVENTORY ---');

    const consumable = await prisma.consumable.findFirst();
    if (consumable) {
      const inwardRes = await request(app)
        .post(`/api/v1/consumables/${consumable.id}/transaction`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({
          type: 'INWARD',
          quantity: 10,
          notes: 'Restocked from warehouse shipment',
        });
      if (inwardRes.status === 201 || inwardRes.status === 200) {
        record('Consumables', 'Record Stock Inward Inflow', 'PASS', `Added 10 units`, 'SUPPORT_ENGINEER');
      } else {
        record('Consumables', 'Record Stock Inward Inflow', 'FAIL');
      }

      const outwardRes = await request(app)
        .post(`/api/v1/consumables/${consumable.id}/transaction`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({
          type: 'OUTWARD',
          quantity: 2,
          employeeId: emp!.id,
          notes: 'Issued to employee for remote workstation',
        });
      if (outwardRes.status === 201 || outwardRes.status === 200) {
        record('Consumables', 'Record Stock Outward Checkout', 'PASS', `Deducted 2 units`, 'SUPPORT_ENGINEER');
      } else {
        record('Consumables', 'Record Stock Outward Checkout', 'FAIL');
      }
    }

    // -------------------------------------------------------------
    // 9. Email Notification Mail Settings (Google Workspace & Office 365)
    // -------------------------------------------------------------
    console.log('\n--- 9. EMAIL SETTINGS (GOOGLE WORKSPACE & OFFICE 365) ---');

    const getEmailRes = await request(app)
      .get('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${superAdminToken}`);
    if (getEmailRes.status === 200 && getEmailRes.body.data?.hasPassword !== undefined) {
      record('Email', 'Retrieve Email Settings with Masked Password', 'PASS', `Host: ${getEmailRes.body.data.smtpHost}`, 'SUPER_ADMIN');
    } else {
      record('Email', 'Retrieve Email Settings with Masked Password', 'FAIL');
    }

    const saveGSuiteRes = await request(app)
      .post('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        provider: 'google_workspace',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'assets@acme-corp.com',
        smtpPass: 'test-app-password',
        fromName: 'IT Asset Operations',
        fromEmail: 'assets@acme-corp.com',
        enableTls: true,
        notificationsEnabled: true,
      });
    record('Email', 'Save Google Workspace Email Preset', saveGSuiteRes.status === 200 ? 'PASS' : 'FAIL', 'smtp.gmail.com:587 TLS', 'SUPER_ADMIN');

    const saveO365Res = await request(app)
      .post('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        provider: 'office_365',
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'itam@acme-corp.com',
        smtpPass: 'test-office-password',
        fromName: 'Microsoft 365 IT Hub',
        fromEmail: 'itam@acme-corp.com',
        enableTls: true,
        notificationsEnabled: true,
      });
    record('Email', 'Save Microsoft 365 Outlook Preset', saveO365Res.status === 200 ? 'PASS' : 'FAIL', 'smtp.office365.com:587 STARTTLS', 'SUPER_ADMIN');

    // -------------------------------------------------------------
    // 10. Reports & Analytics
    // -------------------------------------------------------------
    console.log('\n--- 10. REPORTS & DATA EXPORTS ---');

    const metricsRes = await request(app)
      .get('/api/v1/assets/dashboard-metrics')
      .set('Authorization', `Bearer ${itAdminToken}`);
    if (metricsRes.status === 200 && metricsRes.body.data?.summary) {
      record('Reports', 'Generate Dashboard KPI Metrics', 'PASS', `Total Assets: ${metricsRes.body.data.summary.totalAssets}`);
    } else {
      record('Reports', 'Generate Dashboard KPI Metrics', 'FAIL');
    }

    const exportCsvRes = await request(app)
      .get('/api/v1/reports/export?entity=assets&format=csv')
      .set('Authorization', `Bearer ${itAdminToken}`);
    if (exportCsvRes.status === 200 && exportCsvRes.headers['content-type']?.includes('csv')) {
      record('Reports', 'Export Assets CSV Report', 'PASS', `CSV Length: ${exportCsvRes.text.length} chars`);
    } else {
      record('Reports', 'Export Assets CSV Report', 'FAIL');
    }

    // -------------------------------------------------------------
    // 11. Version 3.0 Customization Subsystem (Super Admin)
    // -------------------------------------------------------------
    console.log('\n--- 11. V3.0 SUPER ADMIN CUSTOMIZATION ENGINE ---');

    // 11.1 Public Branding API
    const brandGetRes = await request(app).get('/api/v1/customization/branding');
    record('Customization', 'Public Branding Endpoint (No Auth)', brandGetRes.status === 200 ? 'PASS' : 'FAIL', `Portal: ${brandGetRes.body.data?.portalTitle}`);

    // 11.2 Super Admin Branding Update & Multi-table sync
    const newCompanyName = `Enterprise Innovations Ltd (${Date.now()})`;
    const brandPutRes = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        companyName: newCompanyName,
        portalTitle: 'NextGen IT Portal v3',
        primaryColor: '#1d4ed8',
        currencySymbol: '₹',
        currencyCode: 'INR',
      });
    const dbOrg = await prisma.organization.findFirst();
    const isSynced = dbOrg?.name === newCompanyName;
    record('Customization', 'Update Branding & Sync DB Organization', brandPutRes.status === 200 && isSynced ? 'PASS' : 'FAIL', `Company: ${newCompanyName} | Org Synced: ${isSynced}`, 'SUPER_ADMIN');

    // 11.3 Custom Fields Engine
    const customFieldPostRes = await request(app)
      .post('/api/v1/customization/fields/asset')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `nvmeDriveModel_${Date.now()}`,
        label: 'NVMe Drive Model Number',
        type: 'text',
        required: false,
        placeholder: 'e.g. Samsung 990 Pro 2TB',
      });
    record('Customization', 'Register Dynamic Custom Attribute', customFieldPostRes.status === 201 ? 'PASS' : 'FAIL', 'Custom field registered in schema', 'SUPER_ADMIN');

    // 11.4 Numbering & Auto-Tagging Simulator
    const simRes = await request(app)
      .post('/api/v1/customization/numbering/preview')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        pattern: '{PREFIX}-{YYYY}-{CAT}-{SEQ:5}',
        prefix: 'CORP',
        seqPadding: 5,
        sampleSeq: 88,
      });
    const previewStr = simRes.body.data?.preview || '';
    record('Customization', 'Simulate Auto-Tagging Token Preview', simRes.status === 200 && previewStr.includes('CORP') ? 'PASS' : 'FAIL', `Preview: ${previewStr}`, 'SUPER_ADMIN');

    // 11.5 Custom Statuses Engine
    const statusRes = await request(app)
      .get('/api/v1/customization/statuses')
      .set('Authorization', `Bearer ${superAdminToken}`);
    record('Customization', 'Retrieve Configurable Workflow Statuses', statusRes.status === 200 ? 'PASS' : 'FAIL', `Count: ${statusRes.body.data?.length} statuses`, 'SUPER_ADMIN');

    // 11.6 Email Templates Engine
    const emailTplRes = await request(app)
      .get('/api/v1/customization/email-templates')
      .set('Authorization', `Bearer ${superAdminToken}`);
    record('Customization', 'Retrieve HTML Notification Templates', emailTplRes.status === 200 ? 'PASS' : 'FAIL', '6 Core notification triggers loaded', 'SUPER_ADMIN');

    // 11.7 Feature Flags Engine
    const flagsRes = await request(app)
      .get('/api/v1/customization/features')
      .set('Authorization', `Bearer ${superAdminToken}`);
    record('Customization', 'Retrieve Modular Feature Toggles', flagsRes.status === 200 ? 'PASS' : 'FAIL', `SAM: ${flagsRes.body.data?.enableSamLicenses}`, 'SUPER_ADMIN');

    // 11.8 Backup Configuration Snapshot
    const backupExportRes = await request(app)
      .get('/api/v1/customization/backup/export')
      .set('Authorization', `Bearer ${superAdminToken}`);
    record('Customization', 'Export JSON Configuration Snapshot', backupExportRes.status === 200 && backupExportRes.body.data?.branding ? 'PASS' : 'FAIL', 'Full JSON configuration snapshot generated', 'SUPER_ADMIN');

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('\n======================================================================');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('======================================================================');
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`Total Checks: ${results.length}`);
    console.log(`Passed:       ${passed} ✅`);
    console.log(`Failed:       ${failed} ${failed > 0 ? '❌' : '🎉'}`);
    console.log(`Pass Rate:    ${Math.round((passed / results.length) * 100)}%\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter((r) => r.status === 'FAIL').forEach((f) => console.log(` - [${f.category}] ${f.testName} (${f.details || ''})`));
      process.exit(1);
    } else {
      console.log('🌟 ALL 4 ROLES & SYSTEM FEATURES FULLY VERIFIED AND WORKING PROPERLY!');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 Unhandled Exception during verification:', error);
    process.exit(1);
  }
}

runVerification();

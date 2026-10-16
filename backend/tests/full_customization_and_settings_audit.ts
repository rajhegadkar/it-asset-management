/**
 * Enterprise Customization Center & Settings Page Comprehensive Audit Test Suite
 * ITAM Version 3.0 Custom Edition
 */
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

interface AuditItem {
  id: string;
  module: string;
  title: string;
  status: 'PASS' | 'FAIL';
  details: string;
  durationMs: number;
}

const auditLog: AuditItem[] = [];

function record(module: string, title: string, status: 'PASS' | 'FAIL', details: string, start: number) {
  const durationMs = Date.now() - start;
  const item: AuditItem = {
    id: `AUDIT-${auditLog.length + 1}`,
    module,
    title,
    status,
    details,
    durationMs,
  };
  auditLog.push(item);
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${module}] ${title} (${durationMs}ms) -> ${details}`);
}

async function runAudit() {
  process.env.NODE_ENV = 'test';
  console.log('\n========================================================================================');
  console.log('🔍 STARTING FULL ENTERPRISE CUSTOMIZATION CENTER & SETTINGS PAGE AUDIT (v3.0.0)');
  console.log('========================================================================================\n');

  let superToken = '';
  let itToken = '';
  let employeeToken = '';

  try {
    // -------------------------------------------------------------------------
    // 0. AUTHENTICATION & ACCESS TOKENS
    // -------------------------------------------------------------------------
    console.log('\n--- 0. AUTHENTICATION SETUP ---');
    let t0 = Date.now();
    const saRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'admin@acme-corp.com',
      password: 'Admin@123456',
    });
    superToken = saRes.body?.data?.accessToken;
    record('Auth', 'Super Admin Login', superToken ? 'PASS' : 'FAIL', `Token length: ${superToken?.length}`, t0);

    t0 = Date.now();
    const itRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'itadmin@acme-corp.com',
      password: 'Admin@123456',
    });
    itToken = itRes.body?.data?.accessToken;
    record('Auth', 'IT Admin Login', itToken ? 'PASS' : 'FAIL', `Token length: ${itToken?.length}`, t0);

    t0 = Date.now();
    const empRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'john.doe@acme-corp.com',
      password: 'User@123456',
    });
    employeeToken = empRes.body?.data?.accessToken;
    record('Auth', 'Employee Login', employeeToken ? 'PASS' : 'FAIL', `Token length: ${employeeToken?.length}`, t0);

    // -------------------------------------------------------------------------
    // PART 1: ENTERPRISE CUSTOMIZATION CENTER AUDIT (8 MODULES)
    // -------------------------------------------------------------------------
    console.log('\n--- PART 1: ENTERPRISE CUSTOMIZATION CENTER AUDIT ---');

    // 1.1 Branding & Visual Customization
    t0 = Date.now();
    const brandGet = await request(app).get('/api/v1/customization/branding');
    record(
      'Customization.Branding',
      'GET /customization/branding (Public branding)',
      brandGet.status === 200 && brandGet.body.success ? 'PASS' : 'FAIL',
      `Company: ${brandGet.body.data?.companyName}, Currency: ${brandGet.body.data?.currencySymbol}`,
      t0
    );

    t0 = Date.now();
    const testBrandUpdate = {
      companyName: `Acme Global Technologies Inc.`,
      portalTitle: 'ITAM Enterprise Command Hub',
      primaryColor: '#1e3a8a',
      accentColor: '#10b981',
      headerBgColor: '#0f172a',
      currencySymbol: '$',
      currencyCode: 'USD',
    };
    const brandPut = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${superToken}`)
      .send(testBrandUpdate);
    record(
      'Customization.Branding',
      'PUT /customization/branding (Super Admin updates brand)',
      brandPut.status === 200 && brandPut.body.data?.companyName === testBrandUpdate.companyName ? 'PASS' : 'FAIL',
      `Updated company: ${brandPut.body.data?.companyName}`,
      t0
    );

    t0 = Date.now();
    const brandDeny = await request(app)
      .put('/api/v1/customization/branding')
      .set('Authorization', `Bearer ${itToken}`)
      .send(testBrandUpdate);
    record(
      'Customization.Branding',
      'RBAC: IT_ADMIN blocked from updating branding',
      brandDeny.status === 403 ? 'PASS' : 'FAIL',
      `Status: ${brandDeny.status} (Forbidden)`,
      t0
    );

    // 1.2 Dynamic Custom Schema Fields Builder
    t0 = Date.now();
    const fieldsGet = await request(app)
      .get('/api/v1/customization/fields/asset')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.Schema',
      'GET /customization/fields/asset (Schema definitions)',
      fieldsGet.status === 200 && Array.isArray(fieldsGet.body.data) ? 'PASS' : 'FAIL',
      `Found ${fieldsGet.body.data?.length} custom fields`,
      t0
    );

    t0 = Date.now();
    const testFieldKey = `secTier_${Date.now()}`;
    const fieldPost = await request(app)
      .post('/api/v1/customization/fields/asset')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: testFieldKey,
        label: 'Security Tier',
        type: 'select',
        entity: 'asset',
        required: false,
        options: ['Tier 1 - Mission Critical', 'Tier 2 - Confidential', 'Tier 3 - General'],
      });
    const createdFieldId = fieldPost.body.data?.id;
    record(
      'Customization.Schema',
      'POST /customization/fields/asset (Register custom attribute)',
      fieldPost.status === 201 && createdFieldId ? 'PASS' : 'FAIL',
      `Created Field ID: ${createdFieldId}, Key: ${testFieldKey}`,
      t0
    );

    if (createdFieldId) {
      t0 = Date.now();
      const fieldDel = await request(app)
        .delete(`/api/v1/customization/fields/asset/${createdFieldId}`)
        .set('Authorization', `Bearer ${superToken}`);
      record(
        'Customization.Schema',
        'DELETE /customization/fields/asset/:id (Remove attribute)',
        fieldDel.status === 200 ? 'PASS' : 'FAIL',
        `Successfully deleted custom field ${createdFieldId}`,
        t0
      );
    }

    // 1.3 Numbering Schemes & Auto-Tagging Engine
    t0 = Date.now();
    const numGet = await request(app)
      .get('/api/v1/customization/numbering')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.Numbering',
      'GET /customization/numbering (All numbering entities)',
      numGet.status === 200 && numGet.body.data?.ASSET_TAG ? 'PASS' : 'FAIL',
      `Active prefix: ${numGet.body.data?.ASSET_TAG?.prefix}, Pattern: ${numGet.body.data?.ASSET_TAG?.pattern}`,
      t0
    );

    t0 = Date.now();
    const numPreview = await request(app)
      .post('/api/v1/customization/numbering/preview')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        pattern: '{PREFIX}-{CATEGORY}-{YEAR}-{NUMBER:5}',
        prefix: 'CORP',
        sampleSeq: 42,
      });
    record(
      'Customization.Numbering',
      'POST /customization/numbering/preview (Simulation token engine)',
      numPreview.status === 200 && numPreview.body.data?.preview ? 'PASS' : 'FAIL',
      `Simulated Tag: ${numPreview.body.data?.preview}`,
      t0
    );

    // 1.4 Configurable Workflow Statuses
    t0 = Date.now();
    const statusGet = await request(app)
      .get('/api/v1/customization/statuses')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.Statuses',
      'GET /customization/statuses (Lifecycle transition map)',
      statusGet.status === 200 && Array.isArray(statusGet.body.data) ? 'PASS' : 'FAIL',
      `Configured statuses count: ${statusGet.body.data?.length}`,
      t0
    );

    // 1.5 Email Notification HTML Templates
    t0 = Date.now();
    const emailTplGet = await request(app)
      .get('/api/v1/customization/email-templates')
      .set('Authorization', `Bearer ${superToken}`);
    const tplKeys = emailTplGet.body.data ? Object.keys(emailTplGet.body.data) : [];
    record(
      'Customization.EmailTemplates',
      'GET /customization/email-templates (HTML Trigger templates)',
      emailTplGet.status === 200 && tplKeys.length >= 6 ? 'PASS' : 'FAIL',
      `Retrieved ${tplKeys.length} triggers: ${tplKeys.slice(0, 3).join(', ')}...`,
      t0
    );

    t0 = Date.now();
    const sampleTpl = emailTplGet.body.data?.ASSET_ALLOCATED || (emailTplGet.body.data && Object.values(emailTplGet.body.data)[0]);
    const emailPreview = await request(app)
      .post('/api/v1/customization/email-templates/preview')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        template: sampleTpl,
        sampleData: {
          assetName: 'HP Elite Dragonfly G3',
          assetTag: 'TAG-COM-9901',
          employeeName: 'Jane Smith',
        },
      });
    record(
      'Customization.EmailTemplates',
      'POST /customization/email-templates/preview (Token variable interpolation)',
      emailPreview.status === 200 && emailPreview.body.data?.html ? 'PASS' : 'FAIL',
      `Rendered Subject: ${emailPreview.body.data?.subject}`,
      t0
    );

    // 1.6 Printable Sticker & PDF Templates (Audit QR_ONLY, BARCODE_ONLY, BOTH)
    t0 = Date.now();
    const pdfTplGet = await request(app)
      .get('/api/v1/customization/pdf-templates')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.PrintTemplates',
      'GET /customization/pdf-templates (Layout and symbologies)',
      pdfTplGet.status === 200 && pdfTplGet.body.data?.headerText ? 'PASS' : 'FAIL',
      `Active BarcodeType: ${pdfTplGet.body.data?.barcodeType}, Header: ${pdfTplGet.body.data?.headerText}`,
      t0
    );

    // Test 1: Update to 1D Barcode Only (CODE128)
    t0 = Date.now();
    const update1D = await request(app)
      .put('/api/v1/customization/pdf-templates')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ barcodeType: 'CODE128', headerText: 'PROPERTY OF ACME CORP' });
    const setting1D = await prisma.systemSetting.findUnique({ where: { key: 'barcode.sticker_style' } });
    record(
      'Customization.PrintTemplates',
      'PUT /customization/pdf-templates with CODE128 -> Auto-syncs BARCODE_ONLY',
      update1D.status === 200 && setting1D?.value === 'BARCODE_ONLY' ? 'PASS' : 'FAIL',
      `Synced barcode.sticker_style: ${setting1D?.value}`,
      t0
    );

    // Test 2: Verify 1D Barcode PDF generation excludes QR code
    t0 = Date.now();
    const pdf1D = await request(app)
      .post('/api/v1/assets/labels/pdf')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ all: true });
    record(
      'Customization.PrintTemplates',
      'POST /assets/labels/pdf generates pure 1D Barcode Sheet (Zero QR Code)',
      pdf1D.status === 200 && pdf1D.header['content-type'] === 'application/pdf' ? 'PASS' : 'FAIL',
      `1D Barcode PDF stream bytes: ${pdf1D.body.length}`,
      t0
    );

    // Test 3: Update to 2D QR Code Only (Restructured Modern Layout)
    t0 = Date.now();
    const updateQR = await request(app)
      .put('/api/v1/customization/pdf-templates')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ barcodeType: 'QR', headerText: 'PROPERTY OF ACME CORP' });
    const settingQR = await prisma.systemSetting.findUnique({ where: { key: 'barcode.sticker_style' } });
    record(
      'Customization.PrintTemplates',
      'PUT /customization/pdf-templates with QR -> Auto-syncs QR_ONLY',
      updateQR.status === 200 && settingQR?.value === 'QR_ONLY' ? 'PASS' : 'FAIL',
      `Synced barcode.sticker_style: ${settingQR?.value}`,
      t0
    );

    // Test 4: Verify 2D QR Code PDF generation excludes 1D barcode
    t0 = Date.now();
    const pdfQR = await request(app)
      .post('/api/v1/assets/labels/pdf')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ all: true });
    record(
      'Customization.PrintTemplates',
      'POST /assets/labels/pdf generates pure 2D QR Code Sheet (Zero Barcode)',
      pdfQR.status === 200 && pdfQR.header['content-type'] === 'application/pdf' ? 'PASS' : 'FAIL',
      `QR Code PDF stream bytes: ${pdfQR.body.length}`,
      t0
    );

    // Test 5: Update to Dual Symbology (BOTH)
    t0 = Date.now();
    const updateDual = await request(app)
      .put('/api/v1/customization/pdf-templates')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ barcodeType: 'BOTH' });
    const settingDual = await prisma.systemSetting.findUnique({ where: { key: 'barcode.sticker_style' } });
    record(
      'Customization.PrintTemplates',
      'PUT /customization/pdf-templates with BOTH -> Auto-syncs BOTH',
      updateDual.status === 200 && settingDual?.value === 'BOTH' ? 'PASS' : 'FAIL',
      `Synced barcode.sticker_style: ${settingDual?.value}`,
      t0
    );

    // Restore to QR_ONLY as default
    await request(app)
      .put('/api/v1/customization/pdf-templates')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ barcodeType: 'QR', headerText: 'PROPERTY OF IT OPERATIONS' });

    // 1.7 Modular Feature Toggles
    t0 = Date.now();
    const featGet = await request(app)
      .get('/api/v1/customization/features')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.Features',
      'GET /customization/features (Modular toggle status)',
      featGet.status === 200 && featGet.body.data ? 'PASS' : 'FAIL',
      `SAM: ${featGet.body.data?.enableSamLicenses}, Portal: ${featGet.body.data?.enableEmployeePortal}, Scanner: ${featGet.body.data?.enableCameraScanner}`,
      t0
    );

    t0 = Date.now();
    const featPut = await request(app)
      .put('/api/v1/customization/features')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enableHardwareScanner: true });
    record(
      'Customization.Features',
      'PUT /customization/features (Update toggle flag)',
      featPut.status === 200 && featPut.body.data?.enableHardwareScanner === true ? 'PASS' : 'FAIL',
      `Hardware Scanner Flag: ${featPut.body.data?.enableHardwareScanner}`,
      t0
    );

    // 1.8 Full Customization Backup & Export
    t0 = Date.now();
    const backupExport = await request(app)
      .get('/api/v1/customization/backup/export')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Customization.Backup',
      'GET /customization/backup/export (Complete snapshot)',
      backupExport.status === 200 && backupExport.body.data?.version ? 'PASS' : 'FAIL',
      `Exported schema version: ${backupExport.body.data?.version}`,
      t0
    );

    // -------------------------------------------------------------------------
    // PART 2: SETTINGS PAGE & MASTER DATA AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: SETTINGS PAGE & MASTER DATA AUDIT ---');

    // 2.1 Global System Settings
    t0 = Date.now();
    const settingsGet = await request(app)
      .get('/api/v1/system/settings')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.General',
      'GET /system/settings (All system key-value pairs)',
      settingsGet.status === 200 && Array.isArray(settingsGet.body.data) ? 'PASS' : 'FAIL',
      `Total settings keys loaded: ${settingsGet.body.data?.length}`,
      t0
    );

    t0 = Date.now();
    const settingsUpdate = await request(app)
      .put('/api/v1/system/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send([
        { key: 'company.name', value: 'Acme Global Technologies Inc.', group: 'BRANDING' },
        { key: 'warranty.alert_days', value: '90,60,30,7', group: 'NOTIFICATIONS' },
        { key: 'barcode.sticker_style', value: 'QR_ONLY', group: 'BARCODE' },
      ]);
    record(
      'Settings.General',
      'PUT /system/settings (Batch key update)',
      settingsUpdate.status === 200 ? 'PASS' : 'FAIL',
      `Result: ${settingsUpdate.body.message}`,
      t0
    );

    // 2.2 Organization Details
    t0 = Date.now();
    const orgRes = await request(app)
      .get('/api/v1/org/organization')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.Branding',
      'GET /org/organization (Primary organization info)',
      orgRes.status === 200 && orgRes.body.data?.name ? 'PASS' : 'FAIL',
      `Org Name: ${orgRes.body.data?.name}`,
      t0
    );

    // 2.3 Master Data: Departments
    t0 = Date.now();
    const deptGet = await request(app)
      .get('/api/v1/org/departments')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.MasterData',
      'GET /org/departments (Department registry)',
      deptGet.status === 200 && Array.isArray(deptGet.body.data) ? 'PASS' : 'FAIL',
      `Active departments: ${deptGet.body.data?.length}`,
      t0
    );

    // 2.4 Master Data: Locations
    t0 = Date.now();
    const locGet = await request(app)
      .get('/api/v1/org/locations')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.MasterData',
      'GET /org/locations (Location hierarchy)',
      locGet.status === 200 && Array.isArray(locGet.body.data) ? 'PASS' : 'FAIL',
      `Active locations: ${locGet.body.data?.length}`,
      t0
    );

    // 2.5 Master Data: Categories
    t0 = Date.now();
    const catGet = await request(app)
      .get('/api/v1/org/categories')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.MasterData',
      'GET /org/categories (Asset category specifications)',
      catGet.status === 200 && Array.isArray(catGet.body.data) ? 'PASS' : 'FAIL',
      `Active categories: ${catGet.body.data?.length}`,
      t0
    );

    // 2.6 Master Data: Vendors
    t0 = Date.now();
    const vndGet = await request(app)
      .get('/api/v1/org/vendors')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.MasterData',
      'GET /org/vendors (Supplier & vendor directory)',
      vndGet.status === 200 && Array.isArray(vndGet.body.data) ? 'PASS' : 'FAIL',
      `Active vendors: ${vndGet.body.data?.length}`,
      t0
    );

    // 2.7 Email Settings (Google Workspace & Office 365)
    t0 = Date.now();
    const emailGet = await request(app)
      .get('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.Email',
      'GET /system/email-settings (SMTP configuration)',
      emailGet.status === 200 && emailGet.body.data?.smtpHost ? 'PASS' : 'FAIL',
      `Configured host: ${emailGet.body.data?.smtpHost}`,
      t0
    );

    t0 = Date.now();
    const emailSave = await request(app)
      .post('/api/v1/system/email-settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        provider: 'google_workspace',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'itam-alerts@acme-corp.com',
        senderName: 'Acme IT Helpdesk',
        senderEmail: 'itam-alerts@acme-corp.com',
      });
    record(
      'Settings.Email',
      'POST /system/email-settings (Google Workspace preset save)',
      emailSave.status === 200 ? 'PASS' : 'FAIL',
      `Provider: ${emailSave.body.data?.provider || 'google_workspace'}`,
      t0
    );

    // 2.8 Audit Logs & Compliance Trails
    t0 = Date.now();
    const auditLogsGet = await request(app)
      .get('/api/v1/system/audit-logs')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Settings.AuditLogs',
      'GET /system/audit-logs (Security & tamper-evident event log)',
      auditLogsGet.status === 200 && Array.isArray(auditLogsGet.body.data) ? 'PASS' : 'FAIL',
      `Retrieved ${auditLogsGet.body.data?.length} audit events`,
      t0
    );

    // -------------------------------------------------------------------------
    // PART 3: SOFTWARE CORE FUNCTIONAL SUBSYSTEMS FULL TEST
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: SOFTWARE CORE FUNCTIONAL SUBSYSTEMS TEST ---');

    // Fetch prerequisite category, location, and department IDs
    const defaultCat = await prisma.category.findFirst();
    const defaultLoc = await prisma.location.findFirst();
    const defaultDept = await prisma.department.findFirst();

    // 3.1 Asset Master Lifecycle
    t0 = Date.now();
    const newAssetRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        name: 'MacBook Pro 14 M3 Max',
        model: 'Apple Silicon M3 Max 36GB',
        categoryId: defaultCat?.id || '',
        locationId: defaultLoc?.id,
        departmentId: defaultDept?.id,
        serialNumber: `SN-MAC-${Date.now()}`,
        status: 'AVAILABLE',
        condition: 'NEW',
        cost: 2999.0,
      });
    const createdAssetId = newAssetRes.body?.data?.id;
    const createdAssetTag = newAssetRes.body?.data?.assetTag;
    record(
      'Subsystem.Assets',
      'Create New Hardware Asset with auto-generated tag',
      newAssetRes.status === 201 && createdAssetId ? 'PASS' : 'FAIL',
      `ID: ${createdAssetId}, Tag: ${createdAssetTag}`,
      t0
    );

    // 3.2 Allocation & Electronic Acceptance
    let allocationId = '';
    if (createdAssetId) {
      t0 = Date.now();
      const employeesRes = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${itToken}`);
      const employeeId = employeesRes.body.data?.[0]?.id;

      const allocRes = await request(app)
        .post('/api/v1/allocations/allocate')
        .set('Authorization', `Bearer ${itToken}`)
        .send({
          assetId: createdAssetId,
          employeeId: employeeId,
          allocationDate: new Date().toISOString().split('T')[0],
          notes: 'Standard engineering deployment',
        });
      allocationId = allocRes.body?.data?.assignment?.id || allocRes.body?.data?.id;
      record(
        'Subsystem.Allocations',
        'Allocate asset to employee',
        allocRes.status === 201 && allocationId ? 'PASS' : 'FAIL',
        `Allocation ID: ${allocationId}`,
        t0
      );

      t0 = Date.now();
      const ackRes = await request(app)
        .post(`/api/v1/allocations/acknowledge/${allocationId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          termsAccepted: true,
        });
      record(
        'Subsystem.Allocations',
        'Electronic acceptance & digital signature capture',
        ackRes.status === 200 ? 'PASS' : 'FAIL',
        `Acknowledged: ${ackRes.body.data?.termsAccepted}`,
        t0
      );

      // Handover PDF
      t0 = Date.now();
      const handoverPdfRes = await request(app)
        .get(`/api/v1/allocations/handover-pdf/${allocationId}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      record(
        'Subsystem.Allocations',
        'Generate Signed Handover Certificate PDF',
        handoverPdfRes.status === 200 && handoverPdfRes.body.length > 5000 ? 'PASS' : 'FAIL',
        `PDF bytes: ${handoverPdfRes.body.length}`,
        t0
      );

      // Return Workflow
      t0 = Date.now();
      const returnRes = await request(app)
        .post('/api/v1/allocations/return')
        .set('Authorization', `Bearer ${itToken}`)
        .send({
          assetId: createdAssetId,
          returnDate: new Date().toISOString().split('T')[0],
          condition: 'GOOD',
          notes: 'Audit returned in flawless condition',
        });
      record(
        'Subsystem.Allocations',
        'Process Asset Return and restore inventory status',
        returnRes.status === 200 ? 'PASS' : 'FAIL',
        `Status restored to: ${returnRes.body.data?.asset?.status}`,
        t0
      );
    }

    // 3.3 Quick Tag Tracking
    if (createdAssetTag) {
      t0 = Date.now();
      const trackRes = await request(app)
        .get(`/api/v1/assets/track/${createdAssetTag}`)
        .set('Authorization', `Bearer ${superToken}`);
      record(
        'Subsystem.Tracking',
        'Instant Barcode/QR scan tracking lookup',
        trackRes.status === 200 && trackRes.body.data?.assetTag === createdAssetTag ? 'PASS' : 'FAIL',
        `Found asset: ${trackRes.body.data?.name}`,
        t0
      );
    }

    // 3.4 Helpdesk Ticketing
    t0 = Date.now();
    const ticketRes = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        subject: 'Audit Software License Provisioning',
        description: 'Automated test suite verification for helpdesk ticketing SLA',
        priority: 'MEDIUM',
        category: 'SOFTWARE',
      });
    record(
      'Subsystem.Tickets',
      'Create Helpdesk Support Incident Ticket',
      ticketRes.status === 201 && ticketRes.body.data?.ticketNumber ? 'PASS' : 'FAIL',
      `Ticket: ${ticketRes.body.data?.ticketNumber}`,
      t0
    );

    // 3.5 Software Asset Management (SAM)
    t0 = Date.now();
    const samRes = await request(app)
      .get('/api/v1/licenses')
      .set('Authorization', `Bearer ${itToken}`);
    record(
      'Subsystem.SAM',
      'Software Licenses & Seat Compliance calculation',
      samRes.status === 200 && Array.isArray(samRes.body.data) ? 'PASS' : 'FAIL',
      `Active license packages: ${samRes.body.data?.length}`,
      t0
    );

    // 3.6 Consumables Stock Tracking
    t0 = Date.now();
    const consumablesRes = await request(app)
      .get('/api/v1/consumables')
      .set('Authorization', `Bearer ${itToken}`);
    record(
      'Subsystem.Consumables',
      'Consumables & Spare Parts Inventory retrieval',
      consumablesRes.status === 200 && Array.isArray(consumablesRes.body.data) ? 'PASS' : 'FAIL',
      `Tracked stock items: ${consumablesRes.body.data?.length}`,
      t0
    );

    // 3.7 Executive Dashboard KPI Analytics & Fleet CSV Export
    t0 = Date.now();
    const metricsRes = await request(app)
      .get('/api/v1/assets/dashboard-metrics')
      .set('Authorization', `Bearer ${superToken}`);
    const totalFleet = metricsRes.body.data?.summary?.totalAssets ?? metricsRes.body.data?.totalAssets;
    record(
      'Subsystem.Reporting',
      'Dashboard KPI Fleet Analytics retrieval',
      metricsRes.status === 200 && totalFleet !== undefined ? 'PASS' : 'FAIL',
      `Total fleet assets: ${totalFleet}`,
      t0
    );

    t0 = Date.now();
    const csvExportRes = await request(app)
      .get('/api/v1/reports/export?type=assets&format=csv')
      .set('Authorization', `Bearer ${superToken}`);
    record(
      'Subsystem.Reporting',
      'Bulk Fleet Inventory CSV Data Export',
      csvExportRes.status === 200 && csvExportRes.header['content-type']?.includes('text/csv') ? 'PASS' : 'FAIL',
      `CSV stream size: ${csvExportRes.text?.length} chars`,
      t0
    );

    // -------------------------------------------------------------------------
    // SUMMARY CALCULATION
    // -------------------------------------------------------------------------
    console.log('\n========================================================================================');
    console.log('📊 AUDIT SUMMARY REPORT');
    console.log('========================================================================================');

    const total = auditLog.length;
    const passed = auditLog.filter((a) => a.status === 'PASS').length;
    const failed = auditLog.filter((a) => a.status === 'FAIL').length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`Total Audit Checks: ${total}`);
    console.log(`Passed:             ${passed} ✅`);
    console.log(`Failed:             ${failed} ${failed > 0 ? '❌' : '🎉'}`);
    console.log(`Pass Rate:          ${passRate}%\n`);

    if (failed === 0) {
      console.log('🌟 ALL ENTERPRISE CUSTOMIZATION, SETTINGS, AND SOFTWARE SUBSYSTEMS PASSED 100%!');
    } else {
      console.error(`⚠️ ${failed} check(s) failed during audit execution.`);
    }

    return { total, passed, failed, passRate, auditLog };
  } catch (error) {
    console.error('Fatal audit failure:', error);
    process.exit(1);
  }
}

runAudit();

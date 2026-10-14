import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { BarcodeGenerator } from '../src/utils/barcodeGenerator.js';
import { PdfService } from '../src/utils/pdfService.js';

describe('Enterprise IT Asset Management (ITAM) Test Suite', () => {
  let adminToken: string;
  let createdAssetId: string;
  let testEmployeeId: string;
  let assignmentId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Health Check & API Meta', () => {
    it('GET /api/v1/health should return system status UP', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.database).toBe('CONNECTED');
    });

    it('GET / should return product metadata', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.name).toContain('IT Asset Management');
    });
  });

  describe('2. Authentication & RBAC', () => {
    it('POST /api/v1/auth/login with valid admin credentials should return JWT and user info', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrUsername: 'admin@acme-corp.com',
        password: 'Admin@123456',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@acme-corp.com');
      expect(res.body.data.user.role.name).toBe('SUPER_ADMIN');

      adminToken = res.body.data.accessToken;
    });

    it('POST /api/v1/auth/login with invalid password should fail with 401', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        emailOrUsername: 'admin@acme-corp.com',
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('GET /api/v1/assets without token should be rejected with 401', async () => {
      const res = await request(app).get('/api/v1/assets');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('3. Barcode & QR Code Engine', () => {
    it('should generate Code128 barcode as Base64 image', async () => {
      const barcode = await BarcodeGenerator.generateBarcodeBase64('IT-LAP-000001', 'code128');
      expect(barcode).toMatch(/^data:image\/png;base64,/);
    });

    it('should generate QR code as Base64 data URL', async () => {
      const qrCode = await BarcodeGenerator.generateQrCodeBase64('IT-LAP-000001');
      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('4. Asset Master Data & Lifecycle', () => {
    it('POST /api/v1/assets should create a new hardware asset with unique Asset ID', async () => {
      // Find a category and department
      const category = await prisma.category.findFirst();
      const department = await prisma.department.findFirst();
      const location = await prisma.location.findFirst();

      const newAsset = {
        name: 'HP ZBook Studio G10 Mobile Workstation',
        categoryId: category!.id,
        serialNumber: `SN-HP-ZB10-${Date.now()}`,
        status: 'AVAILABLE',
        condition: 'NEW',
        departmentId: department?.id,
        locationId: location?.id,
        manufacturer: 'HP',
        model: 'ZBook Studio G10',
        cpu: 'Intel Core i9-13900H',
        ram: '64GB DDR5',
        storage: '2TB NVMe SSD',
        purchaseCost: 2899.0,
      };

      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAsset);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assetId).toBeDefined();
      expect(res.body.data.name).toBe(newAsset.name);
      expect(res.body.data.status).toBe('AVAILABLE');

      createdAssetId = res.body.data.id;
    });

    it('GET /api/v1/assets/:id should retrieve asset with complete lifecycle logs', async () => {
      const res = await request(app)
        .get(`/api/v1/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdAssetId);
      expect(res.body.data.lifecycleLogs).toBeDefined();
      expect(res.body.data.lifecycleLogs.length).toBeGreaterThan(0);
      expect(res.body.data.lifecycleLogs[0].eventType).toBe('PURCHASE');
    });
  });

  describe('5. Asset Allocation, Handover & Acknowledgement', () => {
    beforeAll(async () => {
      const emp = await prisma.employee.findFirst();
      testEmployeeId = emp!.id;
    });

    it('POST /api/v1/allocations/allocate should assign asset to employee', async () => {
      const res = await request(app)
        .post('/api/v1/allocations/allocate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assetId: createdAssetId,
          employeeId: testEmployeeId,
          allocationType: 'PERMANENT',
          accessories: ['HP 150W Smart AC Adapter', 'Wireless Mouse'],
          notes: 'Standard engineering deployment',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment).toBeDefined();

      assignmentId = res.body.data.assignment.id;

      // Verify asset status is updated to ASSIGNED
      const assetCheck = await prisma.asset.findUnique({ where: { id: createdAssetId } });
      expect(assetCheck?.status).toBe('ASSIGNED');
      expect(assetCheck?.currentEmployeeId).toBe(testEmployeeId);
    });

    it('POST /api/v1/allocations/allocate should reject double allocation of already assigned asset', async () => {
      const res = await request(app)
        .post('/api/v1/allocations/allocate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assetId: createdAssetId,
          employeeId: testEmployeeId,
          allocationType: 'TEMPORARY',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('ASSET_ALREADY_ASSIGNED');
    });

    it('POST /api/v1/allocations/acknowledge/:id should record electronic acceptance', async () => {
      const res = await request(app)
        .post(`/api/v1/allocations/acknowledge/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          signatureData: 'Test Employee (Digital Acknowledged)',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.termsAccepted).toBe(true);
    });

    it('GET /api/v1/allocations/handover-pdf/:id should stream professional PDF certificate', async () => {
      const res = await request(app)
        .get(`/api/v1/allocations/handover-pdf/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.body).toBeInstanceOf(Buffer);
    });
  });

  describe('6. Asset Return Workflow', () => {
    it('POST /api/v1/allocations/return should process return and restore inventory', async () => {
      const res = await request(app)
        .post('/api/v1/allocations/return')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assetId: createdAssetId,
          condition: 'EXCELLENT',
          accessoriesReturned: ['HP 150W Smart AC Adapter', 'Wireless Mouse'],
          newStatus: 'AVAILABLE',
          notes: 'Asset returned in pristine condition',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify asset is now available
      const assetCheck = await prisma.asset.findUnique({ where: { id: createdAssetId } });
      expect(assetCheck?.status).toBe('AVAILABLE');
      expect(assetCheck?.currentEmployeeId).toBeNull();
    });
  });

  describe('7. Helpdesk Tickets & SLA', () => {
    it('POST /api/v1/tickets should raise support ticket linked to asset', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'RAM upgrade request for engineering benchmark',
          description: 'Requesting 32GB to 64GB DDR5 memory upgrade for local Docker containers.',
          priority: 'MEDIUM',
          category: 'HARDWARE',
          requesterId: testEmployeeId,
          assetId: createdAssetId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketNumber).toMatch(/^TIK-\d{6}$/);
      expect(res.body.data.slaDueDate).toBeDefined();
    });
  });

  describe('8. Consumables & Stock Inventory', () => {
    it('POST /api/v1/consumables/:id/transaction should handle stock inward and outward', async () => {
      const consumable = await prisma.consumable.findFirst();
      expect(consumable).toBeDefined();

      const initialStock = consumable!.stockQuantity;

      // Issue outward 1 unit
      const issueRes = await request(app)
        .post(`/api/v1/consumables/${consumable!.id}/transaction`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'OUTWARD_ISSUE',
          quantity: 1,
          notes: 'Issued to engineering lab',
        });

      expect(issueRes.status).toBe(201);

      const checkConsumable = await prisma.consumable.findUnique({ where: { id: consumable!.id } });
      expect(checkConsumable?.stockQuantity).toBe(initialStock - 1);
    });
  });

  describe('9. Email Notification Mail Settings (Google Workspace & Office 365)', () => {
    it('GET /api/v1/system/email-settings should retrieve email config with masked pass', async () => {
      const res = await request(app)
        .get('/api/v1/system/email-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBeDefined();
    });

    it('POST /api/v1/system/email-settings should save Google Workspace preset settings', async () => {
      const res = await request(app)
        .post('/api/v1/system/email-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'google_workspace',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'it-admin@acme-corp.com',
          smtpPass: 'abcd-efgh-ijkl-mnop',
          fromName: 'Acme IT Helpdesk',
          fromEmail: 'it-admin@acme-corp.com',
          notificationsEnabled: true,
          notifyOnAllocation: true,
          notifyOnReturn: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app)
        .get('/api/v1/system/email-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(check.body.data.provider).toBe('google_workspace');
      expect(check.body.data.smtpHost).toBe('smtp.gmail.com');
      expect(check.body.data.hasPassword).toBe(true);
    });

    it('POST /api/v1/system/email-settings should save Office 365 Outlook preset settings', async () => {
      const res = await request(app)
        .post('/api/v1/system/email-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'office_365',
          smtpHost: 'smtp.office365.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'it-support@acme-corp.com',
          smtpPass: '••••••••', // should preserve existing
          fromName: 'Acme Corporate IT',
          fromEmail: 'it-support@acme-corp.com',
          notificationsEnabled: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app)
        .get('/api/v1/system/email-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(check.body.data.provider).toBe('office_365');
      expect(check.body.data.smtpHost).toBe('smtp.office365.com');
    });
  });

  describe('10. Asset Tag Search & Quick Tracking', () => {
    it('GET /api/v1/assets/quick-search should return matching assets for asset tag or serial', async () => {
      const res = await request(app)
        .get('/api/v1/assets/quick-search?q=HP')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].assetId).toBeDefined();
    });

    it('GET /api/v1/assets/track/:tag should retrieve asset by Asset ID or Asset Tag', async () => {
      // Find an asset with tag or id
      const asset = await prisma.asset.findFirst();
      expect(asset).toBeDefined();

      const trackRes = await request(app)
        .get(`/api/v1/assets/track/${asset!.assetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(trackRes.status).toBe(200);
      expect(trackRes.body.success).toBe(true);
      expect(trackRes.body.data.id).toBe(asset!.id);
      expect(trackRes.body.data.assetId).toBe(asset!.assetId);
    });
  });

  describe('11. Asset Barcode Label PDF Generation', () => {
    it('POST /api/v1/assets/labels/pdf should stream printable barcode stickers without errors', async () => {
      const asset = await prisma.asset.findFirst();
      expect(asset).toBeDefined();

      const res = await request(app)
        .post('/api/v1/assets/labels/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assetIds: [asset!.id] });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body).toBeDefined();
    });
  });

  describe('12. Version 3 Super Admin Customization Engine', () => {
    it('GET /api/v1/customization/branding should return public branding without auth', async () => {
      const res = await request(app).get('/api/v1/customization/branding');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.portalTitle).toBeDefined();
      expect(res.body.data.currencySymbol).toBeDefined();
    });

    it('PUT /api/v1/customization/branding should update branding by Super Admin', async () => {
      const res = await request(app)
        .put('/api/v1/customization/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          companyName: 'Acme Global IT v3',
          portalTitle: 'NextGen Asset Portal',
          currencySymbol: '€',
          currencyCode: 'EUR',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe('Acme Global IT v3');
      expect(res.body.data.portalTitle).toBe('NextGen Asset Portal');
      expect(res.body.data.currencySymbol).toBe('€');

      const org = await prisma.organization.findFirst();
      expect(org?.name).toBe('Acme Global IT v3');
    });

    it('GET /api/v1/customization/fields/asset should return customizable asset schema', async () => {
      const res = await request(app)
        .get('/api/v1/customization/fields/asset')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/customization/fields/asset should register new custom field', async () => {
      const fieldName = `testSpec_${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/customization/fields/asset')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: fieldName,
          label: 'Test Hardware Specification',
          type: 'text',
          required: false,
          placeholder: 'Test Value',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(fieldName);
      expect(res.body.data.label).toBe('Test Hardware Specification');
    });

    it('POST /api/v1/customization/numbering/preview should simulate next tag with custom pattern', async () => {
      const res = await request(app)
        .post('/api/v1/customization/numbering/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pattern: 'CUSTOM-{YYYY}-{CAT}-{SEQ:5}',
          prefix: 'ACME',
          seqPadding: 5,
          sampleSeq: 100,
          categoryCode: 'SRV',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.preview).toContain('CUSTOM-');
      expect(res.body.data.preview).toContain('SRV');
      expect(res.body.data.preview).toContain('00100');
    });

    it('GET /api/v1/customization/statuses should retrieve configurable asset statuses', async () => {
      const res = await request(app)
        .get('/api/v1/customization/statuses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((s: any) => s.code === 'AVAILABLE')).toBe(true);
    });

    it('GET /api/v1/customization/features should retrieve modular feature toggles', async () => {
      const res = await request(app)
        .get('/api/v1/customization/features')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enableSamLicenses).toBe(true);
      expect(res.body.data.enableConsumables).toBe(true);
    });

    it('GET /api/v1/customization/backup/export should export full JSON configuration snapshot', async () => {
      const res = await request(app)
        .get('/api/v1/customization/backup/export')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.branding).toBeDefined();
      expect(res.body.data.customFields).toBeDefined();
      expect(res.body.data.numbering).toBeDefined();
    });
  });
});

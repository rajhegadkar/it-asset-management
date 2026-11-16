/**
 * Security & workflow regression tests for the Nov 2026 audit fixes.
 * Each block names the audit finding it guards (S = security, B = bug, W = wiring).
 */
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { safeUploadPath, DisasterRecoveryService } from '../src/disasterRecovery/disasterRecoveryService.js';
import { verifyAuditChain } from '../src/middlewares/audit.js';

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ emailOrUsername: email, password });
  if (!res.body?.data?.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data as { accessToken: string; refreshToken: string; user: any };
};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const SECRET_FIELD = /passwordHash|twoFactorSecret|twoFactorRecoveryCodes/;

describe('Audit fixes: security and workflow regression suite', () => {
  let admin: string;
  let support: string;
  let john: { accessToken: string; user: any };
  let sarah: { accessToken: string; user: any };
  let johnEmpId: string;
  let sarahEmpId: string;
  let categoryId: string;

  const newAsset = async (suffix: string) => {
    const res = await request(app)
      .post('/api/v1/assets')
      .set(auth(admin))
      .send({ name: `Test ${suffix}`, categoryId, serialNumber: `SN-SEC-${suffix}-${Date.now()}-${Math.random()}` });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  beforeAll(async () => {
    await prisma.$connect();
    admin = (await login('admin@acme-corp.com', 'Admin@123456')).accessToken;
    support = (await login('support@acme-corp.com', 'Admin@123456')).accessToken;
    john = await login('john.doe@acme-corp.com', 'User@123456');
    sarah = await login('sarah.connor@acme-corp.com', 'User@123456');
    johnEmpId = john.user.employeeProfile.id;
    sarahEmpId = sarah.user.employeeProfile.id;
    categoryId = (await prisma.category.findFirst())!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('S1 – no password hashes or 2FA secrets in any response', () => {
    it('ticket list, ticket detail, asset detail and employee detail are clean', async () => {
      const tickets = await request(app).get('/api/v1/tickets?limit=100').set(auth(admin));
      expect(tickets.status).toBe(200);
      expect(JSON.stringify(tickets.body)).not.toMatch(SECRET_FIELD);

      const t = await prisma.ticket.findFirst();
      if (t) {
        const one = await request(app).get(`/api/v1/tickets/${t.id}`).set(auth(admin));
        expect(JSON.stringify(one.body)).not.toMatch(SECRET_FIELD);
      }
      const a = await prisma.asset.findFirst({ where: { tickets: { some: {} } } });
      if (a) {
        const one = await request(app).get(`/api/v1/assets/${a.id}`).set(auth(admin));
        expect(JSON.stringify(one.body)).not.toMatch(SECRET_FIELD);
      }
      const e = await request(app).get(`/api/v1/employees/${johnEmpId}`).set(auth(admin));
      expect(e.status).toBe(200);
      expect(JSON.stringify(e.body)).not.toMatch(SECRET_FIELD);

      const profile = await request(app).get('/api/v1/auth/profile').set(auth(john.accessToken));
      expect(JSON.stringify(profile.body)).not.toMatch(SECRET_FIELD);
    });
  });

  describe('S2 – settings and secrets', () => {
    it('employees cannot read system settings', async () => {
      const res = await request(app).get('/api/v1/system/settings').set(auth(john.accessToken));
      expect(res.status).toBe(403);
    });

    it('SMTP password is encrypted at rest and masked for the super admin', async () => {
      await request(app)
        .post('/api/v1/system/email-settings')
        .set(auth(admin))
        .send({ provider: 'custom', smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'u@example.com', smtpPass: 'Sup3r-Secret!' });
      const row = await prisma.systemSetting.findUnique({ where: { key: 'email.smtp_pass' } });
      expect(row!.value.startsWith('enc:v1:')).toBe(true);
      expect(row!.value).not.toContain('Sup3r-Secret!');

      const res = await request(app).get('/api/v1/system/settings').set(auth(admin));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('Sup3r-Secret!');
      expect(JSON.stringify(res.body)).not.toContain('enc:v1:');
    });

    it('DR cloud credentials are masked and encrypted', async () => {
      const put = await request(app)
        .put('/api/v1/system/backup/config')
        .set(auth(admin))
        .send({ provider: 'AMAZON_S3', s3Bucket: 'b', s3AccessKeyId: 'AKIA', s3SecretAccessKey: 'very-secret-key', autoSyncCloud: false });
      expect(put.status).toBe(200);
      expect(JSON.stringify(put.body)).not.toContain('very-secret-key');
      const row = await prisma.systemSetting.findUnique({ where: { key: 'disaster_recovery.config' } });
      expect(row!.value).not.toContain('very-secret-key');
      // Sending the mask back keeps the stored secret
      await request(app).put('/api/v1/system/backup/config').set(auth(admin)).send({ s3SecretAccessKey: '••••••••', provider: 'LOCAL_NAS' });
      const cfg = await DisasterRecoveryService.getConfig();
      expect(cfg.s3SecretAccessKey).toBe('very-secret-key');
    });
  });

  describe('S3 / S8 / S11 – server-side access control for employees', () => {
    const forbidden = [
      '/api/v1/employees',
      '/api/v1/reports/inventory',
      '/api/v1/reports/allocations',
      '/api/v1/reports/export?entity=employees',
      '/api/v1/assets/dashboard-metrics',
      '/api/v1/assets/quick-search?q=a',
      '/api/v1/licenses',
      '/api/v1/consumables',
      '/api/v1/maintenance',
      '/api/v1/system/audit-logs',
      '/api/v1/imports/template/assets',
    ];
    it.each(forbidden)('employee gets 403 for %s', async (url) => {
      const res = await request(app).get(url).set(auth(john.accessToken));
      expect(res.status).toBe(403);
    });

    it('support engineers can export assets but not the employee directory', async () => {
      expect((await request(app).get('/api/v1/reports/export?entity=assets&format=csv').set(auth(support))).status).toBe(200);
      expect((await request(app).get('/api/v1/reports/export?entity=employees&format=csv').set(auth(support))).status).toBe(403);
    });

    it('employees only see their own tickets, whatever filter they send', async () => {
      const res = await request(app).get(`/api/v1/tickets?requesterId=${sarahEmpId}&limit=100`).set(auth(john.accessToken));
      expect(res.status).toBe(200);
      for (const t of res.body.data) expect(t.requesterId).toBe(johnEmpId);
    });

    it("employees cannot open someone else's ticket, profile or assignments", async () => {
      const sarahTicket = await prisma.ticket.create({
        data: { ticketNumber: `TST-${Date.now()}`, subject: 's', description: 'd', requesterId: sarahEmpId },
      });
      expect((await request(app).get(`/api/v1/tickets/${sarahTicket.id}`).set(auth(john.accessToken))).status).toBe(403);
      expect((await request(app).post(`/api/v1/tickets/${sarahTicket.id}/comments`).set(auth(john.accessToken)).send({ comment: 'hi' })).status).toBe(403);
      expect((await request(app).get(`/api/v1/employees/${sarahEmpId}`).set(auth(john.accessToken))).status).toBe(403);
      expect((await request(app).get(`/api/v1/employees/${johnEmpId}`).set(auth(john.accessToken))).status).toBe(200);

      const list = await request(app).get(`/api/v1/allocations/assignments?employeeId=${sarahEmpId}`).set(auth(john.accessToken));
      for (const a of list.body.data) expect(a.employeeId).toBe(johnEmpId);
    });

    it('internal notes are hidden from the requester', async () => {
      const t = await prisma.ticket.create({
        data: { ticketNumber: `TST-I-${Date.now()}`, subject: 's', description: 'd', requesterId: johnEmpId },
      });
      await request(app).post(`/api/v1/tickets/${t.id}/comments`).set(auth(admin)).send({ comment: 'INTERNAL-ONLY-NOTE', isInternal: true });
      await request(app).post(`/api/v1/tickets/${t.id}/comments`).set(auth(admin)).send({ comment: 'public reply' });
      const view = await request(app).get(`/api/v1/tickets/${t.id}`).set(auth(john.accessToken));
      expect(view.status).toBe(200);
      expect(JSON.stringify(view.body)).not.toContain('INTERNAL-ONLY-NOTE');
      expect(JSON.stringify(view.body)).toContain('public reply');
      // employees cannot create internal notes
      const c = await request(app).post(`/api/v1/tickets/${t.id}/comments`).set(auth(john.accessToken)).send({ comment: 'mine', isInternal: true });
      expect(c.body.data.isInternal).toBe(false);
    });
  });

  describe('S9 – ticket spoofing', () => {
    it('an employee cannot raise a ticket as someone else', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set(auth(john.accessToken))
        .send({ subject: 'spoof', description: 'x', requesterId: sarahEmpId, assignedEngineerId: 'whatever' });
      expect(res.status).toBe(201);
      expect(res.body.data.requesterId).toBe(johnEmpId);
      expect(res.body.data.assignedEngineerId).toBeNull();
    });
  });

  describe('S7 / B1 / B2 – custody workflow', () => {
    it("employees cannot sign someone else's handover, and cannot sign twice", async () => {
      const asset = await newAsset('ack');
      const alloc = await request(app).post('/api/v1/allocations/allocate').set(auth(admin)).send({ assetId: asset.id, employeeId: sarahEmpId });
      expect(alloc.status).toBe(201);
      const id = alloc.body.data.assignment.id;
      expect((await request(app).post(`/api/v1/allocations/acknowledge/${id}`).set(auth(john.accessToken)).send({})).status).toBe(403);
      expect((await request(app).get(`/api/v1/allocations/handover-pdf/${id}`).set(auth(john.accessToken))).status).toBe(403);
      expect((await request(app).post(`/api/v1/allocations/acknowledge/${id}`).set(auth(sarah.accessToken)).send({})).status).toBe(200);
      expect((await request(app).post(`/api/v1/allocations/acknowledge/${id}`).set(auth(sarah.accessToken)).send({})).status).toBe(409);
    });

    it('parallel allocations of one asset: exactly one succeeds', async () => {
      const asset = await newAsset('race');
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          request(app).post('/api/v1/allocations/allocate').set(auth(admin)).send({ assetId: asset.id, employeeId: i % 2 ? johnEmpId : sarahEmpId })
        )
      );
      expect(results.filter((r) => r.status === 201).length).toBe(1);
      expect(await prisma.assetAssignment.count({ where: { assetId: asset.id, status: 'ACTIVE' } })).toBe(1);
    });

    it('transfer closes the old custody record and opens one for the receiver', async () => {
      const asset = await newAsset('xfer');
      await request(app).post('/api/v1/allocations/allocate').set(auth(admin)).send({ assetId: asset.id, employeeId: johnEmpId });
      const tr = await request(app).post('/api/v1/allocations/transfer').set(auth(admin)).send({ assetId: asset.id, toEmployeeId: sarahEmpId, reason: 'Team move' });
      expect(tr.status).toBe(200);
      const rows = await prisma.assetAssignment.findMany({ where: { assetId: asset.id }, orderBy: { createdAt: 'asc' } });
      expect(rows.map((r) => [r.employeeId, r.status])).toEqual([
        [johnEmpId, 'TRANSFERRED'],
        [sarahEmpId, 'ACTIVE'],
      ]);
      const a = await prisma.asset.findUnique({ where: { id: asset.id } });
      expect(a!.currentEmployeeId).toBe(sarahEmpId);
      expect(a!.handoverStatus).toBe('PENDING_ACKNOWLEDGEMENT');
      // John no longer sees it in My Assets
      const mine = await request(app).get('/api/v1/allocations/my-assets').set(auth(john.accessToken));
      expect(mine.body.data.find((x: any) => x.assetId === asset.id)).toBeUndefined();
    });
  });

  describe('S5 – no mass assignment on asset update', () => {
    it('custody / archive fields are ignored and workflow-only statuses are refused', async () => {
      const asset = await newAsset('mass');
      const res = await request(app)
        .put(`/api/v1/assets/${asset.id}`)
        .set(auth(support))
        .send({ name: 'Renamed', currentEmployeeId: johnEmpId, isArchived: true, assetId: 'HACKED-1' });
      expect(res.status).toBe(200);
      const a = await prisma.asset.findUnique({ where: { id: asset.id } });
      expect(a!.name).toBe('Renamed');
      expect(a!.currentEmployeeId).toBeNull();
      expect(a!.isArchived).toBe(false);
      expect(a!.assetId).not.toBe('HACKED-1');
      expect((await request(app).put(`/api/v1/assets/${asset.id}`).set(auth(support)).send({ status: 'DISPOSED' })).status).toBe(400);
      expect((await request(app).put(`/api/v1/assets/${asset.id}`).set(auth(support)).send({ warrantyEnd: 'not-a-date' })).status).toBe(400);
    });
  });

  describe('B3 – atomic numbering', () => {
    it('20 parallel creates receive 20 unique asset IDs and tags', async () => {
      const res = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          request(app).post('/api/v1/assets').set(auth(admin)).send({ name: `Bulk ${i}`, categoryId, serialNumber: `SN-BULK-${Date.now()}-${i}` })
        )
      );
      expect(res.every((r) => r.status === 201)).toBe(true);
      expect(new Set(res.map((r) => r.body.data.assetId)).size).toBe(20);
      expect(new Set(res.map((r) => r.body.data.assetTag)).size).toBe(20);
    });
  });

  describe('B10 / B11 – stock and seat integrity', () => {
    it('rejects invalid quantities and never goes negative', async () => {
      const item = await prisma.consumable.create({ data: { name: 'Test cable', category: 'CABLE', itemCode: `T-${Date.now()}`, stockQuantity: 3, minQuantity: 0 } });
      const tx = (body: any) => request(app).post(`/api/v1/consumables/${item.id}/transaction`).set(auth(admin)).send(body);
      expect((await tx({ type: 'INWARD', quantity: -5 })).status).toBe(400);
      expect((await tx({ type: 'OUTWARD_ISSUE', quantity: 10 })).status).toBe(400);
      expect((await tx({ type: 'ADJUSTMENT', quantity: 2, notes: 'found in audit' })).status).toBe(201);
      expect((await tx({ type: 'ADJUSTMENT', quantity: -1, notes: 'damaged' })).status).toBe(201);
      expect((await prisma.consumable.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(4);
      expect((await prisma.consumable.findUnique({ where: { id: item.id } }))!.minQuantity).toBe(0);
    });

    it('license seats cannot be oversold or reduced below use; keys are encrypted', async () => {
      const lic = await request(app).post('/api/v1/licenses').set(auth(admin)).send({ softwareName: 'TestSoft', quantityPurchased: 1, licenseKey: 'ABCD-EFGH-IJKL-MNOP' });
      expect(lic.status).toBe(201);
      const row = await prisma.softwareLicense.findUnique({ where: { id: lic.body.data.id } });
      expect(row!.licenseKey).not.toContain('ABCD');
      const a1 = await request(app).post(`/api/v1/licenses/${row!.id}/assign`).set(auth(admin)).send({ employeeId: johnEmpId });
      expect(a1.status).toBe(200);
      expect((await request(app).post(`/api/v1/licenses/${row!.id}/assign`).set(auth(admin)).send({ employeeId: sarahEmpId })).status).toBe(400);
      expect((await request(app).put(`/api/v1/licenses/${row!.id}`).set(auth(admin)).send({ quantityPurchased: 0 })).status).toBe(400);
      const view = await request(app).get(`/api/v1/licenses/${row!.id}`).set(auth(admin));
      expect(view.body.data.licenseKey).toBe('ABCD-EFGH-IJKL-MNOP');
    });
  });

  describe('S13 – session revocation', () => {
    it('changing the password revokes existing tokens; refresh rotates', async () => {
      const s = await login('sarah.connor@acme-corp.com', 'User@123456');
      const r = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: s.refreshToken });
      expect(r.status).toBe(200);
      expect(r.body.data.refreshToken).toBeDefined();

      const weak = await request(app).post('/api/v1/auth/change-password').set(auth(s.accessToken)).send({ currentPassword: 'User@123456', newPassword: 'short' });
      expect(weak.status).toBe(400);
      const ok = await request(app).post('/api/v1/auth/change-password').set(auth(s.accessToken)).send({ currentPassword: 'User@123456', newPassword: 'NewPassw0rd!2026' });
      expect(ok.status).toBe(200);
      expect((await request(app).get('/api/v1/auth/profile').set(auth(s.accessToken))).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: s.refreshToken })).status).toBe(401);
      expect((await request(app).get('/api/v1/auth/profile').set(auth(ok.body.data.accessToken))).status).toBe(200);
      // restore for other tests
      await request(app).post('/api/v1/auth/change-password').set(auth(ok.body.data.accessToken)).send({ currentPassword: 'NewPassw0rd!2026', newPassword: 'User@123456' });
    });

    it('tokens in the query string are no longer accepted', async () => {
      const res = await request(app).get(`/api/v1/auth/profile?token=${admin}`);
      expect(res.status).toBe(401);
    });

    it('login does not reveal whether an account exists', async () => {
      const a = await request(app).post('/api/v1/auth/login').send({ emailOrUsername: 'nobody@acme-corp.com', password: 'x' });
      const b = await request(app).post('/api/v1/auth/login').send({ emailOrUsername: 'john.doe@acme-corp.com', password: 'wrong' });
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body.message).toBe(b.body.message);
    });
  });

  describe('S4 – restore path traversal', () => {
    it('paths outside the uploads folder are rejected', () => {
      expect(safeUploadPath('../../src/app.js')).toBeNull();
      expect(safeUploadPath('/etc/passwd')).toBeNull();
      expect(safeUploadPath('C:/Windows/win.ini')).toBeNull();
      expect(safeUploadPath('..\\..\\evil.txt')).toBeNull();
      expect(safeUploadPath('signatures/a.png')).toBe(path.resolve(process.cwd(), 'uploads', 'signatures/a.png'));
    });

    it('a tampered backup is refused', async () => {
      const { filePath } = await DisasterRecoveryService.createBackup({ email: 'test' });
      const bundle = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(bundle.encrypted).toBe(true);
      const opened = DisasterRecoveryService.openArchive(JSON.stringify(bundle));
      expect(opened.payload.portableData.users.length).toBeGreaterThan(0);
      bundle.manifest.backupId = 'tampered';
      expect(() => DisasterRecoveryService.openArchive(JSON.stringify(bundle))).toThrow();
      fs.unlinkSync(filePath);
    });
  });

  describe('W – audit trail is recorded and tamper-evident', () => {
    it('writes are logged and the hash chain verifies', async () => {
      await new Promise((r) => setTimeout(r, 300)); // audit writes are async
      const count = await prisma.auditLog.count({ where: { hash: { not: null } } });
      expect(count).toBeGreaterThan(10);
      expect(await prisma.auditLog.count({ where: { action: 'LOGIN' } })).toBeGreaterThan(0);
      expect(await prisma.auditLog.count({ where: { action: 'ALLOCATE' } })).toBeGreaterThan(0);
      const v = await verifyAuditChain();
      expect(v.valid).toBe(true);
      const res = await request(app).get('/api/v1/system/audit-logs/verify').set(auth(admin));
      expect(res.body.data.valid).toBe(true);
    });
  });

  describe('W – feature flags are enforced', () => {
    it('disabling SAM blocks the licenses API', async () => {
      await request(app).put('/api/v1/customization/features').set(auth(admin)).send({ enableSamLicenses: false });
      expect((await request(app).get('/api/v1/licenses').set(auth(admin))).status).toBe(403);
      await request(app).put('/api/v1/customization/features').set(auth(admin)).send({ enableSamLicenses: true });
      expect((await request(app).get('/api/v1/licenses').set(auth(admin))).status).toBe(200);
    });
  });
});

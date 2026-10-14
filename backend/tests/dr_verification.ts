/**
 * Disaster Recovery & Cloud Backup Verification Test
 * ITAM Version 3.0 Custom Edition
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';

async function runDrTests() {
  console.log('\n======================================================');
  console.log('🛡️ RUNNING DISASTER RECOVERY & BACKUP TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${title} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate as Super Admin
    const superAdminRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'admin@acme-corp.com',
      password: 'Admin@123456',
    });
    const superToken = superAdminRes.body?.data?.accessToken;
    assert(!!superToken, 'Super Admin login successful');

    // 2. Authenticate as IT Admin
    const itAdminRes = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: 'itadmin@acme-corp.com',
      password: 'Admin@123456',
    });
    const itToken = itAdminRes.body?.data?.accessToken;
    assert(!!itToken, 'IT Admin login successful');

    // 3. RBAC Check: IT Admin must be denied DR endpoints
    const rbacDeniedRes = await request(app)
      .get('/api/v1/system/backup/config')
      .set('Authorization', `Bearer ${itToken}`);
    assert(rbacDeniedRes.status === 403, 'RBAC correctly denies IT_ADMIN from accessing DR config', `Status: ${rbacDeniedRes.status}`);

    // 4. Get DR Config as SUPER_ADMIN
    const getConfigRes = await request(app)
      .get('/api/v1/system/backup/config')
      .set('Authorization', `Bearer ${superToken}`);
    assert(getConfigRes.status === 200 && getConfigRes.body.success, 'SUPER_ADMIN fetches DR config', `Provider: ${getConfigRes.body.data?.provider}`);

    // 5. Update DR Config (Set to Local NAS with Daily frequency)
    const updateConfigRes = await request(app)
      .put('/api/v1/system/backup/config')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        provider: 'LOCAL_NAS',
        frequency: 'DAILY',
        scheduledTime: '03:00',
        retentionDays: 45,
        autoSyncCloud: true,
      });
    assert(
      updateConfigRes.status === 200 && updateConfigRes.body.data.retentionDays === 45,
      'SUPER_ADMIN updates DR config',
      `Retention: ${updateConfigRes.body.data?.retentionDays}d, Frequency: ${updateConfigRes.body.data?.frequency}`
    );

    // 6. Test Cloud / NAS Storage Connectivity
    const testNasRes = await request(app)
      .post('/api/v1/system/backup/test-cloud')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        provider: 'LOCAL_NAS',
      });
    assert(testNasRes.status === 200 && testNasRes.body.success, 'Cloud/NAS storage connectivity test succeeded', testNasRes.body.message);

    // 7. Test Google Drive Connectivity simulation
    const testGdriveRes = await request(app)
      .post('/api/v1/system/backup/test-cloud')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        provider: 'GOOGLE_DRIVE',
        googleDriveFolderId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
        googleAccessToken: 'ya29.sample_oauth_token',
      });
    assert(testGdriveRes.status === 200 && testGdriveRes.body.success, 'Google Drive storage connectivity validated', testGdriveRes.body.message);

    // 8. Test Microsoft OneDrive Connectivity simulation
    const testOneDriveRes = await request(app)
      .post('/api/v1/system/backup/test-cloud')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        provider: 'MICROSOFT_ONEDRIVE',
        oneDriveFolder: '/Enterprise_Backups/ITAM',
        oneDriveClientId: 'sample-client-id',
        oneDriveClientSecret: 'sample-secret',
      });
    assert(testOneDriveRes.status === 200 && testOneDriveRes.body.success, 'OneDrive storage connectivity validated', testOneDriveRes.body.message);

    // 9. Create Full System Backup Archive
    console.log('\n📦 Creating Full System Backup Archive...');
    const createBackupRes = await request(app)
      .post('/api/v1/system/backup/create')
      .set('Authorization', `Bearer ${superToken}`);
    
    assert(
      createBackupRes.status === 200 && createBackupRes.body.success,
      'Full system backup archive created successfully',
      `File: ${createBackupRes.body.data?.filename}`
    );
    const backupFilename = createBackupRes.body.data?.filename;
    const backupManifest = createBackupRes.body.data?.manifest;
    assert(!!backupManifest?.checksumSha256, 'SHA-256 Checksum generated', backupManifest?.checksumSha256?.substring(0, 16) + '...');

    // 10. List Backup History
    const historyRes = await request(app)
      .get('/api/v1/system/backup/history')
      .set('Authorization', `Bearer ${superToken}`);
    assert(
      historyRes.status === 200 && Array.isArray(historyRes.body.data) && historyRes.body.data.length > 0,
      'Backup history retrieved',
      `Found ${historyRes.body.data.length} backup archive(s)`
    );

    // 11. Download Backup Archive
    const downloadRes = await request(app)
      .get(`/api/v1/system/backup/download/${backupFilename}`)
      .set('Authorization', `Bearer ${superToken}`);
    assert(
      downloadRes.status === 200 && downloadRes.body.length > 0,
      'Backup archive download verified',
      `Downloaded ${downloadRes.body.length} bytes`
    );

    // 12. Restore Backup from Snapshot Payload
    console.log('\n🔄 Testing Disaster Recovery Restore Operation...');
    const backupFilePath = path.resolve(process.cwd(), 'backups', backupFilename);
    const fileContent = fs.readFileSync(backupFilePath);

    const restoreRes = await request(app)
      .post('/api/v1/system/backup/restore')
      .set('Authorization', `Bearer ${superToken}`)
      .attach('file', backupFilePath);

    assert(
      restoreRes.status === 200 && restoreRes.body.success,
      'System disaster recovery restore completed successfully',
      restoreRes.body.message
    );
    assert(
      restoreRes.body.data?.totalRecords > 0,
      'Restored entities count verified',
      `Total restored units: ${restoreRes.body.data?.totalRecords}`
    );

    console.log('\n======================================================');
    console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled test failure:', error);
    process.exit(1);
  }
}

runDrTests();

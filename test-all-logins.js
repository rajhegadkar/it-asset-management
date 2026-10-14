const BASE_URL = 'http://localhost:5000/api/v1';

async function req(endpoint, method = 'GET', data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method,
    headers,
  };
  if (data) options.body = JSON.stringify(data);

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 ITAM v1.0 ENTERPRISE MULTI-ROLE & DYNAMIC CURRENCY TEST SUITE');
  console.log('================================================================\n');

  const results = {
    superAdmin: [],
    currencySync: [],
    itAdmin: [],
    supportEngineer: [],
    employee: [],
  };

  const record = (suite, testName, passed, details = '') => {
    results[suite].push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${testName} ${details ? '— ' + details : ''}`);
  };

  try {
    // ================================================================
    // SUITE 1: SUPER_ADMIN (admin@acme-corp.com)
    // ================================================================
    console.log('--- 1. Testing SUPER_ADMIN (admin@acme-corp.com) ---');
    let superAdminToken = '';
    const loginSa = await req('/auth/login', 'POST', {
      emailOrUsername: 'admin@acme-corp.com',
      password: 'Admin@123456',
    });

    if (loginSa.ok && loginSa.data?.data?.accessToken) {
      superAdminToken = loginSa.data.data.accessToken;
      record('superAdmin', 'Super Admin Authentication', true, `Token issued, Role: ${loginSa.data.data.user.role.name}`);
    } else {
      record('superAdmin', 'Super Admin Authentication', false, loginSa.data?.message || `HTTP ${loginSa.status}`);
    }

    if (superAdminToken) {
      // 1.1 Profile
      const profile = await req('/auth/profile', 'GET', null, superAdminToken);
      const isSa = profile.ok && profile.data?.data?.role?.name === 'SUPER_ADMIN';
      record('superAdmin', 'Get Current Profile (/auth/profile)', isSa, `User: ${profile.data?.data?.email}, Name: ${profile.data?.data?.firstName} ${profile.data?.data?.lastName}`);

      // 1.2 System Settings
      const settings = await req('/system/settings', 'GET', null, superAdminToken);
      record('superAdmin', 'Read System Settings (/system/settings)', settings.ok && Array.isArray(settings.data?.data), `${settings.data?.data?.length} settings`);

      // 1.3 Audit Logs
      const audit = await req('/system/audit-logs', 'GET', null, superAdminToken);
      record('superAdmin', 'Read Audit Logs (/system/audit-logs)', audit.ok && Array.isArray(audit.data?.data), `${audit.data?.data?.length} audit records`);

      // 1.4 Customization Feature Flags
      const flags = await req('/customization/features', 'GET', null, superAdminToken);
      record('superAdmin', 'Read Feature Flags (/customization/features)', flags.ok && typeof flags.data?.data === 'object', 'Active modules loaded');

      // 1.5 Disaster Recovery Backups History
      const dr = await req('/system/backup/history', 'GET', null, superAdminToken);
      record('superAdmin', 'Disaster Recovery Backups (/system/backup/history)', dr.ok && Array.isArray(dr.data?.data), `${dr.data?.data?.length} backup records found`);
    }

    // ================================================================
    // SUITE 2: DYNAMIC CURRENCY SYNCHRONIZATION
    // ================================================================
    console.log('\n--- 2. Testing Currency Synchronization Across Customization & Settings ---');
    if (superAdminToken) {
      // 2.1 Update Currency to INR (₹) via /customization/branding
      const setInr = await req('/customization/branding', 'PUT', {
        currencyCode: 'INR',
        currencySymbol: '₹'
      }, superAdminToken);

      const checkInr = await req('/customization/branding', 'GET');
      const checkInrSettings = await req('/system/settings', 'GET', null, superAdminToken);
      const inrSetting = checkInrSettings.data?.data?.find(s => s.key === 'company.currency');

      const isINR = checkInr.ok && checkInr.data?.data?.currencyCode === 'INR' && checkInr.data?.data?.currencySymbol === '₹';
      const isLegacyINR = inrSetting?.value === 'INR';
      record('currencySync', 'Customization Center: Set Currency to INR (₹)', isINR && isLegacyINR, `Symbol: ${checkInr.data?.data?.currencySymbol}, Code: ${checkInr.data?.data?.currencyCode}, Settings Synced: ${isLegacyINR}`);

      // 2.2 Update Currency to EUR (€) via /system/settings (Legacy System Settings endpoint)
      const setEur = await req('/system/settings', 'PUT', [
        { key: 'company.currency', value: 'EUR', group: 'BRANDING' }
      ], superAdminToken);

      const checkEur = await req('/customization/branding', 'GET');
      const isEUR = checkEur.ok && checkEur.data?.data?.currencyCode === 'EUR' && checkEur.data?.data?.currencySymbol === '€';
      record('currencySync', 'System Settings: Set Currency to EUR (€)', isEUR, `Resolved Symbol: ${checkEur.data?.data?.currencySymbol}, Code: ${checkEur.data?.data?.currencyCode}`);

      // 2.3 Restore Default Currency to USD ($)
      const setUsd = await req('/customization/branding', 'PUT', {
        currencyCode: 'USD',
        currencySymbol: '$'
      }, superAdminToken);

      const checkUsd = await req('/customization/branding', 'GET');
      const isUSD = checkUsd.ok && checkUsd.data?.data?.currencyCode === 'USD' && checkUsd.data?.data?.currencySymbol === '$';
      record('currencySync', 'Restore Default Currency to USD ($)', isUSD, `Symbol: ${checkUsd.data?.data?.currencySymbol}, Code: ${checkUsd.data?.data?.currencyCode}`);
    }

    // ================================================================
    // SUITE 3: IT_ADMIN (itadmin@acme-corp.com)
    // ================================================================
    console.log('\n--- 3. Testing IT_ADMIN (itadmin@acme-corp.com) ---');
    let itAdminToken = '';
    const loginIt = await req('/auth/login', 'POST', {
      emailOrUsername: 'itadmin@acme-corp.com',
      password: 'Admin@123456',
    });

    if (loginIt.ok && loginIt.data?.data?.accessToken) {
      itAdminToken = loginIt.data.data.accessToken;
      record('itAdmin', 'IT Admin Authentication', true, `Token issued, Role: ${loginIt.data.data.user.role.name}`);
    } else {
      record('itAdmin', 'IT Admin Authentication', false, loginIt.data?.message || `HTTP ${loginIt.status}`);
    }

    let testAssetId = '';
    let testAssetTag = '';

    if (itAdminToken) {
      // 3.1 Fetch Categories
      const cats = await req('/org/categories', 'GET', null, itAdminToken);
      const catId = cats.data?.data?.[0]?.id;
      record('itAdmin', 'Fetch Asset Categories (/org/categories)', cats.ok && Array.isArray(cats.data?.data), `${cats.data?.data?.length} categories`);

      // 3.2 Create Asset with Purchase Cost & Custom Specifications
      const uniqueSerial = 'SR-' + Date.now().toString().slice(-6);
      const createAsset = await req('/assets', 'POST', {
        name: 'Precision Test Workstation 7560',
        categoryId: catId,
        serialNumber: uniqueSerial,
        status: 'AVAILABLE',
        condition: 'NEW',
        manufacturer: 'Dell',
        model: 'Precision 7560',
        cpu: 'Intel Xeon W-11955M',
        ram: '64GB ECC',
        storage: '2TB NVMe SSD',
        operatingSystem: 'Ubuntu 24.04 LTS',
        purchaseCost: 3499.50,
        customFields: { warrantyTier: 'ProSupport Plus', testField: 'AutomatedRun' }
      }, itAdminToken);

      if (createAsset.ok && createAsset.data?.data?.id) {
        testAssetId = createAsset.data.data.id;
        testAssetTag = createAsset.data.data.assetTag;
        const hasCost = createAsset.data.data.purchaseCost === 3499.50;
        record('itAdmin', 'Create Asset with Purchase Cost & Custom Specs', hasCost, `Asset Tag: ${testAssetTag}, Cost: $${createAsset.data.data.purchaseCost}`);
      } else {
        record('itAdmin', 'Create Asset with Purchase Cost & Custom Specs', false, createAsset.data?.message || `HTTP ${createAsset.status}`);
      }

      // 3.3 Track Asset by Asset Tag
      if (testAssetTag) {
        const track = await req(`/assets/track/${encodeURIComponent(testAssetTag)}`, 'GET', null, itAdminToken);
        const match = track.ok && track.data?.data?.assetTag === testAssetTag && track.data?.data?.purchaseCost === 3499.50;
        record('itAdmin', 'Track Asset by Asset Tag (/assets/track/:tag)', match, `Retrieved: ${track.data?.data?.name}`);
      }

      // 3.4 Update Asset Details
      if (testAssetId) {
        const updateAsset = await req(`/assets/${testAssetId}`, 'PUT', {
          purchaseCost: 3599.00,
          condition: 'EXCELLENT'
        }, itAdminToken);
        const updatedCost = updateAsset.ok && updateAsset.data?.data?.purchaseCost === 3599.00;
        record('itAdmin', 'Update Asset Purchase Cost & Condition', updatedCost, `Updated Cost: $${updateAsset.data?.data?.purchaseCost}`);
      }

      // 3.5 Allocate Asset to Employee EMP-003
      const emps = await req('/employees', 'GET', null, itAdminToken);
      const emp = emps.data?.data?.find(e => e.employeeId === 'EMP-003') || emps.data?.data?.[0];
      if (testAssetId && emp?.id) {
        const alloc = await req('/allocations/allocate', 'POST', {
          assetId: testAssetId,
          employeeId: emp.id,
          allocationType: 'PERMANENT',
          notes: 'Test allocation via test suite'
        }, itAdminToken);
        record('itAdmin', 'Allocate Asset to Employee (/allocations/allocate)', alloc.ok, `Allocated to ${emp.firstName} ${emp.lastName}`);
      }

      // 3.6 Check Allocations List
      const allocList = await req('/allocations/assignments', 'GET', null, itAdminToken);
      record('itAdmin', 'Fetch Allocations List (/allocations/assignments)', allocList.ok && Array.isArray(allocList.data?.data), `${allocList.data?.data?.length} assignments`);
    }

    // ================================================================
    // SUITE 4: SUPPORT_ENGINEER (support@acme-corp.com)
    // ================================================================
    console.log('\n--- 4. Testing SUPPORT_ENGINEER (support@acme-corp.com) ---');
    let supportToken = '';
    const loginSup = await req('/auth/login', 'POST', {
      emailOrUsername: 'support@acme-corp.com',
      password: 'Admin@123456',
    });

    if (loginSup.ok && loginSup.data?.data?.accessToken) {
      supportToken = loginSup.data.data.accessToken;
      record('supportEngineer', 'Support Engineer Authentication', true, `Token issued, Role: ${loginSup.data.data.user.role.name}`);
    } else {
      record('supportEngineer', 'Support Engineer Authentication', false, loginSup.data?.message || `HTTP ${loginSup.status}`);
    }

    if (supportToken) {
      // 4.1 Track Asset
      const track = await req(`/assets/track/${encodeURIComponent(testAssetTag || 'IT-000001')}`, 'GET', null, supportToken);
      record('supportEngineer', 'Support Engineer Track Asset', track.ok, `Asset: ${track.data?.data?.name}`);

      // 4.2 Log Maintenance Record with Cost
      let maintenanceId = '';
      const maint = await req('/maintenance', 'POST', {
        assetId: testAssetId || 'asset-1',
        maintenanceType: 'PREVENTIVE',
        issue: 'Routine thermal repasting and diagnostic inspection',
        startDate: new Date().toISOString(),
        cost: 150.00
      }, supportToken);

      if (maint.ok && maint.data?.data?.id) {
        maintenanceId = maint.data.data.id;
        record('supportEngineer', 'Log Maintenance Record with Cost', true, `Record ID: ${maintenanceId}, Cost: $150.00`);
      } else {
        record('supportEngineer', 'Log Maintenance Record with Cost', false, maint.data?.message || `HTTP ${maint.status}`);
      }

      // 4.3 Complete Maintenance Record with Updated Cost
      if (maintenanceId) {
        const comp = await req(`/maintenance/${maintenanceId}/complete`, 'PUT', {
          resolutionNotes: 'Completed maintenance successfully. System runs cool.',
          cost: 175.50
        }, supportToken);
        record('supportEngineer', 'Complete Maintenance with Cost Update', comp.ok && comp.data?.data?.cost === 175.50, `Final Cost: $${comp.data?.data?.cost}`);
      }

      // 4.4 View Support Tickets
      const tickets = await req('/tickets', 'GET', null, supportToken);
      record('supportEngineer', 'View Support Tickets (/tickets)', tickets.ok && Array.isArray(tickets.data?.data), `${tickets.data?.data?.length} tickets`);
    }

    // ================================================================
    // SUITE 5: EMPLOYEE (john.doe@acme-corp.com)
    // ================================================================
    console.log('\n--- 5. Testing EMPLOYEE (john.doe@acme-corp.com) ---');
    let employeeToken = '';
    const loginEmp = await req('/auth/login', 'POST', {
      emailOrUsername: 'john.doe@acme-corp.com',
      password: 'User@123456',
    });

    if (loginEmp.ok && loginEmp.data?.data?.accessToken) {
      employeeToken = loginEmp.data.data.accessToken;
      record('employee', 'Employee Authentication', true, `Token issued, Role: ${loginEmp.data.data.user.role.name}`);
    } else {
      record('employee', 'Employee Authentication', false, loginEmp.data?.message || `HTTP ${loginEmp.status}`);
    }

    if (employeeToken) {
      // 5.1 Profile
      const prof = await req('/auth/profile', 'GET', null, employeeToken);
      record('employee', 'Employee Profile Verification (/auth/profile)', prof.ok && prof.data?.data?.role?.name === 'EMPLOYEE', `Name: ${prof.data?.data?.firstName} ${prof.data?.data?.lastName}, Employee ID: ${prof.data?.data?.employeeProfile?.employeeId}`);

      // 5.2 Self-Service Assigned Assets
      const myAssets = await req('/allocations/my-assets', 'GET', null, employeeToken);
      record('employee', 'View Self-Service Assigned Assets (/allocations/my-assets)', myAssets.ok && Array.isArray(myAssets.data?.data), `${myAssets.data?.data?.length} assigned items`);

      // 5.3 Submit Helpdesk Ticket
      const empProfileId = prof.data?.data?.employeeProfile?.id;
      const tick = await req('/tickets', 'POST', {
        subject: 'Ergonomic display adjustment required',
        description: 'Requesting assistance with external monitor stand in Office 4B',
        priority: 'LOW',
        category: 'HARDWARE',
        requesterId: empProfileId
      }, employeeToken);
      record('employee', 'Employee Raise Helpdesk Ticket (/tickets)', tick.ok && !!tick.data?.data?.id, `Ticket #${tick.data?.data?.ticketNumber}`);

      // 5.4 RBAC Security: Deny Employee Access to Audit Logs
      const forbidAudit = await req('/system/audit-logs', 'GET', null, employeeToken);
      record('employee', 'RBAC Security: Deny Employee Access to Audit Logs', forbidAudit.status === 403, `Status code: ${forbidAudit.status} Forbidden (Expected)`);

      // 5.5 RBAC Security: Deny Employee Access to Disaster Recovery
      const forbidDr = await req('/system/backup/history', 'GET', null, employeeToken);
      record('employee', 'RBAC Security: Deny Employee Access to Disaster Recovery', forbidDr.status === 403, `Status code: ${forbidDr.status} Forbidden (Expected)`);

      // 5.6 RBAC Security: Deny Employee Access to Modify System Settings
      const forbidSettings = await req('/system/settings', 'PUT', [
        { key: 'company.name', value: 'Hacked Corp', group: 'BRANDING' }
      ], employeeToken);
      record('employee', 'RBAC Security: Deny Employee Access to Modify Settings', forbidSettings.status === 403, `Status code: ${forbidSettings.status} Forbidden (Expected)`);
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log('\n================================================================');
    console.log('📊 TEST SUMMARY RESULTS ACROSS ALL ROLES & MODULES:');
    console.log('================================================================');

    let totalTests = 0;
    let totalPassed = 0;

    for (const [suite, tests] of Object.entries(results)) {
      const suitePassed = tests.filter(t => t.passed).length;
      totalTests += tests.length;
      totalPassed += suitePassed;
      console.log(`\n• [${suite.toUpperCase()}]: ${suitePassed}/${tests.length} tests passed`);
      tests.forEach(t => {
        console.log(`   ${t.passed ? '✓' : '✗'} ${t.testName}: ${t.details}`);
      });
    }

    console.log('\n----------------------------------------------------------------');
    console.log(`TOTAL SCORE: ${totalPassed} / ${totalTests} (${Math.round((totalPassed/totalTests)*100)}%) PASS RATE`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Unexpected test suite error:', err);
  }
}

runTests();

const BASE_URL = process.env.BASE_URL || 'https://it-asset-management-q6ey.onrender.com/api/v1';

async function runAudit() {
  console.log('========================================================================');
  console.log(`🔍 RUNNING COMPREHENSIVE LIVE AUDIT ON: ${BASE_URL}`);
  console.log('========================================================================\n');

  const results = {
    working: [],
    broken: [],
    missingFeatures: [],
  };

  async function check(name, fn) {
    process.stdout.write(`Testing: ${name}... `);
    try {
      const res = await fn();
      if (res && res.broken) {
        console.log(`❌ BROKEN: ${res.reason}`);
        results.broken.push({ name, reason: res.reason, details: res.details });
      } else {
        console.log(`✅ OK (${res?.info || 'Passed'})`);
        results.working.push({ name, info: res?.info });
      }
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      results.broken.push({ name, reason: err.message, stack: err.stack });
    }
  }

  // 1. Health
  await check('GET /health', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (res.status !== 200 || !data.success) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Status: ${data.data.status}, DB: ${data.data.database}` };
  });

  // 2. Authentication
  let adminToken = '';
  await check('POST /auth/login (SUPER_ADMIN)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: 'admin@acme-corp.com', password: 'Admin@123456' }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.accessToken) return { broken: true, reason: `Login failed: ${data.message}` };
    adminToken = data.data.accessToken;
    return { info: `User: ${data.data.user.email}, Role: ${data.data.user.role.name}` };
  });

  let itAdminToken = '';
  await check('POST /auth/login (IT_ADMIN)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: 'itadmin@acme-corp.com', password: 'Admin@123456' }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.accessToken) return { broken: true, reason: `Login failed: ${data.message}` };
    itAdminToken = data.data.accessToken;
    return { info: `User: ${data.data.user.email}, Role: ${data.data.user.role.name}` };
  });

  let employeeToken = '';
  await check('POST /auth/login (EMPLOYEE)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: 'john.doe@acme-corp.com', password: 'User@123456' }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.accessToken) return { broken: true, reason: `Login failed: ${data.message}` };
    employeeToken = data.data.accessToken;
    return { info: `User: ${data.data.user.email}, Role: ${data.data.user.role.name}` };
  });

  const authHeader = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const employeeAuthHeader = { 'Authorization': `Bearer ${employeeToken}`, 'Content-Type': 'application/json' };

  // 3. Entity Name Change / Organization Branding
  await check('GET /customization/branding (Public)', async () => {
    const res = await fetch(`${BASE_URL}/customization/branding`);
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Company: ${data.data?.companyName}, Currency: ${data.data?.currencyCode}` };
  });

  await check('PUT /customization/branding (SUPER_ADMIN Name Change)', async () => {
    const testName = 'Acme Global Technologies Inc.';
    const res = await fetch(`${BASE_URL}/customization/branding`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ companyName: testName, portalTitle: 'Enterprise ITAM Hub' }),
    });
    const data = await res.json();
    if (res.status !== 200 || data.data?.companyName !== testName) {
      return { broken: true, reason: `Failed: ${JSON.stringify(data)}` };
    }
    return { info: `Updated to: "${data.data?.companyName}"` };
  });

  await check('GET /org/organization (Get Current Org Entity)', async () => {
    const res = await fetch(`${BASE_URL}/org/organization`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.name) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Org Entity: "${data.data.name}", Code: ${data.data.code}` };
  });

  await check('PUT /org/organization (Update Org Entity Name & Contact)', async () => {
    const orgName = 'Acme Global Enterprises';
    const res = await fetch(`${BASE_URL}/org/organization`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: orgName, email: 'support@acmeglobal.com' }),
    });
    const data = await res.json();
    if (res.status !== 200 || data.data?.name !== orgName) {
      return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    }
    return { info: `Org Entity updated to: "${data.data.name}"` };
  });

  await check('GET /auth/profile reflects Organization Name change', async () => {
    const res = await fetch(`${BASE_URL}/auth/profile`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.organization?.name) {
      return { broken: true, reason: `Profile org name missing or wrong: ${JSON.stringify(data)}` };
    }
    return { info: `Org in Profile: "${data.data.organization.name}"` };
  });

  await check('PUT /system/settings (Change company.name via Settings)', async () => {
    const res = await fetch(`${BASE_URL}/system/settings`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify([
        { key: 'company.name', value: 'Acme Global Technologies Inc.', group: 'BRANDING' }
      ]),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) {
      return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    }
    return { info: `Settings saved` };
  });

  // 4. Custom Fields CRUD
  let createdFieldId = '';
  await check('GET /customization/fields/ASSET', async () => {
    const res = await fetch(`${BASE_URL}/customization/fields/ASSET`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.data.length} fields found` };
  });

  await check('POST /customization/fields/ASSET (Create Custom Field)', async () => {
    const uniqueName = `auditField_${Date.now()}`;
    const res = await fetch(`${BASE_URL}/customization/fields/ASSET`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: uniqueName,
        label: 'Audit Test Field',
        type: 'text',
        required: false,
        placeholder: 'Test Placeholder',
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Failed: ${JSON.stringify(data)}` };
    createdFieldId = data.data.id;
    return { info: `Created ID: ${createdFieldId}, Name: ${uniqueName}` };
  });

  await check('PUT /customization/fields/ASSET/:id (Update Custom Field)', async () => {
    if (!createdFieldId) return { broken: true, reason: 'No field to update' };
    const res = await fetch(`${BASE_URL}/customization/fields/ASSET/${createdFieldId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ label: 'Updated Audit Label' }),
    });
    const data = await res.json();
    if (res.status !== 200 || data.data?.label !== 'Updated Audit Label') {
      return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    }
    return { info: `Updated label: ${data.data?.label}` };
  });

  await check('DELETE /customization/fields/ASSET/:id (Delete Custom Field)', async () => {
    if (!createdFieldId) return { broken: true, reason: 'No field to delete' };
    const res = await fetch(`${BASE_URL}/customization/fields/ASSET/${createdFieldId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Field deleted` };
  });

  // 5. Numbering Schemes
  await check('GET /customization/numbering', async () => {
    const res = await fetch(`${BASE_URL}/customization/numbering`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.ASSET_TAG) return { broken: true, reason: `Status ${res.status}` };
    return { info: `ASSET_TAG prefix: ${data.data.ASSET_TAG.prefix}` };
  });

  await check('POST /customization/numbering/preview', async () => {
    const res = await fetch(`${BASE_URL}/customization/numbering/preview`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ pattern: '{PREFIX}-{CATEGORY}-{NUMBER:6}', prefix: 'IT', seqPadding: 6, sampleSeq: 45 }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.data?.preview) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Sample Preview: "${data.data.preview}"` };
  });

  // 6. Assets Registry
  let createdAssetId = '';
  let createdAssetTag = '';
  await check('GET /assets (List Assets)', async () => {
    const res = await fetch(`${BASE_URL}/assets?limit=5`, { headers: authHeader });
    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data.data?.assets) ? data.data.assets : null);
    if (res.status !== 200 || !list) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Total assets: ${data.pagination?.total || list.length}` };
  });

  await check('GET /assets/dashboard-metrics', async () => {
    const res = await fetch(`${BASE_URL}/assets/dashboard-metrics`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !data.data) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Total Assets in DB: ${data.data.totalAssets || 0}, Value: $${data.data.totalAssetValue || 0}` };
  });

  let categoryId = '';
  await check('GET /org/categories', async () => {
    const res = await fetch(`${BASE_URL}/org/categories`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    categoryId = data.data[0]?.id;
    return { info: `${data.data.length} categories found` };
  });

  await check('POST /assets (Create Hardware Asset)', async () => {
    if (!categoryId) return { broken: true, reason: 'No category found' };
    const res = await fetch(`${BASE_URL}/assets`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: 'Audit Precision Laptop XPS 15',
        categoryId,
        serialNumber: `SN-AUDIT-${Date.now()}`,
        manufacturer: 'Dell',
        model: 'XPS 15 9530',
        purchaseCost: 2499.00,
        status: 'AVAILABLE',
        condition: 'NEW',
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdAssetId = data.data.id;
    createdAssetTag = data.data.assetTag;
    return { info: `Created ID: ${createdAssetId}, Tag: ${createdAssetTag}` };
  });

  await check('GET /assets/:id (Get Asset Details)', async () => {
    if (!createdAssetId) return { broken: true, reason: 'No asset' };
    const res = await fetch(`${BASE_URL}/assets/${createdAssetId}`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || data.data?.id !== createdAssetId) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Fetched: ${data.data.name} (${data.data.assetTag})` };
  });

  await check('PUT /assets/:id (Update Asset Name & Cost)', async () => {
    if (!createdAssetId) return { broken: true, reason: 'No asset' };
    const res = await fetch(`${BASE_URL}/assets/${createdAssetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        name: 'Audit Precision Laptop XPS 15 (Renamed)',
        purchaseCost: 2699.00,
      }),
    });
    const data = await res.json();
    if (res.status !== 200 || data.data?.name !== 'Audit Precision Laptop XPS 15 (Renamed)') {
      return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    }
    return { info: `Updated Name: "${data.data.name}", Cost: $${data.data.purchaseCost}` };
  });

  await check('GET /assets/track/:tag (Quick Search by Tag)', async () => {
    if (!createdAssetTag) return { broken: true, reason: 'No tag' };
    const res = await fetch(`${BASE_URL}/assets/track/${createdAssetTag}`, { headers: authHeader });
    const data = await res.json();
    const asset = data.data?.asset || data.data;
    if (res.status !== 200 || !asset?.assetTag) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    return { info: `Found Tag: ${asset.assetTag}` };
  });

  await check('POST /assets/labels/pdf (Generate Asset QR/Barcode PDF)', async () => {
    if (!createdAssetId) return { broken: true, reason: 'No asset' };
    const res = await fetch(`${BASE_URL}/assets/labels/pdf`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ assetIds: [createdAssetId] }),
    });
    if (res.status !== 200 || res.headers.get('content-type') !== 'application/pdf') {
      return { broken: true, reason: `Status ${res.status}, Type: ${res.headers.get('content-type')}` };
    }
    const buf = await res.arrayBuffer();
    return { info: `Labels PDF generated, size: ${buf.byteLength} bytes` };
  });

  // 7. Allocation & Handover
  let employeeId = '';
  await check('GET /employees', async () => {
    const res = await fetch(`${BASE_URL}/employees`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    employeeId = data.data[0]?.id;
    return { info: `${data.data.length} employees found` };
  });

  let allocationId = '';
  await check('POST /allocations/allocate (Assign Asset)', async () => {
    if (!createdAssetId || !employeeId) return { broken: true, reason: 'Missing asset or employee' };
    const res = await fetch(`${BASE_URL}/allocations/allocate`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        assetId: createdAssetId,
        employeeId,
        allocatedDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 90 * 86400000).toISOString(),
        accessories: ['Charger', 'Mouse'],
      }),
    });
    const data = await res.json();
    allocationId = data.data?.assignment?.id || data.data?.id;
    if (res.status !== 201 || !allocationId) return { broken: true, reason: `Status ${res.status}: ${data.message || JSON.stringify(data)}` };
    return { info: `Allocated, Assignment ID: ${allocationId}` };
  });

  await check('GET /allocations/assignments (List Assignments)', async () => {
    const res = await fetch(`${BASE_URL}/allocations/assignments`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.data.length} active assignments` };
  });

  await check('POST /allocations/acknowledge/:id (Sign Custody)', async () => {
    if (!allocationId) return { broken: true, reason: 'No allocation' };
    const res = await fetch(`${BASE_URL}/allocations/acknowledge/${allocationId}`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        acknowledgementNotes: 'Verified condition GOOD',
      }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) return { broken: true, reason: `Status ${res.status}: ${data.message || JSON.stringify(data)}` };
    return { info: `Acknowledgement signed` };
  });

  await check('GET /allocations/handover-pdf/:id (Stream Handover PDF)', async () => {
    if (!allocationId) return { broken: true, reason: 'No allocation' };
    const res = await fetch(`${BASE_URL}/allocations/handover-pdf/${allocationId}`, { headers: authHeader });
    if (res.status !== 200 || res.headers.get('content-type') !== 'application/pdf') {
      return { broken: true, reason: `Status ${res.status}, Type: ${res.headers.get('content-type')}` };
    }
    const buf = await res.arrayBuffer();
    return { info: `PDF streamed, size: ${buf.byteLength} bytes` };
  });

  await check('POST /allocations/return (Return Asset to Stock)', async () => {
    if (!createdAssetId) return { broken: true, reason: 'No asset' };
    const res = await fetch(`${BASE_URL}/allocations/return`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        assetId: createdAssetId,
        returnDate: new Date().toISOString(),
        condition: 'GOOD',
        notes: 'Returned after audit benchmark',
      }),
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Asset returned to AVAILABLE pool` };
  });

  // 8. Software Licenses (SAM)
  let licenseId = '';
  await check('GET /licenses (SAM Registry)', async () => {
    const res = await fetch(`${BASE_URL}/licenses`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    licenseId = data.data[0]?.id;
    return { info: `${data.data.length} licenses registered` };
  });

  let createdLicId = '';
  await check('POST /licenses (Create Software License)', async () => {
    const res = await fetch(`${BASE_URL}/licenses`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        softwareName: 'Figma Enterprise Audit Edition',
        publisher: 'Figma Inc.',
        licenseType: 'SUBSCRIPTION',
        licenseKey: `LIC-FIGMA-${Date.now()}`,
        quantityPurchased: 25,
        cost: 45.00,
        expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdLicId = data.data.id;
    return { info: `Created License ID: ${createdLicId}` };
  });

  await check('PUT /licenses/:id (Update License - Entity Change)', async () => {
    const targetId = createdLicId || licenseId;
    if (!targetId) return { broken: true, reason: 'No license' };
    const res = await fetch(`${BASE_URL}/licenses/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ softwareName: 'Figma Enterprise Audit Edition (Updated)' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.softwareName}"` };
  });

  await check('DELETE /licenses/:id (Delete License)', async () => {
    if (!createdLicId) return { broken: true, reason: 'No created license to delete' };
    const res = await fetch(`${BASE_URL}/licenses/${createdLicId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `License deleted successfully` };
  });

  // 9. Consumables
  let consumableId = '';
  await check('GET /consumables (Stock Registry)', async () => {
    const res = await fetch(`${BASE_URL}/consumables`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    consumableId = data.data[0]?.id;
    return { info: `${data.data.length} consumable items registered` };
  });

  let createdConsId = '';
  await check('POST /consumables (Create Consumable Item)', async () => {
    const res = await fetch(`${BASE_URL}/consumables`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: 'USB-C to HDMI 4K Adapter',
        category: 'ADAPTER',
        itemCode: `CONS-${Date.now()}`,
        stockQuantity: 50,
        minQuantity: 10,
        unitCost: 19.99,
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdConsId = data.data.id;
    return { info: `Created Consumable ID: ${createdConsId}` };
  });

  await check('PUT /consumables/:id (Update Consumable - Entity Change)', async () => {
    const targetId = createdConsId || consumableId;
    if (!targetId) return { broken: true, reason: 'No consumable' };
    const res = await fetch(`${BASE_URL}/consumables/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: 'USB-C to HDMI 4K Adapter (Gold Plated)' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.name}"` };
  });

  await check('DELETE /consumables/:id (Delete Consumable)', async () => {
    if (!createdConsId) return { broken: true, reason: 'No created consumable to delete' };
    const res = await fetch(`${BASE_URL}/consumables/${createdConsId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Consumable deleted successfully` };
  });

  // 10. Helpdesk Tickets
  await check('GET /tickets (Ticket Queue)', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.data.length} tickets in queue` };
  });

  let createdTicketId = '';
  await check('POST /tickets (Submit Incident Ticket)', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        subject: 'Audit Ticket: Display calibration check',
        title: 'Audit Ticket: Display calibration check',
        description: 'Verifying display panel color profile after OS update.',
        priority: 'MEDIUM',
        category: 'HARDWARE',
        requesterId: employeeId,
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdTicketId = data.data.id;
    return { info: `Ticket ID: ${createdTicketId}, Code: ${data.data.ticketNumber || data.data.code}` };
  });

  await check('POST /tickets/:id/comments (Add Comment)', async () => {
    if (!createdTicketId) return { broken: true, reason: 'No ticket' };
    const res = await fetch(`${BASE_URL}/tickets/${createdTicketId}/comments`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ comment: 'Support engineer running diagnostics' }),
    });
    const data = await res.json();
    if (res.status !== 200 && res.status !== 201) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Comment added` };
  });

  // 11. Maintenance
  await check('GET /maintenance (Maintenance Records)', async () => {
    const res = await fetch(`${BASE_URL}/maintenance`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.data.length} maintenance records` };
  });

  // 12. Reports Export
  await check('GET /reports/inventory', async () => {
    const res = await fetch(`${BASE_URL}/reports/inventory`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Inventory report retrieved` };
  });

  await check('GET /reports/warranty', async () => {
    const res = await fetch(`${BASE_URL}/reports/warranty`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Warranty report retrieved` };
  });

  await check('GET /reports/export?entity=assets&format=csv', async () => {
    const res = await fetch(`${BASE_URL}/reports/export?entity=assets&format=csv`, { headers: authHeader });
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}` };
    const text = await res.text();
    return { info: `CSV rows: ${text.split('\n').length}` };
  });

  await check('GET /reports/export?entity=assets&format=xlsx', async () => {
    const res = await fetch(`${BASE_URL}/reports/export?entity=assets&format=xlsx`, { headers: authHeader });
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}` };
    const buf = await res.arrayBuffer();
    return { info: `XLSX size: ${buf.byteLength} bytes` };
  });

  // 13. System Audit Logs
  await check('GET /system/audit-logs', async () => {
    const res = await fetch(`${BASE_URL}/system/audit-logs?limit=5`, { headers: authHeader });
    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data.data?.logs) ? data.data.logs : null);
    if (res.status !== 200 || !list) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.pagination?.total || list.length} audit log entries` };
  });

  // 14. Master Data Entities (Departments, Categories, Locations, Vendors)
  let deptId = '';
  await check('GET /org/departments', async () => {
    const res = await fetch(`${BASE_URL}/org/departments`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    deptId = data.data[0]?.id;
    return { info: `${data.data.length} departments` };
  });

  let createdDeptId = '';
  await check('POST /org/departments (Create Department)', async () => {
    const res = await fetch(`${BASE_URL}/org/departments`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: `Audit Dept ${Date.now()}`,
        code: `DEP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdDeptId = data.data.id;
    return { info: `Created Department: "${data.data.name}"` };
  });

  await check('PUT /org/departments/:id (Update Department Name - Entity Change)', async () => {
    const targetId = createdDeptId || deptId;
    if (!targetId) return { broken: true, reason: 'No dept' };
    const res = await fetch(`${BASE_URL}/org/departments/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: 'Engineering & Innovation Center' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.name}"` };
  });

  await check('DELETE /org/departments/:id (Delete Department)', async () => {
    if (!createdDeptId) return { broken: true, reason: 'No dept to delete' };
    const res = await fetch(`${BASE_URL}/org/departments/${createdDeptId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Department deleted` };
  });

  let createdCatId = '';
  await check('POST /org/categories (Create Category)', async () => {
    const res = await fetch(`${BASE_URL}/org/categories`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: `Audit Category ${Date.now()}`,
        code: `CAT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdCatId = data.data.id;
    return { info: `Created Category: "${data.data.name}"` };
  });

  await check('PUT /org/categories/:id (Update Category Name - Entity Change)', async () => {
    const targetId = createdCatId || categoryId;
    if (!targetId) return { broken: true, reason: 'No category' };
    const res = await fetch(`${BASE_URL}/org/categories/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: 'High-Performance Laptops' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.name}"` };
  });

  await check('DELETE /org/categories/:id (Delete Category)', async () => {
    if (!createdCatId) return { broken: true, reason: 'No category to delete' };
    const res = await fetch(`${BASE_URL}/org/categories/${createdCatId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Category deleted` };
  });

  let locId = '';
  await check('GET /org/locations', async () => {
    const res = await fetch(`${BASE_URL}/org/locations`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    locId = data.data[0]?.id;
    return { info: `${data.data.length} locations` };
  });

  let createdLocId = '';
  await check('POST /org/locations (Create Location)', async () => {
    const res = await fetch(`${BASE_URL}/org/locations`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: `Audit Campus ${Date.now()}`,
        code: `LOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        address: '100 Innovation Way',
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdLocId = data.data.id;
    return { info: `Created Location: "${data.data.name}"` };
  });

  await check('PUT /org/locations/:id (Update Location Name - Entity Change)', async () => {
    const targetId = createdLocId || locId;
    if (!targetId) return { broken: true, reason: 'No location' };
    const res = await fetch(`${BASE_URL}/org/locations/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: 'Global Tech Headquarters' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.name}"` };
  });

  await check('DELETE /org/locations/:id (Delete Location)', async () => {
    if (!createdLocId) return { broken: true, reason: 'No location to delete' };
    const res = await fetch(`${BASE_URL}/org/locations/${createdLocId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Location deleted` };
  });

  let vendorId = '';
  await check('GET /org/vendors', async () => {
    const res = await fetch(`${BASE_URL}/org/vendors`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    vendorId = data.data[0]?.id;
    return { info: `${data.data.length} vendors` };
  });

  let createdVendorId = '';
  await check('POST /org/vendors (Create Vendor)', async () => {
    const res = await fetch(`${BASE_URL}/org/vendors`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: `Audit Vendor ${Date.now()}`,
        code: `VEN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        email: 'vendor@audit.com',
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdVendorId = data.data.id;
    return { info: `Created Vendor: "${data.data.name}"` };
  });

  await check('PUT /org/vendors/:id (Update Vendor Name - Entity Change)', async () => {
    const targetId = createdVendorId || vendorId;
    if (!targetId) return { broken: true, reason: 'No vendor' };
    const res = await fetch(`${BASE_URL}/org/vendors/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ name: 'Dell Enterprise Solutions Global' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: "${data.data?.name}"` };
  });

  await check('DELETE /org/vendors/:id (Delete Vendor)', async () => {
    if (!createdVendorId) return { broken: true, reason: 'No vendor to delete' };
    const res = await fetch(`${BASE_URL}/org/vendors/${createdVendorId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Vendor deleted` };
  });

  // 15. Employee Management
  let createdEmpId = '';
  await check('POST /employees (Create Employee)', async () => {
    const uniqueEmail = `audit.user.${Date.now()}@acme-corp.com`;
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        employeeId: `EMP-AUDIT-${Date.now()}`,
        firstName: 'Audit',
        lastName: 'Specialist',
        email: uniqueEmail,
        jobTitle: 'Senior QA Engineer',
      }),
    });
    const data = await res.json();
    if (res.status !== 201 || !data.data?.id) return { broken: true, reason: `Status ${res.status}: ${JSON.stringify(data)}` };
    createdEmpId = data.data.id;
    return { info: `Created Employee ID: ${createdEmpId}` };
  });

  await check('PUT /employees/:id (Update Employee - Entity Change)', async () => {
    const targetId = createdEmpId || employeeId;
    if (!targetId) return { broken: true, reason: 'No employee' };
    const res = await fetch(`${BASE_URL}/employees/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ firstName: 'Auditor', lastName: 'Master' }),
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Updated to: ${data.data?.firstName} ${data.data?.lastName}` };
  });

  await check('DELETE /employees/:id (Delete Employee)', async () => {
    if (!createdEmpId) return { broken: true, reason: 'No created employee to delete' };
    const res = await fetch(`${BASE_URL}/employees/${createdEmpId}`, {
      method: 'DELETE',
      headers: authHeader,
    });
    const data = await res.json();
    if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
    return { info: `Employee deleted safely` };
  });

  // 16. Disaster Recovery & Cloud Backup Engine
  await check('GET /system/backup/config (Backup Settings)', async () => {
    const res = await fetch(`${BASE_URL}/system/backup/config`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !data.data) return { broken: true, reason: `Status ${res.status}` };
    return { info: `Provider: ${data.data.provider}, AutoBackup: ${data.data.autoBackupEnabled}` };
  });

  await check('GET /system/backup/history (Backup Snapshots)', async () => {
    const res = await fetch(`${BASE_URL}/system/backup/history`, { headers: authHeader });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data.data)) return { broken: true, reason: `Status ${res.status}` };
    return { info: `${data.data.length} backup snapshots registered` };
  });

  // 17. Clean up test asset
  if (createdAssetId) {
    await check('DELETE /assets/:id (Archive Asset)', async () => {
      const res = await fetch(`${BASE_URL}/assets/${createdAssetId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const data = await res.json();
      if (res.status !== 200) return { broken: true, reason: `Status ${res.status}: ${data.message}` };
      return { info: `Asset archived` };
    });
  }

  console.log('\n========================================================================');
  console.log('📊 AUDIT SUMMARY:');
  console.log(`   Working Features: ${results.working.length}`);
  console.log(`   Broken / Missing Features: ${results.broken.length}`);
  console.log('========================================================================');
  if (results.broken.length > 0) {
    console.log('\n❌ DETAILED DEFECTS:');
    results.broken.forEach((b, i) => {
      console.log(`   ${i + 1}. [${b.name}] -> ${b.reason}`);
    });
  } else {
    console.log('\n🎉 ALL AUDIT CHECKS PASSED WITH 100% SUCCESS RATE! 0 DEFECTS DETECTED.');
  }
}

runAudit().catch(console.error);

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Enterprise ITAM Database Seed...');

  // 1. Organization Branding & Tenancy
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-global' },
    update: {},
    create: {
      name: 'Acme Global Technologies Inc.',
      slug: 'acme-global',
      logoUrl: '/logo.svg',
      address: '100 Innovation Blvd, Suite 500, San Francisco, CA 94105, USA',
      email: 'it-support@acme-corp.com',
      phone: '+1 (415) 555-0199',
      website: 'https://www.acme-corp.com',
      taxId: 'US-EIN-94-3829104',
      currency: 'USD',
    },
  });

  console.log(`✅ Organization created: ${org.name}`);

  // 2. Default System Settings
  const defaultSettings = [
    { key: 'company.name', value: 'Acme Global Technologies Inc.', group: 'BRANDING' },
    { key: 'company.logo', value: '/logo.svg', group: 'BRANDING' },
    { key: 'company.tax_id', value: 'US-EIN-94-3829104', group: 'BRANDING' },
    { key: 'company.currency', value: 'USD', group: 'BRANDING' },
    { key: 'asset.prefix', value: 'IT', group: 'ASSET_NUMBERING' },
    { key: 'asset.padding', value: '6', group: 'ASSET_NUMBERING' },
    { key: 'asset.pattern', value: '{PREFIX}-{CATEGORY}-{NUMBER:6}', group: 'ASSET_NUMBERING' },
    { key: 'barcode.type', value: 'CODE128', group: 'BARCODE' },
    { key: 'barcode.include_logo', value: 'true', group: 'BARCODE' },
    { key: 'warranty.alert_days', value: '90,30,7', group: 'NOTIFICATIONS' },
    { key: 'maintenance.preventive_interval_days', value: '90', group: 'SLA' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, group: s.group },
      create: { ...s, organizationId: org.id },
    });
  }

  // 3. Permissions
  const permissionsList = [
    // Assets
    { code: 'assets:create', module: 'assets', description: 'Create new IT assets' },
    { code: 'assets:read', module: 'assets', description: 'View IT assets and details' },
    { code: 'assets:update', module: 'assets', description: 'Modify IT asset records' },
    { code: 'assets:delete', module: 'assets', description: 'Archive or remove IT assets' },
    { code: 'assets:allocate', module: 'assets', description: 'Allocate assets to employees' },
    { code: 'assets:return', module: 'assets', description: 'Process asset returns and conditions' },
    { code: 'assets:transfer', module: 'assets', description: 'Transfer assets between departments/locations' },
    { code: 'assets:dispose', module: 'assets', description: 'Initiate and approve asset disposal' },
    // Tickets
    { code: 'tickets:create', module: 'tickets', description: 'Raise IT support tickets' },
    { code: 'tickets:read', module: 'tickets', description: 'View IT support tickets' },
    { code: 'tickets:update', module: 'tickets', description: 'Update and resolve tickets' },
    { code: 'tickets:delete', module: 'tickets', description: 'Delete tickets' },
    // SAM & Consumables
    { code: 'licenses:manage', module: 'licenses', description: 'Manage software licenses and seats' },
    { code: 'consumables:manage', module: 'consumables', description: 'Manage spare parts and consumables' },
    // Reports & Audit
    { code: 'reports:view', module: 'reports', description: 'View and export analytics reports' },
    { code: 'audit:view', module: 'audit', description: 'Inspect audit trail and security logs' },
    // Admin & Settings
    { code: 'users:manage', module: 'users', description: 'Manage users, employees, and roles' },
    { code: 'settings:manage', module: 'settings', description: 'Manage global company configurations' },
  ];

  const dbPermissions = [];
  for (const p of permissionsList) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, description: p.description },
      create: p,
    });
    dbPermissions.push(perm);
  }

  // 4. Roles
  const superAdminRole = await prisma.role.upsert({
    where: { id: 'role-super-admin' },
    update: {},
    create: {
      id: 'role-super-admin',
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      description: 'Unrestricted system-level control over all entities, settings, and tenants',
      isSystem: true,
      organizationId: org.id,
    },
  });

  const itAdminRole = await prisma.role.upsert({
    where: { id: 'role-it-admin' },
    update: {},
    create: {
      id: 'role-it-admin',
      name: 'IT_ADMIN',
      displayName: 'IT Administrator',
      description: 'Manages assets, allocations, maintenance, software licenses, and operations',
      isSystem: true,
      organizationId: org.id,
    },
  });

  const supportRole = await prisma.role.upsert({
    where: { id: 'role-support-engineer' },
    update: {},
    create: {
      id: 'role-support-engineer',
      name: 'SUPPORT_ENGINEER',
      displayName: 'Support Engineer',
      description: 'Scans barcodes, executes allocations/returns, troubleshoots, and updates tickets',
      isSystem: true,
      organizationId: org.id,
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { id: 'role-employee' },
    update: {},
    create: {
      id: 'role-employee',
      name: 'EMPLOYEE',
      displayName: 'Employee / End User',
      description: 'Self-service view of assigned assets, acknowledgement, and ticket submission',
      isSystem: true,
      organizationId: org.id,
    },
  });

  // Assign permissions to Super Admin (all)
  for (const p of dbPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: p.id,
      },
    });
  }

  // 5. Locations (Hierarchy: HQ -> Building -> Floor -> Room/Rack)
  const locHq = await prisma.location.upsert({
    where: { code: 'LOC-HQ' },
    update: {},
    create: {
      name: 'San Francisco Global Headquarters',
      code: 'LOC-HQ',
      type: 'OFFICE',
      address: '100 Innovation Blvd, San Francisco, CA',
      organizationId: org.id,
    },
  });

  const locBuilding1 = await prisma.location.upsert({
    where: { code: 'LOC-HQ-B1' },
    update: {},
    create: {
      name: 'Building Alpha',
      code: 'LOC-HQ-B1',
      type: 'BUILDING',
      parentId: locHq.id,
      organizationId: org.id,
    },
  });

  const locFloor4 = await prisma.location.upsert({
    where: { code: 'LOC-HQ-B1-F4' },
    update: {},
    create: {
      name: 'Floor 4 - Engineering & IT Ops',
      code: 'LOC-HQ-B1-F4',
      type: 'FLOOR',
      parentId: locBuilding1.id,
      organizationId: org.id,
    },
  });

  const locServerRoom = await prisma.location.upsert({
    where: { code: 'LOC-HQ-SR1' },
    update: {},
    create: {
      name: 'Datacenter Server Room A',
      code: 'LOC-HQ-SR1',
      type: 'ROOM',
      parentId: locFloor4.id,
      organizationId: org.id,
    },
  });

  const locRack01 = await prisma.location.upsert({
    where: { code: 'LOC-HQ-RACK-01' },
    update: {},
    create: {
      name: 'Rack 42U - Primary Compute (R01)',
      code: 'LOC-HQ-RACK-01',
      type: 'RACK',
      parentId: locServerRoom.id,
      organizationId: org.id,
    },
  });

  const locNyOffice = await prisma.location.upsert({
    where: { code: 'LOC-NY' },
    update: {},
    create: {
      name: 'New York Regional Tech Center',
      code: 'LOC-NY',
      type: 'OFFICE',
      address: '350 5th Avenue, New York, NY',
      organizationId: org.id,
    },
  });

  // 6. Departments
  const deptIT = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: {
      name: 'Information Technology',
      code: 'IT',
      departmentHead: 'Alex Mercer',
      costCenter: 'CC-IT-101',
      locationId: locFloor4.id,
      organizationId: org.id,
    },
  });

  const deptEng = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      name: 'Software Engineering & Cloud',
      code: 'ENG',
      departmentHead: 'Sarah Connor',
      costCenter: 'CC-ENG-201',
      locationId: locFloor4.id,
      organizationId: org.id,
    },
  });

  const deptHR = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      name: 'Human Resources',
      code: 'HR',
      departmentHead: 'Elena Rostova',
      costCenter: 'CC-HR-301',
      locationId: locHq.id,
      organizationId: org.id,
    },
  });

  const deptFin = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: {
      name: 'Finance & Operations',
      code: 'FIN',
      departmentHead: 'Marcus Vance',
      costCenter: 'CC-FIN-401',
      locationId: locHq.id,
      organizationId: org.id,
    },
  });

  // 7. Vendors
  const vendorDell = await prisma.vendor.upsert({
    where: { code: 'VND-DELL' },
    update: {},
    create: {
      name: 'Dell Technologies Enterprise',
      code: 'VND-DELL',
      contactPerson: 'David Miller',
      email: 'enterprise@dell.com',
      phone: '+1 (800) 456-3355',
      website: 'https://www.dell.com',
      taxId: 'US-TX-DELL-128',
      paymentTerms: 'Net 30',
      organizationId: org.id,
    },
  });

  const vendorApple = await prisma.vendor.upsert({
    where: { code: 'VND-AAPL' },
    update: {},
    create: {
      name: 'Apple Enterprise Solutions',
      code: 'VND-AAPL',
      contactPerson: 'Karen Lee',
      email: 'business@apple.com',
      phone: '+1 (800) 854-3680',
      website: 'https://www.apple.com/business',
      paymentTerms: 'Net 30',
      organizationId: org.id,
    },
  });

  const vendorCisco = await prisma.vendor.upsert({
    where: { code: 'VND-CSCO' },
    update: {},
    create: {
      name: 'Cisco Systems Networks',
      code: 'VND-CSCO',
      contactPerson: 'Robert Chang',
      email: 'support@cisco.com',
      phone: '+1 (800) 553-6387',
      website: 'https://www.cisco.com',
      paymentTerms: 'Net 45',
      organizationId: org.id,
    },
  });

  // 8. Categories & Subcategories
  const catComputing = await prisma.category.upsert({
    where: { code: 'CAT-COMP' },
    update: {},
    create: {
      name: 'Computing',
      code: 'CAT-COMP',
      description: 'Laptops, Workstations, Desktops, and Mobile Computing Devices',
      icon: 'Laptop',
      customFieldsSchema: JSON.stringify([
        { name: 'cpu', label: 'CPU / Processor', type: 'text', required: true },
        { name: 'ram', label: 'RAM Size (GB)', type: 'select', options: ['8GB', '16GB', '32GB', '64GB', '128GB'] },
        { name: 'storage', label: 'Storage (SSD/NVMe)', type: 'text', required: true },
        { name: 'os', label: 'Operating System', type: 'select', options: ['Windows 11 Pro', 'macOS Sequoia', 'Ubuntu 24.04 LTS', 'Red Hat'] },
      ]),
      organizationId: org.id,
    },
  });

  const catLaptop = await prisma.category.upsert({
    where: { code: 'CAT-LAPTOP' },
    update: {},
    create: {
      name: 'Laptop',
      code: 'CAT-LAPTOP',
      parentId: catComputing.id,
      description: 'Portable business laptops and ultrabooks',
      icon: 'Laptop',
      organizationId: org.id,
    },
  });

  const catServer = await prisma.category.upsert({
    where: { code: 'CAT-SERVER' },
    update: {},
    create: {
      name: 'Servers & Storage',
      code: 'CAT-SERVER',
      description: 'Physical rack servers, NAS, and SAN storage units',
      icon: 'Server',
      customFieldsSchema: JSON.stringify([
        { name: 'raid', label: 'RAID Configuration', type: 'text' },
        { name: 'iloAddress', label: 'iLO / iDRAC IPMI IP', type: 'text' },
        { name: 'vmCount', label: 'Active VM Count', type: 'number' },
      ]),
      organizationId: org.id,
    },
  });

  const catNetworking = await prisma.category.upsert({
    where: { code: 'CAT-NET' },
    update: {},
    create: {
      name: 'Networking',
      code: 'CAT-NET',
      description: 'Switches, Routers, Firewalls, and Access Points',
      icon: 'Network',
      customFieldsSchema: JSON.stringify([
        { name: 'portCount', label: 'Port Count', type: 'number' },
        { name: 'firmwareVersion', label: 'Firmware Version', type: 'text' },
        { name: 'managementIp', label: 'Management IP', type: 'text' },
        { name: 'vlan', label: 'Primary VLAN', type: 'text' },
      ]),
      organizationId: org.id,
    },
  });

  const catDisplays = await prisma.category.upsert({
    where: { code: 'CAT-DISP' },
    update: {},
    create: {
      name: 'Displays',
      code: 'CAT-DISP',
      description: 'LED, LCD Monitors, Curved Displays, and Projectors',
      icon: 'Monitor',
      organizationId: org.id,
    },
  });

  // 9. Users & Employees
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const userPasswordHash = await bcrypt.hash('User@123456', 10);

  // Super Admin User
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@acme-corp.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@acme-corp.com',
      username: 'admin',
      passwordHash: adminPasswordHash,
      firstName: 'Chief',
      lastName: 'Administrator',
      roleId: superAdminRole.id,
      organizationId: org.id,
      isEmailVerified: true,
    },
  });

  // IT Admin User & Employee
  const itAdminUser = await prisma.user.upsert({
    where: { email: 'itadmin@acme-corp.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'itadmin@acme-corp.com',
      username: 'itadmin',
      passwordHash: adminPasswordHash,
      firstName: 'Alex',
      lastName: 'Mercer',
      phone: '+1 415-555-0101',
      roleId: itAdminRole.id,
      organizationId: org.id,
      isEmailVerified: true,
    },
  });

  await prisma.employee.upsert({
    where: { employeeId: 'EMP-001' },
    update: {},
    create: {
      employeeId: 'EMP-001',
      firstName: 'Alex',
      lastName: 'Mercer',
      email: 'itadmin@acme-corp.com',
      phone: '+1 415-555-0101',
      designation: 'IT Director & Systems Architect',
      departmentId: deptIT.id,
      locationId: locFloor4.id,
      joiningDate: new Date('2021-03-15'),
      costCenter: 'CC-IT-101',
      userId: itAdminUser.id,
      organizationId: org.id,
    },
  });

  // Support Engineer
  const supportUser = await prisma.user.upsert({
    where: { email: 'support@acme-corp.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'support@acme-corp.com',
      username: 'support',
      passwordHash: adminPasswordHash,
      firstName: 'Jason',
      lastName: 'Lee',
      phone: '+1 415-555-0102',
      roleId: supportRole.id,
      organizationId: org.id,
      isEmailVerified: true,
    },
  });

  await prisma.employee.upsert({
    where: { employeeId: 'EMP-002' },
    update: {},
    create: {
      employeeId: 'EMP-002',
      firstName: 'Jason',
      lastName: 'Lee',
      email: 'support@acme-corp.com',
      phone: '+1 415-555-0102',
      designation: 'Senior IT Support Specialist',
      departmentId: deptIT.id,
      locationId: locFloor4.id,
      joiningDate: new Date('2022-06-01'),
      costCenter: 'CC-IT-101',
      userId: supportUser.id,
      organizationId: org.id,
    },
  });

  // Regular Employee 1: John Doe
  const johnUser = await prisma.user.upsert({
    where: { email: 'john.doe@acme-corp.com' },
    update: { passwordHash: userPasswordHash },
    create: {
      email: 'john.doe@acme-corp.com',
      username: 'johndoe',
      passwordHash: userPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1 415-555-0155',
      roleId: employeeRole.id,
      organizationId: org.id,
      isEmailVerified: true,
    },
  });

  const empJohn = await prisma.employee.upsert({
    where: { employeeId: 'EMP-003' },
    update: {},
    create: {
      employeeId: 'EMP-003',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@acme-corp.com',
      phone: '+1 415-555-0155',
      designation: 'Staff Backend Software Engineer',
      departmentId: deptEng.id,
      locationId: locFloor4.id,
      joiningDate: new Date('2023-01-10'),
      costCenter: 'CC-ENG-201',
      userId: johnUser.id,
      organizationId: org.id,
    },
  });

  // Regular Employee 2: Sarah Connor
  const sarahUser = await prisma.user.upsert({
    where: { email: 'sarah.connor@acme-corp.com' },
    update: { passwordHash: userPasswordHash },
    create: {
      email: 'sarah.connor@acme-corp.com',
      username: 'sarahc',
      passwordHash: userPasswordHash,
      firstName: 'Sarah',
      lastName: 'Connor',
      phone: '+1 415-555-0188',
      roleId: employeeRole.id,
      organizationId: org.id,
      isEmailVerified: true,
    },
  });

  const empSarah = await prisma.employee.upsert({
    where: { employeeId: 'EMP-004' },
    update: {},
    create: {
      employeeId: 'EMP-004',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@acme-corp.com',
      phone: '+1 415-555-0188',
      designation: 'Engineering VP & Lead Architect',
      departmentId: deptEng.id,
      locationId: locFloor4.id,
      joiningDate: new Date('2022-02-14'),
      costCenter: 'CC-ENG-201',
      userId: sarahUser.id,
      organizationId: org.id,
    },
  });

  // 10. Assets
  const asset1 = await prisma.asset.upsert({
    where: { assetId: 'IT-LAP-000001' },
    update: {},
    create: {
      assetId: 'IT-LAP-000001',
      assetTag: 'TAG-DL-7440-001',
      barcode: 'IT-LAP-000001',
      qrCode: 'IT-LAP-000001',
      serialNumber: 'SN-DELL-7440-XY12',
      name: 'Dell Latitude 7440 Ultrabook 14"',
      categoryId: catLaptop.id,
      status: 'ASSIGNED',
      condition: 'EXCELLENT',
      departmentId: deptEng.id,
      locationId: locFloor4.id,
      costCenter: 'CC-ENG-201',
      manufacturer: 'Dell',
      brand: 'Latitude',
      model: 'Latitude 7440',
      cpu: 'Intel Core i7-1365U vPro (10-Core)',
      ram: '32GB LPDDR5',
      storage: '1TB M.2 PCIe NVMe Gen4 SSD',
      operatingSystem: 'Windows 11 Pro 64-bit',
      macAddress: '00:1A:2B:3C:4D:5E',
      ipAddress: '192.168.10.45',
      hostname: 'US-SFO-ENG-LAP01',
      vendorId: vendorDell.id,
      poNumber: 'PO-2024-0089',
      invoiceNumber: 'INV-DELL-99201',
      purchaseDate: new Date('2024-02-15'),
      purchaseCost: 1899.0,
      warrantyStart: new Date('2024-02-15'),
      warrantyEnd: new Date('2027-02-15'),
      warrantyProvider: 'Dell ProSupport Plus with Next Business Day Onsite',
      currentEmployeeId: empJohn.id,
      assignmentDate: new Date('2024-02-20'),
      allocationType: 'PERMANENT',
      handoverStatus: 'ACKNOWLEDGED',
      organizationId: org.id,
      notes: 'Standard high-performance engineer allocation with dual external monitor capability.',
    },
  });

  // Allocation record for Asset 1
  await prisma.assetAssignment.create({
    data: {
      assetId: asset1.id,
      employeeId: empJohn.id,
      allocatedById: itAdminUser.id,
      allocationType: 'PERMANENT',
      allocationDate: new Date('2024-02-20'),
      accessories: JSON.stringify(['Dell 65W USB-C GaN Charger', 'Dell Pro Wireless Optical Mouse', 'Targus 15.6" Eco Laptop Bag']),
      termsAccepted: true,
      acknowledgedAt: new Date('2024-02-21'),
      acknowledgementType: 'DIGITAL_SIGNATURE',
      acknowledgementIp: '192.168.10.45',
      signatureData: 'John Doe (E-Signature Verified)',
      status: 'ACTIVE',
      notes: 'Handover complete and verified in good physical order.',
    },
  });

  // Lifecycle log
  await prisma.assetLifecycleLog.create({
    data: {
      assetId: asset1.id,
      eventType: 'ALLOCATION',
      description: 'Asset IT-LAP-000001 allocated to employee John Doe (EMP-003)',
      fromStatus: 'AVAILABLE',
      toStatus: 'ASSIGNED',
      performedById: itAdminUser.id,
      performedBy: 'Alex Mercer (IT Admin)',
      metadata: JSON.stringify({ employee: 'John Doe', department: 'Engineering' }),
    },
  });

  // Asset 2: MacBook Pro (Assigned to Sarah Connor)
  const asset2 = await prisma.asset.upsert({
    where: { assetId: 'IT-LAP-000002' },
    update: {},
    create: {
      assetId: 'IT-LAP-000002',
      assetTag: 'TAG-MBP-16-002',
      barcode: 'IT-LAP-000002',
      qrCode: 'IT-LAP-000002',
      serialNumber: 'SN-AAPL-M3X-9941',
      name: 'MacBook Pro 16" Apple Silicon M3 Max',
      categoryId: catLaptop.id,
      status: 'ASSIGNED',
      condition: 'NEW',
      departmentId: deptEng.id,
      locationId: locFloor4.id,
      costCenter: 'CC-ENG-201',
      manufacturer: 'Apple',
      brand: 'MacBook Pro',
      model: 'MacBook Pro 16-inch M3 Max (2024)',
      cpu: 'Apple M3 Max (16-core CPU, 40-core GPU)',
      ram: '64GB Unified Memory',
      storage: '2TB High-Speed SSD',
      operatingSystem: 'macOS Sequoia 15.1',
      macAddress: 'F0:18:98:AA:BB:CC',
      ipAddress: '192.168.10.12',
      hostname: 'US-SFO-ENG-MBP02',
      vendorId: vendorApple.id,
      poNumber: 'PO-2024-0120',
      invoiceNumber: 'INV-AAPL-88319',
      purchaseDate: new Date('2024-04-10'),
      purchaseCost: 3999.0,
      warrantyStart: new Date('2024-04-10'),
      warrantyEnd: new Date('2027-04-10'),
      warrantyProvider: 'AppleCare+ for Enterprise',
      currentEmployeeId: empSarah.id,
      assignmentDate: new Date('2024-04-12'),
      allocationType: 'PERMANENT',
      handoverStatus: 'ACKNOWLEDGED',
      organizationId: org.id,
    },
  });

  await prisma.assetAssignment.create({
    data: {
      assetId: asset2.id,
      employeeId: empSarah.id,
      allocatedById: itAdminUser.id,
      allocationType: 'PERMANENT',
      allocationDate: new Date('2024-04-12'),
      accessories: JSON.stringify(['Apple 140W USB-C Power Adapter', 'MagSafe 3 Braided Cable', 'Magic Mouse Black']),
      termsAccepted: true,
      acknowledgedAt: new Date('2024-04-12'),
      acknowledgementType: 'DIGITAL_SIGNATURE',
      acknowledgementIp: '192.168.10.12',
      signatureData: 'Sarah Connor',
      status: 'ACTIVE',
    },
  });

  // Asset 3: Server in Rack
  await prisma.asset.upsert({
    where: { assetId: 'IT-SRV-000001' },
    update: {},
    create: {
      assetId: 'IT-SRV-000001',
      assetTag: 'TAG-R750-RACK-01',
      barcode: 'IT-SRV-000001',
      qrCode: 'IT-SRV-000001',
      serialNumber: 'SN-DELL-R750-8841A',
      name: 'Dell PowerEdge R750 2U Rack Server',
      categoryId: catServer.id,
      status: 'IN_USE',
      condition: 'EXCELLENT',
      departmentId: deptIT.id,
      locationId: locRack01.id,
      rackUnit: 'U14-U15',
      datacenter: 'SFO Data Center Alpha',
      costCenter: 'CC-IT-101',
      manufacturer: 'Dell',
      brand: 'PowerEdge',
      model: 'PowerEdge R750',
      cpu: 'Dual Intel Xeon Platinum 8358 (64 cores total)',
      ram: '512GB DDR4 ECC Registered',
      storage: '8x 3.84TB SAS Enterprise SSD in RAID 10',
      operatingSystem: 'VMware ESXi 8.0 Update 2',
      iloAddress: '10.0.100.14',
      managementIp: '10.0.100.14',
      ipAddress: '10.0.10.14',
      hostname: 'sfo-esxi-prod-01.acme-corp.com',
      vendorId: vendorDell.id,
      purchaseDate: new Date('2023-08-01'),
      purchaseCost: 14500.0,
      warrantyStart: new Date('2023-08-01'),
      warrantyEnd: new Date('2028-08-01'),
      warrantyProvider: 'Dell ProSupport Mission Critical 4hr 24x7',
      organizationId: org.id,
      notes: 'Primary production virtualization host running core infrastructure microservices.',
    },
  });

  // Asset 4: Cisco Core Switch
  await prisma.asset.upsert({
    where: { assetId: 'IT-NET-000001' },
    update: {},
    create: {
      assetId: 'IT-NET-000001',
      assetTag: 'TAG-CSCO-9300-48P',
      barcode: 'IT-NET-000001',
      qrCode: 'IT-NET-000001',
      serialNumber: 'SN-CSCO-C9300-48P-99',
      name: 'Cisco Catalyst 9300 48-Port PoE+ Managed Switch',
      categoryId: catNetworking.id,
      status: 'IN_USE',
      condition: 'EXCELLENT',
      departmentId: deptIT.id,
      locationId: locRack01.id,
      rackUnit: 'U20',
      portCount: 48,
      uplinkPort: '4x 10G SFP+',
      firmwareVersion: 'Cisco IOS-XE 17.9.4a',
      managementIp: '10.0.1.1',
      vlan: 'VLAN 10, 20, 30, 99',
      hostname: 'sfo-sw-core-01',
      vendorId: vendorCisco.id,
      purchaseDate: new Date('2023-05-10'),
      purchaseCost: 6800.0,
      warrantyStart: new Date('2023-05-10'),
      warrantyEnd: new Date('2026-05-10'),
      organizationId: org.id,
    },
  });

  // Asset 5: Available Stock Laptop
  await prisma.asset.upsert({
    where: { assetId: 'IT-LAP-000003' },
    update: {},
    create: {
      assetId: 'IT-LAP-000003',
      assetTag: 'TAG-LEN-X1C-003',
      barcode: 'IT-LAP-000003',
      qrCode: 'IT-LAP-000003',
      serialNumber: 'SN-LEN-X1C-G11-3820',
      name: 'Lenovo ThinkPad X1 Carbon Gen 11',
      categoryId: catLaptop.id,
      status: 'AVAILABLE',
      condition: 'NEW',
      departmentId: deptIT.id,
      locationId: locFloor4.id,
      costCenter: 'CC-IT-101',
      manufacturer: 'Lenovo',
      brand: 'ThinkPad',
      model: 'X1 Carbon Gen 11',
      cpu: 'Intel Core i7-1370P vPro',
      ram: '32GB LPDDR5',
      storage: '1TB NVMe Opal SSD',
      operatingSystem: 'Windows 11 Pro',
      purchaseDate: new Date('2024-09-01'),
      purchaseCost: 2150.0,
      warrantyStart: new Date('2024-09-01'),
      warrantyEnd: new Date('2027-09-01'),
      warrantyProvider: 'Lenovo Premier Support Plus 3-Yr Onsite',
      organizationId: org.id,
      notes: 'Ready for deployment to incoming executive or engineering hire.',
    },
  });

  // Asset 6: Under Maintenance Asset
  const assetMnt = await prisma.asset.upsert({
    where: { assetId: 'IT-LAP-000004' },
    update: {},
    create: {
      assetId: 'IT-LAP-000004',
      assetTag: 'TAG-HP-840-004',
      barcode: 'IT-LAP-000004',
      qrCode: 'IT-LAP-000004',
      serialNumber: 'SN-HP-840G9-1102',
      name: 'HP EliteBook 840 G9 Notebook',
      categoryId: catLaptop.id,
      status: 'UNDER_MAINTENANCE',
      condition: 'FAIR',
      departmentId: deptFin.id,
      locationId: locFloor4.id,
      manufacturer: 'HP',
      model: 'EliteBook 840 G9',
      cpu: 'Intel Core i5-1240P',
      ram: '16GB DDR5',
      storage: '512GB SSD',
      operatingSystem: 'Windows 11 Pro',
      purchaseCost: 1350.0,
      warrantyStart: new Date('2022-10-01'),
      warrantyEnd: new Date('2025-10-01'),
      organizationId: org.id,
      notes: 'Flickering display panel issue being diagnosed by certified technician.',
    },
  });

  // Maintenance Record for Asset 6
  await prisma.maintenanceRecord.create({
    data: {
      assetId: assetMnt.id,
      maintenanceType: 'CORRECTIVE',
      vendorId: vendorDell.id,
      engineerName: 'HP Certified Service Desk',
      startDate: new Date('2024-09-28'),
      issue: 'Intermittent display flicker and backlight degradation',
      diagnosis: 'Faulty EDP display ribbon cable and LCD panel hinge wear',
      workPerformed: 'Ordered replacement 14-inch IPS 400-nit panel and new video ribbon harness',
      cost: 180.0,
      downtimeHours: 72.0,
      warrantyCovered: true,
      notes: 'Parts dispatched under warranty dispatch #HP-DSP-88219.',
      organizationId: org.id,
    },
  });

  // 11. Software Licenses (SAM)
  const licM365 = await prisma.softwareLicense.create({
    data: {
      softwareName: 'Microsoft 365 E5 Enterprise Suite',
      publisher: 'Microsoft Corporation',
      version: 'Cloud Subscription',
      licenseType: 'PER_USER',
      licenseKey: 'MSFT-M365-E5-ENT-COMMERCIAL-TENANT',
      purchaseDate: new Date('2024-01-01'),
      expiryDate: new Date('2025-01-01'),
      renewalDate: new Date('2024-12-01'),
      quantityPurchased: 100,
      quantityUsed: 4,
      cost: 57000.0,
      contractNumber: 'MS-EA-2024-ACME',
      organizationId: org.id,
      notes: 'Full security compliance, Purview, Entra ID P2, and Defender for Endpoint included.',
    },
  });

  // Assign to John and Sarah
  await prisma.licenseAssignment.create({
    data: {
      licenseId: licM365.id,
      employeeId: empJohn.id,
      notes: 'Developer license assignment',
    },
  });

  await prisma.licenseAssignment.create({
    data: {
      licenseId: licM365.id,
      employeeId: empSarah.id,
      notes: 'Executive license assignment',
    },
  });

  const licAdobe = await prisma.softwareLicense.create({
    data: {
      softwareName: 'Adobe Creative Cloud All Apps',
      publisher: 'Adobe Inc.',
      version: '2024 Enterprise',
      licenseType: 'PER_USER',
      purchaseDate: new Date('2024-03-01'),
      expiryDate: new Date('2025-03-01'),
      quantityPurchased: 20,
      quantityUsed: 1,
      cost: 16800.0,
      organizationId: org.id,
      notes: 'Allocated for UI/UX designers and marketing team.',
    },
  });

  // 12. Consumables & Spare Parts
  const cons1 = await prisma.consumable.upsert({
    where: { itemCode: 'CSM-RAM-DDR5-32G' },
    update: {},
    create: {
      name: 'Crucial 32GB DDR5-5600 SODIMM Laptop Memory',
      category: 'RAM',
      itemCode: 'CSM-RAM-DDR5-32G',
      stockQuantity: 18,
      minQuantity: 8,
      maxQuantity: 50,
      unitCost: 89.99,
      locationId: locFloor4.id,
      organizationId: org.id,
    },
  });

  const cons2 = await prisma.consumable.upsert({
    where: { itemCode: 'CSM-SSD-NVME-2TB' },
    update: {},
    create: {
      name: 'Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD',
      category: 'SSD',
      itemCode: 'CSM-SSD-NVME-2TB',
      stockQuantity: 12,
      minQuantity: 5,
      maxQuantity: 30,
      unitCost: 169.5,
      locationId: locFloor4.id,
      organizationId: org.id,
    },
  });

  // Low stock item to trigger dashboard alert!
  const consLowStock = await prisma.consumable.upsert({
    where: { itemCode: 'CSM-PWR-USBC-65W' },
    update: {},
    create: {
      name: 'Dell 65W USB-C GaN Original Laptop Power Adapter',
      category: 'CHARGER',
      itemCode: 'CSM-PWR-USBC-65W',
      stockQuantity: 3, // < minQuantity 10 -> Low Stock Alert!
      minQuantity: 10,
      maxQuantity: 50,
      unitCost: 45.0,
      locationId: locFloor4.id,
      organizationId: org.id,
    },
  });

  // 13. Helpdesk Tickets
  const ticket1 = await prisma.ticket.upsert({
    where: { ticketNumber: 'TIK-000001' },
    update: {},
    create: {
      ticketNumber: 'TIK-000001',
      subject: 'Dual 4K Monitor DisplayPort Daisy Chaining Configuration Help',
      description: 'Need assistance setting up Dell UltraSharp dual monitor chaining via Thunderbolt dock on my new Dell Latitude 7440.',
      category: 'HARDWARE',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      requesterId: empJohn.id,
      assignedEngineerId: supportUser.id,
      assetId: asset1.id,
      departmentId: deptEng.id,
      locationId: locFloor4.id,
      slaDueDate: new Date(Date.now() + 86400000 * 2), // 2 days
      organizationId: org.id,
    },
  });

  await prisma.ticketComment.create({
    data: {
      ticketId: ticket1.id,
      userId: supportUser.id,
      authorName: 'Jason Lee (Support Engineer)',
      comment: 'Reviewed the laptop GPU specs. Please enable MST (Multi-Stream Transport) on monitor 1 menu settings. I will stop by your desk at 2:00 PM if needed.',
      isInternal: false,
    },
  });

  const ticket2 = await prisma.ticket.upsert({
    where: { ticketNumber: 'TIK-000002' },
    update: {},
    create: {
      ticketNumber: 'TIK-000002',
      subject: 'Critical: Datacenter Core Switch VLAN 20 Trunk Alert',
      description: 'Spanning tree topology change detected on Port 24 towards Core Switch 2.',
      category: 'NETWORK',
      priority: 'CRITICAL',
      status: 'RESOLVED',
      requesterId: empSarah.id,
      assignedEngineerId: itAdminUser.id,
      assetId: asset2.id,
      departmentId: deptIT.id,
      locationId: locServerRoom.id,
      resolvedAt: new Date(),
      organizationId: org.id,
    },
  });

  // 14. Notifications
  await prisma.notification.create({
    data: {
      userId: itAdminUser.id,
      organizationId: org.id,
      type: 'LOW_STOCK',
      title: 'Consumable Low Stock Alert',
      message: 'Item "Dell 65W USB-C GaN Original Laptop Power Adapter" is low on stock (3 remaining, minimum threshold is 10).',
      link: '/consumables',
    },
  });

  await prisma.notification.create({
    data: {
      userId: johnUser.id,
      organizationId: org.id,
      type: 'ASSET_ALLOCATED',
      title: 'Asset Allocated to You',
      message: 'You have been assigned Dell Latitude 7440 Ultrabook (IT-LAP-000001). Handover document is verified.',
      link: '/portal/my-assets',
    },
  });

  // 15. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: superAdminUser.id,
      username: 'admin',
      action: 'SETTINGS_CHANGE',
      entity: 'SystemSetting',
      entityId: 'SYSTEM_INIT',
      newValues: JSON.stringify({ status: 'Enterprise ITAM System Initialized with production master data' }),
      ipAddress: '127.0.0.1',
      userAgent: 'Seed Script / System Bootloader',
    },
  });

  console.log('🎉 Database successfully seeded with enterprise data!');
  console.log(`
Default Credentials:
  - Super Admin: admin@acme-corp.com / Admin@123456
  - IT Admin:    itadmin@acme-corp.com / Admin@123456
  - Support Eng: support@acme-corp.com / Admin@123456
  - Employee:    john.doe@acme-corp.com / User@123456
                 sarah.connor@acme-corp.com / User@123456
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

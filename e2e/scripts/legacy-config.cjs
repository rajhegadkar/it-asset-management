// Puts the test database into the state older installs are in, so the suite proves upgrades work:
// "Business Criticality" stored with the legacy default "TIER_3" (not one of its options).
// resolve Prisma from the backend folder (the script runs with cwd = backend)
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [process.cwd()] }));
const prisma = new PrismaClient();
(async () => {
  const key = 'customization.fields.asset';
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  let fields = s ? JSON.parse(s.value) : null;
  if (!fields) {
    fields = [{ id: 'field-ast-3', entity: 'ASSET', name: 'criticalityLevel', label: 'Business Criticality', type: 'select', required: false,
      options: ['TIER_1_MISSION_CRITICAL', 'TIER_2_BUSINESS_IMPORTANT', 'TIER_3_STANDARD_OFFICE', 'TIER_4_LOW_PRIORITY'], order: 1, isActive: true }];
  }
  for (const f of fields) if (f.name === 'criticalityLevel') f.defaultValue = 'TIER_3';
  await prisma.systemSetting.upsert({ where: { key }, update: { value: JSON.stringify(fields) }, create: { key, value: JSON.stringify(fields), group: 'CUSTOMIZATION' } });
  console.log('[e2e] legacy custom-field default applied');
  await prisma.$disconnect();
})();

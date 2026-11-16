import { repairSelectDefault } from '../src/customization/customFieldsEngine.js';

// Regression: "Custom field validation failed" when editing an asset's cost.
// Older installs stored criticalityLevel with default "TIER_3", which is not one of its options,
// so the edit form filled it in and the server rejected the whole save.
describe('custom field select defaults', () => {
  const field = {
    type: 'select',
    options: ['TIER_1_MISSION_CRITICAL', 'TIER_2_BUSINESS_IMPORTANT', 'TIER_3_STANDARD_OFFICE', 'TIER_4_LOW_PRIORITY'],
  } as any;

  it('repairs a legacy short default to the option it abbreviates', () => {
    expect(repairSelectDefault({ ...field, defaultValue: 'TIER_3' })).toEqual({ changed: true, value: 'TIER_3_STANDARD_OFFICE' });
  });

  it('clears a default that matches no option', () => {
    expect(repairSelectDefault({ ...field, defaultValue: 'GOLD' })).toEqual({ changed: true, value: undefined });
  });

  it('leaves valid defaults and non-select fields alone', () => {
    expect(repairSelectDefault({ ...field, defaultValue: 'TIER_1_MISSION_CRITICAL' }).changed).toBe(false);
    expect(repairSelectDefault({ type: 'text', defaultValue: 'x' } as any).changed).toBe(false);
  });
});

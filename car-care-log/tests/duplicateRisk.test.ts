import { describe, expect, it } from 'vitest';
import { findDuplicateRisk } from '../shared/duplicateRisk';
import { SAMPLE_DATA } from '../shared/sampleData';
import type { ServiceRecord } from '../shared/types';

function service(overrides: Partial<ServiceRecord>): ServiceRecord {
  return {
    id: overrides.id ?? `service-${overrides.category ?? 'coolant'}-${overrides.serviceDate ?? 'date'}`,
    vehicleId: overrides.vehicleId ?? 'vehicle-1',
    serviceDate: overrides.serviceDate ?? '2026-01-01',
    mileage: overrides.mileage ?? 50000,
    shop: overrides.shop ?? 'Sample Shop',
    category: overrides.category ?? 'Coolant',
    description: overrides.description ?? '',
    totalCost: overrides.totalCost ?? null,
    notes: overrides.notes ?? '',
    nextRecommendedDate: overrides.nextRecommendedDate ?? '',
    nextRecommendedMileage: overrides.nextRecommendedMileage ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    attachments: overrides.attachments ?? []
  };
}

describe('duplicate-risk detection', () => {
  it('surfaces a same-category record inside the 24 month window', () => {
    const result = findDuplicateRisk({
      services: [service({ serviceDate: '2025-03-12', mileage: 42180 })],
      vehicleId: 'vehicle-1',
      category: 'Coolant',
      serviceDate: '2026-03-12',
      mileage: 54820,
      mileageThreshold: 15000
    });

    expect(result.hasRisk).toBe(true);
    expect(result.reason).toBe('date_window');
    expect(result.lastRecord?.category).toBe('Coolant');
  });

  it('uses related category groups for simple duplicate context', () => {
    const result = findDuplicateRisk({
      services: [service({ category: 'Tires', serviceDate: '2025-11-01', mileage: 60000 })],
      vehicleId: 'vehicle-1',
      category: 'Tire rotation',
      serviceDate: '2026-01-01',
      mileage: 64000,
      mileageThreshold: 15000
    });

    expect(result.hasRisk).toBe(true);
    expect(result.lastRecord?.category).toBe('Tires');
  });

  it('can flag mileage proximity even when the record is older than 24 months', () => {
    const result = findDuplicateRisk({
      services: [service({ category: 'Transmission', serviceDate: '2023-01-01', mileage: 70000 })],
      vehicleId: 'vehicle-1',
      category: 'Transmission',
      serviceDate: '2026-01-01',
      mileage: 79000,
      mileageThreshold: 10000
    });

    expect(result.hasRisk).toBe(true);
    expect(result.reason).toBe('mileage_window');
  });

  it('ignores other vehicles', () => {
    const result = findDuplicateRisk({
      services: [service({ vehicleId: 'vehicle-2', serviceDate: '2026-01-01' })],
      vehicleId: 'vehicle-1',
      category: 'Coolant',
      serviceDate: '2026-02-01',
      mileage: 52000,
      mileageThreshold: 15000
    });

    expect(result.hasRisk).toBe(false);
    expect(result.lastRecord).toBeNull();
  });

  it('sample data includes a coolant duplicate-risk scenario', () => {
    const sampleServices = SAMPLE_DATA[0].services.map((item, index) =>
      service({
        ...item,
        id: `sample-${index}`,
        vehicleId: 'sample-vehicle'
      })
    );

    const result = findDuplicateRisk({
      services: sampleServices,
      vehicleId: 'sample-vehicle',
      category: 'Coolant',
      serviceDate: '2026-05-01',
      mileage: 56000,
      mileageThreshold: 15000
    });

    expect(result.hasRisk).toBe(true);
    expect(result.lastRecord?.description).toContain('Coolant');
  });
});

import { describe, expect, it } from 'vitest';
import { buildServicesCsv } from '../shared/csv';
import { findDuplicateRisk } from '../shared/duplicateRisk';
import { createTutorialSnapshot } from '../shared/sampleData';

describe('tutorial workspace sample data', () => {
  it('builds an isolated sample snapshot with tutorial-only records and documents', () => {
    const snapshot = createTutorialSnapshot();
    const attachments = snapshot.services.flatMap((service) => service.attachments);

    expect(snapshot.vehicles.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.services.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.vehicles.every((vehicle) => vehicle.id.startsWith('tutorial-vehicle-'))).toBe(true);
    expect(snapshot.services.every((service) => service.id.startsWith('tutorial-service-'))).toBe(true);
    expect(attachments.length).toBeGreaterThanOrEqual(4);
    expect(attachments.some((attachment) => attachment.ocrStatus === 'extracted')).toBe(true);
    expect(attachments.some((attachment) => attachment.ocrStatus === 'partial')).toBe(true);
    expect(attachments.some((attachment) => attachment.ocrStatus === 'not_run')).toBe(true);
  });

  it('covers duplicate-risk and export-preview workflows without requiring real storage', () => {
    const snapshot = createTutorialSnapshot();
    const crv = snapshot.vehicles.find((vehicle) => vehicle.nickname === 'Honda CR-V');
    expect(crv).toBeTruthy();

    const duplicateRisk = findDuplicateRisk({
      services: snapshot.services,
      vehicleId: crv?.id ?? '',
      category: 'Coolant',
      serviceDate: '2026-04-01',
      mileage: 55200,
      mileageThreshold: snapshot.settings.duplicateMileageThreshold
    });
    const csv = buildServicesCsv(snapshot.vehicles, snapshot.services);

    expect(duplicateRisk.hasRisk).toBe(true);
    expect(duplicateRisk.lastRecord?.category).toBe('Coolant');
    expect(csv).toContain('Oil change receipt');
    expect(csv).toContain('partial');
  });
});

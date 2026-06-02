import { describe, expect, it } from 'vitest';
import { buildServicesCsv } from '../shared/csv';
import type { ServiceRecord, Vehicle } from '../shared/types';

describe('CSV export', () => {
  it('escapes service history rows and includes attachment OCR metadata', () => {
    const vehicle: Vehicle = {
      id: 'vehicle-1',
      nickname: 'Family SUV',
      year: 2019,
      make: 'Horizon',
      model: 'Trailway',
      trim: '',
      vin: 'FAKEVIN',
      licensePlate: 'LOCAL',
      purchaseDate: '',
      startingMileage: null,
      currentMileage: 56000,
      notes: '',
      createdAt: '',
      updatedAt: ''
    };
    const service: ServiceRecord = {
      id: 'service-1',
      vehicleId: 'vehicle-1',
      serviceDate: '2026-03-12',
      mileage: 54820,
      shop: 'Northside Auto',
      category: 'Coolant',
      description: 'Coolant service, noted during visit',
      totalCost: 189.4,
      notes: 'Review before approving repeat coolant work.',
      nextRecommendedDate: '',
      nextRecommendedMileage: null,
      createdAt: '',
      updatedAt: '',
      attachments: [
        {
          id: 'attachment-1',
          serviceRecordId: 'service-1',
          label: 'Invoice',
          type: 'invoice',
          addedDate: '',
          fileType: 'PDF',
          mimeType: 'application/pdf',
          sizeBytes: 1200,
          ocrStatus: 'not_run',
          ocrText: '',
          ocrError: '',
          ocrRunAt: '',
          createdAt: '',
          updatedAt: ''
        }
      ]
    };

    const csv = buildServicesCsv([vehicle], [service]);

    expect(csv).toContain('"Coolant service, noted during visit"');
    expect(csv).toContain('Invoice');
    expect(csv).toContain('not_run');
  });
});

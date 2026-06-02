import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CarCareDatabase, getStoragePaths } from '../backend/database';

let tempRoot = '';

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-fresh-user-smoke-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('fresh user local data smoke flow', () => {
  it('creates storage, copies an attachment, exports, backs up, restores, and reads back after restart', async () => {
    const userDataDir = path.join(tempRoot, 'fresh-user-data');
    const paths = getStoragePaths(userDataDir);
    const db = new CarCareDatabase(paths);
    await db.initialize();

    expect(fs.existsSync(paths.dbPath)).toBe(true);
    expect(fs.existsSync(paths.attachmentsDir)).toBe(true);
    expect(fs.existsSync(paths.intakeDir)).toBe(true);

    const vehicle = db.createVehicle({
      nickname: 'Fresh User Car',
      year: 2024,
      make: 'Subaru',
      model: 'Outback',
      trim: '',
      vin: '',
      licensePlate: '',
      purchaseDate: '',
      startingMileage: 12000,
      currentMileage: 12000,
      notes: ''
    });
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-03-14',
      mileage: 13010,
      shop: 'Local Auto',
      category: 'Oil change',
      description: 'Fresh user oil change',
      totalCost: 74.88,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const receiptPath = path.join(tempRoot, 'receipt.txt');
    fs.writeFileSync(receiptPath, 'Local Auto\nOil change\nTotal $74.88');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Oil receipt', type: 'receipt' }, receiptPath);
    db.updateAttachmentOcr(attachment.id, 'extracted', 'Local Auto Oil change Total $74.88', '');

    const exportDir = path.join(tempRoot, 'exports');
    const backupRoot = path.join(tempRoot, 'backups');
    const csv = db.exportCsvToDirectory(exportDir);
    const backup = db.createBackup(backupRoot);

    expect(fs.existsSync(path.join(exportDir, csv.fileName))).toBe(true);
    expect(fs.existsSync(path.join(backupRoot, backup.backupName, 'manifest.json'))).toBe(true);

    db.createVehicle({
      nickname: 'Should Disappear After Restore',
      year: null,
      make: '',
      model: '',
      trim: '',
      vin: '',
      licensePlate: '',
      purchaseDate: '',
      startingMileage: null,
      currentMileage: null,
      notes: ''
    });
    await db.restoreFromBackup(path.join(backupRoot, backup.backupName));

    const restartedDb = new CarCareDatabase(paths);
    await restartedDb.initialize();
    const restartedRecords = restartedDb.listServiceRecords();

    expect(restartedDb.listVehicles().map((item) => item.nickname)).toEqual(['Fresh User Car']);
    expect(restartedRecords[0].description).toBe('Fresh user oil change');
    expect(restartedRecords[0].attachments[0].ocrText).toContain('Oil change');
    expect(fs.existsSync(restartedDb.getAttachmentFileForOcr(attachment.id).filePath)).toBe(true);
  });
});

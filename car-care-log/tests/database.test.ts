import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { CarCareDatabase, getStoragePaths } from '../backend/database';
import { ATTACHMENT_PREVIEW_MAX_BYTES } from '../backend/preview';

let tempRoot = '';
let db: CarCareDatabase;
const require = createRequire(import.meta.url);

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-test-'));
  db = new CarCareDatabase(getStoragePaths(tempRoot));
  await db.initialize();
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('local database foundation', () => {
  it('starts with empty real user records on a fresh local database', () => {
    const snapshot = db.getSnapshot();

    expect(snapshot.vehicles).toHaveLength(0);
    expect(snapshot.services).toHaveLength(0);
  });

  it('migrates an older local database without losing records', async () => {
    const paths = getStoragePaths(tempRoot);
    fs.mkdirSync(paths.dataDir, { recursive: true });
    const sql = await initSqlJs({
      locateFile: (file) => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm')), file)
    });
    const legacyDb = new sql.Database();
    legacyDb.run(`
      CREATE TABLE vehicles (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        year INTEGER,
        make TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        trim TEXT NOT NULL DEFAULT '',
        vin TEXT NOT NULL DEFAULT '',
        license_plate TEXT NOT NULL DEFAULT '',
        purchase_date TEXT NOT NULL DEFAULT '',
        starting_mileage INTEGER,
        current_mileage INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE service_records (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        service_date TEXT NOT NULL,
        mileage INTEGER,
        shop TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        total_cost REAL,
        notes TEXT NOT NULL DEFAULT '',
        next_recommended_date TEXT NOT NULL DEFAULT '',
        next_recommended_mileage INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY,
        service_record_id TEXT NOT NULL,
        stored_file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        added_date TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        ocr_status TEXT NOT NULL DEFAULT 'not_run',
        ocr_text TEXT NOT NULL DEFAULT '',
        ocr_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacyDb.run(
      `INSERT INTO vehicles (id, nickname, make, model, created_at, updated_at)
       VALUES ('vehicle-1', 'Legacy Car', 'Subaru', 'Outback', '2024-01-01', '2024-01-01')`
    );
    legacyDb.run(
      `INSERT INTO service_records (
        id, vehicle_id, service_date, category, description, created_at, updated_at
      ) VALUES (
        'service-1', 'vehicle-1', '2024-02-02', 'Oil change', 'Legacy oil change', '2024-02-02', '2024-02-02'
      )`
    );
    legacyDb.run(
      `INSERT INTO attachments (
        id, service_record_id, stored_file_name, original_file_name, label, type, added_date, file_type,
        mime_type, size_bytes, ocr_status, ocr_text, ocr_error, created_at, updated_at
      ) VALUES (
        'attachment-1', 'service-1', 'attachment-1.pdf', 'receipt.pdf', 'Receipt', 'receipt', '2024-02-02',
        'PDF', 'application/pdf', 12, 'extracted', 'Legacy OCR text', '', '2024-02-02', '2024-02-02'
      )`
    );
    fs.writeFileSync(paths.dbPath, Buffer.from(legacyDb.export()));
    legacyDb.close();

    db = new CarCareDatabase(paths);
    await db.initialize();

    const records = db.listServiceRecords();
    expect(db.listVehicles()[0].nickname).toBe('Legacy Car');
    expect(records[0].description).toBe('Legacy oil change');
    expect(records[0].attachments[0].ocrText).toBe('Legacy OCR text');
    expect(records[0].attachments[0].ocrRunAt).toBe('');
  });

  it('creates vehicles and service records in a local SQLite file', () => {
    const vehicle = db.createVehicle({
      nickname: 'Test Car',
      year: 2020,
      make: 'Local',
      model: 'Runner',
      trim: '',
      vin: '',
      licensePlate: '',
      purchaseDate: '',
      startingMileage: 10000,
      currentMileage: 11000,
      notes: ''
    });

    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: 12000,
      shop: 'Local Shop',
      category: 'Oil change',
      description: 'Oil and filter',
      totalCost: 71.25,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: 18000
    });

    expect(fs.existsSync(getStoragePaths(tempRoot).dbPath)).toBe(true);
    expect(db.listVehicles()).toHaveLength(1);
    expect(db.listServiceRecords()[0].id).toBe(service.id);
    expect(db.getVehicle(vehicle.id)?.currentMileage).toBe(12000);
  });

  it('copies attachments into app-managed local storage without exposing source paths', () => {
    const vehicle = db.createVehicle({
      nickname: 'Attachment Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Battery',
      description: 'Battery replacement',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt.txt');
    fs.writeFileSync(sourcePath, 'receipt text');

    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Battery receipt', type: 'receipt' }, sourcePath);
    const storedFiles = fs.readdirSync(getStoragePaths(tempRoot).attachmentsDir);

    expect(attachment.label).toBe('Battery receipt');
    expect(attachment.ocrStatus).toBe('not_run');
    expect(JSON.stringify(attachment)).not.toContain(sourcePath);
    expect(storedFiles).toHaveLength(1);
  });

  it('normalizes Windows-style original attachment names before storing metadata', () => {
    const vehicle = db.createVehicle({
      nickname: 'Windows Path Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Path normalization',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt-source.pdf');
    fs.writeFileSync(sourcePath, 'receipt text');

    const attachment = db.addAttachmentFromLocalFile(
      { serviceRecordId: service.id, label: '', type: 'receipt' },
      sourcePath,
      String.raw`C:\Users\owner\Documents\vehicle receipts\Oil Change.PDF`
    );

    expect(attachment.label).toBe('Oil Change');
    expect(JSON.stringify(attachment)).not.toContain('owner');
    expect(JSON.stringify(attachment)).not.toContain('vehicle receipts');
    expect(fs.readdirSync(getStoragePaths(tempRoot).attachmentsDir)[0]).toMatch(/\.pdf$/);
  });

  it('keeps large attachment previews out of IPC-sized data URLs', () => {
    const vehicle = db.createVehicle({
      nickname: 'Preview Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Large document',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'large-invoice.pdf');
    fs.writeFileSync(sourcePath, Buffer.alloc(ATTACHMENT_PREVIEW_MAX_BYTES + 1, 1));

    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Large invoice', type: 'invoice' }, sourcePath);
    const preview = db.getAttachmentPreview(attachment.id);

    expect(preview.previewKind).toBe('too_large');
    expect(preview.dataUrl).toBe('');
  });

  it('stores OCR status transitions and preserves OCR text through backup and restore', async () => {
    const vehicle = db.createVehicle({
      nickname: 'OCR Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Document import',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'invoice.txt');
    fs.writeFileSync(sourcePath, 'Northside Auto\\nInvoice Date 03/12/2026\\nCoolant flush\\nTotal $189.40');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Coolant invoice', type: 'invoice' }, sourcePath);

    const updated = db.updateAttachmentOcr(attachment.id, 'extracted', 'Coolant flush Total $189.40', '');
    const backupDir = path.join(tempRoot, 'ocr-backups');
    const backup = db.createBackup(backupDir);
    db.updateAttachmentOcr(attachment.id, 'failed', '', 'temporary error');

    await db.restoreFromBackup(path.join(backupDir, backup.backupName));
    const restored = db.listServiceRecords().flatMap((record) => record.attachments)[0];

    expect(updated.ocrStatus).toBe('extracted');
    expect(updated.ocrRunAt).not.toBe('');
    expect(restored.ocrStatus).toBe('extracted');
    expect(restored.ocrText).toContain('Coolant flush');
  });

  it('exports CSV and restores from a local backup folder', async () => {
    db.loadSampleDataForTests();
    const exportDir = path.join(tempRoot, 'exports');
    const backupDir = path.join(tempRoot, 'backups');

    const csv = db.exportCsvToDirectory(exportDir);
    const backup = db.createBackup(backupDir);
    db.createVehicle({
      nickname: 'Temporary Car',
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

    const restored = await db.restoreFromBackup(path.join(backupDir, backup.backupName));

    expect(fs.existsSync(path.join(exportDir, csv.fileName))).toBe(true);
    expect(csv.rowCount).toBeGreaterThanOrEqual(6);
    expect(restored.vehicleCount).toBe(backup.vehicleCount);
    expect(db.listVehicles().some((vehicle) => vehicle.nickname === 'Temporary Car')).toBe(false);
  });

  it('rejects non-file backup attachments without replacing current records', async () => {
    const vehicle = db.createVehicle({
      nickname: 'Safe Restore Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Backup hardening',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt.pdf');
    fs.writeFileSync(sourcePath, 'not really a pdf');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Receipt', type: 'receipt' }, sourcePath);
    const backupRoot = path.join(tempRoot, 'safe-restore-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    const backupAttachment = path.join(backupDir, 'attachments', `${attachment.id}.pdf`);
    fs.rmSync(backupAttachment);
    fs.mkdirSync(backupAttachment);

    await expect(db.restoreFromBackup(backupDir)).rejects.toThrow(/not a regular file/);

    expect(db.listVehicles().map((item) => item.nickname)).toContain('Safe Restore Car');
    expect(db.listServiceRecords()).toHaveLength(1);
  });

  it('rejects missing backup manifest fields without replacing current records', async () => {
    db.loadSampleDataForTests();
    const originalVehicles = db.listVehicles().map((vehicle) => vehicle.nickname);
    const backupRoot = path.join(tempRoot, 'bad-manifest-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({ app: 'Car Care Log' }, null, 2));

    await expect(db.restoreFromBackup(backupDir)).rejects.toThrow(/does not look like/);

    expect(db.listVehicles().map((vehicle) => vehicle.nickname)).toEqual(originalVehicles);
  });

  it('rejects corrupted backup databases without replacing current records', async () => {
    db.loadSampleDataForTests();
    const originalVehicleCount = db.listVehicles().length;
    const backupRoot = path.join(tempRoot, 'corrupt-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    fs.writeFileSync(path.join(backupDir, 'car-care-log.sqlite'), 'not a sqlite database');

    await expect(db.restoreFromBackup(backupDir)).rejects.toThrow();

    expect(db.listVehicles()).toHaveLength(originalVehicleCount);
  });

  it('rejects oversized backup attachments before replacing current records', async () => {
    const vehicle = db.createVehicle({
      nickname: 'Oversized Restore Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Backup size hardening',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt.pdf');
    fs.writeFileSync(sourcePath, 'small receipt');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Receipt', type: 'receipt' }, sourcePath);
    const backupRoot = path.join(tempRoot, 'oversized-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    const backupAttachment = path.join(backupDir, 'attachments', `${attachment.id}.pdf`);
    fs.writeFileSync(backupAttachment, Buffer.alloc(50 * 1024 * 1024 + 1, 1));

    await expect(db.restoreFromBackup(backupDir)).rejects.toThrow(/larger than the local attachment size limit/);

    expect(db.listVehicles().map((item) => item.nickname)).toContain('Oversized Restore Car');
    expect(db.listServiceRecords()).toHaveLength(1);
  });

  it('sanitizes traversal-style backup attachment names into the backup attachment folder', async () => {
    const vehicle = db.createVehicle({
      nickname: 'Traversal Restore Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Traversal restore hardening',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt.pdf');
    fs.writeFileSync(sourcePath, 'portable backup fixture');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Receipt', type: 'receipt' }, sourcePath);
    const backupRoot = path.join(tempRoot, 'traversal-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    const backupDbPath = path.join(backupDir, 'car-care-log.sqlite');
    const sqlite = Buffer.from(fs.readFileSync(backupDbPath));
    const sql = (db as unknown as { sql: { Database: new (data: Buffer) => { run: (sql: string, params?: Record<string, string>) => void; export: () => Uint8Array; close: () => void } } }).sql;
    const backupDb = new sql.Database(sqlite);
    try {
      backupDb.run('UPDATE attachments SET stored_file_name = $stored_file_name WHERE id = $id', {
        $stored_file_name: `../../outside/${attachment.id}.pdf`,
        $id: attachment.id
      });
      fs.writeFileSync(backupDbPath, Buffer.from(backupDb.export()));
    } finally {
      backupDb.close();
    }

    await db.restoreFromBackup(backupDir);

    expect(fs.existsSync(path.join(getStoragePaths(tempRoot).attachmentsDir, `${attachment.id}.pdf`))).toBe(true);
  });

  it('restores backups that reference attachment names with Windows-style separators safely', async () => {
    const vehicle = db.createVehicle({
      nickname: 'Cross Platform Restore Car',
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
    const service = db.createServiceRecord({
      vehicleId: vehicle.id,
      serviceDate: '2026-02-01',
      mileage: null,
      shop: '',
      category: 'Other',
      description: 'Backup path compatibility',
      totalCost: null,
      notes: '',
      nextRecommendedDate: '',
      nextRecommendedMileage: null
    });
    const sourcePath = path.join(tempRoot, 'receipt.pdf');
    fs.writeFileSync(sourcePath, 'portable backup fixture');
    const attachment = db.addAttachmentFromFile({ serviceRecordId: service.id, label: 'Receipt', type: 'receipt' }, sourcePath);
    const backupRoot = path.join(tempRoot, 'cross-platform-backups');
    const backup = db.createBackup(backupRoot);
    const backupDir = path.join(backupRoot, backup.backupName);
    const backupDbPath = path.join(backupDir, 'car-care-log.sqlite');
    const sqlite = Buffer.from(fs.readFileSync(backupDbPath));

    const sql = (db as unknown as { sql: { Database: new (data: Buffer) => { run: (sql: string, params?: Record<string, string>) => void; export: () => Uint8Array; close: () => void } } }).sql;
    const backupDb = new sql.Database(sqlite);
    try {
      backupDb.run('UPDATE attachments SET stored_file_name = $stored_file_name WHERE id = $id', {
        $stored_file_name: `legacy\\windows\\${attachment.id}.pdf`,
        $id: attachment.id
      });
      fs.writeFileSync(backupDbPath, Buffer.from(backupDb.export()));
    } finally {
      backupDb.close();
    }

    await db.restoreFromBackup(backupDir);

    const restored = db.listServiceRecords().flatMap((record) => record.attachments)[0];
    expect(restored.id).toBe(attachment.id);
    expect(fs.existsSync(path.join(getStoragePaths(tempRoot).attachmentsDir, `${attachment.id}.pdf`))).toBe(true);
  });
});

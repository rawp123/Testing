import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { SAMPLE_DATA } from '../shared/sampleData';
import { SERVICE_CATEGORIES, type AttachmentType, type ServiceCategory } from '../shared/serviceCategories';
import type {
  AppSettings,
  AppSnapshot,
  Attachment,
  AttachmentPreview,
  AttachmentRequest,
  BackupResult,
  ExportResult,
  OcrStatus,
  RestoreResult,
  ServiceRecord,
  ServiceRecordInput,
  Vehicle,
  VehicleInput
} from '../shared/types';
import { buildServicesCsv } from '../shared/csv';
import { preferUnpackedPath } from './runtimePaths';
import { buildLocalPreview } from './preview';

type Row = Record<string, unknown>;
type BindValue = string | number | null;
type BindParams = Record<string, BindValue>;
type BackupManifest = {
  app?: unknown;
  database?: unknown;
  attachments?: unknown;
};

export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export interface StoragePaths {
  dataDir: string;
  dbPath: string;
  attachmentsDir: string;
  intakeDir: string;
}

export function getStoragePaths(userDataPath: string): StoragePaths {
  const dataDir = path.join(userDataPath, 'data');
  return {
    dataDir,
    dbPath: path.join(dataDir, 'car-care-log.sqlite'),
    attachmentsDir: path.join(dataDir, 'attachments'),
    intakeDir: path.join(dataDir, 'intake')
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function optionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function asNumber(row: Row, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeCategory(value: string): ServiceCategory {
  const match = SERVICE_CATEGORIES.find((category) => category === value);
  return match ?? 'Other';
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function mimeFromExtension(extension: string): string {
  const ext = extension.toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv'
  };
  return map[ext] ?? 'application/octet-stream';
}

function fileTypeFromExtension(extension: string): string {
  return extension ? extension.replace('.', '').toUpperCase() : 'FILE';
}

function fileNameOnly(value: string): string {
  return value.replace(/\0/g, '').split(/[\\/]/).filter(Boolean).at(-1) ?? '';
}

function safeJoin(baseDir: string, fileName: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, fileNameOnly(fileName));
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid local storage path.');
  }
  return resolvedTarget;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function allFromDatabase(database: Database, sql: string, params?: BindParams): Row[] {
  const statement = database.prepare(sql);
  try {
    if (params) statement.bind(params);
    const rows: Row[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as Row);
    }
    return rows;
  } finally {
    statement.free();
  }
}

function validateBackupManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('Backup manifest is not readable.');
  }
  const manifest = value as BackupManifest;
  if (manifest.app !== 'Car Care Log' || manifest.database !== 'car-care-log.sqlite') {
    throw new Error('This does not look like a Car Care Log backup.');
  }
  return manifest;
}

function validateBackupDatabase(database: Database): void {
  const integrity = allFromDatabase(database, 'PRAGMA integrity_check')[0];
  if (asString(integrity ?? {}, 'integrity_check') !== 'ok') {
    throw new Error('Backup database failed its integrity check.');
  }

  const tableRows = allFromDatabase(database, "SELECT name FROM sqlite_master WHERE type = 'table'");
  const tables = new Set(tableRows.map((row) => asString(row, 'name')));
  for (const table of ['vehicles', 'service_records', 'attachments']) {
    if (!tables.has(table)) {
      throw new Error('Backup database is missing required Car Care Log tables.');
    }
  }
}

function attachmentFileNamesFromBackupDatabase(database: Database): string[] {
  return Array.from(
    new Set(
      allFromDatabase(database, 'SELECT stored_file_name FROM attachments')
        .map((row) => fileNameOnly(asString(row, 'stored_file_name')))
        .filter(Boolean)
    )
  );
}

export class CarCareDatabase {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;

  constructor(private readonly paths: StoragePaths) {}

  async initialize(): Promise<void> {
    fs.mkdirSync(this.paths.dataDir, { recursive: true });
    fs.mkdirSync(this.paths.attachmentsDir, { recursive: true });
    fs.mkdirSync(this.paths.intakeDir, { recursive: true });

    const require = createRequire(import.meta.url);
    const wasmDir = path.dirname(preferUnpackedPath(require.resolve('sql.js/dist/sql-wasm.wasm')));
    this.sql = await initSqlJs({
      locateFile: (file) => path.join(wasmDir, file)
    });

    if (fs.existsSync(this.paths.dbPath)) {
      this.db = new this.sql.Database(fs.readFileSync(this.paths.dbPath));
    } else {
      this.db = new this.sql.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON');
    this.migrate();
    this.persist();
  }

  getSnapshot(): AppSnapshot {
    return {
      vehicles: this.listVehicles(),
      services: this.listServiceRecords(),
      settings: this.getSettings()
    };
  }

  listVehicles(): Vehicle[] {
    return this.all('SELECT * FROM vehicles ORDER BY nickname COLLATE NOCASE ASC').map(toVehicle);
  }

  getVehicle(id: string): Vehicle | null {
    const row = this.one('SELECT * FROM vehicles WHERE id = $id', { $id: id });
    return row ? toVehicle(row) : null;
  }

  createVehicle(input: VehicleInput): Vehicle {
    const id = randomUUID();
    const now = nowIso();
    const vehicle = normalizeVehicleInput(input);
    if (!vehicle.nickname) {
      throw new Error('Vehicle nickname is required.');
    }

    this.run(
      `INSERT INTO vehicles (
        id, nickname, year, make, model, trim, vin, license_plate, purchase_date,
        starting_mileage, current_mileage, notes, created_at, updated_at
      ) VALUES (
        $id, $nickname, $year, $make, $model, $trim, $vin, $license_plate, $purchase_date,
        $starting_mileage, $current_mileage, $notes, $created_at, $updated_at
      )`,
      {
        $id: id,
        $nickname: vehicle.nickname,
        $year: vehicle.year,
        $make: vehicle.make,
        $model: vehicle.model,
        $trim: vehicle.trim,
        $vin: vehicle.vin,
        $license_plate: vehicle.licensePlate,
        $purchase_date: vehicle.purchaseDate,
        $starting_mileage: vehicle.startingMileage,
        $current_mileage: vehicle.currentMileage,
        $notes: vehicle.notes,
        $created_at: now,
        $updated_at: now
      }
    );

    this.persist();
    return this.getVehicle(id) as Vehicle;
  }

  updateVehicle(id: string, input: VehicleInput): Vehicle {
    const vehicle = normalizeVehicleInput(input);
    if (!vehicle.nickname) {
      throw new Error('Vehicle nickname is required.');
    }

    this.run(
      `UPDATE vehicles SET
        nickname = $nickname,
        year = $year,
        make = $make,
        model = $model,
        trim = $trim,
        vin = $vin,
        license_plate = $license_plate,
        purchase_date = $purchase_date,
        starting_mileage = $starting_mileage,
        current_mileage = $current_mileage,
        notes = $notes,
        updated_at = $updated_at
      WHERE id = $id`,
      {
        $id: id,
        $nickname: vehicle.nickname,
        $year: vehicle.year,
        $make: vehicle.make,
        $model: vehicle.model,
        $trim: vehicle.trim,
        $vin: vehicle.vin,
        $license_plate: vehicle.licensePlate,
        $purchase_date: vehicle.purchaseDate,
        $starting_mileage: vehicle.startingMileage,
        $current_mileage: vehicle.currentMileage,
        $notes: vehicle.notes,
        $updated_at: nowIso()
      }
    );

    this.persist();
    const updated = this.getVehicle(id);
    if (!updated) throw new Error('Vehicle not found.');
    return updated;
  }

  deleteVehicle(id: string): void {
    const attachmentFileNames = this.attachmentFileNamesForVehicle(id);
    this.run('DELETE FROM vehicles WHERE id = $id', { $id: id });
    attachmentFileNames.forEach((fileName) => this.deleteAttachmentFileByName(fileName));
    this.persist();
  }

  listServiceRecords(vehicleId?: string): ServiceRecord[] {
    const rows = vehicleId
      ? this.all('SELECT * FROM service_records WHERE vehicle_id = $vehicle_id ORDER BY service_date DESC, mileage DESC', {
          $vehicle_id: vehicleId
        })
      : this.all('SELECT * FROM service_records ORDER BY service_date DESC, mileage DESC');

    return rows.map((row) => toServiceRecord(row, this.listAttachmentsForService(asString(row, 'id'))));
  }

  getServiceRecord(id: string): ServiceRecord | null {
    const row = this.one('SELECT * FROM service_records WHERE id = $id', { $id: id });
    return row ? toServiceRecord(row, this.listAttachmentsForService(id)) : null;
  }

  createServiceRecord(input: ServiceRecordInput): ServiceRecord {
    if (!this.getVehicle(input.vehicleId)) {
      throw new Error('Vehicle not found.');
    }
    const id = randomUUID();
    const now = nowIso();
    const service = normalizeServiceInput(input);
    if (!service.serviceDate) throw new Error('Service date is required.');

    this.run(
      `INSERT INTO service_records (
        id, vehicle_id, service_date, mileage, shop, category, description, total_cost,
        notes, next_recommended_date, next_recommended_mileage, created_at, updated_at
      ) VALUES (
        $id, $vehicle_id, $service_date, $mileage, $shop, $category, $description, $total_cost,
        $notes, $next_recommended_date, $next_recommended_mileage, $created_at, $updated_at
      )`,
      {
        $id: id,
        $vehicle_id: service.vehicleId,
        $service_date: service.serviceDate,
        $mileage: service.mileage,
        $shop: service.shop,
        $category: service.category,
        $description: service.description,
        $total_cost: service.totalCost,
        $notes: service.notes,
        $next_recommended_date: service.nextRecommendedDate,
        $next_recommended_mileage: service.nextRecommendedMileage,
        $created_at: now,
        $updated_at: now
      }
    );
    this.bumpVehicleMileage(service.vehicleId, service.mileage);
    this.persist();
    return this.getServiceRecord(id) as ServiceRecord;
  }

  updateServiceRecord(id: string, input: ServiceRecordInput): ServiceRecord {
    const service = normalizeServiceInput(input);
    if (!service.serviceDate) throw new Error('Service date is required.');

    this.run(
      `UPDATE service_records SET
        vehicle_id = $vehicle_id,
        service_date = $service_date,
        mileage = $mileage,
        shop = $shop,
        category = $category,
        description = $description,
        total_cost = $total_cost,
        notes = $notes,
        next_recommended_date = $next_recommended_date,
        next_recommended_mileage = $next_recommended_mileage,
        updated_at = $updated_at
      WHERE id = $id`,
      {
        $id: id,
        $vehicle_id: service.vehicleId,
        $service_date: service.serviceDate,
        $mileage: service.mileage,
        $shop: service.shop,
        $category: service.category,
        $description: service.description,
        $total_cost: service.totalCost,
        $notes: service.notes,
        $next_recommended_date: service.nextRecommendedDate,
        $next_recommended_mileage: service.nextRecommendedMileage,
        $updated_at: nowIso()
      }
    );
    this.bumpVehicleMileage(service.vehicleId, service.mileage);
    this.persist();
    const updated = this.getServiceRecord(id);
    if (!updated) throw new Error('Service record not found.');
    return updated;
  }

  deleteServiceRecord(id: string): void {
    const attachmentFileNames = this.attachmentFileNamesForService(id);
    this.run('DELETE FROM service_records WHERE id = $id', { $id: id });
    attachmentFileNames.forEach((fileName) => this.deleteAttachmentFileByName(fileName));
    this.persist();
  }

  listAttachments(): Attachment[] {
    return this.all('SELECT * FROM attachments ORDER BY added_date DESC').map(toAttachment);
  }

  listAttachmentsForService(serviceRecordId: string): Attachment[] {
    return this.all('SELECT * FROM attachments WHERE service_record_id = $service_record_id ORDER BY added_date DESC', {
      $service_record_id: serviceRecordId
    }).map(toAttachment);
  }

  addAttachmentFromFile(request: AttachmentRequest, sourcePath: string): Attachment {
    return this.addAttachmentFromLocalFile(request, sourcePath, path.basename(sourcePath));
  }

  addAttachmentFromLocalFile(
    request: AttachmentRequest,
    sourcePath: string,
    originalFileName: string,
    ocr?: { status: OcrStatus; text: string; error: string; runAt: string }
  ): Attachment {
    if (!this.getServiceRecord(request.serviceRecordId)) {
      throw new Error('Service record not found.');
    }
    const stats = fs.statSync(sourcePath);
    if (!stats.isFile()) {
      throw new Error('Attachment must be a file.');
    }
    if (stats.size > ATTACHMENT_MAX_BYTES) {
      throw new Error('This file is larger than the local attachment size limit for this version.');
    }

    const id = randomUUID();
    const cleanOriginalFileName = fileNameOnly(originalFileName || sourcePath);
    const originalExtension = path.extname(cleanOriginalFileName || sourcePath);
    const extension = originalExtension.toLowerCase();
    const storedFileName = `${id}${extension}`;
    const destination = safeJoin(this.paths.attachmentsDir, storedFileName);
    fs.mkdirSync(this.paths.attachmentsDir, { recursive: true });
    fs.copyFileSync(sourcePath, destination);

    const now = nowIso();
    const labelBaseName = originalExtension ? cleanOriginalFileName.slice(0, -originalExtension.length) : cleanOriginalFileName;
    const label = cleanText(request.label) || labelBaseName || 'Attachment';

    this.run(
      `INSERT INTO attachments (
        id, service_record_id, stored_file_name, original_file_name, label, type,
        added_date, file_type, mime_type, size_bytes, ocr_status, ocr_text,
        ocr_error, ocr_run_at, created_at, updated_at
      ) VALUES (
        $id, $service_record_id, $stored_file_name, $original_file_name, $label, $type,
        $added_date, $file_type, $mime_type, $size_bytes, $ocr_status, $ocr_text,
        $ocr_error, $ocr_run_at, $created_at, $updated_at
      )`,
      {
        $id: id,
        $service_record_id: request.serviceRecordId,
        $stored_file_name: storedFileName,
        $original_file_name: cleanOriginalFileName,
        $label: label,
        $type: request.type,
        $added_date: now,
        $file_type: fileTypeFromExtension(extension),
        $mime_type: mimeFromExtension(extension),
        $size_bytes: stats.size,
        $ocr_status: ocr?.status ?? 'not_run',
        $ocr_text: ocr?.text ?? '',
        $ocr_error: ocr?.error ?? '',
        $ocr_run_at: ocr?.runAt ?? '',
        $created_at: now,
        $updated_at: now
      }
    );

    this.persist();
    return this.getAttachment(id) as Attachment;
  }

  deleteAttachment(id: string): void {
    const row = this.one('SELECT stored_file_name FROM attachments WHERE id = $id', { $id: id });
    this.run('DELETE FROM attachments WHERE id = $id', { $id: id });
    this.deleteAttachmentFileByName(row ? asString(row, 'stored_file_name') : '');
    this.persist();
  }

  getAttachmentPreview(id: string): AttachmentPreview {
    const row = this.one('SELECT * FROM attachments WHERE id = $id', { $id: id });
    if (!row) throw new Error('Attachment not found.');
    const mimeType = asString(row, 'mime_type');
    const storedFileName = asString(row, 'stored_file_name');
    const filePath = safeJoin(this.paths.attachmentsDir, storedFileName);
    return buildLocalPreview(filePath, mimeType, id);
  }

  getAttachmentFileForOcr(id: string): { attachment: Attachment; filePath: string; originalFileName: string } {
    const row = this.one('SELECT * FROM attachments WHERE id = $id', { $id: id });
    if (!row) throw new Error('Attachment not found.');
    return {
      attachment: toAttachment(row),
      filePath: safeJoin(this.paths.attachmentsDir, asString(row, 'stored_file_name')),
      originalFileName: asString(row, 'original_file_name')
    };
  }

  updateAttachmentOcr(id: string, status: OcrStatus, text: string, error: string): Attachment {
    const now = nowIso();
    this.run(
      `UPDATE attachments SET
        ocr_status = $ocr_status,
        ocr_text = $ocr_text,
        ocr_error = $ocr_error,
        ocr_run_at = $ocr_run_at,
        updated_at = $updated_at
      WHERE id = $id`,
      {
        $id: id,
        $ocr_status: status,
        $ocr_text: text,
        $ocr_error: error,
        $ocr_run_at: now,
        $updated_at: now
      }
    );
    this.persist();
    const attachment = this.getAttachment(id);
    if (!attachment) throw new Error('Attachment not found.');
    return attachment;
  }

  moveAttachmentToService(attachmentId: string, serviceRecordId: string): Attachment {
    if (!this.getServiceRecord(serviceRecordId)) {
      throw new Error('Service record not found.');
    }
    this.run(
      `UPDATE attachments SET service_record_id = $service_record_id, updated_at = $updated_at WHERE id = $id`,
      {
        $id: attachmentId,
        $service_record_id: serviceRecordId,
        $updated_at: nowIso()
      }
    );
    this.persist();
    const attachment = this.getAttachment(attachmentId);
    if (!attachment) throw new Error('Attachment not found.');
    return attachment;
  }

  getSettings(): AppSettings {
    const value = this.one('SELECT value FROM settings WHERE key = $key', { $key: 'duplicate_mileage_threshold' });
    const threshold = value ? Number(asString(value, 'value')) : 15000;
    return {
      duplicateMileageThreshold: Number.isFinite(threshold) ? threshold : 15000
    };
  }

  updateSettings(settings: AppSettings): AppSettings {
    const threshold = Math.max(0, Math.round(settings.duplicateMileageThreshold || 0));
    this.run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($key, $value, $updated_at)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      {
        $key: 'duplicate_mileage_threshold',
        $value: String(threshold),
        $updated_at: nowIso()
      }
    );
    this.persist();
    return this.getSettings();
  }

  loadSampleData(): AppSnapshot {
    for (const bundle of SAMPLE_DATA) {
      const vehicle = this.createVehicle(bundle.vehicle);
      for (const service of bundle.services) {
        this.createServiceRecord({
          ...service,
          vehicleId: vehicle.id
        });
      }
    }
    return this.getSnapshot();
  }

  exportCsvToDirectory(targetDirectory: string): ExportResult {
    fs.mkdirSync(targetDirectory, { recursive: true });
    const snapshot = this.getSnapshot();
    const csv = buildServicesCsv(snapshot.vehicles, snapshot.services);
    const fileName = `car-care-log-services-${timestampForFile()}.csv`;
    fs.writeFileSync(path.join(targetDirectory, fileName), csv, 'utf8');
    return {
      fileName,
      rowCount: snapshot.services.length
    };
  }

  createBackup(targetDirectory: string): BackupResult {
    fs.mkdirSync(targetDirectory, { recursive: true });
    this.persist();

    const snapshot = this.getSnapshot();
    const backupName = `CarCareLogBackup-${timestampForFile()}`;
    const backupDir = path.join(targetDirectory, backupName);
    fs.mkdirSync(backupDir, { recursive: true });

    fs.copyFileSync(this.paths.dbPath, path.join(backupDir, 'car-care-log.sqlite'));
    if (fs.existsSync(this.paths.attachmentsDir)) {
      fs.cpSync(this.paths.attachmentsDir, path.join(backupDir, 'attachments'), { recursive: true });
    }

    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(
        {
          app: 'Car Care Log',
          createdAt: nowIso(),
          database: 'car-care-log.sqlite',
          attachments: 'attachments',
          vehicleCount: snapshot.vehicles.length,
          serviceCount: snapshot.services.length,
          attachmentCount: snapshot.services.reduce((count, service) => count + service.attachments.length, 0)
        },
        null,
        2
      )
    );

    return {
      backupName,
      vehicleCount: snapshot.vehicles.length,
      serviceCount: snapshot.services.length,
      attachmentCount: snapshot.services.reduce((count, service) => count + service.attachments.length, 0)
    };
  }

  async restoreFromBackup(backupDirectory: string): Promise<RestoreResult> {
    const manifestPath = path.join(backupDirectory, 'manifest.json');
    const databasePath = path.join(backupDirectory, 'car-care-log.sqlite');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(databasePath)) {
      throw new Error('Backup folder is missing its manifest or database file.');
    }
    const sql = this.sql;
    if (!sql) throw new Error('Database engine is not initialized.');

    validateBackupManifest(readJsonFile(manifestPath));

    const databaseStat = fs.lstatSync(databasePath);
    if (!databaseStat.isFile()) {
      throw new Error('Backup database is not a regular file.');
    }

    const backupDb = new sql.Database(fs.readFileSync(databasePath));
    let referencedAttachmentFileNames: string[] = [];
    try {
      backupDb.run('PRAGMA foreign_keys = ON');
      validateBackupDatabase(backupDb);
      referencedAttachmentFileNames = attachmentFileNamesFromBackupDatabase(backupDb);
    } finally {
      backupDb.close();
    }

    fs.mkdirSync(this.paths.dataDir, { recursive: true });
    const stageDir = path.join(this.paths.dataDir, `.restore-stage-${randomUUID()}`);
    const rollbackDir = path.join(this.paths.dataDir, `.restore-rollback-${randomUUID()}`);
    const stageDbPath = path.join(stageDir, 'car-care-log.sqlite');
    const stageAttachmentsDir = path.join(stageDir, 'attachments');
    const rollbackDbPath = path.join(rollbackDir, 'car-care-log.sqlite');
    const rollbackAttachmentsDir = path.join(rollbackDir, 'attachments');
    fs.mkdirSync(stageAttachmentsDir, { recursive: true });
    fs.copyFileSync(databasePath, stageDbPath);

    const backupAttachments = path.join(backupDirectory, 'attachments');
    try {
      for (const storedFileName of referencedAttachmentFileNames) {
        const source = safeJoin(backupAttachments, storedFileName);
        if (!fs.existsSync(source)) {
          throw new Error('Backup is missing an attachment file referenced by the database.');
        }
        const sourceStat = fs.lstatSync(source);
        if (!sourceStat.isFile()) {
          throw new Error('Backup contains an attachment that is not a regular file.');
        }
        if (sourceStat.size > ATTACHMENT_MAX_BYTES) {
          throw new Error('Backup contains an attachment larger than the local attachment size limit.');
        }
        fs.copyFileSync(source, safeJoin(stageAttachmentsDir, storedFileName));
      }
    } catch (error) {
      fs.rmSync(stageDir, { recursive: true, force: true });
      throw error;
    }

    this.db?.close();
    try {
      fs.mkdirSync(rollbackDir, { recursive: true });
      if (fs.existsSync(this.paths.dbPath)) fs.copyFileSync(this.paths.dbPath, rollbackDbPath);
      if (fs.existsSync(this.paths.attachmentsDir)) fs.cpSync(this.paths.attachmentsDir, rollbackAttachmentsDir, { recursive: true });

      fs.rmSync(this.paths.dbPath, { force: true });
      fs.rmSync(this.paths.attachmentsDir, { recursive: true, force: true });
      fs.renameSync(stageDbPath, this.paths.dbPath);
      fs.renameSync(stageAttachmentsDir, this.paths.attachmentsDir);

      this.db = new sql.Database(fs.readFileSync(this.paths.dbPath));
      this.db.run('PRAGMA foreign_keys = ON');
      this.migrate();
      this.persist();
    } catch (error) {
      fs.rmSync(this.paths.dbPath, { force: true });
      fs.rmSync(this.paths.attachmentsDir, { recursive: true, force: true });
      if (fs.existsSync(rollbackDbPath)) fs.copyFileSync(rollbackDbPath, this.paths.dbPath);
      if (fs.existsSync(rollbackAttachmentsDir)) fs.cpSync(rollbackAttachmentsDir, this.paths.attachmentsDir, { recursive: true });
      this.db = new sql.Database(fs.existsSync(this.paths.dbPath) ? fs.readFileSync(this.paths.dbPath) : undefined);
      this.db.run('PRAGMA foreign_keys = ON');
      this.migrate();
      this.persist();
      throw error;
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
      fs.rmSync(rollbackDir, { recursive: true, force: true });
    }

    const snapshot = this.getSnapshot();
    return {
      backupName: path.basename(backupDirectory),
      vehicleCount: snapshot.vehicles.length,
      serviceCount: snapshot.services.length,
      attachmentCount: snapshot.services.reduce((count, service) => count + service.attachments.length, 0)
    };
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS vehicles (
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

      CREATE TABLE IF NOT EXISTS service_records (
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
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
        ocr_run_at TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (service_record_id) REFERENCES service_records(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_service_vehicle_date ON service_records(vehicle_id, service_date DESC);
      CREATE INDEX IF NOT EXISTS idx_service_category ON service_records(category);
      CREATE INDEX IF NOT EXISTS idx_attachments_service ON attachments(service_record_id);
    `);

    this.addColumnIfMissing('attachments', 'ocr_run_at', "TEXT NOT NULL DEFAULT ''");

    this.run(
      `INSERT OR IGNORE INTO settings (key, value, updated_at)
       VALUES ($key, $value, $updated_at)`,
      {
        $key: 'duplicate_mileage_threshold',
        $value: '15000',
        $updated_at: nowIso()
      }
    );
  }

  private get database(): Database {
    if (!this.db) throw new Error('Database has not been initialized.');
    return this.db;
  }

  private run(sql: string, params?: BindParams): void {
    this.database.run(sql, params);
  }

  private all(sql: string, params?: BindParams): Row[] {
    const statement = this.database.prepare(sql);
    try {
      if (params) statement.bind(params);
      const rows: Row[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as Row);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  private one(sql: string, params?: BindParams): Row | null {
    return this.all(sql, params)[0] ?? null;
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.all(`PRAGMA table_info(${table})`).map((row) => asString(row, 'name'));
    if (columns.includes(column)) return;
    this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private persist(): void {
    fs.mkdirSync(this.paths.dataDir, { recursive: true });
    fs.writeFileSync(this.paths.dbPath, Buffer.from(this.database.export()));
  }

  private getAttachment(id: string): Attachment | null {
    const row = this.one('SELECT * FROM attachments WHERE id = $id', { $id: id });
    return row ? toAttachment(row) : null;
  }

  private attachmentFileNamesForVehicle(vehicleId: string): string[] {
    return this.all(
      `SELECT attachments.stored_file_name
       FROM attachments
       JOIN service_records ON service_records.id = attachments.service_record_id
       WHERE service_records.vehicle_id = $vehicle_id`,
      { $vehicle_id: vehicleId }
    )
      .map((row) => asString(row, 'stored_file_name'))
      .filter(Boolean);
  }

  private attachmentFileNamesForService(serviceRecordId: string): string[] {
    return this.all('SELECT stored_file_name FROM attachments WHERE service_record_id = $service_record_id', {
      $service_record_id: serviceRecordId
    })
      .map((row) => asString(row, 'stored_file_name'))
      .filter(Boolean);
  }

  private deleteAttachmentFileByName(storedFileName: string): void {
    if (!storedFileName) return;
    fs.rmSync(safeJoin(this.paths.attachmentsDir, storedFileName), { force: true });
  }

  private bumpVehicleMileage(vehicleId: string, mileage: number | null): void {
    if (typeof mileage !== 'number') return;
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle || (vehicle.currentMileage ?? 0) >= mileage) return;
    this.run('UPDATE vehicles SET current_mileage = $mileage, updated_at = $updated_at WHERE id = $id', {
      $id: vehicleId,
      $mileage: mileage,
      $updated_at: nowIso()
    });
  }
}

function normalizeVehicleInput(input: VehicleInput): VehicleInput {
  return {
    nickname: cleanText(input.nickname),
    year: optionalNumber(input.year),
    make: cleanText(input.make),
    model: cleanText(input.model),
    trim: cleanText(input.trim),
    vin: cleanText(input.vin).toUpperCase(),
    licensePlate: cleanText(input.licensePlate).toUpperCase(),
    purchaseDate: cleanText(input.purchaseDate),
    startingMileage: optionalNumber(input.startingMileage),
    currentMileage: optionalNumber(input.currentMileage),
    notes: cleanText(input.notes)
  };
}

function normalizeServiceInput(input: ServiceRecordInput): ServiceRecordInput {
  return {
    vehicleId: input.vehicleId,
    serviceDate: cleanText(input.serviceDate),
    mileage: optionalNumber(input.mileage),
    shop: cleanText(input.shop),
    category: sanitizeCategory(input.category),
    description: cleanText(input.description),
    totalCost: optionalNumber(input.totalCost),
    notes: cleanText(input.notes),
    nextRecommendedDate: cleanText(input.nextRecommendedDate),
    nextRecommendedMileage: optionalNumber(input.nextRecommendedMileage)
  };
}

function toVehicle(row: Row): Vehicle {
  return {
    id: asString(row, 'id'),
    nickname: asString(row, 'nickname'),
    year: asNumber(row, 'year'),
    make: asString(row, 'make'),
    model: asString(row, 'model'),
    trim: asString(row, 'trim'),
    vin: asString(row, 'vin'),
    licensePlate: asString(row, 'license_plate'),
    purchaseDate: asString(row, 'purchase_date'),
    startingMileage: asNumber(row, 'starting_mileage'),
    currentMileage: asNumber(row, 'current_mileage'),
    notes: asString(row, 'notes'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at')
  };
}

function toServiceRecord(row: Row, attachments: Attachment[]): ServiceRecord {
  return {
    id: asString(row, 'id'),
    vehicleId: asString(row, 'vehicle_id'),
    serviceDate: asString(row, 'service_date'),
    mileage: asNumber(row, 'mileage'),
    shop: asString(row, 'shop'),
    category: sanitizeCategory(asString(row, 'category')),
    description: asString(row, 'description'),
    totalCost: asNumber(row, 'total_cost'),
    notes: asString(row, 'notes'),
    nextRecommendedDate: asString(row, 'next_recommended_date'),
    nextRecommendedMileage: asNumber(row, 'next_recommended_mileage'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at'),
    attachments
  };
}

function toAttachment(row: Row): Attachment {
  return {
    id: asString(row, 'id'),
    serviceRecordId: asString(row, 'service_record_id'),
    label: asString(row, 'label'),
    type: asString(row, 'type') as AttachmentType,
    addedDate: asString(row, 'added_date'),
    fileType: asString(row, 'file_type'),
    mimeType: asString(row, 'mime_type'),
    sizeBytes: asNumber(row, 'size_bytes') ?? 0,
    ocrStatus: asString(row, 'ocr_status') as Attachment['ocrStatus'],
    ocrText: asString(row, 'ocr_text'),
    ocrError: asString(row, 'ocr_error'),
    ocrRunAt: asString(row, 'ocr_run_at'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at')
  };
}

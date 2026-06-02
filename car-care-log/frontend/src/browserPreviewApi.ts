import type { CarCareLogApi } from '../../shared/api';
import { buildServicesCsv } from '../../shared/csv';
import type {
  AppSnapshot,
  Attachment,
  AttachmentPreview,
  BackupResult,
  DocumentIntakeResult,
  OcrReviewResult,
  ServiceRecord,
  ServiceRecordInput,
  SuggestedField,
  SuggestedServiceFields,
  Vehicle,
  VehicleInput
} from '../../shared/types';

const STORAGE_KEY = 'car-care-log.browser-preview.snapshot.v1';
const DEFAULT_SETTINGS = { duplicateMileageThreshold: 15000 };

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptySnapshot(): AppSnapshot {
  return {
    vehicles: [],
    services: [],
    settings: DEFAULT_SETTINGS
  };
}

function readSnapshot(storage: Storage): AppSnapshot {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) return emptySnapshot();

  try {
    const parsed = JSON.parse(stored) as Partial<AppSnapshot>;
    return {
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      services: Array.isArray(parsed.services) ? parsed.services : [],
      settings: {
        duplicateMileageThreshold:
          typeof parsed.settings?.duplicateMileageThreshold === 'number'
            ? parsed.settings.duplicateMileageThreshold
            : DEFAULT_SETTINGS.duplicateMileageThreshold
      }
    };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(storage: Storage, snapshot: AppSnapshot): AppSnapshot {
  storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function sortSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    vehicles: [...snapshot.vehicles].sort((left, right) => left.nickname.localeCompare(right.nickname)),
    services: [...snapshot.services].sort((left, right) => {
      const date = right.serviceDate.localeCompare(left.serviceDate);
      if (date !== 0) return date;
      return (right.mileage ?? 0) - (left.mileage ?? 0);
    })
  };
}

function makeVehicle(input: VehicleInput, id = newId('vehicle')): Vehicle {
  const timestamp = nowIso();
  return {
    ...input,
    id,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function makeService(input: ServiceRecordInput, id = newId('service')): ServiceRecord {
  const timestamp = nowIso();
  return {
    ...input,
    id,
    attachments: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function suggestedField<T>(value: T, evidence = ''): SuggestedField<T> {
  return {
    value,
    confidence: evidence ? 'low' : 'none',
    evidence
  };
}

function emptySuggestions(): SuggestedServiceFields {
  return {
    serviceDate: suggestedField(''),
    mileage: suggestedField(null),
    shop: suggestedField(''),
    category: suggestedField('Other'),
    description: suggestedField(''),
    totalCost: suggestedField(null),
    notes: suggestedField(''),
    nextRecommendedDate: suggestedField(''),
    nextRecommendedMileage: suggestedField(null)
  };
}

function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.click();
  URL.revokeObjectURL(url);
}

export function createBrowserPreviewApi(storage: Storage = window.localStorage): CarCareLogApi {
  return {
    async getSnapshot() {
      return sortSnapshot(readSnapshot(storage));
    },

    async createVehicle(input: VehicleInput) {
      if (!input.nickname.trim()) throw new Error('Vehicle nickname is required.');
      const snapshot = readSnapshot(storage);
      const vehicle = makeVehicle(input);
      writeSnapshot(storage, sortSnapshot({ ...snapshot, vehicles: [...snapshot.vehicles, vehicle] }));
      return vehicle;
    },

    async updateVehicle(id: string, input: VehicleInput) {
      if (!input.nickname.trim()) throw new Error('Vehicle nickname is required.');
      const snapshot = readSnapshot(storage);
      const existing = snapshot.vehicles.find((vehicle) => vehicle.id === id);
      if (!existing) throw new Error('Vehicle not found.');

      const updated = { ...existing, ...input, updatedAt: nowIso() };
      writeSnapshot(storage, sortSnapshot({ ...snapshot, vehicles: snapshot.vehicles.map((vehicle) => (vehicle.id === id ? updated : vehicle)) }));
      return updated;
    },

    async deleteVehicle(id: string) {
      const snapshot = readSnapshot(storage);
      return writeSnapshot(
        storage,
        sortSnapshot({
          ...snapshot,
          vehicles: snapshot.vehicles.filter((vehicle) => vehicle.id !== id),
          services: snapshot.services.filter((service) => service.vehicleId !== id)
        })
      );
    },

    async createServiceRecord(input: ServiceRecordInput) {
      const snapshot = readSnapshot(storage);
      if (!snapshot.vehicles.some((vehicle) => vehicle.id === input.vehicleId)) throw new Error('Vehicle not found.');
      if (!input.serviceDate) throw new Error('Service date is required.');

      const service = makeService(input);
      writeSnapshot(storage, sortSnapshot({ ...snapshot, services: [...snapshot.services, service] }));
      return service;
    },

    async updateServiceRecord(id: string, input: ServiceRecordInput) {
      const snapshot = readSnapshot(storage);
      const existing = snapshot.services.find((service) => service.id === id);
      if (!existing) throw new Error('Service record not found.');

      const updated = { ...existing, ...input, attachments: existing.attachments, updatedAt: nowIso() };
      writeSnapshot(storage, sortSnapshot({ ...snapshot, services: snapshot.services.map((service) => (service.id === id ? updated : service)) }));
      return updated;
    },

    async deleteServiceRecord(id: string) {
      const snapshot = readSnapshot(storage);
      return writeSnapshot(storage, sortSnapshot({ ...snapshot, services: snapshot.services.filter((service) => service.id !== id) }));
    },

    async chooseAndAddAttachment() {
      return null;
    },

    async deleteAttachment() {
      return readSnapshot(storage);
    },

    async getAttachmentPreview(id: string): Promise<AttachmentPreview> {
      return {
        attachmentId: id,
        mimeType: 'application/octet-stream',
        dataUrl: '',
        previewKind: 'unsupported'
      };
    },

    async runAttachmentOcr(id: string): Promise<OcrReviewResult> {
      return this.getAttachmentReview(id);
    },

    async getAttachmentReview(id: string): Promise<OcrReviewResult> {
      const attachment: Attachment = {
        id,
        serviceRecordId: '',
        label: 'Preview attachment',
        type: 'other',
        addedDate: nowIso(),
        fileType: 'unknown',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        ocrStatus: 'unavailable',
        ocrText: '',
        ocrError: 'Document OCR is available in the desktop app window.',
        ocrRunAt: '',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      return {
        attachment,
        suggested: emptySuggestions(),
        status: 'unavailable',
        text: '',
        error: 'Document OCR is available in the desktop app window.'
      };
    },

    async moveAttachmentToService() {
      throw new Error('Attach documents from the desktop app window.');
    },

    async chooseDocumentForIntake(): Promise<DocumentIntakeResult | null> {
      return null;
    },

    async createServiceFromIntake() {
      return null;
    },

    async discardIntake() {
      return true;
    },

    async updateSettings(settings) {
      const snapshot = readSnapshot(storage);
      writeSnapshot(storage, { ...snapshot, settings });
      return settings;
    },

    async exportCsv() {
      const snapshot = readSnapshot(storage);
      const csv = buildServicesCsv(snapshot.vehicles, snapshot.services);
      downloadTextFile('car-care-log-services-preview.csv', csv, 'text/csv;charset=utf-8');
      return {
        fileName: 'car-care-log-services-preview.csv',
        rowCount: snapshot.services.length
      };
    },

    async createBackup(): Promise<BackupResult> {
      const snapshot = readSnapshot(storage);
      const backupName = `car-care-log-preview-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadTextFile(backupName, JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
      return {
        backupName,
        vehicleCount: snapshot.vehicles.length,
        serviceCount: snapshot.services.length,
        attachmentCount: snapshot.services.reduce((count, service) => count + service.attachments.length, 0)
      };
    },

    async restoreBackup() {
      return null;
    }
  };
}

export function installBrowserPreviewApi(): void {
  if (window.carCareLog) return;
  window.carCareLog = createBrowserPreviewApi();
  window.__CAR_CARE_LOG_BROWSER_PREVIEW__ = true;
}

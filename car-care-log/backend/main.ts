import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path, { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ATTACHMENT_MAX_BYTES, CarCareDatabase, getStoragePaths, type StoragePaths } from './database';
import { runLocalOcr } from './ocr';
import { cleanupStaleIntakeFiles } from './intakeCleanup';
import { buildLocalPreview } from './preview';
import { emptySuggestedServiceFields, suggestServiceFieldsFromOcr } from '../shared/receiptParser';
import { userSafeErrorMessage } from '../shared/safeErrors';
import type { AttachmentType } from '../shared/serviceCategories';
import type {
  AppSettings,
  AttachmentRequest,
  CreateServiceFromIntakeRequest,
  DocumentIntakeRequest,
  DocumentIntakeResult,
  OcrReviewResult,
  OcrStatus,
  ServiceRecordInput,
  VehicleInput
} from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let database: CarCareDatabase | null = null;
let storagePaths: StoragePaths | null = null;
const isSmokeTest = process.env.CAR_CARE_LOG_SMOKE_TEST === '1';

interface PendingIntake {
  intakeId: string;
  vehicleId: string;
  filePath: string;
  originalFileName: string;
  label: string;
  type: AttachmentType;
  addedDate: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  status: OcrStatus;
  text: string;
  error: string;
}

const pendingIntakes = new Map<string, PendingIntake>();

if (process.env.CAR_CARE_LOG_SMOKE_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.CAR_CARE_LOG_SMOKE_USER_DATA));
}

function getDatabase(): CarCareDatabase {
  if (!database) throw new Error('Local database is not ready.');
  return database;
}

function getStorage(): StoragePaths {
  if (!storagePaths) throw new Error('Local storage is not ready.');
  return storagePaths;
}

function showOpenDialog(options: OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  return mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options);
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').trim();
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

function previewForFile(filePath: string, mimeType: string, id: string): DocumentIntakeResult['preview'] {
  return buildLocalPreview(filePath, mimeType, id);
}

function reviewResultForAttachment(attachmentId: string): OcrReviewResult {
  const attachment = getDatabase().getAttachmentFileForOcr(attachmentId).attachment;
  return {
    attachment,
    suggested: attachment.ocrText ? suggestServiceFieldsFromOcr(attachment.ocrText) : emptySuggestedServiceFields(),
    status: attachment.ocrStatus,
    text: attachment.ocrText,
    error: attachment.ocrError
  };
}

async function runOcrForAttachment(attachmentId: string): Promise<OcrReviewResult> {
  const db = getDatabase();
  const { attachment, filePath } = db.getAttachmentFileForOcr(attachmentId);
  db.updateAttachmentOcr(attachmentId, 'running', attachment.ocrText, '');
  let ocr = {
    status: 'failed' as OcrStatus,
    text: attachment.ocrText,
    error: ''
  };
  try {
    ocr = await runLocalOcr(filePath, attachment.mimeType, attachment.sizeBytes);
  } catch (error) {
    ocr = {
      status: 'failed',
      text: attachment.ocrText,
      error: userSafeErrorMessage(error, 'Text extraction failed locally. Try another file or a clearer scan.')
    };
  }
  const updated = db.updateAttachmentOcr(attachmentId, ocr.status, ocr.text, ocr.error);
  return {
    attachment: updated,
    suggested: ocr.text ? suggestServiceFieldsFromOcr(ocr.text) : emptySuggestedServiceFields(),
    status: ocr.status,
    text: ocr.text,
    error: ocr.error
  };
}

async function chooseDocumentForIntake(request: DocumentIntakeRequest): Promise<DocumentIntakeResult | null> {
  const db = getDatabase();
  if (!db.getVehicle(request.vehicleId)) {
    throw new Error('Choose a vehicle before importing a document.');
  }

  const result = await showOpenDialog({
    title: 'Import a local document for review',
    properties: ['openFile'],
    filters: [
      { name: 'Receipts, documents, and images', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'txt', 'csv'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const sourcePath = result.filePaths[0];
  const stats = fs.statSync(sourcePath);
  if (!stats.isFile()) throw new Error('Import must be a file.');
  if (stats.size > ATTACHMENT_MAX_BYTES) {
    throw new Error('This file is larger than the local attachment size limit for this version.');
  }

  const intakeId = randomUUID();
  const originalFileName = path.basename(sourcePath);
  const extension = path.extname(originalFileName).toLowerCase();
  const fileType = fileTypeFromExtension(extension);
  const mimeType = mimeFromExtension(extension);
  const intakeFilePath = path.join(getStorage().intakeDir, `${intakeId}${extension}`);
  let copied = false;

  try {
    fs.mkdirSync(getStorage().intakeDir, { recursive: true });
    fs.copyFileSync(sourcePath, intakeFilePath);
    copied = true;

    const label = cleanText(request.label) || path.basename(originalFileName, extension) || 'Imported document';
    const addedDate = new Date().toISOString();
    const ocr = await runLocalOcr(intakeFilePath, mimeType, stats.size);
    const pending: PendingIntake = {
      intakeId,
      vehicleId: request.vehicleId,
      filePath: intakeFilePath,
      originalFileName,
      label,
      type: request.type,
      addedDate,
      fileType,
      mimeType,
      sizeBytes: stats.size,
      status: ocr.status,
      text: ocr.text,
      error: ocr.error
    };
    pendingIntakes.set(intakeId, pending);

    return {
      intakeId,
      vehicleId: request.vehicleId,
      label,
      type: request.type,
      addedDate,
      fileType,
      mimeType,
      sizeBytes: stats.size,
      preview: previewForFile(intakeFilePath, mimeType, intakeId),
      suggested: ocr.text ? suggestServiceFieldsFromOcr(ocr.text) : emptySuggestedServiceFields(),
      status: ocr.status,
      text: ocr.text,
      error: ocr.error
    };
  } catch (error) {
    if (copied) fs.rmSync(intakeFilePath, { force: true });
    throw new Error(userSafeErrorMessage(error, 'The document could not be imported. Choose it again and try once more.'));
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'Car Care Log',
    backgroundColor: '#f6f7f4',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:snapshot', () => getDatabase().getSnapshot());
  ipcMain.handle('sample:load', () => getDatabase().loadSampleData());

  ipcMain.handle('vehicles:create', (_event, input: VehicleInput) => getDatabase().createVehicle(input));
  ipcMain.handle('vehicles:update', (_event, id: string, input: VehicleInput) => getDatabase().updateVehicle(id, input));
  ipcMain.handle('vehicles:delete', (_event, id: string) => {
    getDatabase().deleteVehicle(id);
    return getDatabase().getSnapshot();
  });

  ipcMain.handle('services:create', (_event, input: ServiceRecordInput) => getDatabase().createServiceRecord(input));
  ipcMain.handle('services:update', (_event, id: string, input: ServiceRecordInput) =>
    getDatabase().updateServiceRecord(id, input)
  );
  ipcMain.handle('services:delete', (_event, id: string) => {
    getDatabase().deleteServiceRecord(id);
    return getDatabase().getSnapshot();
  });

  ipcMain.handle('attachments:choose-and-add', async (_event, request: AttachmentRequest) => {
    const result = await showOpenDialog({
      title: 'Attach a local document',
      properties: ['openFile'],
      filters: [
        { name: 'Documents and images', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'txt', 'csv'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return getDatabase().addAttachmentFromFile(request, result.filePaths[0]);
  });
  ipcMain.handle('attachments:delete', (_event, id: string) => {
    getDatabase().deleteAttachment(id);
    return getDatabase().getSnapshot();
  });
  ipcMain.handle('attachments:preview', (_event, id: string) => getDatabase().getAttachmentPreview(id));
  ipcMain.handle('attachments:run-ocr', (_event, id: string) => runOcrForAttachment(id));
  ipcMain.handle('attachments:review', (_event, id: string) => reviewResultForAttachment(id));
  ipcMain.handle('attachments:move-to-service', (_event, attachmentId: string, serviceRecordId: string) =>
    getDatabase().moveAttachmentToService(attachmentId, serviceRecordId)
  );

  ipcMain.handle('intake:choose-document', (_event, request: DocumentIntakeRequest) => chooseDocumentForIntake(request));
  ipcMain.handle('intake:create-service', async (_event, request: CreateServiceFromIntakeRequest) => {
    const pending = pendingIntakes.get(request.intakeId);
    if (!pending) throw new Error('Imported document is no longer available. Please import it again.');
    if (pending.vehicleId !== request.service.vehicleId) {
      throw new Error('Imported document vehicle does not match the reviewed service record.');
    }
    const db = getDatabase();
    const service = db.createServiceRecord(request.service);
    try {
      db.addAttachmentFromLocalFile(
        {
          serviceRecordId: service.id,
          label: cleanText(request.attachmentLabel) || pending.label,
          type: request.attachmentType
        },
        pending.filePath,
        pending.originalFileName,
        {
          status: pending.status,
          text: pending.text,
          error: pending.error,
          runAt: new Date().toISOString()
        }
      );
    } catch (error) {
      db.deleteServiceRecord(service.id);
      throw new Error(userSafeErrorMessage(error, 'The reviewed record could not be saved with its document attached.'));
    }
    fs.rmSync(pending.filePath, { force: true });
    pendingIntakes.delete(request.intakeId);
    return db.getServiceRecord(service.id);
  });
  ipcMain.handle('intake:discard', (_event, intakeId: string) => {
    const pending = pendingIntakes.get(intakeId);
    if (pending) {
      fs.rmSync(pending.filePath, { force: true });
      pendingIntakes.delete(intakeId);
    }
    return true;
  });

  ipcMain.handle('settings:update', (_event, settings: AppSettings) => getDatabase().updateSettings(settings));

  ipcMain.handle('export:csv', async () => {
    const result = await showOpenDialog({
      title: 'Choose a folder for the CSV export',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return getDatabase().exportCsvToDirectory(result.filePaths[0]);
  });

  ipcMain.handle('backup:create', async () => {
    const result = await showOpenDialog({
      title: 'Choose a folder for the local backup',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return getDatabase().createBackup(result.filePaths[0]);
  });

  ipcMain.handle('backup:restore', async () => {
    const result = await showOpenDialog({
      title: 'Choose a Car Care Log backup folder',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return getDatabase().restoreFromBackup(result.filePaths[0]);
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.carcarelog.app');
  storagePaths = getStoragePaths(app.getPath('userData'));
  cleanupStaleIntakeFiles(storagePaths.intakeDir);
  database = new CarCareDatabase(storagePaths);
  await database.initialize();
  registerIpcHandlers();
  await createWindow();

  if (isSmokeTest) {
    const smokeResult = JSON.stringify({
      status: 'ready',
      packaged: app.isPackaged,
      hasDatabase: Boolean(database),
      hasStorage: Boolean(storagePaths),
      databaseReady: Boolean(storagePaths && fs.existsSync(storagePaths.dbPath)),
      attachmentsReady: Boolean(storagePaths && fs.existsSync(storagePaths.attachmentsDir)),
      intakeReady: Boolean(storagePaths && fs.existsSync(storagePaths.intakeDir))
    });
    const smokeFile = process.env.CAR_CARE_LOG_SMOKE_FILE;
    if (smokeFile) {
      fs.writeFileSync(smokeFile, smokeResult);
    } else {
      console.log(smokeResult);
    }
    setTimeout(() => app.quit(), 250);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

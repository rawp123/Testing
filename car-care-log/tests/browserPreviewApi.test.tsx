/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { createBrowserPreviewApi } from '../frontend/src/browserPreviewApi';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('browser preview API boundaries', () => {
  it('starts empty and does not expose sample loading into preview storage', async () => {
    const api = createBrowserPreviewApi(new MemoryStorage());
    const snapshot = await api.getSnapshot();

    expect(snapshot.vehicles).toHaveLength(0);
    expect(snapshot.services).toHaveLength(0);
    expect('loadSampleData' in api).toBe(false);
  });

  it('keeps document OCR unavailable with a clear desktop-app message', async () => {
    const api = createBrowserPreviewApi(new MemoryStorage());

    const review = await api.getAttachmentReview('preview-attachment');
    const ocr = await api.runAttachmentOcr('preview-attachment');

    expect(review.status).toBe('unavailable');
    expect(review.error).toContain('desktop app window');
    expect(ocr.status).toBe('unavailable');
    expect(ocr.error).toContain('desktop app window');
  });

  it('does not pretend browser preview can move or import local documents', async () => {
    const api = createBrowserPreviewApi(new MemoryStorage());

    await expect(api.moveAttachmentToService('attachment-1', 'service-1')).rejects.toThrow(/desktop app window/);
    await expect(
      api.chooseDocumentForIntake({
        vehicleId: 'vehicle-1',
        label: 'Receipt',
        type: 'receipt'
      })
    ).resolves.toBeNull();
    await expect(
      api.createServiceFromIntake({
        intakeId: 'intake-1',
        attachmentLabel: 'Receipt',
        attachmentType: 'receipt',
        service: {
          vehicleId: 'vehicle-1',
          serviceDate: '2026-02-01',
          mileage: null,
          shop: '',
          category: 'Other',
          description: '',
          totalCost: null,
          notes: '',
          nextRecommendedDate: '',
          nextRecommendedMileage: null
        }
      })
    ).resolves.toBeNull();
  });

  it('keeps preview restore as a no-op instead of implying desktop backup parity', async () => {
    const api = createBrowserPreviewApi(new MemoryStorage());

    await expect(api.restoreBackup()).resolves.toBeNull();
  });
});

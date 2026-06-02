import { describe, expect, it } from 'vitest';
import { stripLocalPaths, userSafeErrorMessage } from '../shared/safeErrors';

describe('safe user-facing errors', () => {
  it('strips absolute local paths from arbitrary messages', () => {
    const message = "OCR failed while reading '/Users/robertparrish/private/repair order.pdf'";

    expect(stripLocalPaths(message)).toBe("OCR failed while reading '[local file]'");
  });

  it('maps pathful filesystem errors to plain recovery guidance', () => {
    const error = new Error("ENOENT: no such file or directory, open '/Users/robertparrish/receipts/invoice.pdf'");

    expect(userSafeErrorMessage(error)).toBe('A local file or folder could not be read. Choose it again and try once more.');
  });

  it('keeps useful non-path messages readable', () => {
    expect(userSafeErrorMessage(new Error('Vehicle nickname is required.'))).toBe('Vehicle nickname is required.');
  });
});

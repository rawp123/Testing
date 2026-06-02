# Real-World Document QA

Car Care Log should be tested with real maintenance documents locally, but real documents must not be committed.

## Private Fixture Folder

Place private test files here:

```text
fixtures/private-documents/
```

The folder is ignored by git. Use fake or redacted copies whenever possible. Do not commit real names, addresses, VINs, license plates, phone numbers, payment details, or repair order documents.

## QA Checklist

Test each document type through Documents -> Import and review:

- Dealership repair-order PDF
- Independent shop invoice PDF
- Oil-change receipt
- Tire invoice or alignment receipt
- Phone photo of a receipt
- Scanned PDF with no embedded text
- Multi-page PDF with several service lines

You can also run the private OCR harness from the repository root:

```bash
npm run qa:private-ocr
```

The harness scans `fixtures/private-documents/`, runs local OCR, and prints only file-relative names, MIME type, OCR status, extracted text length, and whether an error was present. It does not snapshot or write OCR text.

For each document, record locally:

- Whether preview opens
- OCR status: extracted, partial, failed, or unavailable
- Whether service date is suggested correctly
- Whether mileage is suggested correctly
- Whether shop/provider is suggested correctly
- Whether category is useful
- Whether total cost is suggested correctly
- Whether notes include useful repair-order context
- Whether suggested fields are easy to correct before saving

## Safety Checks

- Confirm no source file path appears in the UI.
- Confirm unsupported files remain stored locally and show a cautious unavailable state.
- Confirm scanned PDFs over the current page limit show partial extraction honestly.
- Confirm private fixture files remain ignored in `git status --ignored`.

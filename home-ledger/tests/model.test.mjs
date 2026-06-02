import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExpensesCsv,
  formatFileSize,
  parseAmount,
  removeLocalPaths,
  sanitizeData,
} from "../backend/domain/model.js";

test("sanitizeData normalizes relationships, options, dates, amounts, and local paths", () => {
  const cleanData = sanitizeData({
    properties: [{
      id: "property_1",
      name: "Main home",
      address: "/Users/private/address.txt",
      purchaseDate: "2024-02-31",
      purchasePrice: "$450,000.99",
      notes: "See file:///Users/private/closing.pdf",
    }],
    projects: [{
      id: "project_1",
      propertyId: "missing_property",
      name: "Kitchen",
      category: "not-real",
      status: "mystery",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "missing_property",
      projectId: "project_1",
      date: "2024-04-02",
      vendor: "=Formula Vendor",
      description: "Cabinets",
      amount: "$1,200.505",
      classification: "made up",
      category: "bad category",
      documentationStatus: "unknown",
      notes: "../private/receipt.pdf",
    }],
    documents: [{
      id: "document_1",
      propertyId: "missing_property",
      projectId: "project_1",
      expenseId: "expense_1",
      displayName: "Receipt",
      documentType: "bogus",
      addedDate: "2024-04-03",
      fileName: "C:/Users/private/cabinet-receipt.pdf",
      fileStatusNote: "Restored from ~/Downloads/backup.json",
      hasFile: true,
      fileSize: "2400",
    }],
  });

  assert.equal(cleanData.properties.length, 1);
  assert.equal(cleanData.properties[0].purchaseDate, "");
  assert.equal(cleanData.properties[0].purchasePrice, 450000.99);
  assert.equal(cleanData.projects[0].propertyId, "property_1");
  assert.equal(cleanData.projects[0].category, "other");
  assert.equal(cleanData.projects[0].status, "planned");
  assert.equal(cleanData.expenses[0].classification, "unclear / ask CPA");
  assert.equal(cleanData.expenses[0].category, "other");
  assert.equal(cleanData.expenses[0].documentationStatus, "no document yet");
  assert.equal(cleanData.documents[0].propertyId, "property_1");
  assert.equal(cleanData.documents[0].projectId, "project_1");
  assert.equal(cleanData.documents[0].documentType, "other");
  assert.equal(cleanData.documents[0].fileSize, 2400);

  const serialized = JSON.stringify(cleanData);
  for (const forbidden of ["/Users/", "file://", "../private", "C:/", "~/"]) {
    assert.equal(serialized.includes(forbidden), false, `raw path survived sanitizer: ${forbidden}`);
  }
});

test("sanitizeData drops orphaned records when no usable property remains", () => {
  const cleanData = sanitizeData({
    properties: [{ id: "property_1", name: "" }],
    projects: [{ id: "project_1", propertyId: "property_1", name: "Roof" }],
    expenses: [{ id: "expense_1", propertyId: "property_1", vendor: "Vendor", description: "Work" }],
    documents: [{ id: "document_1", propertyId: "property_1", displayName: "Invoice" }],
  });

  assert.deepEqual(cleanData, {
    properties: [],
    projects: [],
    expenses: [],
    documents: [],
  });
});

test("buildExpensesCsv neutralizes spreadsheet formulas and quotes values", () => {
  const cleanData = sanitizeData({
    properties: [{ id: "property_1", name: "Main, Home" }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      date: "2024-01-02",
      vendor: "@Vendor",
      description: "Line one\nLine two",
      amount: "20",
      classification: "repair or maintenance",
      category: "roof",
      documentationStatus: "needs follow-up",
    }],
  });

  const csv = buildExpensesCsv(cleanData);
  assert.match(csv, /,'@Vendor,/);
  assert.match(csv, /"Line one\nLine two"/);
  assert.match(csv, /"Main, Home"/);
});

test("amount, file-size, and path helpers handle edge cases", () => {
  assert.equal(parseAmount("$1,234.567"), 1234.57);
  assert.equal(parseAmount("not money"), 0);
  assert.equal(formatFileSize(-1), "Unknown size");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(removeLocalPaths("\\\\Server\\Share\\invoice.pdf"), "[local file path removed]");
});

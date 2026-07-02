import assert from "node:assert/strict";
import {
  buildExpensesCsv,
  sanitizeData,
} from "../backend/domain/model.js";

const rawData = {
  properties: [{
    id: "property_1",
    name: "Main home",
    address: "~/Documents/private-address",
    purchaseDate: "2024-02-31",
    purchasePrice: "-1",
    notes: "See /Users/person/receipt.pdf, /Applications/App.app, ../relative/file.pdf, and C:/Users/person/file.pdf",
  }],
  projects: [{
    id: "project_1",
    propertyId: "property_1",
    name: "Kitchen",
    category: "kitchen",
    status: "completed",
  }],
  expenses: [{
    id: "expense_1",
    propertyId: "property_1",
    projectId: "project_1",
    date: "2024-04-02",
    vendor: "=Formula Vendor",
    description: "Cabinets",
    amount: "-1200.50",
    classification: "potential basis addition",
    category: "kitchen",
    documentationStatus: "receipt attached",
    notes: "\\\\Server\\Share\\private.pdf",
  }],
  documents: [{
    id: "document_1",
    propertyId: "property_1",
    projectId: "project_1",
    expenseId: "expense_1",
    displayName: "Receipt",
    documentType: "receipt",
    addedDate: "2024-04-03",
    fileName: "/Users/person/cabinet-receipt.pdf",
    fileStatusNote: "Restored from ~/Downloads/backup.json",
    hasFile: true,
  }],
};

const cleanData = sanitizeData(rawData);
assert.equal(cleanData.properties.length, 1);
assert.equal(cleanData.projects.length, 1);
assert.equal(cleanData.expenses.length, 1);
assert.equal(cleanData.documents.length, 1);
assert.equal(cleanData.properties[0].purchaseDate, "");
assert.equal(cleanData.properties[0].purchasePrice, 0);
assert.equal(cleanData.expenses[0].amount, 0);

const serializedData = JSON.stringify(cleanData);
for (const forbidden of ["/Users/", "~/", "C:/", "\\\\Server", "/Applications/", "../relative"]) {
  assert.equal(serializedData.includes(forbidden), false, `raw path survived sanitizer: ${forbidden}`);
}

const csv = buildExpensesCsv(cleanData);
assert.match(csv, /'=Formula Vendor/);
assert.match(csv, /Possible improvement/);

console.log("Home Ledger model checks passed.");

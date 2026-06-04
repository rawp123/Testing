import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSaleScenarioEstimate,
  buildExpensesCsv,
  formatFileSize,
  getSafeDownloadFileName,
  getProjectCompleteness,
  getProjectReviewSummaries,
  getPropertyReviewSummaries,
  getReviewReadiness,
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
      permitNumber: "/Users/private/permit.pdf",
      status: "mystery",
      scopeSummary: "See ~/private/scope.txt",
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
  assert.equal(cleanData.projects[0].permitNumber, "[local file path removed]");
  assert.equal(cleanData.projects[0].scopeSummary, "See [local file path removed]");
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
    vendors: [],
    properties: [],
    projects: [],
    expenses: [],
    documents: [],
  });
});

test("sanitizeData creates shared vendors from legacy project and expense names", () => {
  const cleanData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Kitchen",
      contractor: "Acme Tile",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      vendor: "Acme Tile",
      description: "Tile labor",
      amount: 1200,
    }],
  });

  assert.equal(cleanData.vendors.length, 1);
  assert.equal(cleanData.vendors[0].name, "Acme Tile");
  assert.equal(cleanData.projects[0].vendorId, cleanData.vendors[0].id);
  assert.equal(cleanData.expenses[0].vendorId, cleanData.vendors[0].id);
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
  assert.match(csv, /^Export Source,Export Date,Property,/);
  assert.match(csv, /^Home Basis Tracker,\d{4}-\d{2}-\d{2},/m);
  assert.match(csv, /,'@Vendor,/);
  assert.match(csv, /"Line one\nLine two"/);
  assert.match(csv, /"Main, Home"/);
});

test("review readiness and project summaries cover export essentials", () => {
  const cleanData = sanitizeData({
    properties: [{
      id: "property_1",
      name: "Main home",
      address: "123 Maple Street",
      purchaseDate: "2020-01-15",
      purchasePrice: 450000,
    }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Kitchen remodel",
      category: "kitchen",
      status: "completed",
      startDate: "2024-01-01",
      completionDate: "2024-03-01",
      contractor: "Builder Co.",
      permitNumber: "PR-123",
      scopeSummary: "Cabinets and electrical upgrades.",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      date: "2024-02-01",
      vendor: "Builder Co.",
      description: "Cabinet installation",
      amount: 1200,
      classification: "potential basis addition",
      category: "kitchen",
      documentationStatus: "invoice attached",
    }],
    documents: [{
      id: "document_1",
      propertyId: "property_1",
      projectId: "project_1",
      expenseId: "expense_1",
      displayName: "Cabinet invoice",
      documentType: "invoice",
      addedDate: "2024-02-02",
      hasFile: true,
      fileName: "invoice.pdf",
      fileSize: 2048,
    }],
  });

  const readiness = getReviewReadiness(cleanData);
  const properties = getPropertyReviewSummaries(cleanData);
  const projects = getProjectReviewSummaries(cleanData);

  assert.equal(readiness.expensesMissingLinkedEvidence.length, 0);
  assert.equal(readiness.score, 100);
  assert.equal(properties[0].readinessScore, 100);
  assert.equal(properties[0].documents[0].displayName, "Cabinet invoice");
  assert.equal(projects[0].project.name, "Kitchen remodel");
  assert.equal(projects[0].hasPermit, true);
  assert.equal(projects[0].expenses[0].description, "Cabinet installation");
});

test("sale scenario estimates proceeds and potential taxable gain from saved basis records", () => {
  const cleanData = sanitizeData({
    properties: [{
      id: "property_1",
      name: "Main home",
      purchaseDate: "2020-01-15",
      purchasePrice: 450000,
    }],
    expenses: [
      {
        id: "expense_basis",
        propertyId: "property_1",
        date: "2024-02-01",
        vendor: "Builder Co.",
        description: "Kitchen remodel",
        amount: 80000,
        classification: "potential basis addition",
        category: "kitchen",
        documentationStatus: "invoice attached",
      },
      {
        id: "expense_repair",
        propertyId: "property_1",
        date: "2024-04-01",
        vendor: "Painter Co.",
        description: "Touch-up painting",
        amount: 5000,
        classification: "repair or maintenance",
        category: "interior painting",
        documentationStatus: "receipt attached",
      },
      {
        id: "expense_review",
        propertyId: "property_1",
        date: "2024-05-01",
        vendor: "Roof Co.",
        description: "Roof work",
        amount: 12000,
        classification: "unclear / ask CPA",
        category: "roof",
        documentationStatus: "needs follow-up",
      },
    ],
  });

  const estimate = buildSaleScenarioEstimate(cleanData, {
    propertyId: "property_1",
    salePrice: 900000,
    mortgagePayoff: 300000,
    sellingCostsRate: 6,
    exclusionAmount: 250000,
  });

  assert.equal(estimate.sellingCosts, 54000);
  assert.equal(estimate.adjustedBasis, 530000);
  assert.equal(estimate.gainBeforeExclusion, 316000);
  assert.equal(estimate.potentialTaxableGain, 66000);
  assert.equal(estimate.netProceedsBeforeTax, 546000);
  assert.equal(estimate.needsReviewCosts, 12000);
  assert.equal(estimate.repairCosts, 5000);
});

test("project completeness tracks missing and finished review requirements", () => {
  const incompleteData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Electrical panel",
      category: "electrical",
      status: "completed",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      date: "2024-04-10",
      vendor: "Electrician Co.",
      description: "Panel upgrade",
      amount: 3200,
      classification: "unclear / ask CPA",
      documentationStatus: "invoice attached",
    }],
  });
  const incomplete = getProjectCompleteness(incompleteData, incompleteData.projects[0]);

  assert.ok(incomplete.score < 70);
  assert.ok(incomplete.followUps.some((item) => /project description/i.test(item)));
  assert.ok(incomplete.followUps.some((item) => /receipt or invoice/i.test(item)));
  assert.ok(incomplete.missingExpectedDocumentTypes.some((item) => item.value === "permit"));

  const completeData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Electrical panel",
      category: "electrical",
      status: "completed",
      startDate: "2024-04-01",
      completionDate: "2024-04-12",
      contractor: "Electrician Co.",
      permitNumber: "EL-123",
      scopeSummary: "Panel replacement and related electrical work.",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      date: "2024-04-10",
      vendor: "Electrician Co.",
      description: "Panel upgrade",
      amount: 3200,
      classification: "potential basis addition",
      documentationStatus: "invoice attached",
    }],
    documents: [
      {
        id: "document_1",
        propertyId: "property_1",
        projectId: "project_1",
        expenseId: "expense_1",
        displayName: "Panel invoice",
        documentType: "invoice",
        hasFile: true,
        fileName: "panel-invoice.pdf",
      },
      {
        id: "document_2",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "Contract",
        documentType: "contract",
      },
      {
        id: "document_3",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "After photo",
        documentType: "photo",
      },
      {
        id: "document_4",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "Payment record",
        documentType: "payment record",
      },
    ],
  });
  const complete = getProjectCompleteness(completeData, completeData.projects[0]);

  assert.equal(complete.score, 100);
  assert.equal(complete.followUps.length, 0);
  assert.deepEqual(complete.missingExpectedDocumentTypes, []);
});

test("review readiness starts at zero for an empty binder", () => {
  const readiness = getReviewReadiness(sanitizeData());

  assert.equal(readiness.score, 0);
  assert.equal(readiness.completedChecks, 0);
  assert.ok(readiness.followUps.some((item) => /property/i.test(item)));
});

test("amount, file-size, and path helpers handle edge cases", () => {
  assert.equal(parseAmount("$1,234.567"), 1234.57);
  assert.equal(parseAmount("not money"), 0);
  assert.equal(formatFileSize(-1), "Unknown size");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(removeLocalPaths("\\\\Server\\Share\\invoice.pdf"), "[local file path removed]");
});

test("download file names strip paths and control characters", () => {
  assert.equal(getSafeDownloadFileName("/Users/private/backup.json"), "backup.json");
  assert.equal(getSafeDownloadFileName("folder\\nested\\receipt\u0000\n2026.pdf"), "receipt2026.pdf");
  assert.equal(getSafeDownloadFileName(""), "home-basis-download");
});

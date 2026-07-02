import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSaleScenarioEstimate,
  buildExpensesCsv,
  formatFileSize,
  getPacketReadinessSummary,
  getProfessionalClassificationLabel,
  getSafeDownloadFileName,
  getProjectCompleteness,
  getProjectReviewSummaries,
  getPropertyReviewSummaries,
  getRecordFollowUps,
  getRecordFollowUpsForSurface,
  getReviewReadiness,
  isPlaceholderReviewValue,
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
      isPrimary: true,
    }],
    projects: [{
      id: "project_1",
      propertyId: "missing_property",
      name: "Kitchen",
      category: "not-real",
      permitNumber: "/Users/private/permit.pdf",
      status: "mystery",
      scopeSummary: "See ~/private/scope.txt",
      completenessOverrideNote: "Reviewed /Users/private/project-notes.txt",
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
  assert.equal(cleanData.properties[0].isPrimary, true);
  assert.equal(cleanData.properties[0].purchaseDate, "");
  assert.equal(cleanData.properties[0].purchasePrice, 450000.99);
  assert.equal(cleanData.projects[0].propertyId, "property_1");
  assert.equal(cleanData.projects[0].category, "other");
  assert.equal(cleanData.projects[0].status, "planned");
  assert.equal(cleanData.projects[0].permitNumber, "[local file path removed]");
  assert.equal(cleanData.projects[0].scopeSummary, "See [local file path removed]");
  assert.equal(cleanData.projects[0].completenessOverrideNote, "Reviewed [local file path removed]");
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

test("sanitizeData keeps one primary property first", () => {
  const cleanData = sanitizeData({
    properties: [
      { id: "property_1", name: "Lake house", isPrimary: false },
      { id: "property_2", name: "Main home", isPrimary: true },
      { id: "property_3", name: "Office", isPrimary: true },
    ],
    projects: [],
    expenses: [],
    documents: [],
  });

  assert.equal(cleanData.properties[0].id, "property_2");
  assert.equal(cleanData.properties[0].isPrimary, true);
  assert.equal(cleanData.properties.filter((property) => property.isPrimary).length, 1);
  assert.deepEqual(cleanData.properties.map((property) => property.id), ["property_2", "property_1", "property_3"]);
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
    followUpOverrides: [],
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
  assert.match(csv, /^Home Ledger,\d{4}-\d{2}-\d{2},/m);
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

test("record follow-up generator normalizes unfinished record items", () => {
  const cleanData = sanitizeData({
    properties: [{
      id: "property_1",
      name: "Main home",
    }],
    projects: [
      {
        id: "project_1",
        propertyId: "property_1",
        name: "Roof work",
        category: "roof",
        status: "completed",
      },
      {
        id: "project_no_vendor",
        propertyId: "property_1",
        name: "Attic insulation",
        category: "attic",
        status: "planned",
      },
      {
        id: "project_marked_complete",
        propertyId: "property_1",
        name: "Basement shelves",
        status: "completed",
        completenessOverrideNote: "No more records to add.",
      },
    ],
    expenses: [
      {
        id: "expense_missing_support",
        propertyId: "property_1",
        projectId: "project_1",
        date: "2024-01-05",
        description: "Roof deposit",
        amount: 500,
        classification: "unclear / ask CPA",
        documentationStatus: "needs follow-up",
      },
      {
        id: "expense_documented_without_link",
        propertyId: "property_1",
        projectId: "project_1",
        date: "2024-01-08",
        vendor: "Roof Co.",
        description: "Roof invoice",
        amount: 2000,
        classification: "potential basis addition",
        documentationStatus: "invoice attached",
      },
      {
        id: "expense_linked_missing_file",
        propertyId: "property_1",
        projectId: "project_1",
        date: "2024-01-09",
        vendor: "Supply Co.",
        description: "Roof materials",
        amount: 300,
        classification: "repair or maintenance",
        documentationStatus: "receipt attached",
      },
    ],
    documents: [
      {
        id: "document_linked_missing_file",
        propertyId: "property_1",
        projectId: "project_1",
        expenseId: "expense_linked_missing_file",
        displayName: "Roof materials receipt",
        documentType: "receipt",
        hasFile: false,
      },
      {
        id: "document_restored_missing",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "Restored permit",
        documentType: "permit",
        hasFile: false,
        fileStatusNote: "File content was not restored inside this workspace.",
      },
      {
        id: "document_tutorial_sample",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "Tutorial photo",
        documentType: "photo",
        hasFile: false,
        fileStatusNote: "Tutorial sample: no photo file is stored.",
      },
    ],
  });

  const followUps = getRecordFollowUps(cleanData, { tutorialMode: true });
  const types = new Set(followUps.map((item) => item.type));

  assert.ok(types.has("property-missing-purchase-date"));
  assert.ok(types.has("property-missing-purchase-price"));
  assert.ok(types.has("project-missing-vendor"));
  assert.ok(types.has("project-missing-dates"));
  assert.ok(types.has("project-missing-scope"));
  assert.ok(types.has("project-missing-supporting-documents"));
  assert.ok(types.has("expense-missing-vendor"));
  assert.ok(types.has("expense-review-treatment"));
  assert.ok(types.has("expense-missing-document-support"));
  assert.ok(types.has("expense-documented-without-support"));
  assert.ok(types.has("document-missing-attached-file"));
  assert.ok(types.has("document-restored-without-file-content"));
  assert.ok(types.has("document-tutorial-metadata-only"));

  assert.equal(followUps.some((item) => item.projectId === "project_marked_complete"), false);
  assert.equal(
    followUps.some((item) => item.expenseId === "expense_linked_missing_file" && item.type === "expense-documented-without-support"),
    false,
  );
  assert.ok(
    followUps.some((item) => item.expenseId === "expense_linked_missing_file" && item.type === "document-missing-attached-file"),
  );
  assert.ok(followUps.every((item) => item.id && item.primaryAction?.label && item.primaryAction?.destinationTab && item.primaryAction?.copy));
});

test("packet readiness flags placeholder content and professional labels", () => {
  assert.equal(isPlaceholderReviewValue("test"), true);
  assert.equal(isPlaceholderReviewValue("asdf"), true);
  assert.equal(isPlaceholderReviewValue("This note mentions a test fit with real context."), false);
  assert.equal(getProfessionalClassificationLabel("unclear / ask CPA"), "Needs classification");

  const cleanData = sanitizeData({
    properties: [{
      id: "property_1",
      name: "Main home",
      purchaseDate: "2020-01-01",
      purchasePrice: 400000,
      notes: "asdf",
    }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Roof project",
      contractor: "test",
      permitNumber: "test",
      scopeSummary: "test",
      notes: "todo",
      startDate: "2024-01-01",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      date: "2024-01-05",
      vendor: "test",
      description: "Roof deposit",
      amount: 500,
      classification: "unclear / ask CPA",
      documentationStatus: "needs follow-up",
      notes: "tbd",
    }],
    documents: [{
      id: "document_1",
      propertyId: "property_1",
      projectId: "project_1",
      displayName: "asdf",
      documentType: "other",
      hasFile: true,
      fileName: "note.pdf",
    }],
  });

  const packet = getPacketReadinessSummary(cleanData);
  const placeholderIds = new Set(packet.placeholderItems.map((item) => item.id));

  assert.equal(packet.title, "Draft Professional Review Packet");
  assert.equal(packet.statusLabel, "Needs records");
  assert.equal(packet.readyToShare, false);
  assert.ok(placeholderIds.has("property:property_1:placeholder:notes"));
  assert.ok(placeholderIds.has("project:project_1:placeholder:scopeSummary"));
  assert.ok(placeholderIds.has("project:project_1:placeholder:contractor"));
  assert.ok(placeholderIds.has("project:project_1:placeholder:permitNumber"));
  assert.ok(placeholderIds.has("expense:expense_1:placeholder:vendor"));
  assert.ok(placeholderIds.has("expense:expense_1:placeholder:notes"));
  assert.ok(placeholderIds.has("document:document_1:placeholder:title"));
  assert.ok(packet.needsClassificationItems.some((item) => item.label === "Review cost type"));
});

test("packet readiness counts only linked expense proof files and separates dismissed items", () => {
  const records = {
    properties: [{
      id: "property_1",
      name: "Main home",
      purchaseDate: "2020-01-01",
      purchasePrice: 400000,
    }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Kitchen project",
      contractor: "Builder Co.",
      scopeSummary: "Cabinet and fixture work.",
      startDate: "2024-01-01",
    }],
    expenses: [
      {
        id: "expense_supported",
        propertyId: "property_1",
        projectId: "project_1",
        date: "2024-01-05",
        vendor: "Builder Co.",
        description: "Cabinet invoice",
        amount: 1200,
        classification: "potential basis addition",
        documentationStatus: "invoice attached",
      },
      {
        id: "expense_unlinked",
        propertyId: "property_1",
        projectId: "project_1",
        date: "2024-01-06",
        vendor: "Builder Co.",
        description: "Fixture invoice",
        amount: 800,
        classification: "potential basis addition",
        documentationStatus: "invoice attached",
      },
    ],
    documents: [
      {
        id: "document_linked",
        propertyId: "property_1",
        projectId: "project_1",
        expenseId: "expense_supported",
        displayName: "Cabinet invoice",
        documentType: "invoice",
        hasFile: true,
        fileName: "cabinet-invoice.pdf",
      },
      {
        id: "document_unrelated",
        propertyId: "property_1",
        projectId: "project_1",
        displayName: "Unrelated invoice",
        documentType: "invoice",
        hasFile: true,
        fileName: "unrelated-invoice.pdf",
      },
    ],
  };

  const packet = getPacketReadinessSummary(sanitizeData(records));
  assert.equal(packet.expenseProofFilesLinked, 1);
  assert.ok(packet.supportItems.some((item) => item.expenseId === "expense_unlinked"));
  assert.equal(packet.readyToShare, false);

  const dismissedPacket = getPacketReadinessSummary(sanitizeData({
    ...records,
    followUpOverrides: [{
      id: "expense:expense_unlinked:documented-without-support",
      label: "Upload invoice for Builder Co.",
      typeLabel: "Expense support",
      expenseId: "expense_unlinked",
      note: "Handled outside the app.",
    }],
  }));

  assert.equal(dismissedPacket.expenseProofFilesLinked, 1);
  assert.equal(dismissedPacket.supportItems.some((item) => item.expenseId === "expense_unlinked"), false);
  assert.equal(dismissedPacket.dismissedItemCount, 1);
  assert.equal(dismissedPacket.dismissedItemCopy, "1 dismissed item is excluded from open counts.");
});

test("document-related follow-ups are surfaced through projects instead of documents", () => {
  const cleanData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{ id: "project_1", propertyId: "property_1", name: "Kitchen" }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      description: "Cabinets",
      amount: 1200,
      documentationStatus: "invoice attached",
      classification: "potential basis addition",
    }],
    documents: [{
      id: "document_1",
      propertyId: "property_1",
      projectId: "project_1",
      expenseId: "expense_1",
      displayName: "Cabinet invoice",
      documentType: "invoice",
      hasFile: false,
    }],
  });

  const documentFollowUps = getRecordFollowUpsForSurface(cleanData, "documents");
  const projectFollowUps = getRecordFollowUpsForSurface(cleanData, "projects");

  assert.deepEqual(documentFollowUps, []);
  assert.ok(projectFollowUps.some((item) => item.type === "document-missing-attached-file"));
  assert.ok(projectFollowUps.some((item) => item.label === "Upload invoice file"));
  assert.ok(projectFollowUps.some((item) => /Cabinet invoice/.test(item.detail)));
});

test("project follow-ups name the exact missing document or file requirement", () => {
  const cleanData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Bathroom remodel",
      category: "bathroom",
      status: "completed",
      startDate: "2024-01-01",
      completionDate: "2024-01-20",
      contractor: "Harbor Bath & Tile",
      scopeSummary: "Tile, waterproofing, vanity, and fixture installation.",
    }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      date: "2024-01-10",
      vendor: "Harbor Bath & Tile",
      description: "Bathroom tile and vanity installation",
      amount: 9000,
      classification: "potential basis addition",
      documentationStatus: "invoice attached",
    }],
    documents: [{
      id: "document_1",
      propertyId: "property_1",
      projectId: "project_1",
      expenseId: "expense_1",
      displayName: "Bathroom remodel invoice",
      documentType: "invoice",
      hasFile: true,
      fileName: "bathroom-invoice.pdf",
    }],
  });

  const projectFollowUps = getRecordFollowUpsForSurface(cleanData, "projects");

  assert.ok(projectFollowUps.some((item) =>
    item.id === "project:project_1:supporting-document:contract" &&
    item.label === "Add contract or estimate" &&
    /missing a contract or estimate document record/i.test(item.detail)
  ));
  assert.ok(projectFollowUps.some((item) =>
    item.id === "project:project_1:supporting-document:photo" &&
    item.label === "Add before/after photo" &&
    /missing a before\/after photo document record/i.test(item.detail)
  ));
  assert.equal(projectFollowUps.some((item) => /contract or estimate and before\/after photo/i.test(item.detail)), false);
});

test("expense support follow-ups name receipt or invoice requirements", () => {
  const receiptData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{ id: "project_1", propertyId: "property_1", name: "Deck repair" }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      vendor: "Cedarline Carpentry",
      description: "Deck repair estimate",
      amount: 1200,
      documentationStatus: "needs follow-up",
      classification: "repair or maintenance",
    }],
  });
  const receiptFollowUps = getRecordFollowUpsForSurface(receiptData, "projects");
  assert.ok(receiptFollowUps.some((item) =>
    item.type === "expense-missing-document-support" &&
    item.label === "Add receipt for Cedarline Carpentry" &&
    /needs receipt support/i.test(item.detail)
  ));

  const invoiceData = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{ id: "project_1", propertyId: "property_1", name: "Bathroom remodel" }],
    expenses: [{
      id: "expense_1",
      propertyId: "property_1",
      projectId: "project_1",
      vendor: "Harbor Bath & Tile",
      description: "Bathroom tile installation",
      amount: 9000,
      documentationStatus: "invoice attached",
      classification: "potential basis addition",
    }],
  });
  const invoiceFollowUps = getRecordFollowUpsForSurface(invoiceData, "projects");
  assert.ok(invoiceFollowUps.some((item) =>
    item.type === "expense-documented-without-support" &&
    item.label === "Upload invoice for Harbor Bath & Tile" &&
    /no uploaded invoice file is linked/i.test(item.detail)
  ));
});

test("follow-up overrides persist and remove only the overridden open item", () => {
  const dataWithOpenItems = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Kitchen",
      status: "completed",
    }],
  });
  const openItems = getRecordFollowUpsForSurface(dataWithOpenItems, "projects");
  assert.ok(openItems.some((item) => item.id === "project:project_1:dates"));
  assert.ok(openItems.some((item) => item.id === "project:project_1:scope"));

  const dataWithOverride = sanitizeData({
    ...dataWithOpenItems,
    followUpOverrides: [{
      id: "project:project_1:dates",
      label: "Add project dates",
      projectId: "project_1",
      note: "Dates reviewed outside the app.",
      completedAt: "2026-06-06T12:00:00.000Z",
    }],
  });
  const remainingItems = getRecordFollowUpsForSurface(dataWithOverride, "projects");

  assert.equal(remainingItems.some((item) => item.id === "project:project_1:dates"), false);
  assert.ok(remainingItems.some((item) => item.id === "project:project_1:scope"));
  assert.equal(dataWithOverride.followUpOverrides[0].note, "Dates reviewed outside the app.");
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

test("project completeness can be marked complete with a note", () => {
  const data = sanitizeData({
    properties: [{ id: "property_1", name: "Main home" }],
    projects: [{
      id: "project_1",
      propertyId: "property_1",
      name: "Electrical panel",
      category: "electrical",
      status: "completed",
      completenessOverrideNote: "Reviewed available records and no additional documents are needed.",
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

  const completeness = getProjectCompleteness(data, data.projects[0]);

  assert.equal(completeness.score, 100);
  assert.equal(completeness.completedChecks, completeness.totalChecks);
  assert.equal(completeness.followUps.length, 0);
  assert.deepEqual(completeness.missingExpectedDocumentTypes, []);
  assert.equal(completeness.isOverridden, true);
  assert.match(completeness.overrideNote, /Reviewed available records/);
});

test("review readiness starts at zero for an empty binder", () => {
  const readiness = getReviewReadiness(sanitizeData());

  assert.equal(readiness.score, 0);
  assert.equal(readiness.completedChecks, 0);
  assert.deepEqual(readiness.followUps, []);
  assert.deepEqual(readiness.followUpItems, []);
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

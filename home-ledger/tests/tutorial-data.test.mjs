import assert from "node:assert/strict";
import test from "node:test";
import { createBackupEnvelope, validateBackupEnvelope } from "../backend/domain/backup.js";
import { buildExpensesCsv, sanitizeData } from "../backend/domain/model.js";
import { createTutorialData, TUTORIAL_STEPS } from "../backend/domain/tutorial-data.js";

test("tutorial workspace data covers the main Home Basis workflows", () => {
  const tutorialData = createTutorialData();

  assert.ok(tutorialData.properties.length >= 2);
  assert.ok(tutorialData.projects.length >= 12);
  assert.ok(tutorialData.expenses.length >= 25);
  assert.ok(tutorialData.documents.length >= 30);

  assert.ok(tutorialData.projects.some((project) => project.status === "completed"));
  assert.ok(tutorialData.projects.some((project) => project.status === "in progress"));
  assert.ok(tutorialData.projects.some((project) => project.status === "blocked"));
  assert.ok(tutorialData.projects.some((project) => project.permitNumber || project.scopeSummary));
  assert.ok(tutorialData.expenses.some((expense) => expense.classification === "potential basis addition"));
  assert.ok(tutorialData.expenses.some((expense) => expense.classification === "repair or maintenance"));
  assert.ok(tutorialData.expenses.some((expense) => expense.classification === "unclear / ask CPA"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "receipt"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "invoice"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "permit"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "payment record"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "warranty"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "photo"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "contract"));
  assert.ok(tutorialData.documents.some((document) => document.documentType === "plan or drawing"));
  assert.ok(TUTORIAL_STEPS.some((step) => /backup/i.test(`${step.title} ${step.summary}`)));
  assert.ok(TUTORIAL_STEPS.some((step) => /export/i.test(`${step.title} ${step.summary}`)));
  assert.equal(TUTORIAL_STEPS.some((step) => /CPA/i.test(`${step.title} ${step.summary}`)), false);
});

test("tutorial data is safe sample data and can be exported without file payloads", () => {
  const tutorialData = createTutorialData();
  const sanitizedAgain = sanitizeData(tutorialData);
  const serialized = JSON.stringify(sanitizedAgain);

  assert.deepEqual(sanitizedAgain, tutorialData);
  assert.equal(tutorialData.documents.every((document) => !document.hasFile && !document.fileId), true);
  assert.equal(serialized.includes("/Users/"), false);
  assert.equal(serialized.includes("file://"), false);

  const csv = buildExpensesCsv(tutorialData);
  assert.match(csv, /Maple Street Home/);
  assert.match(csv, /Portland Tile Co\./);

  const backup = createBackupEnvelope(tutorialData, [], []);
  const restored = validateBackupEnvelope(backup);
  assert.deepEqual(restored.data, tutorialData);
  assert.deepEqual(restored.files, []);
});

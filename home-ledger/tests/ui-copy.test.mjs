import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSourcePromise = readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
const styleSourcePromise = readFile(new URL("../frontend/styles.css", import.meta.url), "utf8");
const readmePromise = readFile(new URL("../README.md", import.meta.url), "utf8");
const desktopPackagePromise = readFile(new URL("../desktop/package.json", import.meta.url), "utf8");
const websiteSourcePromises = [
  "../website/index.html",
  "../website/how-it-works/index.html",
  "../website/faq/index.html",
  "../website/download/index.html",
  "../website/privacy/index.html",
].map((filePath) => readFile(new URL(filePath, import.meta.url), "utf8"));

test("calculator surfaces use homeowner labels and sale estimate caveat", async () => {
  const source = await appSourcePromise;

  for (const copy of [
    "Sale Estimate Worksheet",
    "Estimated cash before taxes",
    "Estimated gain before tax review",
    "Basis estimate used",
    "Optional home-sale exclusion assumption",
    "Review-later amounts tracked separately",
    "This is an organizing estimate only. It does not determine taxes owed, exclusion eligibility, depreciation, state taxes, or professional treatment.",
  ]) {
    assert.ok(source.includes(copy), `missing calculator copy: ${copy}`);
  }

  for (const oldCopy of ["Sales Calculator", "Cash before tax", "Potential taxable gain", "Adjusted basis estimate", "Main-home exclusion"]) {
    assert.equal(source.includes(oldCopy), false, `old calculator copy remains: ${oldCopy}`);
  }
});

test("project cost planner is a current-session worksheet and does not create budget items", async () => {
  const source = await appSourcePromise;
  const plannerStart = source.indexOf("function renderProjectCostCalculator()");
  const plannerEnd = source.indexOf("function renderRecordsToFinishPanel", plannerStart);
  const plannerSource = source.slice(plannerStart, plannerEnd);

  assert.ok(plannerSource.includes("This worksheet is for the current session only."));
  assert.ok(plannerSource.includes("does not save a project budget"));
  assert.equal(/budget(s|Id|Records|Storage|Entity)/.test(plannerSource.replace("project budget", "")), false);
});

test("export and backup page labels frame output as review packet and full backup", async () => {
  const source = await appSourcePromise;

  for (const copy of [
    "Export for review",
    "Backup and restore",
    "Review packet PDF",
    "Download review packet",
    "Download expense CSV",
    "Items to review before sharing",
    "Full backup",
  ]) {
    assert.ok(source.includes(copy), `missing export/backup copy: ${copy}`);
  }

  assert.equal(source.includes("Professional review PDF"), false);
  assert.equal(source.includes("Download/save professional review PDF"), false);
});

test("restore confirmation names workspace, counts, attached files, and replacement scope", async () => {
  const source = await appSourcePromise;
  const restoreStart = source.indexOf("function buildRestorePreviewMessage");
  const restoreEnd = source.indexOf("function getRecordCounts", restoreStart);
  const restoreSource = source.slice(restoreStart, restoreEnd);

  for (const copy of [
    "Workspace affected:",
    "Real home file",
    "Tutorial workspace",
    "Items to restore:",
    "Attached files:",
    "Files may be skipped:",
    "Current saved items that will be replaced:",
    "Choose OK to restore, or Cancel to keep the current workspace unchanged.",
  ]) {
    assert.ok(restoreSource.includes(copy), `missing restore confirmation copy: ${copy}`);
  }

  assert.ok(source.includes("Backup restored into the tutorial workspace only."));
  assert.ok(source.includes("This will replace the temporary tutorial workspace only. Your real home file will not be changed."));
});

test("tutorial mode source keeps sample items scoped away from real home file", async () => {
  const source = await appSourcePromise;

  assert.equal(source.includes("ENABLE_TEMP_SAMPLE_RECORDS"), false);
  assert.equal(source.includes("withTemporarySampleRecords"), false);
  assert.equal(source.includes("temp_sample_"), false);
  assert.ok(source.includes("realData = data;"));
  assert.ok(source.includes("workspaceMode = WORKSPACE_TUTORIAL;"));
  assert.ok(source.includes("tutorialData = sanitizeData(data);"));
  assert.ok(source.includes("workspaceMode = WORKSPACE_REAL;"));
  assert.ok(source.includes("data = realData;"));
  assert.ok(source.includes("if (isTutorialMode()) {\n    tutorialData = data;\n    render();\n    return true;\n  }"));
  assert.ok(source.includes("oldFileIds = isTutorialMode() ? [] : await getExistingDocumentFileIds();"));
  assert.ok(source.includes("restored = isTutorialMode()\n      ? prepareTutorialBackupRestore(backup)\n      : await prepareBackupRestore(backup);"));
});

test("tutorial UI copy names workspace scope and simulated file details", async () => {
  const source = await appSourcePromise;

  for (const copy of [
    "Tutorial workspace",
    "Sample items only",
    "Open a separate sample workspace. Your real home file stays unchanged.",
    "Reset the tutorial workspace back to the original sample items? Your real home file will not be changed.",
    "Backup restored into the tutorial workspace only.",
    "Sample file details have no real file to preview.",
    "Sample file details have no real file to download.",
    "Sample file details only. No file content was included.",
  ]) {
    assert.ok(source.includes(copy), `missing tutorial copy: ${copy}`);
  }
});

test("document attachment form uses compact business copy", async () => {
  const source = await appSourcePromise;
  const formStart = source.indexOf("function renderDocumentForm(");
  const formEnd = source.indexOf("function renderRecentExpenseTable", formStart);
  const modalStart = source.indexOf("function renderDocumentFormModal(");
  const modalEnd = source.indexOf("function renderContextBanner", modalStart);
  const actionsStart = source.indexOf("function documentFormActions(");
  const actionsEnd = source.indexOf("function scoreToneName", actionsStart);
  const formSource = `${source.slice(formStart, formEnd)}\n${source.slice(modalStart, modalEnd)}\n${source.slice(actionsStart, actionsEnd)}`;

  for (const copy of [
    "Add document",
    "Edit document",
    "Attach file",
    "Linked expense",
    "Changing the expense will update the property and project.",
    "Type",
    "Document date",
    "File",
    "PDF, image, receipt, invoice, permit, or note. Maximum file size:",
    "Optional. Uses file name if blank.",
    "Delete document",
    "Save document",
  ]) {
    assert.ok(formSource.includes(copy), `missing document form copy: ${copy}`);
  }

  for (const oldCopy of [
    "Expense support",
    "Attaching file for",
    "Saving keeps you anchored",
    "Related expense",
    "Document type",
    "Added date",
    "Leave this blank to use the attached file name.",
    "browser storage",
    "local storage",
    "on this Mac",
  ]) {
    assert.equal(formSource.includes(oldCopy), false, `old document form copy remains: ${oldCopy}`);
  }
});

test("dashboard uses filtered recent activity and a needs attention subtab", async () => {
  const source = await appSourcePromise;
  const dashboardStart = source.indexOf("function renderDashboard()");
  const dashboardEnd = source.indexOf("function renderDashboardSummaryRow", dashboardStart);
  const dashboardSource = source.slice(dashboardStart, dashboardEnd);

  for (const marker of [
    "Recent activity",
    "Needs attention",
    'data-action="set-dashboard-subtab"',
    'data-dashboard-subtab="${DASHBOARD_TAB_ATTENTION}"',
    'renderFilter("Activity type", "dashboard.activityType"',
    "renderDashboardActivityTable",
    "getDashboardActivityItems",
    'data-dashboard-open="true"',
    'const stayOnDashboard = actionButton.dataset.dashboardOpen === "true";',
    "renderFollowUpActionTable",
    "follow-up-record-table",
  ]) {
    assert.ok(dashboardSource.includes(marker) || source.includes(marker), `missing dashboard marker: ${marker}`);
  }

  assert.ok(source.includes('{ value: "project", label: "Projects" }'));
  assert.ok(source.includes('{ value: "expense", label: "Expenses" }'));
  assert.ok(source.includes('{ value: "document", label: "Documents" }'));
  assert.equal(dashboardSource.includes('renderPanelHeader("Recent expenses"'), false);
  assert.equal(dashboardSource.includes('renderPanelHeader("Recent documents"'), false);
  assert.equal(dashboardSource.includes("dashboard-side-grid"), false);
});

test("interactive surfaces expose keyboard, dialog, and validation semantics", async () => {
  const source = await appSourcePromise;
  const styles = await styleSourcePromise;

  for (const marker of [
    'app.addEventListener("keydown", handleKeydown);',
    "function handleTablistKeydown(event)",
    'tabindex="${activeTab === tab.id ? "0" : "-1"}"',
    'data-action="toggle-project-followups"',
    'aria-controls="project-followups-${escapeAttr(project.id)}"',
    'aria-controls="dashboard-activity-panel"',
    'aria-controls="dashboard-attention-panel"',
    'aria-controls="calculator-panel-${escapeAttr(id)}"',
    "function syncModalFocus()",
    "function trapDialogFocus(event, dialog)",
    "'[role=\"dialog\"][aria-modal=\"true\"]'",
    'aria-describedby="records-to-finish-summary"',
    "Override and mark complete",
    "field-error-message",
  ]) {
    assert.ok(source.includes(marker), `missing accessibility marker: ${marker}`);
  }

  for (const marker of [
    "summary:focus-visible",
    "[tabindex]:focus-visible",
    ".field .field-error-message",
    ".table-wrap:focus-within",
  ]) {
    assert.ok(styles.includes(marker), `missing accessibility style: ${marker}`);
  }
});

test("public copy avoids stale tax-planning and old label framing", async () => {
  const source = await appSourcePromise;
  const readme = await readmePromise;
  const desktopPackage = await desktopPackagePromise;
  const websiteSources = await Promise.all(websiteSourcePromises);
  const publicCopy = [source, readme, desktopPackage, ...websiteSources].join("\n");

  for (const prohibitedCopy of [
    "IRS-ready",
    "audit-proof",
    "legal-grade",
    "guaranteed tax savings",
    "guaranteed deductions",
    "bank-grade security",
    "professionally certified",
    "Sales Calculator",
    "Professional review PDF",
    "Potential taxable gain",
    "Adjusted basis estimate",
    "Main-home exclusion",
    "Cash before tax",
    "Completeness override note",
    "manual override",
    "Record gaps",
  ]) {
    assert.equal(publicCopy.includes(prohibitedCopy), false, `stale or prohibited copy remains: ${prohibitedCopy}`);
  }

  assert.equal(readme.includes("classification"), false, "README should use cost type wording");
  assert.equal(websiteSources.some((html) => html.includes("classification")), false, "website should use cost type wording");
  assert.equal(/CPA review|professional review/.test(publicCopy), false, "public copy should prefer review packet wording");
});

test("website copy avoids technical product language", async () => {
  const websiteSources = await Promise.all(websiteSourcePromises);
  const websiteCopy = websiteSources.join("\n");

  for (const prohibitedCopy of [
    "local-first",
    "telemetry",
    "third-party APIs",
    "app-managed storage",
    "encoded attachments",
    "record treatment",
    "documentation status",
    "document metadata",
    "record structure",
    "review conversation",
    "Mac",
    "macOS",
    "iOS",
    "on your device",
    "on your Mac",
    "local storage",
    "cloud sync",
    "usage tracking",
    "upload files",
  ]) {
    assert.equal(websiteCopy.includes(prohibitedCopy), false, `technical website copy remains: ${prohibitedCopy}`);
  }
  assert.ok(websiteCopy.includes("Backup basics"));
  assert.ok(websiteCopy.includes("Keep a second copy of important home paperwork."));
});

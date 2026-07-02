import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportMigrationView } from "../src/import/ImportMigrationPage";

describe("Import and Migration screen", () => {
  it("renders the migration beta sections with direct unavailable status", () => {
    const html = renderToStaticMarkup(
      <ImportMigrationView onNavigate={() => undefined} workspaceName="Home records" />
    );

    expect(html).toContain("Import and migration");
    expect(html).toContain("Migration overview");
    expect(html).toContain("What can be prepared");
    expect(html).toContain("Current status");
    expect(html).toContain("Recommended preparation");
    expect(html).toContain("Import controls");
    expect(html).toContain("earlier local app");
    expect(html).toContain("Automated import is unavailable in this beta");
    expect(html).toContain("does not upload, parse, merge, or replace records");
  });

  it("names preparable record areas without promising completed migration", () => {
    const html = renderToStaticMarkup(
      <ImportMigrationView onNavigate={() => undefined} workspaceName="Home records" />
    );

    expect(html).toContain("Properties");
    expect(html).toContain("Projects");
    expect(html).toContain("Expenses");
    expect(html).toContain("Vendors");
    expect(html).toContain("Documents and file references");
    expect(html).toContain("Notes and review statuses");
    expect(html).not.toContain("Import complete");
    expect(html).not.toContain("Automatically migrate");
  });

  it("renders disabled future import controls instead of fake upload behavior", () => {
    const html = renderToStaticMarkup(
      <ImportMigrationView onNavigate={() => undefined} workspaceName="Home records" />
    );

    expect(html).toContain("type=\"file\"");
    expect(html).toContain("accept=\"application/json,.json\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Review import");
    expect(html).toContain("File import is unavailable in this beta.");
    expect(html).not.toContain("Uploading");
    expect(html).not.toContain("Processing backup");
  });

  it("keeps product language neutral and avoids sensitive implementation details", () => {
    const html = renderToStaticMarkup(
      <ImportMigrationView onNavigate={() => undefined} workspaceName="Home records" />
    ).toLowerCase();

    for (const blocked of ["deductible", "irs-ready", "tax-safe", "audit-proof", "tax-optimized", "legal-ready"]) {
      expect(html).not.toContain(blocked);
    }

    for (const sensitive of ["storage_key", "signed url", "download_url", "/users/", "raw ocr text", "provider internal"]) {
      expect(html).not.toContain(sensitive);
    }
  });
});

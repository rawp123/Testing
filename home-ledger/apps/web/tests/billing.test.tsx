import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardResponse } from "../src/api/types";
import { BillingPlanView } from "../src/billing/BillingPlanPage";

describe("Billing and Plan screen", () => {
  it("renders the billing beta sections with direct unavailable status", () => {
    const html = renderToStaticMarkup(
      <BillingPlanView
        dashboard={createDashboard()}
        onNavigate={() => undefined}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Billing and plan");
    expect(html).toContain("Current plan");
    expect(html).toContain("Usage snapshot");
    expect(html).toContain("Plan actions");
    expect(html).toContain("Plan limits");
    expect(html).toContain("Account and data note");
    expect(html).toContain("Plan details are unavailable in this beta");
    expect(html).toContain("does not collect payment or change workspace access");
  });

  it("renders safe usage counts from the dashboard summary", () => {
    const html = renderToStaticMarkup(
      <BillingPlanView
        dashboard={createDashboard()}
        onNavigate={() => undefined}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Properties");
    expect(html).toContain("2");
    expect(html).toContain("Documents");
    expect(html).toContain("7");
    expect(html).toContain("Files attached");
    expect(html).toContain("4");
    expect(html).toContain("Text extracted");
    expect(html).toContain("3");
    expect(html).toContain("Downloads ready");
  });

  it("renders disabled future billing controls instead of fake payment behavior", () => {
    const html = renderToStaticMarkup(
      <BillingPlanView
        dashboard={createDashboard()}
        onNavigate={() => undefined}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Manage plan");
    expect(html).toContain("Update payment");
    expect(html).toContain("View invoices");
    expect(html).toContain("Change plan");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("These controls are unavailable in this beta.");
    expect(html).not.toContain("Checkout");
    expect(html).not.toContain("Customer portal");
  });

  it("keeps functionality language separate from beta plan state", () => {
    const html = renderToStaticMarkup(
      <BillingPlanView
        dashboard={createDashboard()}
        onNavigate={() => undefined}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Current record screens stay available in this beta.");
    expect(html).toContain("Billing controls are separate from record organization, document files, and exports.");
    expect(html).toContain("Open export");
    expect(html).toContain("Open import");
  });

  it("keeps product billing language neutral and avoids sensitive implementation details", () => {
    const html = renderToStaticMarkup(
      <BillingPlanView
        dashboard={createDashboard()}
        onNavigate={() => undefined}
        workspaceName="Home records"
      />
    ).toLowerCase();

    for (const blocked of ["deductible", "irs-ready", "tax-safe", "audit-proof", "tax-optimized", "legal-ready"]) {
      expect(html).not.toContain(blocked);
    }

    for (const overclaim of [
      "active subscription",
      "payment processed",
      "invoice paid",
      "stripe connected",
      "cancellation complete",
      "refund issued"
    ]) {
      expect(html).not.toContain(overclaim);
    }

    for (const sensitive of [
      "storage_key",
      "signed url",
      "download_url",
      "/users/",
      "raw ocr text",
      "provider internal",
      "billing provider"
    ]) {
      expect(html).not.toContain(sensitive);
    }
  });
});

function createDashboard(): DashboardResponse {
  return {
    workspace_id: "workspace-1",
    generated_at: "2026-06-08T12:00:00.000Z",
    properties: { count: 2, active_count: 2, archived_count: 0 },
    projects: { count: 5, active_count: 5, archived_count: 0, by_status: [], open_follow_up_count: 1 },
    expenses: {
      count: 8,
      total_amount_cents: 123456,
      by_classification: [],
      review_later_count: 1,
      possible_improvement_total_cents: 100000,
      repair_upkeep_total_cents: 23456
    },
    documents: {
      count: 7,
      with_file_count: 4,
      missing_file_count: 3,
      ocr_text_available_count: 3,
      ocr_pending_count: 1,
      by_type: []
    },
    vendors: { count: 4 },
    recent_activity: [],
    follow_ups: []
  };
}

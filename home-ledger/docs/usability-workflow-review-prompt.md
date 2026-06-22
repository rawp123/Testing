# Home Basis Tracker Usability Review Prompt

Use this document as a paste-ready prompt for a comprehensive usability review of Home Basis Tracker. Review the app like a practical UX/product reviewer for a private Mac utility. Focus on whether real homeowners can understand what to do, finish incomplete details without confusion, and recover from missing information.

## Review Request

You are reviewing **Home Basis Tracker**, a private home paperwork app. It helps a homeowner track properties, projects, expenses, vendors, documents, calculators, exports, backups, and items to finish.

Please perform an exhaustive usability review of the workflows below. Evaluate:

- Whether each workflow is understandable without training.
- Whether the user knows what to do next.
- Whether labels, actions, and navigation match the user’s mental model.
- Whether important actions are discoverable without clutter.
- Whether there are redundant, confusing, or misplaced concepts.
- Whether empty states, missing data states, and follow-up states are clear.
- Whether tutorial/sample items are clearly separated from the real home file.
- Whether private/local behavior is respected without overexplaining security.
- Whether calculators feel useful, constrained, and not like tax advice.
- Whether the app feels like a polished local Mac utility rather than a generic dashboard.

Output your review in this format:

1. **Top usability risks**: ranked by severity.
2. **Navigation and information architecture feedback**.
3. **Workflow-by-workflow feedback**.
4. **Copy and labeling issues**.
5. **Missing or awkward empty states**.
6. **Recommended targeted improvements**: grouped into quick wins, medium changes, and avoid/do not do.
7. **Questions to resolve before further development**.

Avoid recommending broad redesigns unless a workflow is fundamentally broken. Prefer targeted improvements that preserve the current app direction.

## Product Context

Home Basis Tracker is for homeowners who want one place for home improvement costs, documents, vendors, projects, and property details. The app is intended to help them organize information for later reference and review. It should not give tax advice or imply guaranteed deductions, tax-agency acceptance, audit protection, or legal conclusions.

The app is private and local. The real home file and attached documents are stored locally in the app/browser environment. The tutorial workspace uses sample data and should remain separate from the real home file.

## Current Navigation

Primary tabs:

- Dashboard
- Property
- Projects
- Expenses
- Documents
- Calculators
- Export & backup
- Tutorial

The sidebar shows the app brand and tab navigation. The app currently avoids page eyebrow labels and page subtitles. Page headers should generally show the page title only.

## Global Data Model

The app stores:

- Vendors
- Properties
- Projects
- Expenses
- Documents

Important relationships:

- Each project belongs to a property.
- Each expense belongs to a property and may belong to a project.
- Each expense should be linked to a vendor or remain unassigned when unknown.
- Each document belongs to a property and may link to a project and/or expense.
- Documents may have stored files, sample file details, missing files, OCR text, and notes.
- One property can be marked primary and should sort first.
- Tutorial data must stay separate from real home file.

## Key App Principles To Preserve

- Keep the real home file separate from tutorial items.
- Keep document viewing and document attachment workflows easy to find.
- Keep the dashboard simple and scannable.
- Avoid AI-ish labels, pill-heavy styling, and excessive explanatory banners.
- Avoid giving tax advice.
- Avoid overusing local/security claims.
- Keep functions in the current tabs; do not create new routes unless clearly needed.
- Preserve export, backup, restore, storage, and local document behavior.

## Workflow 1: First Launch / Empty Real Workspace

Starting state:

- No real properties, projects, expenses, or documents.
- Dashboard shows an onboarding panel.
- User can add a property or open the tutorial.
- The app should not automatically mix sample items into real home file.

User paths:

- User launches app with no saved items.
- User sees Home Basis Tracker and the main tabs.
- User chooses **Add your property**.
- User chooses **Open tutorial**.
- User navigates directly to Property, Projects, Expenses, Documents, Calculators, Export, or Tutorial before adding a property.

Review questions:

- Is the first action obvious?
- Does the user understand that a property is the first real item needed?
- Are disabled states on add-project/add-expense/add-document understandable when no property exists?
- Does the app avoid making the empty state feel broken?

## Workflow 2: Tutorial Workspace

Tutorial tab states:

- Before starting tutorial: shows a prompt to start sample workspace.
- In tutorial mode: app brand/sidebar indicates tutorial/sample workspace.
- Tutorial includes sample properties, projects, expenses, documents, and workflows.
- Tutorial changes are temporary or scoped to tutorial items.
- Reset tutorial restores original sample items.
- Exit tutorial returns to real home file.

Tutorial paths:

- Start tutorial workspace.
- Open guided tutorial steps.
- Navigate from a tutorial step to a specific tab.
- Add/edit/delete tutorial properties, projects, expenses, documents.
- Try document workflows with sample file details.
- Export tutorial data.
- Restore a backup while in tutorial, affecting tutorial only.
- Reset tutorial.
- Exit tutorial back to real home file.

Review questions:

- Is tutorial separation clear without being wordy?
- Does tutorial mode look different enough from the real workspace?
- Are reset and exit actions understandable?
- Are simulated files clearly explained without overwhelming the user?
- Could a user accidentally think tutorial items are real?

## Workflow 3: Dashboard

Dashboard current structure:

- Page title: **Your home paperwork**.
- Summary row: properties, projects, expenses, total spend.
- Top grid: **Properties** and **Recent expenses** side by side on desktop.
- **Properties** block:
  - Shows property rows collapsed by default.
  - Primary property appears first.
  - Property row shows property name, address, total spend, and expand control.
  - Expanded row shows projects, expenses, documents, potential basis, and project spend rows.
- **Recent expenses** block:
  - Shows latest expenses.
- Below top grid: compact **Items to finish** entry point.
  - Collapsed by default.
  - Summary shows follow-up count, spend missing support, and needs-review amount.
  - Expanded view shows follow-up metrics and specific fixable items.
  - Fix actions can navigate to add document, edit expense, fix document, open property, or edit project.

Dashboard user paths:

- Review high-level totals.
- Expand a property.
- Collapse a property.
- Open Items to finish.
- Use a follow-up action to navigate to the appropriate tab/form.
- Review recent expenses.
- Navigate to another tab for deeper work.

Review questions:

- Does the dashboard feel like a useful summary rather than a generic admin page?
- Are Properties and Recent expenses correctly prioritized at the top?
- Does **Items to finish** feel clear without making the dashboard too busy?
- Are collapsed states discoverable?
- Do follow-up action labels clearly indicate where they will take the user?
- Does the dashboard avoid too much text?
- Is total spend clear in the property block?
- Is it okay that Recent expenses is beside Properties rather than below?

## Workflow 4: Property Setup

Property tab:

- Add property.
- Select an existing property.
- Inline edit property name, address, purchase date, purchase price, and notes.
- Mark one property as primary.
- Primary property sorts first.
- Delete property.
- Add project, expense, or document from selected property.
- View property file overview:
  - tracked spend
  - potential basis
  - open projects
  - documents
  - project list
  - recent expenses
  - items to finish for that property

Property paths:

- Add first property.
- Add additional property.
- Set property as primary.
- Switch selected property.
- Inline edit individual property fields.
- Delete property.
- Add project from property.
- Add expense from property.
- Add document from property.
- Open a project preview from the property project list.

Project preview modal from property:

- Open project details.
- See project metrics, documents, expenses, and gaps.
- Edit project details.
- Add expense for project.
- Add document for project.
- Close preview.

Review questions:

- Is “primary property” understandable?
- Is setting primary discoverable without clutter?
- Does the property overview become too long?
- Is the project preview modal a good way to avoid long property pages?
- Are “property” and “home file” labels clear?
- Does delete property feel appropriately careful?

## Workflow 5: Projects

Projects tab:

- Add project.
- Manage vendors.
- Filter projects by property, status, category.
- Expand all projects.
- Collapse all projects.
- Each project can be clicked to expand or collapse.
- Valid state: all projects collapsed.
- Expanded project shows editable fields, linked items, and completeness information.

Project fields:

- Property
- Name
- Category
- Vendor
- Start date
- Completion date
- Permit number
- Status
- Scope summary
- Notes
- Mark as complete with note

Vendor manager:

- Opens as modal/panel from Projects.
- Add vendor.
- Edit vendor.
- Archive or mark active.
- Vendor details include category, contact name, phone, email, website, notes.
- Vendors can be assigned to projects and expenses.

Project completeness:

- Shows whether project has enough context/documents.
- User can mark a project complete with a note.
- The note should be understandable as a practical completion marker, not a guarantee.
- Follow-up items include missing documents, unclear expenses, vendor/date/scope gaps.

Project paths:

- Add project with required fields.
- Add vendor while creating/editing a project.
- Assign existing vendor to project.
- Expand a project.
- Collapse a project.
- Expand all.
- Collapse all.
- Edit project fields inline.
- Add a Mark as complete with note.
- Add expense from project.
- Add document from project.
- Delete project.

Review questions:

- Is project expansion/collapse behavior obvious?
- Does the all-collapsed state feel valid?
- Is vendor management placed correctly inside Projects?
- Is the vendor manager too hidden or too prominent?
- Does project completeness feel helpful or bureaucratic?
- Is the Mark as complete with note understandable and safe?
- Are project details too dense?

## Workflow 6: Expenses

Expenses tab:

- Add expense.
- Edit expense.
- Delete expense.
- Filter by property, project, expense type, category, document status.
- Sort by newest, oldest, amount high-to-low, amount low-to-high.
- View expense cards/list.
- Each expense shows date, vendor, description, amount, property/project details, document state, cost type, category, and document status.
- Expense can link to a vendor.
- Expense can link to a project.
- Expense can link to documents.

Expense fields:

- Property
- Project
- Vendor
- Date
- Description
- Amount
- Cost type:
  - Possible improvement
  - Repair / upkeep
  - Not sure, review later
- Category
- Receipt/file status
- Notes

Expense/document paths:

- Add expense from Expenses tab.
- Add expense from Property tab.
- Add expense from Project modal.
- Edit an expense.
- Attach document to expense.
- View documents linked to expense.
- Add document when expense is missing support.
- Fix expense through Items to finish.
- Change property/project and see project/vendor options update.
- Add vendor from expense form.

Review questions:

- Is the difference between expense cost type and category clear?
- Is “Not sure, review later” useful without feeling scary?
- Is the vendor requirement practical?
- Can users easily attach invoices/receipts to expenses?
- Does the document state make sense?
- Are filters useful or too many?
- Does the expense card layout make the main scan path clear?

## Workflow 7: Documents

Documents tab:

- Two subtabs:
  - All documents
  - Needs follow-up
- Add document.
- Edit document.
- Delete document.
- Filter documents by property, document type, and file status.
- View document list.
- View document file in reader/preview.
- Download document file.
- Remove document file.
- Run OCR/read text when supported.
- Save document preview notes.

Document fields:

- Property
- Project
- Expense
- Display name
- Document type
- Added date
- File
- Notes

Document file states:

- No file attached.
- File attached.
- Sample file details.
- File needs follow-up.
- Restored backup item without file content.

All documents subtab:

- Shows clean document list.
- Each document shows type/date, property/project/expense relationships, file status, notes, and actions.
- Documents with files can be viewed.

Needs follow-up subtab:

- Shows expenses needing documentation attention.
- Shows document entries missing files.
- Should avoid double-counting confusion.
- Provides actions to add documents or fix document entries.

Document reader paths:

- Open document preview from document list.
- View image/PDF/text-capable file.
- Download file.
- Run OCR/read text.
- Save notes from preview.
- Close preview.
- Handle unsupported/missing/tutorial file.

Review questions:

- Is the All documents / Needs follow-up split clear?
- Is document viewing discoverable enough?
- Does the user understand when a document entry exists but the file is missing?
- Are follow-up items grouped clearly?
- Can users easily link invoices/receipts to expenses?
- Does the reader feel reliable?
- Are file storage constraints explained only where needed?

## Workflow 8: Calculators

Calculators tab:

- Uses a calculator menu rather than rendering all calculators at once.
- Current calculators:
  - Sale Estimate Worksheet
  - Basis Summary
  - Project Cost Planner
- Only one calculator displays at a time.
- Item follow-up summary is not in Calculators; it lives on Dashboard as Items to finish.

Sale Estimate Worksheet:

- Select property.
- Enter expected sale price.
- Enter mortgage payoff.
- Enter selling costs percentage.
- Optionally override selling costs amount.
- Select optional home-sale exclusion assumption:
  - do not apply
  - $250,000 single
  - $500,000 married filing jointly
- Results:
  - Estimated cash before taxes
  - Estimated gain before tax review
  - Purchase price
  - Included basis additions
  - Estimated selling costs
  - Basis estimate used
  - Gain before exclusion
  - Needs-review costs not included
- Copy clarifies it does not estimate taxes owed, depreciation, state taxes, or qualification.

Basis Summary:

- Select property.
- Shows basis estimate.
- Shows needs-review amount.
- Breaks down purchase price, possible improvements, repair/upkeep, projects, expenses, documents.
- Shows project-level totals when spending exists.

Project Cost Planner:

- Select property.
- Optionally compare to project.
- Enter materials, labor, permits/fees, other, contingency percentage.
- Shows planned total.
- Shows actual tracked spend if a project is selected.
- Shows remaining/over plan, subtotal, contingency.
- Current-session worksheet only; not a persisted project budget.

Review questions:

- Does the calculator menu reduce confusion?
- Are calculators clearly based on saved home details rather than generic financial tools?
- Is the Sale Estimate Worksheet safe and appropriately caveated?
- Should Project Cost Planner persist saved budgets, or is current-session okay?
- Are calculator names clear?
- Should Items to finish stay on Dashboard rather than Calculators?

## Workflow 9: Export & Backup

Export & backup tab:

- Create review packet.
- Print review summary.
- Download/save review packet PDF.
- Download expense CSV.
- Show saved item counts.
- Show backup notes.
- Create/download full backup.
- Restore from backup.
- Show backup session status.
- Show storage/document file counts.

Export paths:

- Export with no saved items.
- Export with properties/projects/expenses/documents.
- Export in tutorial mode.
- Download CSV when expenses exist.
- Save review packet PDF.
- Print review summary.
- View export preview tables:
  - properties
  - projects
  - expenses
  - items to review before sharing
  - documents
- Review readiness/follow-up checklist in export area.

Backup paths:

- Download/save full backup.
- Backup includes saved details and may include attached file contents.
- Backup may skip missing or unsupported files.
- Restore from backup.
- Confirm restore preview.
- Restore real workspace.
- Restore tutorial workspace only when in tutorial.
- Handle backup from newer version.
- Handle invalid backup.
- Handle unsafe/blocked file types.
- Handle files too large.
- Handle checksum mismatch.
- Handle storage quota or restore failure.
- Cleanup old document files after restore.

Review questions:

- Is Export & backup too broad for one tab?
- Does the user understand the difference between review export and full backup?
- Are backup consequences clear before restore?
- Are tutorial backups/restores clearly scoped?
- Are failure messages actionable?
- Is “review packet PDF” clear and natural?
- Is CSV discoverable enough?

## Workflow 10: Restore And Data Safety Edge Cases

Important states:

- Records fail to load.
- Saves are paused to avoid overwriting data.
- User must restore backup or reopen app.
- Backup restore requires confirmation.
- Restored documents may lack file content.
- Restored files may be skipped.
- Browser/local storage may be full.
- Desktop app stores files differently from browser mode.

Review questions:

- Does save-paused state explain what happened without panic?
- Does restore confirmation provide enough detail?
- Are skipped/missing files visible after restore?
- Are users guided to fix document entries after restore?

## Workflow 11: Tutorial Vs Real Workspace

Separation rules:

- Starting tutorial switches into tutorial workspace.
- Real home file are preserved while tutorial is active.
- Tutorial data can be reset.
- Tutorial backups contain sample items.
- Restoring while in tutorial replaces tutorial data only.
- Tutorial file actions are simulated details only.
- Exiting tutorial returns to real home file.

Review questions:

- Is mode switching obvious?
- Is tutorial mode visually distinct but not noisy?
- Can a user accidentally restore tutorial data into real home file?
- Is it clear when file actions are simulated?

## Workflow 12: Cross-Tab Follow-Up Repair Paths

Items to finish on Dashboard can point users to:

- Add document for an expense.
- Edit expense to add vendor or fix cost type.
- Edit document to attach/fix file.
- Open property to add purchase date/price.
- Edit project to add dates or notes.

Needs follow-up in Documents can point users to:

- Add document for an expense.
- Edit expense.
- Fix document file entry.

Project completeness can point users to:

- Add document for project.
- Edit project fields.
- Add a Mark as complete with note.

Review questions:

- Are these follow-up paths consistent across Dashboard, Documents, Projects, and Export?
- Does the user know whether a fix changes data or just opens a form?
- Are follow-up items too repetitive across tabs?
- Is the app guiding the user toward the best next action?

## Workflow 13: Vendors

Vendor system:

- Vendors are managed from Projects.
- Vendors are reused across projects and expenses.
- Expense forms can add vendors.
- Project forms can add vendors.
- Vendor status can be active or archived.
- Legacy project contractor and expense vendor names can be normalized into shared vendors.

Vendor paths:

- Manage vendors from Projects tab.
- Add vendor.
- Edit vendor.
- Archive vendor.
- Assign vendor to project.
- Assign vendor to expense.
- Leave vendor unassigned/unknown when needed.
- Fix missing vendor from Items to finish.

Review questions:

- Is vendor management discoverable enough?
- Does it make sense that vendors live under Projects rather than a top-level Vendor tab?
- Is “Unassigned / unknown” acceptable for incomplete expense capture?
- Does vendor linking feel mandatory in a helpful way or burdensome?

## Workflow 14: Primary Property

Primary property behavior:

- User can set one property as primary.
- Primary property sorts first.
- Primary label appears near the property name.
- Dashboard and selectors should show the primary property first.

Review questions:

- Is “Primary” clear enough?
- Should setting primary be in the property form, property action bar, or both?
- Does primary sorting surprise users with multiple properties?

## Workflow 15: Navigation And State Persistence

Navigation behavior:

- Sidebar tabs switch main content.
- Editing forms/modal states generally close on tab change.
- Dashboard property rows start collapsed.
- Project rows can all be collapsed.
- Calculator selection is current-session UI state.
- Sales calculator inputs are current-session UI state.
- Project cost planner inputs are current-session UI state.
- Real data persists locally through records storage.
- Tutorial data is temporary/scoped.

Review questions:

- Are unsaved worksheet inputs disappearing acceptable?
- Should calculator inputs persist?
- Are forms closing on navigation expected?
- Does tab state feel predictable?

## Workflow 16: Search, Filters, And Sorting

Existing controls:

- Project filters: property, status, category.
- Expense filters: property, project, expense type, category, docs, sort.
- Document filters: property, type, file status.
- Property selector.
- Calculator property selectors.

Review questions:

- Are filters too much for the scale of the app?
- Are filter labels human enough?
- Are reset/empty filtered states clear?
- Should there be global search, or is tab-level filtering enough?

## Workflow 17: Empty, Partial, And Error States

Important empty states:

- No properties.
- No projects.
- No expenses.
- No documents.
- No matching expenses after filtering.
- No matching documents after filtering.
- No projects for selected property.
- No document files.
- No stored files.
- No follow-ups.
- No calculator data.

Important partial states:

- Property exists without purchase details.
- Project exists without vendor, dates, scope, or documents.
- Expense exists without vendor.
- Expense marked documented but no linked stored document exists.
- Document entry exists without file.
- Backup restored saved details but not files.
- Tutorial file details exists but real file cannot be previewed/downloaded.

Review questions:

- Do empty states tell users what action to take next?
- Are partial states framed as normal/in-progress rather than errors?
- Are follow-up messages concrete?

## Workflow 18: Copy And Labeling Watchlist

Labels that need careful review:

- Home Basis Tracker
- Your home paperwork
- Properties
- Recent expenses
- Items to finish
- Total spend
- Possible improvement
- Repair / upkeep
- Not sure, review later
- Basis Summary
- Sale Estimate Worksheet
- Project Cost Planner
- Optional home-sale exclusion assumption
- Estimated cash before taxes
- Estimated gain before tax review
- Basis estimate
- Review packet PDF
- Export & backup
- Tutorial workspace

Avoid:

- Tax-agency readiness claims
- Audit-protection claims
- Legal-certainty claims
- Promised tax savings
- Bank-style security claims
- AI-sounding filler
- too many “private/local/security” claims

Review questions:

- Which labels are unclear to a homeowner?
- Which labels sound too technical or tax-advice-adjacent?
- Which labels should be more human?

## Workflow 19: Visual Design And Layout Concerns

Recent design preferences:

- Avoid pill/bubble styling for status labels.
- Avoid excessive subheadings under page titles.
- Keep dashboard simple.
- Use expandable/collapsed sections where detail is useful but not always needed.
- Keep cards compact and non-marketing-like.
- Preserve the current practical Mac utility direction.

Review questions:

- Does the interface now feel cleaner without subheadings?
- Are there places where removing subheadings created missing context?
- Are expand/collapse controls obvious?
- Are cards too numerous?
- Does the dashboard hierarchy work?

## Workflow 20: Accessibility And Interaction Review

Interaction elements:

- Sidebar tabs use tab roles.
- Document subtabs use tab-like buttons.
- Calculator menu uses tab-like buttons.
- Dashboard property rows are buttons with aria-expanded.
- Items to finish uses a clear disclosure or popout control.
- Forms should have labels.
- Modals should have dialog roles.
- Icon buttons should have aria-labels.

Review questions:

- Are keyboard interactions predictable?
- Are focus states visible?
- Are disclosure controls understandable to screen readers?
- Are tab semantics used correctly?
- Are icon-only buttons labeled?
- Are clickable cards distinguishable from static cards?

## Workflow 21: Mobile/Responsive Review

Responsive behavior:

- Sidebar becomes sticky/top horizontal tab row.
- Dashboard top grid stacks.
- Calculator menu collapses.
- Property rows stack.
- Tables may become horizontally scrollable or responsive.
- Document preview and modals should fit smaller screens.

Review questions:

- Is the app usable on laptop-sized windows?
- Does mobile layout preserve workflow clarity?
- Do buttons and labels wrap cleanly?
- Are document previews usable on small screens?
- Are wide tables acceptable?

## Workflow 22: Suggested Usability Test Tasks

Ask a reviewer to walk through these tasks:

1. Start with an empty app and add a property.
2. Add a second property and mark it primary.
3. Add a kitchen project for the primary property.
4. Add a vendor and assign it to the project.
5. Add an expense linked to the project and vendor.
6. Attach an invoice to that expense.
7. Open the document reader and view the invoice.
8. Add a document entry without a file and find it in Needs follow-up.
9. Use Dashboard Items to finish to fix a missing document.
10. Expand and collapse properties on the dashboard.
11. Expand and collapse projects in Projects.
12. Add a project Mark as complete with note.
13. Use Basis Summary for the property.
14. Use Sale Estimate Worksheet with a hypothetical sale price.
15. Use Project Cost Planner and compare against an actual project.
16. Export a CSV.
17. Create a full backup.
18. Restore a backup and inspect missing-file follow-ups.
19. Start tutorial mode, edit sample data, reset it, and exit.
20. Confirm the real home file was not affected by tutorial mode.

## Final Review Instruction

Please review all workflows above as one coherent product. Identify where the app is simple and clear, where it is cluttered or confusing, and where users may misunderstand the purpose of a field, status, or action. Prioritize recommendations that make the app easier to use without expanding scope or turning it into a tax-planning product.

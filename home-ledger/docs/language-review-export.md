# Home Basis Tracker Language Review Export

Generated: 2026-06-05

Purpose: one place to review website and product wording for phrases that feel too technical, database-like, tax-planning-oriented, SaaS-like, or AI-generated.

Scope notes:

- Website sections include page titles, meta descriptions, accessibility labels, and visible page text.
- App sections include source strings that are likely user-facing: headings, labels, empty states, help text, confirmation copy, export text, follow-up text, tutorial copy, and validation messages.
- The extractor intentionally filters implementation-only selectors, storage keys, CSS classes, import paths, MIME types, raw file extensions, and compatibility enum values where possible.
- Some source rows may still be fragments from templates. Treat this as a review inventory, not a final rendered transcript.

## Current Preferred Terms

| Area | Preferred wording |
| --- | --- |
| App/dashboard framing | Home paperwork, home file, saved details, items to finish |
| Expense type label | Cost type |
| Expense support label | Receipt/file status |
| Possible improvement option | Possible improvement |
| Repair option | Repair / upkeep |
| Review-later option | Not sure, review later |
| Export PDF | Review packet PDF |
| Sale worksheet | Sale Estimate Worksheet |
| Document file states | No file attached, File attached, Sample file details, File needs follow-up, Restored without the attached file |

## Compatibility Values Intentionally Left Alone

These values may appear in source or tests because they preserve existing saved data and backup compatibility. They should not be rewritten unless a migration is deliberately added.

- `potential basis addition`
- `repair or maintenance`
- `unclear / ask CPA`
- `payment record`

## Website Copy

### Home page

Source: `website/index.html`

**Page title:** Home Basis Tracker
**Meta description:** Home Basis Tracker is a private place on your Mac for home project receipts, invoices, permits, photos, notes, and costs.

**Accessibility / attribute copy:**

- aria-label: Home Basis Tracker home
- aria-label: Main navigation
- aria-label: Product highlights
- aria-label: Home project folder illustration
- aria-label: Privacy and export highlights
- aria-label: Download Home Basis Tracker

**Visible page text:**

- Home Basis Tracker
- How It Works
- Privacy
- FAQ
- Download
- Home project paperwork
- A private place on your Mac for home project receipts, invoices, permits, photos, and notes.
- Keep each home, project, cost, and file together so it is easier to find later.
- Download for Mac
- See how it works
- macOS 11+
- Apple Silicon and Intel
- No account required
- Property
- Maple Street Home
- Portland, OR
- Projects
- Kitchen remodel
- 2023
- Roof replacement
- 2022
- Deck railing
- 2021
- Receipt
- Portland Tile Co.
- $1,248.32
- Permit
- PR23-04567
- Issued 06/23/2023
- Invoice
- Northwest Builders
- $4,750.00
- Photos
- Before and after
- Kitchen
- Review Packet
- Jan 2023 - Jun 2023
- Total expenses
- $18,732.48
- Documents
- 28
- Building permit
- City of Portland
- Permit no. PR23-04567
- Project notes
- Open layout
- Quartz counters
- Soft-close cabinets
- No account
- No sign-up, login, or subscription flow to use the local app.
- Local storage
- Your project details and file copies are saved by the app on your Mac.
- Export anytime
- Create CSV files, printable summaries, and full backups when needed.
- Review packets
- Create a clean summary when you need to look things over or share them.
- What it tracks
- Add a home, group work by project, save costs, and attach receipts or permits.
- Properties
- Address, purchase date, purchase price, and notes for one or multiple homes.
- Categories, status, dates, contractors, vendors, and notes by improvement project.
- Expenses
- Date, vendor, description, amount, cost type, category, receipt/file status, and notes.
- Receipts, invoices, permits, photos, and related notes attached to the right project or cost.
- CSV export
- Export a spreadsheet of your costs, projects, vendors, categories, and notes.
- Printable summary
- Prepare a clean property and project summary for later review.
- Full backup
- Save a private backup file with your details and attached files.
- Restore
- Bring your home project information back from a trusted backup.
- Use it like a private home project folder that can also export clean summaries when you need them.
- Add a property
- Add the home and basic purchase details.
- Purchase date and notes
- Add projects
- Group improvements by project, category, and date range.
- Add costs
- Track expenses, vendors, cost types, and notes.
- $1,248.32 receipt
- Attach documents
- Keep receipts, invoices, permits, photos, and related files together.
- Receipts / Invoices / Permits
- Export for review
- Create a CSV, print a summary, or save a full backup.
- Review Summary
- Ready when you need it
- Kept on your device
- Home Basis Tracker does not create an account, upload files, sync to a cloud service, add usage tracking, or
- call outside services for your files. Your paperwork stays under your control.
- No cloud sync or file upload to our servers
- No usage tracking
- No outside services for your files
- Documents stay organized
- The Mac app saves attached files on your Mac. The browser version saves details and files in the browser
- you are using.
- CSV and print exports include project, cost, and file details
- Full backups can include private project details and attached files
- Local storage is not a backup, so export one regularly
- What it is not
- Home Basis Tracker helps organize home project paperwork. It does not make tax, legal, or professional decisions.
- Not tax software
- It does not calculate taxes, deductions, or basis.
- Not legal advice
- It does not provide legal or professional advice.
- Not cloud storage
- No cloud sync, no uploads, and no remote account.
- Not an automated deduction calculator
- You review, categorize, and decide how to use your costs and paperwork.
- Is this tax software?
- No. It is an organization app for home improvement paperwork.
- Does it upload my receipts?
- No. It does not upload receipts, invoices, permits, photos, or notes.
- Can I export a summary?
- Yes. You can export CSV files and printable summaries when you need to look things over or share them.
- What happens if I delete local data?
- Your saved details and files can be removed if app data or browser data is deleted. Export regular backups.
- Does it work offline?
- Yes. The app keeps information on your device and does not need an account or cloud connection.
- Good habits for your paperwork
- Add receipts and notes while the details are fresh.
- Scan or save supporting documents as PDFs or images.
- Back up your data regularly.
- Keep important project paperwork for as long as you own the property.
- Organize today. Be ready tomorrow.
- Keep home project paperwork together and make future review simpler.
- A private place for home project paperwork.
- Product
- Backups
- Support
- Questions
- Availability
- Your data stays yours.
- No cloud sync, no uploads, no usage tracking, and no outside services for your files. Back up your data regularly.
- (c) 2026 Home Basis Tracker. All rights reserved.
- Made with care for long-term home project paperwork.

### How It Works

Source: `website/how-it-works/index.html`

**Page title:** How It Works | Home Basis Tracker
**Meta description:** How Home Basis Tracker helps homeowners keep home project costs, receipts, permits, photos, notes, exports, and backups together.

**Accessibility / attribute copy:**

- aria-label: Home Basis Tracker home
- aria-label: Main navigation

**Visible page text:**

- Home Basis Tracker
- How It Works
- Privacy
- FAQ
- Download
- Build a private home project folder one project at a time.
- Home Basis Tracker keeps the basic steps simple: add a home, group work into projects, add costs, attach
- supporting files, and export summaries when you need them.
- Add a property
- Start with home details such as address, purchase date, purchase price, and notes.
- Create projects
- Group improvements such as kitchen remodels, roof work, HVAC, landscaping, windows, permits, or repairs.
- Add expenses
- Enter the date, vendor, description, amount, category, cost type, receipt/file status, and notes.
- Attach documents
- Keep receipts, invoices, permits, photos, and related documents connected to the cost or project they support.
- Export or back up
- Create a CSV, print a review packet summary, or save a full backup for long-term safekeeping.
- Organized around real home projects
- Every expense belongs to a property and can also belong to a project. That makes it easier to review one
- renovation, compare work across years, or pull a complete property summary later.
- Home details for one or multiple properties.
- Project history with contractor, category, dates, and notes.
- Expense details with cost type and receipt/file status.
- File details and optional local attachments.
- Built for review, not advice
- Home Basis Tracker prepares organized project details and summaries. The app does not decide eligibility
- or calculate basis.
- Export when needed
- Use exports to take your home project information outside the app for review or safekeeping. Keep backups
- somewhere you already trust for important personal files.
- CSV
- Spreadsheet of costs
- Export property, project, vendor, amount, cost type, category, and notes.
- Print
- Review packet summary
- Create a readable summary when you need to look things over or share them.
- Backup
- Full local backup
- Save a private backup file that may contain sensitive project details and attached files.
- (c) 2026 Home Basis Tracker.
- Privacy-first local storage

### Download

Source: `website/download/index.html`

**Page title:** Download | Home Basis Tracker
**Meta description:** Download and availability details for Home Basis Tracker, a Mac and browser app for home project paperwork.

**Accessibility / attribute copy:**

- aria-label: Home Basis Tracker home
- aria-label: Main navigation

**Visible page text:**

- Home Basis Tracker
- How It Works
- Privacy
- FAQ
- Download
- Home Basis Tracker is currently a local Mac beta.
- The Mac app is the intended desktop experience. A browser version is also available for local use, but browser
- storage depends on the browser you are using.
- Availability
- Mac beta
- Mac desktop app
- Built for home project information on macOS 11 and later. Your project details and file copies stay on
- your Mac.
- Local browser
- Browser version
- Useful for local testing or lightweight use. The browser version saves information in the browser you
- are using, so backups matter.
- Before you start
- Home Basis Tracker does not upload your files.
- Local storage is not a backup by itself.
- Export full backups and keep them somewhere you trust.
- Review cost categories and summaries before sharing.
- See how it works
- Read privacy details
- (c) 2026 Home Basis Tracker.
- Read FAQ

### Privacy

Source: `website/privacy/index.html`

**Page title:** Privacy | Home Basis Tracker
**Meta description:** Home Basis Tracker privacy and storage details: no account, no cloud sync, no uploads, no usage tracking, and local backups.

**Accessibility / attribute copy:**

- aria-label: Home Basis Tracker home
- aria-label: Main navigation

**Visible page text:**

- Home Basis Tracker
- How It Works
- Privacy
- FAQ
- Download
- Your files and project details stay on your device.
- Home Basis Tracker is a private place for home project paperwork. It does not create an account, upload files,
- sync to a cloud service, add usage tracking, or call outside services for your files.
- Mac desktop app
- In the Mac app, saved project details are kept on your Mac. Attached files are copied into a folder saved
- by the app so they stay connected to the right home, project, and cost.
- Browser version
- In the browser version, saved project details and attached files stay in the browser you are using.
- Clearing that browser's storage can remove them.
- Technical note: the browser version uses browser storage, including localStorage and IndexedDB.
- Backups are your responsibility
- Local storage is private and convenient, but it is not a backup by itself. Deleting app data, clearing
- browser data, changing browsers, or using private browsing can remove saved details and attachments.
- Full backup files can contain sensitive home, vendor, amount, note, receipt, invoice, photo, and document
- contents. Treat them like private files and store them somewhere you trust.
- What the app does not add
- No account requirement.
- No cloud sync steps.
- No file upload to our servers.
- No usage tracking or analytics code.
- No outside services for your files.
- (c) 2026 Home Basis Tracker.
- Read FAQ

### FAQ

Source: `website/faq/index.html`

**Page title:** FAQ | Home Basis Tracker
**Meta description:** Frequently asked questions about Home Basis Tracker, where files are saved, backups, attachments, and Mac availability.

**Accessibility / attribute copy:**

- aria-label: Home Basis Tracker home
- aria-label: Main navigation

**Visible page text:**

- Home Basis Tracker
- How It Works
- Privacy
- FAQ
- Download
- Plain answers about where your files go and how backups work.
- Home Basis Tracker is intentionally narrow: it keeps home project paperwork organized on your device and helps
- you prepare summaries when needed.
- Is this tax software?
- No. Home Basis Tracker is an organization tool. It does not calculate taxes, deductions, or basis.
- Does it upload my receipts?
- No. Receipts, invoices, permits, photos, and notes stay in the Mac app or the browser you use.
- Can I export a summary?
- Yes. CSV exports and printable summaries can help when you need to look things over or share them.
- What happens if I delete browser data?
- The browser version saves information in the browser you are using. Clearing that browser data can remove saved details and attachments.
- Are backups encrypted?
- Backup files are not encrypted. They may include private home details, notes, receipts, invoices, photos, and other files, so store them carefully. The backup uses a .json file format.
- Does it work offline?
- Yes. The app keeps information on your device and does not require an account or cloud connection.
- Can I attach files?
- Yes. You can attach receipts, invoices, permits, photos, and other supporting documents.
- Does it support multiple properties?
- Yes. You can keep separate home details, projects, costs, and files for multiple properties.
- Is there a Mac app?
- Yes. The Mac app is the primary local desktop experience. Availability is listed on the download page.
- Keep a backup rhythm
- Export a full backup after large project updates.
- Keep a second copy outside the app.
- Add receipts and notes while the details are fresh.
- (c) 2026 Home Basis Tracker.
- Privacy details

## App And Product Source Strings

### App UI source

Source: `frontend/app.js`

| Line | Text |
| --- | --- |
| 126 | Browser storage |
| 126 | Mac app data file |
| 127 | Mac app documents folder |
| 129 | Project details and document copies are stored by the Mac app. |
| 130 | Project details and document copies are available in this browser. |
| 172 | Stored file |
| 173 | Needs follow-up |
| 174 | No file |
| 212 | Loading your home project information. |
| 212 | Opening Home Basis Tracker |
| 227 | Unable to load your saved information. To protect existing data, new saves are paused until you restore a backup or reopen the app. |
| 265 | App sections |
| 328 | Your home paperwork |
| 337 | Recent expenses |
| 338 | Add receipts, invoices, or notes when you are ready. |
| 338 | No expenses yet |
| 349 | Home paperwork summary |
| 353 | Total spend |
| 391 | Sale Estimate Worksheet |
| 391 | Sale proceeds and estimated gain |
| 392 | Basis estimate by property |
| 392 | Basis Summary |
| 393 | Plan vs actual project spend |
| 393 | Project Cost Planner |
| 402 | Estimate sale proceeds, basis totals, and project costs from saved project details. |
| 406 | Choose calculator |
| 429 | Add a property first. Worksheets use saved property, project, expense, and document details. |
| 429 | Add your property |
| 429 | No calculator data yet |
| 460 | Add purchase price |
| 460 | Add the purchase price to make this worksheet more useful. |
| 460 | Purchase price not added |
| 463 | Add expense |
| 463 | Add expenses to include possible improvements and review-later amounts in the worksheet. |
| 463 | No tracked expenses for this property |
| 474 | Enter sale price |
| 474 | Expected sale price |
| 477 | Mortgage payoff |
| 478 | Selling costs (%) |
| 481 | Optional override amount |
| 481 | Selling costs amount |
| 485 | Do not apply |
| 486 | $250,000 single |
| 487 | $500,000 married filing jointly |
| 497 | Estimated cash before taxes |
| 497 | Sale price minus selling costs and mortgage payoff. |
| 498 | Estimated gain before tax review |
| 498 | Gain after the selected exclusion assumption. |
| 501 | Purchase price |
| 502 | Possible improvements included |
| 503 | Estimated selling costs |
| 503 | Not estimated |
| 504 | Basis estimate used |
| 505 | Gain before exclusion |
| 506 | Review-later amounts tracked separately |
| 549 | Basis estimate |
| 549 | Purchase price plus included possible improvements. |
| 550 | Not sure, review later |
| 550 | Tracked separately for later review. |
| 553 | Add the purchase price to make the basis estimate more useful. |
| 555 | Add expenses to separate possible improvements, repair / upkeep, and review-later amounts. |
| 558 | Included possible improvements |
| 559 | Repair / upkeep |
| 561 | Missing support |
| 569 | Possible improvements |
| 569 | Review later |
| 576 | Add expenses to see project-level basis totals. |
| 576 | No project spending yet |
| 615 | No project |
| 625 | Permits/fees |
| 628 | Contingency (%) |
| 634 | Planned total |
| 635 | Actual tracked spend |
| 635 | Choose project |
| 635 | Select a project to compare. |
| 637 | Add expenses to compare this worksheet with actual project spending. |
| 637 | No tracked spend for selected project |
| 639 | Not compared |
| 639 | Over plan |
| 639 | Remaining plan |
| 640 | Subtotal before contingency |
| 669 | Items to finish |
| 706 | No open follow-ups |
| 722 | Spend missing linked support |
| 723 | Expenses marked Not sure, review later. |
| 723 | Review-later amount |
| 726 | Document file items |
| 727 | Expense items |
| 728 | Project items |
| 729 | Marked complete with note |
| 732 | No follow-ups right now. |
| 755 | Follow-up |
| 819 | Add your first property. |
| 820 | Add an improvement project. |
| 821 | Record an expense or receipt. |
| 822 | Attach a receipt, permit, invoice, photo, or contract. |
| 828 | Next suggested actions |
| 828 | Small steps that make the binder easier to review later. |
| 838 | No immediate suggestions |
| 838 | Your core details are in good shape. Keep adding receipts, project notes, and supporting documents as you collect them. |
| 863 | , tracked spend, |
| 871 | Address not added |
| 896 | Add projects to group related expenses. |
| 896 | No projects yet |
| 973 | Learn the app with sample items |
| 981 | You are using the tutorial workspace. Reset restores the original sample items; exit returns to your real home file. |
| 982 | Open a separate sample workspace. Your real home file stays unchanged. |
| 984 | Sample properties |
| 985 | Sample projects |
| 986 | Sample expenses |
| 987 | Sample documents |
| 988 | Storage impact |
| 991 | Guided workflow |
| 1006 | How separation works |
| 1006 | Sample data stays separate from your real home file. |
| 1039 | Property details |
| 1045 | Property file |
| 1056 | No property yet |
| 1056 | Start with the home these projects, costs, and files belong to. |
| 1074 | Property name |
| 1079 | Not added |
| 1080 | Purchase date |
| 1093 | Tracked spend |
| 1104 | Add projects to group related work. |
| 1112 | Add costs as receipts or notes arrive. |
| 1201 | Add receipts, permits, photos, or notes for this project. |
| 1201 | No project documents yet |
| 1205 | Add an expense and connect it to this project. |
| 1205 | No linked expenses yet |
| 1228 | Renovation and improvement projects |
| 1233 | Add a property first. |
| 1233 | Add project |
| 1236 | Projects need a property so totals and exports stay organized. |
| 1238 | Project list |
| 1243 | : hasActiveFilters && hasProjectsForCurrentFilters |
| 1243 | : selectedFilterProperty &&!hasProjectsForCurrentFilters |
| 1243 | ? renderEmpty("No projects for selected property", |
| 1243 | ? renderProjectsTable(filteredProjects) |
| 1247 | Clear filters |
| 1247 | No matching projects |
| 1249 | No projects for selected property |
| 1251 | Add your first project when you are ready to group related work. |
| 1252 | Add a property before creating projects. |
| 1311 | Add a vendor before linking new projects and expenses. Existing payee text will be migrated automatically when present. |
| 1311 | No vendors yet |
| 1360 | : renderDisabledAction("Add expense", "Add a property first."), |
| 1363 | Expenses need a property so totals and exports stay organized. |
| 1365 | Filtered total |
| 1372 | Amount, date, property, vendor, and description are required. |
| 1372 | Edit expense |
| 1381 | Cost type |
| 1387 | Newest first |
| 1388 | Oldest first |
| 1389 | Amount high to low |
| 1390 | Amount low to high |
| 1398 | No matching expenses |
| 1399 | Add your first cost when you have a receipt, invoice, or note. |
| 1400 | Add a property before tracking expenses. |
| 1424 | Receipts and supporting documents |
| 1426 | : renderDisabledAction("Add document", "Add a property first."), |
| 1427 | Add document |
| 1429 | Documents need a property so they can be included with the right home. |
| 1434 | Edit document |
| 1434 | Save a display name, document type, and optional file. File paths are removed from notes. |
| 1440 | All documents |
| 1450 | No matching documents |
| 1451 | Add a receipt, invoice, permit, photo, or contract. |
| 1451 | No documents yet |
| 1452 | Add a property before attaching documents. |
| 1462 | Document views |
| 1500 | Expenses needing support |
| 1501 | Document files to attach |
| 1504 | No follow-ups for this filter. |
| 1520 | Document center |
| 1522 | Stored files |
| 1523 | Document entries |
| 1524 | Linked items |
| 1526 | Files to attach |
| 1528 | Document types |
| 1531 | Document type counts |
| 1553 | Export summaries and keep backups |
| 1585 | Tutorial sample items only. |
| 1587 | Total tracked spend |
| 1598 | Add a property before preparing a full summary. |
| 1602 | Add projects to group related expenses and documents. |
| 1606 | Add expenses to build the CSV and review summary. |
| 1610 | Add documents to include file details in the printable summary. |
| 1619 | Restore notes |
| 1644 | Download review packet |
| 1644 | Download tutorial review packet |
| 1647 | Review packet PDF |
| 1649 | Create an organizer from saved properties, projects, expenses, and documents. |
| 1649 | Exports use tutorial sample items only. |
| 1650 | Add a property, project, expense, or document to populate the review packet. |
| 1654 | Download expense CSV |
| 1654 | Download tutorial expense CSV |
| 1656 | Add expenses to enable the expense CSV. |
| 1656 | The expense CSV does not include attached file contents. |
| 1667 | Saved items |
| 1674 | Attached files |
| 1675 | Attached file size |
| 1684 | Full backup |
| 1684 | Tutorial backup and restore |
| 1686 | Create or restore sample backup files inside this temporary tutorial workspace only. |
| 1687 | Review exports organize details for sharing. Full backups preserve saved items and supported attached files where available. |
| 1689 | Download full backup |
| 1689 | Download tutorial backup |
| 1689 | Save full backup |
| 1690 | Restore from backup |
| 1690 | Restore into tutorial |
| 1695 | No backup created in this app session |
| 1711 | 2-digit |
| 1751 | Mac app |
| 1772 | Save property |
| 1785 | Add property |
| 1785 | Edit property |
| 1809 | Cancel edit |
| 1940 | Project name |
| 1946 | Start date |
| 1947 | Completion date |
| 1950 | Primary vendor |
| 1951 | Optional permit or approval number |
| 1951 | Permit number |
| 1954 | Project description |
| 1956 | Mark as complete with note |
| 1958 | Save project |
| 1969 | (archived) |
| 1981 | Add vendor |
| 1981 | Edit vendor |
| 1996 | Contractor, store, agency, or person |
| 1996 | Vendor name |
| 2002 | Contact name |
| 2026 | Edit project |
| 2061 | Vendor/payee |
| 2062 | Roof repair, dishwasher install, permit fee |
| 2070 | Receipt/file status |
| 2073 | Save expense |
| 2093 | Attached file |
| 2093 | Current file: ( ). Choose a new file to replace it. |
| 2095 | Choosing a file in tutorial mode saves sample file details only. No file copy is saved. |
| 2096 | Choose a receipt, invoice, permit, photo, or related file. |
| 2099 | multipart/form-data |
| 2101 | Related expense |
| 2105 | Document type |
| 2107 | Display name |
| 2109 | Added date |
| 2114 | Use the normal workspace when you are ready to store real document copies. |
| 2118 | Save document |
| 2269 | A stored document is attached to this expense. |
| 2269 | is attached to this expense. |
| 2270 | Add another document |
| 2281 | A document entry is linked, but no stored file is attached. |
| 2292 | No receipt or invoice file is linked yet. |
| 2303 | This is marked documented. Attach or link a stored when you have it. |
| 2313 | Needs document |
| 2314 | Attach a receipt, invoice, or follow-up file. |
| 2323 | No document linked |
| 2324 | Attach a receipt, invoice, or note when available. |
| 2362 | Attach a receipt, invoice, or note for this expense. |
| 2362 | No linked documents yet |
| 2436 | Sample file details |
| 2439 | This entry has sample file details, but no real file copy is stored. |
| 2440 | Tutorial file |
| 2440 | Unknown type |
| 2446 | File attached |
| 2449 | A stored file copy is attached to this document entry. |
| 2456 | Restored without the attached file |
| 2459 | This document entry was restored, but the file content was not included. |
| 2466 | File needs follow-up |
| 2475 | No file attached |
| 2478 | The document entry is saved, but no file copy is attached yet. |
| 2503 | Document preview |
| 2525 | The stored file could not be opened. |
| 2538 | Document notes |
| 2561 | Reading document... % |
| 2563 | Text saved with this document entry. |
| 2564 | This file could not be read. |
| 2568 | Text reading is available for images, PDFs, and plain text files in this version. |
| 2572 | Text reading is available after the file opens. |
| 2619 | Expense total |
| 2623 | Add a document or connect expenses when details are available. |
| 2623 | No linked items yet |
| 2634 | Note added. |
| 2658 | No project items to finish right now. |
| 2682 | Costs linked |
| 2683 | Receipt and invoice files linked |
| 2684 | Review treatment choices |
| 2692 | Contractor or vendor identified |
| 2693 | Add the contractor/vendor for this project. |
| 2695 | Supporting documents linked |
| 2696 | Link project documents, permits, photos, or notes to this project. |
| 2698 | Expected document types covered |
| 2715 | Add a if available or applicable. |
| 2722 | Marked complete |
| 2743 | Project description not added |
| 2749 | Permit attached |
| 2751 | ( to finish) |
| 2759 | No items |
| 2767 | Receipt/file |
| 2793 | No notes |
| 2796 | No expense |
| 3118 | ArrowDown |
| 3118 | ArrowLeft |
| 3118 | ArrowRight |
| 3118 | ArrowUp |
| 3337 | Your real home file changed in another browser window. Exit the tutorial to see the refreshed file. |
| 3345 | Saved details changed in another browser window. This view has been refreshed. |
| 3373 | Unassigned / unknown |
| 3429 | Tutorial workspace opened. Sample changes are temporary. |
| 3443 | Returned to your real home file. |
| 3451 | Reset the tutorial workspace back to the original sample items? Your real home file will not be changed. |
| 3460 | Tutorial sample data reset. |
| 3521 | Property name is required. |
| 3524 | Enter a valid purchase date. |
| 3525 | Purchase price cannot be negative. |
| 3542 | Property saved. |
| 3556 | Primary property updated. |
| 3594 | Property updated. |
| 3613 | Enter a recognizable property address, or leave the address blank for now. |
| 3619 | Enter the property address only. Web links and email addresses do not belong in this field. |
| 3622 | Include a street number and street name, or leave the address blank for now. |
| 3625 | Use the real property address, or leave the address blank for now. |
| 3634 | Vendor name is required. |
| 3640 | A vendor with this name already exists. |
| 3669 | Vendor saved. |
| 3674 | Property is required. |
| 3675 | Project name is required. |
| 3676 | Enter a valid start date. |
| 3677 | Enter a valid completion date. |
| 3679 | Completion date cannot be before the start date. |
| 3717 | Project saved. |
| 3739 | Enter a valid date. |
| 3773 | Project updated. |
| 3779 | Date is required. |
| 3780 | Enter a valid expense date. |
| 3781 | Description is required. |
| 3782 | Enter an amount greater than zero. |
| 3817 | Expense saved. |
| 3824 | Display name is required. |
| 3825 | Added date is required. |
| 3826 | Enter a valid added date. |
| 3828 | Files over are not accepted in this beta. |
| 3831 | Attached file storage is not available in this . |
| 3867 | Sample file details only. No copy was saved. |
| 3951 | Document saved, but the previous stored file could not be removed from storage. |
| 3958 | Document saved with sample file details. No file copy was stored. |
| 3959 | Document and attached file saved. |
| 3960 | Document saved. |
| 3965 | No stored file is attached to this document. |
| 3967 | Sample file details have no real file to preview. |
| 3990 | The file details are saved, but the stored file is missing. It may have been cleared from storage. |
| 4026 | Document was not found. |
| 4048 | Document notes saved. |
| 4055 | Sample file details have no real file for text reading. |
| 4065 | Local text reading is available for images, PDFs, and plain text files in this version. |
| 4089 | The stored file is missing. |
| 4109 | Text reading finished, but no text was found. |
| 4109 | Text saved with this document. |
| 4123 | Reading image... % |
| 4135 | Opening PDF... |
| 4166 | Checking PDF page of ... |
| 4172 | Read PDF page of . |
| 4176 | Rendering scanned PDF page of ... |
| 4180 | Reading scanned PDF page of ... % |
| 4201 | scanned PDF page processed with OCR. |
| 4202 | Only the first pages were read. |
| 4203 | PDF page could not be read. |
| 4218 | Text files over are too large to read in this beta. |
| 4220 | Reading text file... |
| 4222 | Text file read. |
| 4233 | Local OCR worker could not be loaded. |
| 4294 | The PDF page could not be rendered for OCR. |
| 4367 | Text reading could not start. Reopen the app and try again. |
| 4369 | This PDF could not be read. |
| 4384 | OCR can read supported image text. |
| 4385 | Reading image... 0% |
| 4391 | Searchable PDFs are fast; scanned PDFs can take a while. |
| 4398 | Plain text files can be copied into the document notes. |
| 4437 | Delete from this app? |
| 4438 | This removes project(s), expense(s), document entr, and stored document copies for this property. |
| 4439 | Original files on your computer and any exported backups are not deleted. |
| 4461 | Property deleted. Some attached document files could not be removed. |
| 4462 | Property deleted. |
| 4466 | Delete this project? Related expenses and documents will stay saved without this project. |
| 4479 | Project deleted. Related expenses and documents were kept. |
| 4483 | Delete this expense and unlink its documents? |
| 4491 | Expense deleted. |
| 4497 | Delete this document from this app? This removes the stored copy and its note here, but does not delete the original file from your computer or any copies you downloaded. |
| 4505 | The document was not deleted because the stored file could not be removed from storage. |
| 4519 | Document deleted. |
| 4526 | Sample file details have no real file to download. |
| 4536 | Downloading creates a separate copy outside this app. |
| 4546 | Remove these sample file details? The document entry will stay, and no real file will be deleted. |
| 4547 | Remove the stored file from this app? The document entry will stay, and this will not delete the original file from your computer or any copies you downloaded. |
| 4555 | The document was not updated because the stored file could not be removed from storage. |
| 4567 | Stored file removed from this app. |
| 4584 | Stored file removed. The document entry was kept. |
| 4594 | (missing) |
| 4595 | Stored file details were present, but the file could not be found. |
| 4636 | Add a property, expense, or document before creating a review packet PDF. |
| 4641 | Use the browser print dialog to save the review summary as a PDF. |
| 4653 | Review packet PDF save canceled. |
| 4656 | Review packet PDF saved. |
| 4656 | Tutorial review PDF saved. |
| 4658 | Review packet PDF could not be saved. |
| 4668 | Review Packet |
| 4668 | Tutorial Review Packet |
| 4670 | Prepared from sample tutorial items |
| 4671 | Prepared from Home Basis Tracker |
| 4678 | ( files) |
| 4689 | Marked complete with note: |
| 4726 | Content-Security-Policy |
| 4735 | Segoe UI |
| 4894 | Items to review |
| 4899 | Items to Review Before Sharing |
| 4900 | Related item |
| 4901 | ? pdfTable(["Property", "Purchase Date", "Purchase Price", "Tracked Spend", "Projects", "Documents", "Follow-Ups"], propertyRows) |
| 4902 | Property Summary |
| 4903 | Follow-Ups |
| 4904 | ? pdfTable(["Project", "Status", "Dates", "Contractor", "Permit", "Spend", "Items to finish"], projectRows) |
| 4905 | Project Summary |
| 4907 | ? pdfTable(["Date", "Expense", "Property", "Project", "Cost Type", "Receipt/File", "Amount"], expenseRows) |
| 4908 | Expense Detail |
| 4910 | ? pdfTable(["Document", "Type", "Property", "Project", "Related Expense", "Stored File"], documentRows) |
| 4911 | Document Index |
| 4971 | Backup canceled. |
| 4983 | Backup saved, but some stored files were missing from storage. |
| 4987 | Full backup saved. |
| 4987 | Tutorial backup saved with sample items only. |
| 5004 | Sample file details only. No file content was included. |
| 5010 | Sample file details only |
| 5021 | Stored file missing |
| 5042 | Stored file could not be read |
| 5053 | Backup files over are not accepted in this beta. |
| 5099 | Backup restored into the tutorial workspace only. |
| 5101 | Backup restored. Some attached files could not be restored. |
| 5102 | Backup restored. |
| 5104 | Some older stored files could not be removed from storage. |
| 5114 | No attached file content marked |
| 5117 | Files may be skipped: |
| 5118 | Files needing follow-up: none flagged |
| 5119 | Real home file |
| 5119 | Tutorial workspace |
| 5121 | This will replace the temporary tutorial workspace only. Your real home file will not be changed. |
| 5122 | This will replace the current saved items. Download a backup first if you want to keep what is here. |
| 5125 | Restore this Home Basis Tracker backup? |
| 5127 | Workspace affected: |
| 5128 | Backup file: |
| 5128 | Selected backup |
| 5129 | Created: |
| 5130 | Items to restore: |
| 5131 | Attached files: |
| 5134 | Current saved items that will be replaced: |
| 5137 | Choose OK to restore, or Cancel to keep the current workspace unchanged. |
| 5163 | Not listed |
| 5177 | Restored without the attached file. File content was not restored inside the tutorial workspace. |
| 5213 | Restored without the attached file. File not included in backup. |
| 5218 | Restored without the attached file. File could not be restored in this app. |
| 5223 | Restored without the attached file. File type skipped during restore. |
| 5228 | Restored without the attached file. File too large to restore. |
| 5240 | Restored without the attached file. File checksum did not match backup. |
| 5313 | Could not read file for backup. |
| 5321 | SHA-256 |
| 5336 | Backup file data is not in the expected format. |
| 5339 | Could not read a file stored in the backup. |
| 5455 | The backup could not be restored because storage may be full. |
| 5460 | The backup could not be completed. Check the file and try again. |
| 5465 | Saves are paused because your information could not be loaded safely. Restore a backup or reopen the app before making changes. |
| 5482 | Unable to save. Check storage settings before adding more items. |
| 5498 | The file could not be saved because storage may be full. Keep your own backup of important files. |
| 5504 | Document storage is blocked by another . Close other windows for this app and try again. |
| 5506 | The file could not be saved. Keep your own backup and try again. |
| 5565 | -error |


### Domain labels, follow-ups, exports

Source: `backend/domain/model.js`

| Line | Text |
| --- | --- |
| 4 | Home Basis Tracker |
| 26 | Export & backup |
| 32 | In progress |
| 33 | Blocked / waiting |
| 39 | Possible improvement |
| 40 | Repair / upkeep |
| 41 | Not sure, review later |
| 45 | Addition/structural |
| 51 | Cleanup/hauling |
| 52 | Closets/storage |
| 53 | deck/patio/porch |
| 55 | Dining room |
| 56 | Drainage/grading |
| 57 | Driveway/walkway |
| 58 | Drywall/plaster |
| 60 | Exterior masonry |
| 61 | Fence/gate |
| 62 | Fireplace/chimney |
| 66 | Gutters/downspouts |
| 69 | Insulation/weatherization |
| 72 | Landscaping/yard |
| 73 | Laundry/mudroom |
| 75 | living/family room |
| 77 | Painting - exterior |
| 78 | Painting - interior |
| 79 | Permits/fees |
| 80 | Plans/design |
| 82 | Pool/spa |
| 84 | Sewer/septic |
| 86 | smart home/security |
| 87 | Solar/energy |
| 88 | Stairs/railings |
| 89 | Tree work |
| 90 | Trim/millwork |
| 91 | warranty/service plan |
| 92 | Water heater |
| 93 | well/water treatment |
| 94 | Whole home |
| 95 | Windows/doors |
| 100 | Receipt attached |
| 101 | Invoice attached |
| 102 | No document yet |
| 103 | Needs follow-up |
| 113 | Payment proof |
| 116 | Plan or drawing |
| 481 | Unknown size |
| 482 | 0 B |
| 489 | Not set |
| 490 | T00:00:00 |
| 508 | Unassigned property |
| 512 | No project |
| 516 | Unassigned / unknown |
| 525 | Vendor not added |
| 665 | Property details |
| 666 | Add purchase date |
| 667 | is missing a purchase date. |
| 686 | Add purchase price |
| 687 | is missing a purchase price. |
| 740 | Linked to a property |
| 742 | Link this project to a property. |
| 745 | Project description or notes added |
| 747 | Add a short project description or project note. |
| 750 | Start date added |
| 752 | Add a project start date when available. |
| 755 | Completion date handled |
| 757 | Add the completion date for finished projects. |
| 760 | Contractor or vendor identified |
| 762 | Add the contractor/vendor on the project or linked expenses. |
| 765 | Costs linked |
| 767 | Link at least one expense to this project. |
| 770 | Supporting documents linked |
| 772 | Attach receipts, invoices, permits, photos, or notes to this project. |
| 775 | Receipt and invoice files linked |
| 777 | Attach receipts or invoices for expenses that need them. |
| 780 | Review treatment choices |
| 782 | Review expenses marked Not sure, review later. |
| 785 | Expected document types covered |
| 800 | Marked complete with note |
| 819 | Add a if available or applicable. |
| 874 | Home details added |
| 875 | Projects grouped |
| 876 | Expense vendors linked |
| 877 | Stored document files attached |
| 878 | Possible improvements noted |
| 923 | Changes this item immediately. |
| 925 | Opens the . Nothing changes until you save. |
| 952 | Project item |
| 953 | Add project vendor |
| 954 | does not have a project vendor or linked expense vendor yet. |
| 960 | Add vendor |
| 973 | Add project dates |
| 974 | is missing . |
| 989 | Add project description |
| 990 | needs a short description or note for context. |
| 996 | Add description |
| 1003 | Add supporting document |
| 1006 | does not have supporting documents linked yet. |
| 1010 | Project documents |
| 1042 | Expense item |
| 1044 | is missing a vendor or payee. |
| 1065 | Cost type |
| 1066 | Review cost type |
| 1067 | is marked Not sure, review later. |
| 1093 | Expense support |
| 1095 | needs a linked receipt, invoice, or follow-up document. |
| 1119 | is marked, but no linked with a file is in this folder. |
| 1146 | Attach file |
| 1158 | Sample file details |
| 1160 | has sample file details only. Use your normal workspace to attach a real file. |
| 1178 | Restore or attach file |
| 1180 | is linked to, but the file is not attached. |
| 1181 | has a document entry, but no file is attached. |
| 1186 | Document file |
| 1186 | Restored file |
| 1242 | , and |
| 1261 | Receipt or invoice |
| 1264 | Permit or approval |
| 1267 | Contract or estimate |
| 1270 | Before/after photo |
| 1374 | Export Source |
| 1375 | Export Date |
| 1378 | Vendor ID |
| 1381 | Vendor/Payee |
| 1385 | Receipt/file status |


### Tutorial sample copy

Source: `backend/domain/tutorial-data.js`

| Line | Text |
| --- | --- |
| 9 | Add a property |
| 10 | Review the sample home profile and see where core property details belong. |
| 14 | Add an improvement project |
| 15 | Open a project file, review dates, contractor details, permits, and supporting files. |
| 19 | Record expenses |
| 20 | Connect sample costs to a property or project and review receipt/document status. |
| 24 | Attach documents |
| 25 | Add sample receipts, invoices, permits, photos, contracts, and notes to the document library. |
| 29 | Export summaries |
| 34 | Back up your home file |
| 35 | Create or restore a sample backup without touching your real binder. |
| 44 | Maple Street Home |
| 45 | 123 Maple Street, Portland, OR 97201 |
| 48 | Sample property for learning the workflow. Replace this with your real home only in the normal workspace. |
| 52 | Cedar Lane Cottage |
| 53 | 48 Cedar Lane, Bend, OR 97702 |
| 56 | Second sample property for testing property filters, exports, and details across more than one home. |
| 63 | Kitchen remodel |
| 67 | Northwest Builders LLC |
| 68 | PR-2023-0418 |
| 70 | Full kitchen refresh with cabinets, counters, backsplash tile, lighting, and appliance installation. |
| 71 | Cabinets, counters, tile, lighting, and appliance installation. |
| 76 | Roof replacement |
| 80 | Evergreen Roofing Co. |
| 83 | Full tear-off and replacement of the existing roof system. |
| 84 | Full tear-off and replacement. Good example of a large project to review later. |
| 89 | Bathroom addition |
| 93 | Harbor Home Design |
| 95 | PR-2024-0933 |
| 96 | Bathroom addition with framing, plumbing, electrical, fixtures, and finish work. |
| 97 | Use this active project to practice adding new expenses and follow-up documents. |
| 102 | Window warranty follow-up |
| 106 | Cascade Window Service |
| 109 | Waiting for warranty confirmation before scheduling replacement glass. |
| 110 | Blocked projects help keep follow-ups visible without mixing them into completed work. |
| 115 | Interior painting refresh |
| 119 | Rose City Painting |
| 122 | Repainted entry, stairwell, hallway, living room, and primary bedroom with wall repairs before finish coats. |
| 123 | Useful for testing a project with photos, paint receipts, and contractor invoices. |
| 128 | Exterior painting and trim repair |
| 132 | Summit Exterior Co. |
| 135 | Pressure wash, scrape, prime, repair trim boards, and repaint siding, porch columns, and fascia. |
| 136 | Shows how exterior work can combine painting, trim, and photo documentation. |
| 141 | Water heater replacement |
| 145 | QuickFix Plumbing |
| 146 | WH-2024-1182 |
| 148 | Replaced failed tank water heater with a high-efficiency unit and updated shutoff hardware. |
| 149 | Includes a permit, invoice, warranty, and payment proof for a small but complete project file. |
| 154 | Basement drainage correction |
| 158 | GroundWorks Northwest |
| 161 | French drain, downspout extensions, grading correction, and moisture monitoring around the basement wall. |
| 162 | Active project for testing open follow-ups, estimates, inspection notes, and partial expenses. |
| 167 | Deck boards and railing upgrade |
| 168 | deck/patio/porch |
| 171 | Backyard Build Co. |
| 172 | PR-2024-1840 |
| 174 | Replace aging deck boards, update railing sections, and add stair lighting after permit approval. |
| 175 | Planned project with an estimate and permit but no final invoice yet. |
| 180 | Attic insulation upgrade |
| 184 | EcoLayer Insulation |
| 187 | Air sealed attic penetrations and added blown-in insulation to improve comfort and efficiency. |
| 188 | Includes before photos, invoice, and warranty-style work summary. |
| 193 | Driveway resurfacing |
| 197 | Pioneer Paving |
| 200 | Patch cracks, level low areas, resurface driveway, and reseal walkway approach. |
| 201 | Future work sample with estimate and planning documents. |
| 206 | Cottage flooring replacement |
| 210 | High Desert Floors |
| 213 | Removed damaged carpet and installed engineered hardwood in the living room, hall, and bedrooms. |
| 214 | Second-property sample for testing filters, exports, and property summaries. |
| 219 | Mini-split heat pump install |
| 223 | Cascade Comfort Systems |
| 224 | MECH-2023-2204 |
| 226 | Installed two-zone ductless heat pump system with exterior condenser and wall-mounted heads. |
| 227 | Shows mechanical permits, equipment warranty, and contractor invoices. |
| 232 | Front yard drainage and landscaping |
| 236 | Juniper Yardworks |
| 239 | Regrade front yard, install dry creek bed, replace shrubs, and add drip irrigation zones. |
| 240 | Useful for testing outdoor project details and several document types. |
| 249 | Portland Tile Co. |
| 250 | Backsplash tile and installation |
| 255 | Sample cost linked to a receipt. Cost type can be reviewed later. |
| 262 | Electra Electric |
| 263 | Under-cabinet lighting |
| 268 | Use this to see how invoices appear in the document checklist. |
| 276 | Full roof replacement |
| 281 | Example of a high-value project where complete documentation matters. |
| 289 | Kitchen sink leak service visit |
| 294 | This sample shows a smaller repair / upkeep item for later review. |
| 301 | City of Portland |
| 302 | Bathroom addition permit |
| 307 | Use Not sure, review later when you want to revisit the cost type. |
| 314 | Willamette Stoneworks |
| 315 | Quartz countertop fabrication and install |
| 320 | Countertop invoice linked to the completed kitchen remodel. |
| 327 | Northwest Appliance Outlet |
| 328 | Range and dishwasher package |
| 333 | Sample appliance purchase marked Not sure, review later. |
| 341 | Bathroom addition framing deposit |
| 346 | Deposit expense for an active project with follow-up items still open. |
| 353 | River Supply Co. |
| 354 | Vanity, sink, faucet, and bath fixtures |
| 359 | Material receipt linked to the bathroom addition. |
| 367 | Warranty inspection visit |
| 372 | Small service visit tied to a blocked warranty follow-up. |
| 380 | Interior prep, patching, and paint labor |
| 385 | Interior painting sample for comparing repair and improvement cost types. |
| 392 | Paint & Paper Supply |
| 393 | Primer, wall paint, trim paint, and patch materials |
| 398 | Material receipt attached to a completed interior project. |
| 406 | Exterior painting and trim repair labor |
| 411 | Exterior project with mixed painting and trim repair details. |
| 418 | Bridgetown Lumber |
| 419 | Fascia and porch trim replacement boards |
| 424 | Shows a material cost linked to the same exterior project. |
| 432 | High-efficiency water heater replacement |
| 437 | Complete small project with invoice, permit, and warranty files. |
| 445 | Water heater permit |
| 450 | Permit fee linked to the water heater replacement. |
| 458 | Drainage design and project deposit |
| 463 | Deposit on an active basement drainage project. |
| 470 | Gutter House |
| 471 | Downspout extension materials |
| 476 | Outdoor materials linked to an active drainage project. |
| 484 | Deck replacement estimate deposit |
| 489 | Planned project deposit without final project documentation yet. |
| 497 | Attic air sealing and blown-in insulation |
| 502 | Weatherization project with invoice and before/after photos. |
| 510 | Driveway resurfacing estimate |
| 515 | Zero-dollar planning item to show a future estimate that has not become an expense yet. |
| 523 | Engineered hardwood flooring and installation |
| 528 | Second-property flooring project with invoice and photos. |
| 536 | Two-zone mini-split heat pump install |
| 541 | HVAC project with permit, warranty, and payment proof. |
| 548 | Deschutes County |
| 549 | Mechanical permit fee |
| 554 | Permit fee attached to a second-property HVAC project. |
| 562 | Drainage and planting plan |
| 567 | Design/planning expense for an outdoor project. |
| 575 | Drip irrigation materials and installation |
| 580 | Outdoor project expense that still needs a linked document. |
| 589 | Tile receipt |
| 592 | Tutorial document entry only. No real file is stored. |
| 593 | Sample receipt text: Portland Tile Co. backsplash tile and installation. |
| 595 | Tutorial sample: attach a real file only in your normal workspace. |
| 602 | Lighting invoice |
| 605 | Use this sample to practice linking an invoice to an expense. |
| 606 | Sample invoice text: under-cabinet lighting, labor, and materials. |
| 608 | Tutorial sample: no file copy is stored. |
| 615 | Bathroom permit note |
| 618 | Permit files help keep municipal approvals near the related project. |
| 621 | Tutorial sample: add a permit file in the normal workspace when you have one. |
| 628 | Roof payment confirmation |
| 631 | Payment proof can help reconcile invoices and receipts during review. |
| 632 | Sample payment confirmation for Evergreen Roofing Co. |
| 634 | Tutorial sample: no bank file is stored. |
| 641 | Window warranty email |
| 644 | Warranty files help separate repair follow-up from new improvement work. |
| 645 | Sample warranty text for window service follow-up. |
| 647 | Tutorial sample: add the real warranty file in your normal workspace. |
| 654 | Kitchen before and after photos |
| 657 | Photos can help explain the scope of a project. |
| 660 | Tutorial sample: no photo file is stored. |
| 667 | Countertop fabrication invoice |
| 670 | Sample countertop invoice linked to a kitchen expense. |
| 671 | Sample invoice text: quartz slabs, template visit, fabrication, delivery, and installation. |
| 680 | Appliance package receipt |
| 683 | Receipt sample for an item marked Not sure, review later. |
| 684 | Sample receipt text: range, dishwasher, delivery, installation kit, and haul-away fee. |
| 686 | Tutorial sample: no appliance receipt file is stored. |
| 693 | Bathroom addition contract |
| 696 | Contract sample for reviewing scope, deposit, and contractor information. |
| 697 | Sample contract text: framing, plumbing rough-in, electrical rough-in, inspections, fixtures, and finish work. |
| 699 | Tutorial sample: no contract file is stored. |
| 706 | Bathroom fixture receipt |
| 709 | Material receipt linked to the active bathroom project. |
| 710 | Sample receipt text: vanity, sink, faucet, shower trim, and bath accessories. |
| 712 | Tutorial sample: no receipt file is stored. |
| 719 | Interior painting invoice |
| 722 | Invoice sample for completed interior work. |
| 723 | Sample invoice text: wall preparation, drywall patches, primer, two finish coats, and trim touch-ups. |
| 725 | Tutorial sample: no invoice file is stored. |
| 732 | Interior paint materials receipt |
| 735 | Receipt sample for paint and wall repair materials. |
| 736 | Sample receipt text: primer, eggshell wall paint, semi-gloss trim paint, rollers, trays, and patch compound. |
| 745 | Interior painting before and after photos |
| 748 | Photo showing hallway patch repairs and final paint finish. |
| 758 | Exterior painting invoice |
| 761 | Invoice sample for exterior repainting and trim repair. |
| 762 | Sample invoice text: pressure washing, scraping, priming, exterior paint, trim repair, and cleanup. |
| 771 | Exterior trim materials receipt |
| 774 | Material receipt linked to trim replacement work. |
| 775 | Sample receipt text: primed fascia boards, porch trim, fasteners, caulk, and flashing tape. |
| 784 | Exterior paint before and after photos |
| 787 | Photo sample for documenting exterior project scope. |
| 797 | Water heater invoice |
| 800 | Invoice sample for equipment, labor, and haul-away. |
| 801 | Sample invoice text: high-efficiency water heater, expansion tank, shutoff valve, labor, and disposal. |
| 810 | Water heater permit receipt |
| 813 | Permit linked to the water heater project. |
| 814 | Sample permit text: water heater replacement permit, permit number WH-2024-1182. |
| 816 | Tutorial sample: no permit file is stored. |
| 823 | Water heater warranty |
| 826 | Warranty sample for equipment model and coverage dates. |
| 827 | Sample warranty text: tank warranty, parts coverage, serial number, and installer information. |
| 829 | Tutorial sample: no warranty file is stored. |
| 836 | Basement drainage estimate |
| 839 | Estimate sample for an active project that is not finished yet. |
| 840 | Sample estimate text: French drain, gravel, pipe, downspout tie-ins, grading, and moisture check. |
| 842 | Tutorial sample: no estimate file is stored. |
| 849 | Downspout materials receipt |
| 852 | Receipt sample tied to the active basement drainage project. |
| 853 | Sample receipt text: corrugated pipe, adapters, splash blocks, and fittings. |
| 862 | Basement drainage progress photos |
| 865 | Progress photo sample for an open project. |
| 875 | Deck railing estimate |
| 878 | Estimate sample for planned deck work. |
| 879 | Sample estimate text: cedar deck boards, railing sections, stair lighting, labor, and permit coordination. |
| 888 | Deck permit approval |
| 891 | Permit sample for a planned exterior project. |
| 892 | Sample permit text: deck repair and railing update approved under PR-2024-1840. |
| 901 | Attic insulation invoice |
| 904 | Invoice sample for weatherization work. |
| 905 | Sample invoice text: air sealing, blown-in insulation, baffles, prep, cleanup, and final depth report. |
| 914 | Attic insulation before and after photos |
| 917 | Photo sample for documenting weatherization work. |
| 927 | Driveway resurfacing estimate notes |
| 930 | Planning note sample for a future driveway project. |
| 931 | Sample estimate notes: crack repair, leveling, resurfacing, sealing, and walkway edge repair. |
| 940 | Cottage flooring invoice |
| 943 | Second-property invoice sample for flooring work. |
| 944 | Sample invoice text: carpet removal, engineered hardwood, underlayment, trim transitions, labor, and disposal. |
| 953 | Cottage flooring before and after photos |
| 956 | Photo sample connected to a second-property project. |
| 966 | Mini-split installation invoice |
| 969 | HVAC invoice sample with equipment and labor details. |
| 970 | Sample invoice text: outdoor condenser, two indoor heads, refrigerant lines, electrical disconnect, and commissioning. |
| 979 | Mechanical permit receipt |
| 982 | Permit sample for the cottage HVAC project. |
| 983 | Sample permit text: mechanical permit MECH-2023-2204 for ductless heat pump installation. |
| 992 | Mini-split equipment warranty |
| 995 | Warranty sample for equipment model, serial numbers, and service contact. |
| 996 | Sample warranty text: outdoor condenser serial number, indoor unit model numbers, parts coverage, and labor terms. |
| 1005 | Front yard drainage and planting plan |
| 1008 | Plan sample for an outdoor project that combines grading and planting areas. |
| 1009 | Sample plan text: dry creek bed alignment, amended soil areas, drip irrigation zones, and native shrub locations. |
| 1011 | Tutorial sample: no plan file is stored. |
| 1018 | Irrigation installation note |
| 1021 | Note sample for an expense that still needs final invoice documentation. |
| 1022 | Sample note text: drip zones installed along front bed, side yard shrubs, and dry creek edge. |
| 1024 | Tutorial sample: add the final invoice in the normal workspace when available. |


### Backup/restore messages

Source: `backend/domain/backup.js`

| Line | Text |
| --- | --- |
| 35 | This does not look like a Home Basis Tracker backup. |
| 38 | This backup was created by a newer version of Home Basis Tracker. |
| 144 | Attached file |
| 170 | Backup contains a project that does not belong to a valid property. |
| 174 | Backup contains a project linked to an unknown vendor. |
| 190 | Backup contains an expense that does not belong to a valid property. |
| 193 | Backup contains an expense linked to a project from another property. |
| 197 | Backup contains an expense linked to an unknown vendor. |
| 213 | Backup contains a document linked to an unknown expense. |
| 216 | Backup contains a document linked to a different property than its expense. |
| 219 | Backup contains a document linked to a different project than its expense. |
| 225 | Backup contains a document that does not belong to a valid property. |
| 228 | Backup contains a document linked to a project from another property. |
| 264 | Backup contains an attached file entry without a document link. |
| 268 | Backup contains duplicate attached files for a document. |
| 271 | Backup contains an attached file for an unknown document. |
| 277 | Backup contains duplicate attached file ids. |
| 297 | Backup contains duplicate items. |
| 325 | Backup contains an invalid file checksum. |


### Desktop package labels

Source: `desktop/package.json`

| Line | Text |
| --- | --- |
| 3 | A Mac app for organizing home improvement records. |
| 6 | Home Basis Tracker |
| 8 | Copyright © 2026 Home Basis Tracker |
| 11 | env -u ELECTRON_RUN_AS_NODE electron . |
| 40 | frontend/**/* |
| 41 | backend/**/* |
| 47 | home-ledger/node_modules/tesseract.js/dist |
| 55 | home-ledger/node_modules/tesseract.js-core |
| 62 | home-ledger/node_modules/@tesseract.js-data/eng/4.0.0 |
| 69 | home-ledger/node_modules/pdfjs-dist/build |
| 77 | home-ledger/node_modules/pdfjs-dist/cmaps |
| 84 | home-ledger/node_modules/pdfjs-dist/standard_fonts |
| 91 | home-ledger/node_modules/pdfjs-dist/wasm |
| 98 | home-ledger/node_modules/pdfjs-dist/image_decoders |
| 112 | NSAppTransportSecurity |
| 113 | NSAllowsArbitraryLoads |
| 115 | Home Basis Tracker does not use audio capture. |
| 115 | NSAudioCaptureUsageDescription |
| 116 | Home Basis Tracker does not use Bluetooth. |
| 116 | NSBluetoothAlwaysUsageDescription |
| 117 | NSBluetoothPeripheralUsageDescription |
| 118 | Home Basis Tracker does not use the camera. |
| 118 | NSCameraUsageDescription |
| 119 | Home Basis Tracker does not use the microphone. |
| 119 | NSMicrophoneUsageDescription |


### Project README

Source: `README.md`

| Line | Text |
| --- | --- |
| 30 | website/ |
| 31 | frontend/ |
| 32 | backend/domain/ |
| 33 | backend/storage/ |
| 34 | desktop/ |
| 35 | scripts/ |
| 36 | tests/ |
| 37 | docs/ |
| 38 | fixtures/ |
| 40 | home-ledger/ |
| 50 | npm run dev:website |
| 72 | npm run pack:mac |
| 78 | npm run pack:mac:dmg:signed |
| 78 | source ~/.home-basis-tracker-signing-env |
| 83 | Developer ID Application: Your Name (TEAMID) |
| 83 | Your Name (TEAMID) |
| 99 | docs/DATA_SAFETY.md |
| 118 | docs/HUMAN_REVIEW_CHECKLIST.md |
| 118 | docs/REAL_WORLD_DOCUMENT_QA.md |
| 124 | npm run check:mac-package |
| 124 | npm run check:model |
| 124 | npm run check:syntax |
| 124 | npm run qa:beta |
| 124 | npm run qa:private-documents |
| 124 | npm run qa:render |
| 124 | npm run smoke:desktop |
| 124 | npm run smoke:dmg |
| 124 | npm run smoke:packaged |


### Usability review prompt

Source: `docs/usability-workflow-review-prompt.md`

_No reviewable strings found by the extractor._


## Review Guidance

When reviewing, focus first on wording that a homeowner will see repeatedly: page headers, form labels, empty states, follow-up actions, document file states, export/backup confirmations, and tutorial mode copy. Internal code identifiers and compatibility values are outside this wording pass unless they leak into the UI.


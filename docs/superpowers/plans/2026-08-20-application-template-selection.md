# Application Template Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add business-type and brand selection before creating an application, then render and persist the matching fields and workflow.

**Architecture:** A standalone template module owns business types, brands, field definitions, and workflow mappings. The application page consumes the module for the selection gate and dynamic editor; list and detail pages read the persisted template snapshot without duplicating template logic.

**Tech Stack:** Static HTML/CSS, browser JavaScript, localStorage, Node.js built-in test runner

---

### Task 1: Build the template configuration module

**Files:**
- Create: `js/recruit-application-templates.js`
- Create: `tests/recruit-application-templates.test.js`

- [x] Write tests asserting all six business types and three brands resolve, DP includes guarantee/project nodes, talent and KOC omit them, brand fields merge, and returned objects are cloned.
- [x] Run `node --test tests/recruit-application-templates.test.js` and confirm it fails because the module does not exist.
- [x] Implement the UMD-compatible template module with `getTemplate(type, brand)` and `getFieldLabel(key)`.
- [x] Re-run the test and confirm all assertions pass.

### Task 2: Add the selection gate and dynamic editor

**Files:**
- Modify: `pages/recruit/apply.html`

- [x] Add a responsive template selection panel with six business-type choices, three brand choices, and live material/workflow preview.
- [x] Add a locked template summary and dynamic field card to the editor.
- [x] Integrate selection, draft restoration, validation, read-only handling, and guarded template changes.
- [x] Persist template key/version, workflow node snapshot, and dynamic field values on submit.
- [x] Compile every inline script with `new Function` and verify required DOM IDs and stored fields exist.

### Task 3: Surface template metadata in application views

**Files:**
- Modify: `pages/recruit/mine.html`
- Modify: `pages/recruit/list.html`
- Modify: `pages/recruit/detail.html`

- [x] Show business type and brand on customer application cards.
- [x] Add business type and brand columns/filters to the operations list and mobile filter sheet.
- [x] Show template metadata, workflow nodes, and dynamic fields in application detail.
- [x] Compile inline scripts and verify new fields use escaped output.

### Task 4: Run end-to-end static verification

**Files:**
- Verify: `js/recruit-application-templates.js`
- Verify: `pages/recruit/apply.html`
- Verify: `pages/recruit/mine.html`
- Verify: `pages/recruit/list.html`
- Verify: `pages/recruit/detail.html`

- [x] Run the template unit tests.
- [x] Compile all affected inline scripts.
- [x] Run source assertions for business types, brands, template persistence, filters, and detail rendering.
- [x] Inspect the focused diff and confirm unrelated working-tree changes remain intact.

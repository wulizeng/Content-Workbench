# Remove New Application Sidebar Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every “新建申请” entry from the talent-side left navigation while preserving the content-area creation button and application workflow.

**Architecture:** This is a presentation-only change in four existing HTML files. Delete only the sidebar anchor nodes that render “新建申请”; do not modify routes, navigation functions, form logic, or the content-area button.

**Tech Stack:** Static HTML, inline JavaScript, shell-based source verification

---

### Task 1: Remove “新建申请” from all talent sidebars

**Files:**
- Modify: `index.html`
- Modify: `pages/recruit/mine.html`
- Modify: `pages/recruit/apply.html`
- Modify: `pages/recruit/project-plan.html`

- [ ] **Step 1: Run the regression check before editing**

Run:

```bash
node -e 'const fs=require("fs");const failures=[];const root=fs.readFileSync("index.html","utf8");if(/data-page="pages\/recruit\/apply\.html\?mode=add"[\s\S]{0,500}<span>新建申请<\/span>/.test(root))failures.push("index.html");for(const file of ["pages/recruit/mine.html","pages/recruit/apply.html","pages/recruit/project-plan.html"]){const html=fs.readFileSync(file,"utf8");const sidebar=(html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)||[])[1]||"";if(sidebar.includes("<span>新建申请</span>"))failures.push(file)}if(failures.length)throw new Error("sidebar menu still present: "+failures.join(", "))'
```

Expected: exit status 1 with `sidebar menu still present` listing all four files, so the desired post-change assertion does not yet hold.

- [ ] **Step 2: Delete the four sidebar menu nodes**

In `index.html`, delete the dynamically generated anchor whose page is `pages/recruit/apply.html?mode=add`:

```javascript
'<a class="sidebar-item" data-page="pages/recruit/apply.html?mode=add" onclick="switchSidebar(this)">' +
'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
'<span>新建申请</span>' +
'</a>' +
```

In each of `pages/recruit/mine.html`, `pages/recruit/apply.html`, and `pages/recruit/project-plan.html`, delete the `<aside class="sidebar">` anchor containing:

```html
<span>新建申请</span>
```

Do not delete the `.new-apply-btn` element in `pages/recruit/mine.html`.

- [ ] **Step 3: Verify sidebar entries are gone**

Run:

```bash
node -e 'const fs=require("fs");const failures=[];const root=fs.readFileSync("index.html","utf8");if(/data-page="pages\/recruit\/apply\.html\?mode=add"[\s\S]{0,500}<span>新建申请<\/span>/.test(root))failures.push("index.html");for(const file of ["pages/recruit/mine.html","pages/recruit/apply.html","pages/recruit/project-plan.html"]){const html=fs.readFileSync(file,"utf8");const sidebar=(html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)||[])[1]||"";if(sidebar.includes("<span>新建申请</span>"))failures.push(file)}if(failures.length)throw new Error("sidebar menu still present: "+failures.join(", "))'
```

Expected: no output and exit status 0.

- [ ] **Step 4: Verify the retained creation entry point and workflow**

Run:

```bash
rg -n 'new-apply-btn|goApply\(|apply.html\?mode=add|<div class="breadcrumb" id="pageTitle">新建申请</div>' pages/recruit/mine.html pages/recruit/apply.html
```

Expected: matches include the content-area `.new-apply-btn`, its `goApply('add')` handler, and the application page heading.

- [ ] **Step 5: Inspect the focused diff**

Run:

```bash
git diff -- index.html pages/recruit/mine.html pages/recruit/apply.html pages/recruit/project-plan.html
```

Expected: only the four intended sidebar anchor blocks are removed relative to the current working tree state; pre-existing unrelated edits remain unchanged.

# 招商入驻模块响应式改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `pages/recruit/` 下的 login.html、apply.html、list.html（及联动的 detail.html）在移动端（≤640px）、平板（641-1023px）、桌面端（≥1024px）三档视口下都有良好体验，同时不改变现有登录校验、草稿存储、审核流转等业务逻辑。

**Architecture:** 纯静态 HTML + 内联 `<style>` + 原生 JS（无框架，无打包工具），数据通过 `localStorage` mock。响应式改造以页面级 `@media` 断点（`≤640px` / `641px~1023px` / `≥1024px`）实现，尽量用 CSS 控制显隐/布局，JS 只在必要处（步骤向导、卡片渲染、底部抽屉、加载更多）新增交互逻辑，不引入构建工具。

**Tech Stack:** 原生 HTML5 / CSS3（`@media` 查询、CSS Grid/Flex）/ 原生 JavaScript（ES5 风格，与现有代码保持一致，函数声明用 `function`，避免箭头函数/`let`/`const` 之外的新语法，除非现有文件已使用）。

## Global Constraints

- 断点统一为：移动端 `≤640px`、平板 `641px~1023px`、桌面端 `≥1024px`（页面级 `@media`，不修改 `css/style.css` 的全局断点 1400px/1200px/768px）。
- 移动端表单类控件（input/select/button）最小触控高度 **48px**。
- 不改变登录校验逻辑、草稿存储机制（除新增的表单草稿自动保存/恢复本身是本次要新增的功能）、审核状态流转逻辑。
- 不涉及 `mine.html` 的响应式改造。
- 不涉及后端/接口层，继续基于 `localStorage` mock 数据。
- 所有新增 JS 函数使用与现有文件一致的命名风格（小驼峰），HTML 转义统一复用已有 `esc()` 函数。
- 本项目没有自动化测试框架和构建脚本；每个任务的"测试"步骤是**手动浏览器验证**：用 Chrome DevTools 的设备工具栏，将视口宽度调整到指定像素值，直接打开对应 HTML 文件（`file://` 路径）进行验证。

## File Structure

- `pages/recruit/login.html` — 仅新增移动端专属 CSS（`@media (max-width:640px)`），不改 JS。
- `pages/recruit/apply.html` — 新增：移动端步骤向导 HTML 结构与 CSS、步骤切换 JS、草稿自动保存/恢复 JS、平板双列 CSS、桌面端左侧步骤导航 HTML/CSS/JS。不改动现有 `validate()`/`doSubmit()`/`init()` 的核心字段读写逻辑，只在其外层包一层"当前步骤"控制。
- `pages/recruit/list.html` — 新增：移动端卡片渲染函数与 CSS、移动端筛选底部抽屉 HTML/CSS/JS、移动端"加载更多"分页 JS、平板列压缩与可折叠筛选 CSS/JS、桌面端操作列图标+文字与 hover 提示。
- `pages/recruit/detail.html` — 仅新增 `.detail-grid` 的移动端单列 CSS。

---

## Task 1: login.html 移动端响应式

**Files:**
- Modify: `pages/recruit/login.html:8-60`（`<style>` 块内追加移动端媒体查询）

**Interfaces:**
- 不涉及 JS，纯 CSS 追加，无对外接口。

- [ ] **Step 1: 在 `<style>` 块末尾（`.field-error-text` 规则之后，`</style>` 之前）追加移动端媒体查询**

在 `pages/recruit/login.html` 第 59 行 `.field-error-text { ... }` 规则之后插入：

```css
    @media (max-width: 640px) {
      .login-shell {
        width: 100%;
        max-width: none;
        margin: 0 20px;
        padding: 32px 20px;
      }
      .login-input {
        height: 48px;
        font-size: 15px;
        padding: 0 14px;
      }
      .login-input-row {
        gap: 8px;
      }
      .code-btn {
        min-width: 96px;
        height: 48px;
        font-size: 13px;
        padding: 0 10px;
      }
      .login-submit {
        height: 48px;
        font-size: 15px;
      }
    }
```

- [ ] **Step 2: 手动验证**

用浏览器打开 `pages/recruit/login.html`，打开 DevTools 设备工具栏，将视口宽度设为 `375px`（iPhone 尺寸）：
- 确认登录卡片撑满宽度（左右各留约 20px 边距），不再是居中的固定 400px 卡片
- 确认手机号/姓名/验证码输入框视觉高度变高（约 48px），点击后光标垂直居中
- 点击"获取验证码"，确认按钮不换行到下一行，且倒计时文字（如"60s后重试"）不会被截断

再将视口宽度设为 `1024px`：
- 确认登录卡片恢复为居中的固定宽度卡片，与改动前视觉一致（因为 `≥641px` 未定义任何新样式，走原有 CSS）

- [ ] **Step 3: 提交**

```bash
git add pages/recruit/login.html
git commit -m "招商入驻：login.html 移动端响应式适配"
```

---

## Task 2: apply.html 移动端分步向导（结构+样式+切换逻辑）

**Files:**
- Modify: `pages/recruit/apply.html:8-81`（`<style>` 块）
- Modify: `pages/recruit/apply.html:84-162`（HTML 结构：步骤条、`data-step` 属性、底部导航条）
- Modify: `pages/recruit/apply.html:166-365`（`<script>` 块）

**Interfaces:**
- Produces: 全局变量 `currentStep`（number，初始值 1）、常量 `TOTAL_STEPS`（number，值 3）、函数 `updateStepUI()`（无参数无返回值）、`stepPrev()`（无参数无返回值）、`stepNext()`（无参数无返回值，最后一步时调用已有 `doSubmit()`）。Task 3（草稿保存）依赖 `currentStep` 和 `updateStepUI()`。

- [ ] **Step 1: 在 `<style>` 块末尾（`.locked-banner { ... }` 之后，`</style>` 之前）追加移动端步骤向导样式**

```css
    @media (max-width: 640px) {
      .apply-shell { padding: 0 0 88px; }
      .apply-header { padding: 16px 20px 0; }
      .mobile-step-bar {
        display: flex; position: sticky; top: 0; z-index: 10;
        background: #fff; border-bottom: 1px solid var(--border);
        padding: 12px 20px; margin: 12px 0 0;
      }
      .mobile-step-item {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
        font-size: 12px; color: #94a3b8;
      }
      .mobile-step-item .num {
        width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; color: #64748b;
        display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
        flex-shrink: 0;
      }
      .mobile-step-item.active { color: var(--primary); font-weight: 600; }
      .mobile-step-item.active .num { background: var(--primary); color: #fff; }
      .form-card[data-step] { display: none; margin-left: 20px; margin-right: 20px; }
      .form-card[data-step].step-active { display: block; }
      #formActions { display: none; }
      .mobile-step-nav {
        display: flex; gap: 10px; position: fixed; bottom: 0; left: 0; right: 0;
        background: #fff; border-top: 1px solid var(--border); padding: 12px 20px;
        z-index: 10;
      }
      .mobile-step-nav .btn { flex: 1; height: 48px; }
      .form-input, .form-select { height: 48px; }
      .upload-zone { min-height: 120px; }
    }
    @media (min-width: 641px) {
      .mobile-step-bar, .mobile-step-nav { display: none; }
    }
```

- [ ] **Step 2: 在 HTML 结构中插入移动端步骤条，并给三个 `.form-card` 加上 `data-step` 标记**

在 `pages/recruit/apply.html` 第 96 行 `<div class="locked-banner" ...>` 之后、`<form id="mainForm">` 之前插入步骤条：

```html
  <div class="mobile-step-bar" id="mobileStepBar">
    <div class="mobile-step-item" data-step-tab="1"><span class="num">1</span>基础信息</div>
    <div class="mobile-step-item" data-step-tab="2"><span class="num">2</span>平台账号</div>
    <div class="mobile-step-item" data-step-tab="3"><span class="num">3</span>业绩证明</div>
  </div>
```

将现有三个 `.form-card` 分别加上 `data-step` 属性（不改变其内部内容）：
- 第 99 行 `<div class="form-card">`（基础信息）改为 `<div class="form-card" data-step="1">`
- 第 121 行 `<div class="form-card">`（平台账号）改为 `<div class="form-card" data-step="2">`
- 第 133 行 `<div class="form-card">`（业绩证明）改为 `<div class="form-card" data-step="3">`

在第 156 行现有 `<div class="form-actions" id="formActions">...</div>` 之后追加移动端底部导航条：

```html
    <div class="mobile-step-nav" id="mobileStepNav">
      <button type="button" class="btn" id="stepPrevBtn" onclick="stepPrev()">上一步</button>
      <button type="button" class="btn btn-primary" id="stepNextBtn" onclick="stepNext()">下一步</button>
    </div>
```

- [ ] **Step 3: 在 `<script>` 块中新增步骤控制逻辑**

在 `pages/recruit/apply.html` 现有 `var shots = [];`（第 174 行）之后新增：

```javascript
var TOTAL_STEPS = 3;
var currentStep = 1;

function isMobileStepMode() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function updateStepUI() {
  if (!isMobileStepMode()) return;
  document.querySelectorAll('.form-card[data-step]').forEach(function(card) {
    card.classList.toggle('step-active', Number(card.getAttribute('data-step')) === currentStep);
  });
  document.querySelectorAll('.mobile-step-item').forEach(function(tab) {
    tab.classList.toggle('active', Number(tab.getAttribute('data-step-tab')) === currentStep);
  });
  document.getElementById('stepPrevBtn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  document.getElementById('stepNextBtn').textContent = currentStep === TOTAL_STEPS ? '提交申请' : '下一步';
}

function stepPrev() {
  if (currentStep > 1) { currentStep--; updateStepUI(); window.scrollTo(0, 0); }
}

function stepNext() {
  if (currentStep < TOTAL_STEPS) { currentStep++; updateStepUI(); window.scrollTo(0, 0); }
  else { doSubmit(); }
}
```

在文件末尾 `init();`（第 364 行）之后追加对 `updateStepUI()` 的调用：

```javascript
updateStepUI();
```

- [ ] **Step 4: 手动验证**

用浏览器打开 `pages/recruit/apply.html?mode=add`，DevTools 设备工具栏设为 `375px`：
- 确认页面顶部出现三步骤条（① 基础信息 / ② 平台账号 / ③ 业绩证明），当前步骤高亮
- 确认只显示"基础信息"卡片，其余两个卡片隐藏
- 确认底部固定显示"上一步"（隐藏，因为是第一步）和"下一步"按钮
- 点击"下一步"，确认切换到"平台账号"卡片，步骤条第2项高亮，"上一步"按钮出现
- 连续点击"下一步"到第三步，确认按钮文字变为"提交申请"
- 点击"上一步"能正确返回上一屏
- 在第三步点击"提交申请"（不填必填项），确认原有校验逻辑仍触发（红框+错误提示+toast），说明 `doSubmit()`→`validate()` 未被破坏

将视口宽度设为 `1024px`：
- 确认步骤条和底部导航条不显示，三个 `.form-card` 全部正常显示（因为 `updateStepUI()` 内 `isMobileStepMode()` 为 false 时直接返回，不会给卡片加 `step-active` 限制，且 CSS 里桌面端没有 `display:none` 规则）

- [ ] **Step 5: 提交**

```bash
git add pages/recruit/apply.html
git commit -m "招商入驻：apply.html 移动端分步向导"
```

---

## Task 3: apply.html 移动端草稿自动保存与恢复

**Files:**
- Modify: `pages/recruit/apply.html`（`<script>` 块）

**Interfaces:**
- Consumes: Task 2 的 `currentStep`（number）、`updateStepUI()`
- Produces: 函数 `saveDraft()`（无参数无返回值）、`restoreDraft()`（无参数，返回 boolean：是否成功恢复了草稿）、`clearDraft()`（无参数无返回值）。localStorage key `recruit_apply_draft_<phone>`。

草稿仅用于"新建"模式（`mode==='add'`）下防止移动端刷新丢失已填内容；编辑模式（`mode==='edit'`）不启用草稿（避免覆盖服务器/mock 记录）。

- [ ] **Step 1: 在 `<script>` 块中新增草稿保存/恢复函数**

在 Task 2 新增的 `stepNext()` 函数之后追加：

```javascript
var DRAFT_KEY = 'recruit_apply_draft_' + phone;

function saveDraft() {
  if (mode !== 'add') return;
  var draft = {
    currentStep: currentStep,
    brand: document.getElementById('brand').value,
    mainProduct: document.getElementById('mainProduct').value,
    gmv: document.getElementById('gmv').value,
    platformAccounts: collectPlatformAccounts().map(function(a) { return { platform: a.platform, account_name: a.account_name }; }),
    shots: shots.slice()
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function restoreDraft() {
  if (mode !== 'add') return false;
  var raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  var draft;
  try { draft = JSON.parse(raw); } catch (e) { return false; }
  if (!draft) return false;

  document.getElementById('brand').value = draft.brand || '';
  document.getElementById('mainProduct').value = draft.mainProduct || '';
  document.getElementById('gmv').value = draft.gmv || '';
  shots = (draft.shots || []).slice();
  renderShots();
  document.getElementById('platformAccountList').innerHTML = '';
  (draft.platformAccounts || []).forEach(function(pa) {
    addPlatformAccount(pa.platform, pa.account_name);
  });
  if ((draft.platformAccounts || []).length === 0) addPlatformAccount();
  currentStep = draft.currentStep || 1;
  return true;
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
```

- [ ] **Step 2: 在 `init()` 函数中接入草稿恢复，在 `doSubmit()` 成功后清空草稿，并监听输入自动保存**

修改 `init()` 函数（现有代码结尾的 `addPlatformAccount();` 一行）：将

```javascript
  addPlatformAccount();
}
```

改为：

```javascript
  if (mode === 'add' && restoreDraft()) {
    showToast('已恢复上次填写的草稿', 'info');
  } else {
    addPlatformAccount();
  }
}
```

修改 `doSubmit()` 函数中 `localStorage.setItem('recruit_applications', JSON.stringify(apps));` 之后，插入 `clearDraft();`：

```javascript
  localStorage.setItem('recruit_applications', JSON.stringify(apps));
  clearDraft();
  showToast('提交成功', 'success');
```

在文件末尾 `updateStepUI();`（Task 2 新增）之后追加自动保存的事件监听：

```javascript
document.getElementById('mainForm').addEventListener('input', saveDraft);
document.getElementById('mainForm').addEventListener('change', saveDraft);
```

同时在 `stepNext()` 和 `stepPrev()` 中调用 `saveDraft()`，确保切换步骤时也保存当前步数。将 Task 2 中的：

```javascript
function stepPrev() {
  if (currentStep > 1) { currentStep--; updateStepUI(); window.scrollTo(0, 0); }
}

function stepNext() {
  if (currentStep < TOTAL_STEPS) { currentStep++; updateStepUI(); window.scrollTo(0, 0); }
  else { doSubmit(); }
}
```

改为：

```javascript
function stepPrev() {
  if (currentStep > 1) { currentStep--; updateStepUI(); saveDraft(); window.scrollTo(0, 0); }
}

function stepNext() {
  if (currentStep < TOTAL_STEPS) { currentStep++; updateStepUI(); saveDraft(); window.scrollTo(0, 0); }
  else { doSubmit(); }
}
```

- [ ] **Step 3: 手动验证**

用浏览器打开 `pages/recruit/apply.html?mode=add`，DevTools 设为 `375px`：
- 在"基础信息"步填入品牌和主推产品，点击"下一步"到"平台账号"步
- 刷新页面（F5），确认页面重新打开时自动停在"平台账号"步（`currentStep` 恢复），且"基础信息"步的品牌/主推产品字段值也已恢复，并弹出"已恢复上次填写的草稿"提示
- 完成剩余步骤并成功提交后，重新打开 `apply.html?mode=add`，确认不再恢复出刚才的草稿（因为 `clearDraft()` 已清空），页面是全新空表单

用浏览器打开 `pages/recruit/apply.html?mode=edit&id=4`（对应 mock 数据中已驳回的记录），确认编辑模式下不会触发草稿恢复逻辑，字段值来自 `recruit_applications` 中的记录本身。

- [ ] **Step 4: 提交**

```bash
git add pages/recruit/apply.html
git commit -m "招商入驻：apply.html 移动端表单草稿自动保存与恢复"
```

---

## Task 4: apply.html 平板双列布局

**Files:**
- Modify: `pages/recruit/apply.html`（`<style>` 块）

**Interfaces:**
- 不涉及 JS，纯 CSS 追加。

- [ ] **Step 1: 在 `<style>` 块末尾追加平板媒体查询**

```css
    @media (min-width: 641px) and (max-width: 1023px) {
      .apply-shell { max-width: 720px; }
      .form-card[data-step="1"] .form-group,
      .form-card[data-step="3"] .form-group:first-child {
        display: inline-block;
        width: calc(50% - 8px);
        vertical-align: top;
      }
      .form-card[data-step="1"] .form-group:nth-child(odd),
      .form-card[data-step="3"] .form-group:nth-child(odd) {
        margin-right: 16px;
      }
    }
```

说明：由于第一个 `.form-card`（`data-step="1"`）只有两个 `.form-group`（品牌、主推产品），用 `inline-block` 双列即可让它们同行显示，无需重写为 grid 容器结构（避免大改现有 DOM）。第三个 `.form-card`（`data-step="3"`）的第一个 `.form-group`（GMV）单独占左列，第二个 `.form-group`（业绩截图）保持独占一行——因此选择器只对 `:first-child` 生效，截图上传区域自然换行占满宽度。

- [ ] **Step 2: 手动验证**

用浏览器打开 `pages/recruit/apply.html?mode=add`，DevTools 设为 `768px`：
- 确认表单整体宽度收窄到约 720px 并居中
- 确认"基础信息"卡片中"运营品牌"和"主推产品"两个字段左右并排显示
- 确认"业绩证明"卡片中"近3个月GMV"和"业绩截图上传区"不是并排（截图上传区域独占一行，宽度占满卡片）
- 确认移动端步骤条/底部导航条不显示（因为不在 `≤640px` 范围），也没有出现桌面端左侧导航（Task 5 尚未实现，此时表现应与原版一致，只是宽度收窄+两列）

- [ ] **Step 3: 提交**

```bash
git add pages/recruit/apply.html
git commit -m "招商入驻：apply.html 平板双列布局"
```

---

## Task 5: apply.html 桌面端左侧步骤导航

**Files:**
- Modify: `pages/recruit/apply.html`（`<style>`、HTML、`<script>` 块）

**Interfaces:**
- Consumes: Task 2 的 `TOTAL_STEPS`、`currentStep`
- Produces: 函数 `desktopGoToStep(step)`（参数 step: number，无返回值）、`isStepFilled(step)`（参数 step: number，返回 boolean）

桌面端不隐藏卡片（三个 `.form-card` 全部显示，用户可滚动浏览全部字段），左侧导航仅用于**滚动定位**和展示进度，不像移动端那样切换 `display`。点击导航项会平滑滚动到对应卡片；未填写完的步骤禁止跳转（用 `isStepFilled` 判断）。

- [ ] **Step 1: 在 `<style>` 块末尾追加桌面端样式**

```css
    @media (min-width: 1024px) {
      body { display: flex; justify-content: center; }
      .apply-shell { max-width: 640px; margin: 24px 0 24px 260px; }
      .desktop-step-nav {
        display: flex; flex-direction: column; gap: 4px;
        position: fixed; top: 24px; left: max(20px, calc(50% - 460px));
        width: 220px; background: #fff; border: 1px solid var(--border);
        border-radius: 14px; padding: 16px;
      }
      .desktop-step-nav .dsn-item {
        display: flex; align-items: center; gap: 10px; padding: 10px 12px;
        border-radius: 8px; font-size: 13px; color: #94a3b8; cursor: pointer;
      }
      .desktop-step-nav .dsn-item .num {
        width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #94a3b8;
        display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
        flex-shrink: 0;
      }
      .desktop-step-nav .dsn-item.filled { color: var(--text); }
      .desktop-step-nav .dsn-item.filled .num { background: var(--primary-light); color: var(--primary); }
      .desktop-step-nav .dsn-item.current { background: var(--primary-light); color: var(--primary); font-weight: 600; }
      .desktop-step-nav .dsn-item.current .num { background: var(--primary); color: #fff; }
      .desktop-step-nav .dsn-item.disabled { cursor: not-allowed; }
    }
    @media (max-width: 1023px) {
      .desktop-step-nav { display: none; }
    }
```

- [ ] **Step 2: 在 HTML 中插入桌面端导航条**

在 `pages/recruit/apply.html` 中，`<div class="apply-shell">` 开始标签之前插入：

```html
  <div class="desktop-step-nav" id="desktopStepNav">
    <div class="dsn-item" data-dsn-step="1" onclick="desktopGoToStep(1)"><span class="num">1</span>基础信息</div>
    <div class="dsn-item" data-dsn-step="2" onclick="desktopGoToStep(2)"><span class="num">2</span>平台账号</div>
    <div class="dsn-item" data-dsn-step="3" onclick="desktopGoToStep(3)"><span class="num">3</span>业绩证明</div>
  </div>
```

- [ ] **Step 3: 在 `<script>` 块新增桌面导航逻辑，并接入 `updateStepUI()`**

在 Task 3 新增的 `clearDraft()` 函数之后追加：

```javascript
function isStepFilled(step) {
  if (step === 1) {
    return !!(document.getElementById('brand').value.trim() && document.getElementById('mainProduct').value.trim());
  }
  if (step === 2) {
    var accounts = collectPlatformAccounts();
    return accounts.length > 0 && accounts.every(function(a) { return a.account_name; });
  }
  if (step === 3) {
    return !!(document.getElementById('gmv').value.toString().trim()) && shots.length > 0;
  }
  return false;
}

function desktopGoToStep(step) {
  if (step > 1 && !isStepFilled(step - 1)) return;
  var target = document.querySelector('.form-card[data-step="' + step + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateDesktopNavUI() {
  var nav = document.getElementById('desktopStepNav');
  if (!nav) return;
  for (var s = 1; s <= TOTAL_STEPS; s++) {
    var item = nav.querySelector('[data-dsn-step="' + s + '"]');
    var filled = isStepFilled(s);
    item.classList.toggle('filled', filled);
    item.classList.toggle('disabled', s > 1 && !isStepFilled(s - 1));
  }
}
```

修改 Task 2 中的 `updateStepUI()` 函数，在其末尾追加对 `updateDesktopNavUI()` 的调用：

```javascript
function updateStepUI() {
  if (!isMobileStepMode()) { updateDesktopNavUI(); return; }
  document.querySelectorAll('.form-card[data-step]').forEach(function(card) {
    card.classList.toggle('step-active', Number(card.getAttribute('data-step')) === currentStep);
  });
  document.querySelectorAll('.mobile-step-item').forEach(function(tab) {
    tab.classList.toggle('active', Number(tab.getAttribute('data-step-tab')) === currentStep);
  });
  document.getElementById('stepPrevBtn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  document.getElementById('stepNextBtn').textContent = currentStep === TOTAL_STEPS ? '提交申请' : '下一步';
}
```

在 `updateStepUI()` 每次调用时（包括 Task 3 里 `saveDraft` 触发的 `input`/`change` 监听）都会刷新桌面导航的填充状态高亮，因此额外在 `document.getElementById('mainForm').addEventListener('input', saveDraft);` 之后追加：

```javascript
document.getElementById('mainForm').addEventListener('input', updateStepUI);
document.getElementById('mainForm').addEventListener('change', updateStepUI);
```

- [ ] **Step 4: 手动验证**

用浏览器打开 `pages/recruit/apply.html?mode=add`，DevTools 设为 `1440px`：
- 确认左侧出现固定导航条（基础信息/平台账号/业绩证明），右侧表单区域三个卡片全部正常显示（未分步隐藏）
- 初始状态下"平台账号"和"业绩证明"导航项呈禁用态样式（灰色，不可点击态视觉）
- 填写完"基础信息"两个字段后，"平台账号"导航项变为可点击态（`filled`/取消 `disabled`），点击后页面平滑滚动到"平台账号"卡片
- 在"平台账号"未填完运营账号前，尝试点击"业绩证明"导航项，确认无法跳转（滚动位置不变）
- 缩小视口到 `1023px` 及以下，确认左侧导航条消失，布局回退到 Task 4（平板）或 Task 2（移动端）的样式

- [ ] **Step 5: 提交**

```bash
git add pages/recruit/apply.html
git commit -m "招商入驻：apply.html 桌面端步骤导航"
```

---

## Task 6: list.html 桌面端增强

**Files:**
- Modify: `pages/recruit/list.html:7`（在 `<link rel="stylesheet">` 之后、`</head>` 之前新增 `<style>` 块）
- Modify: `pages/recruit/list.html:100-122`（`renderTable(data)` 函数：操作列图标化、平台摘要 title 提示）

**Interfaces:**
- Produces: list.html 页面级 `<style>` 块（Task 7、Task 8 会继续向其中追加规则）。`renderTable(data)` 新增输出：操作列 `<a class="link-action link-action-icon" title="查看详情">` 含放大镜 SVG；平台摘要单元格带 `title` 属性（完整摘要文本）。

桌面端表头 sticky 已由全局 `css/style.css`（`.data-table thead th` 规则，含 `position: sticky; top: 0; z-index: 1;`）满足，本任务不新增 sticky CSS，仅在验证步骤中确认。

- [ ] **Step 1: 在 `</head>` 之前新增页面级 `<style>` 块**

在 `pages/recruit/list.html` 第 7 行 `<link rel="stylesheet" href="../../css/style.css">` 之后、第 8 行 `</head>` 之前插入：

```html
  <style>
    /* 桌面端：操作列图标+文字链接 */
    .link-action-icon {
      display: inline-flex; align-items: center; gap: 4px;
    }
    .link-action-icon svg { flex-shrink: 0; }
    /* 窄桌面（1024~1279px）：平台账号摘要允许换行，不单独隐藏 */
    @media (min-width: 1024px) and (max-width: 1279px) {
      #dataTable td.col-platform { white-space: normal; word-break: break-all; }
    }
  </style>
```

- [ ] **Step 2: 修改 `renderTable(data)` 的操作列与平台摘要列**

将 `pages/recruit/list.html` 第 111 行：

```javascript
      html += '<td>' + esc(platformSummary(row.platform_accounts)) + '</td>';
```

改为：

```javascript
      html += '<td class="col-platform" title="' + esc(platformSummary(row.platform_accounts)) + '">' + esc(platformSummary(row.platform_accounts)) + '</td>';
```

将第 116 行：

```javascript
      html += '<a class="link-action" href="detail.html?id='+row.id+'&mode=view">查看</a>';
```

改为：

```javascript
      html += '<a class="link-action link-action-icon" title="查看详情" href="detail.html?id='+row.id+'&mode=view"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>查看</a>';
```

- [ ] **Step 3: 手动验证**

用浏览器打开 `pages/recruit/list.html`，DevTools 设为 `1440px`：
- 确认表格表头在向下滚动页面时保持吸顶（sticky，由全局样式提供，本任务仅确认未被破坏）
- 确认操作列"查看"前出现放大镜图标，鼠标悬停时出现浏览器原生 tooltip "查看详情"，且原有下划线 hover 动画（`.link-action::after`）仍然生效
- 确认平台账号摘要单元格鼠标悬停时出现完整内容的原生 tooltip

将视口宽度设为 `1100px`（落在 1024~1279px 窄桌面区间）：
- 确认"平台账号摘要"列内容在单元格内自动换行显示（不出现省略号、不隐藏）

- [ ] **Step 4: 提交**

```bash
git add pages/recruit/list.html
git commit -m "招商入驻：list.html 桌面端操作列图标化与平台摘要提示"
```

---

## Task 7: list.html 平板端布局

**Files:**
- Modify: `pages/recruit/list.html`（`<style>` 块、`renderTable(data)`、`.search-area` HTML、`<script>` 块）

**Interfaces:**
- Consumes: Task 6 新增的页面级 `<style>` 块、`renderTable(data)` 中带 `title` 的平台摘要单元格
- Produces: 函数 `toggleSearchFold()`（无参数无返回值，切换平板筛选区折叠）；`renderTable(data)` 在状态单元格内额外输出 `<div class="td-sub-time">创建时间</div>`（桌面端隐藏、平板端显示）；`.search-area` 新增折叠切换按钮 `#searchFoldBtn`。

注意：`css/style.css` 已存在一个全局 `@media (max-width: 768px)` 规则（含 `.data-table thead th/tbody td` 等）。本任务使用页面级 `@media (min-width:641px) and (max-width:1023px)` 断点，与全局 768px 区间有重叠，因此本任务对表格列的隐藏规则必须使用更高特异性的选择器（以 `#dataTable` 限定），避免与全局规则冲突。

- [ ] **Step 1: 修改 `renderTable(data)`，在状态单元格内叠加创建时间小字**

将 `pages/recruit/list.html` 中（Task 6 修改后的）状态列那一行：

```javascript
      html += '<td>' + st(row.status) + '</td>';
```

改为：

```javascript
      html += '<td class="col-status">' + st(row.status) + '<div class="td-sub-time">' + esc(row.created_at) + '</div></td>';
```

- [ ] **Step 2: 在 `.search-area` 中新增折叠切换按钮，并给 `.search-area` 加上默认折叠类**

将 `pages/recruit/list.html` 第 23 行：

```html
  <div class="search-area">
```

改为：

```html
  <div class="search-area folded">
```

并在其后、第 24 行 `<div class="search-row">` 之前插入：

```html
    <div class="search-fold-bar">
      <button type="button" class="btn" id="searchFoldBtn" onclick="toggleSearchFold()">筛选 &#9662;</button>
    </div>
```

- [ ] **Step 3: 在 `<script>` 块新增折叠切换函数**

在 `pages/recruit/list.html` 现有 `clearSearchTag(id)` 函数（约第 169-172 行）之后追加：

```javascript
function toggleSearchFold() {
  var area = document.querySelector('.search-area');
  var btn = document.getElementById('searchFoldBtn');
  var folded = area.classList.toggle('folded');
  btn.innerHTML = folded ? '筛选 &#9662;' : '筛选 &#9652;';
}
```

- [ ] **Step 4: 在页面级 `<style>` 块末尾追加平板媒体查询**

在 Task 6 新增的 `<style>` 块中、`</style>` 之前追加：

```css
    /* 基础规则：折叠按钮默认隐藏（必须写在平板媒体查询之前，平板区间内靠后出现的 display:block 才能覆盖它） */
    .search-fold-bar { display: none; }
    /* 平板（641~1023px）：隐藏次要列、压缩平台摘要、筛选区可折叠 */
    @media (min-width: 641px) and (max-width: 1023px) {
      /* 隐藏"提交时间"独立列（收进状态列下方小字展示） */
      #dataTable thead th:nth-child(7),
      #dataTable tbody td:nth-child(7) { display: none; }
      /* 状态列下方叠加的创建时间小字：平板显示、桌面隐藏 */
      #dataTable .td-sub-time { display: block; margin-top: 4px; font-size: 11px; color: #94a3b8; }
      /* 平台账号摘要列：压缩宽度 + 省略号 + hover 提示（title 已由 renderTable 提供） */
      #dataTable td.col-platform {
        max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      /* 筛选区折叠：折叠按钮仅在平板区间显示；带 folded 类时隐藏筛选项与按钮 */
      .search-fold-bar { display: block; margin-bottom: 8px; }
      .search-area.folded .search-row,
      .search-area.folded .search-actions { display: none; }
    }
    /* 桌面端：状态列下方叠加时间小字隐藏（独立"提交时间"列恢复显示由浏览器默认表格布局提供） */
    @media (min-width: 1024px) {
      #dataTable .td-sub-time { display: none; }
    }
```

说明：折叠采用**类切换**而非内联 `style.display` 切换——HTML 默认给 `.search-area` 带 `folded` 类，平板区间的 CSS 规则 `.search-area.folded .search-row/.search-actions { display:none }` 使其默认收起；`toggleSearchFold()` 用 `classList.toggle('folded')` 切换，移除该类后筛选项按基础样式（默认显示）展开。`.search-fold-bar { display:none }` 基础规则写在平板媒体查询**之前**，平板区间内后出现的 `display:block` 因级联顺序靠后而生效；桌面端（≥1024px）不命中平板区间，折叠按钮始终隐藏，`.search-area.folded` 的隐藏规则也仅在平板区间内声明，因此桌面端筛选项不受 `folded` 类影响，保持常驻横排。

- [ ] **Step 5: 手动验证**

用浏览器打开 `pages/recruit/list.html`，DevTools 设为 `768px`（平板）：
- 确认表格中"提交时间"独立列消失，而"状态"列的状态徽章下方出现灰色小字创建时间
- 确认"平台账号摘要"列宽度收窄，超长内容以省略号截断，鼠标悬停出现完整内容 tooltip
- 确认搜索区域三个筛选项默认收起，只显示一个"筛选 ▾"按钮；点击后筛选项与查询/重置按钮展开，按钮箭头翻转为 ▴；再次点击收起

将视口设为 `1440px`（桌面端）：
- 确认"提交时间"独立列重新出现，状态列下方小字消失，筛选区恢复为常驻横排（无折叠按钮）

- [ ] **Step 6: 提交**

```bash
git add pages/recruit/list.html
git commit -m "招商入驻：list.html 平板端列压缩与可折叠筛选"
```

---

## Task 8: list.html 移动端卡片流

**Files:**
- Modify: `pages/recruit/list.html`（`<style>` 块、HTML 结构、`<script>` 块）

**Interfaces:**
- Consumes: Task 6/7 的页面级 `<style>` 块；`talentName(phone)`、`platformSummary(accounts)`、`st(s)`、`esc(s)`、`doSearch()`、`resetSearch()`、`mockData`（均为现有/前序任务产物）
- Produces: 函数 `renderCards(data)`（参数 data: array，无返回值，渲染移动端卡片到 `#cardList`）、`renderView(data)`（参数 data: array，无返回值，按视口分发到 `renderTable` 或 `renderCards`）、`toggleFilterSheet()`（无参数无返回值，切换底部筛选抽屉）、`loadMore()`（无参数无返回值，移动端卡片加载更多）。全局变量 `mobileShownCount`（number）、`MOBILE_PAGE_SIZE`（number，值 10）、`currentFiltered`（array，当前筛选结果集，供加载更多复用）。

设计要点：移动端（≤640px）隐藏整个 `.table-area` 内的 `<table>`，改为渲染卡片流到新增的 `#cardList` 容器；分页在移动端改为"加载更多"按钮（桌面/平板仍一次性渲染全部，不受影响）。`renderView(data)` 作为统一入口，`doSearch()`/`resetSearch()`/初始化均改为调用它，并监听 `resize` 在跨断点时重渲染。

- [ ] **Step 1: 新增卡片容器、悬浮筛选按钮、底部抽屉的 HTML**

在 `pages/recruit/list.html` 第 56 行 `<div class="table-area">` 之前插入移动端卡片容器：

```html
  <div class="card-list" id="cardList"></div>
  <div class="load-more-bar" id="loadMoreBar" style="display:none;">
    <button type="button" class="btn" onclick="loadMore()">加载更多</button>
  </div>
```

在文件 `</div>`（`.page-container` 闭合标签，第 83 行）之前、`<script>`（第 85 行）之前插入悬浮筛选按钮与底部抽屉：

```html
  <button type="button" class="filter-fab" id="filterFab" onclick="toggleFilterSheet()">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
    筛选
  </button>

  <div class="filter-sheet-overlay" id="filterSheetOverlay" style="display:none;" onclick="if(event.target===this) toggleFilterSheet()">
    <div class="filter-sheet">
      <div class="filter-sheet-head">
        <span>筛选条件</span>
        <button type="button" class="filter-sheet-close" onclick="toggleFilterSheet()">&times;</button>
      </div>
      <div class="filter-sheet-body">
        <div class="search-item"><label>申请人手机号：</label><input type="text" id="mSPhone" placeholder="请输入手机号"></div>
        <div class="search-item"><label>平台：</label>
          <select id="mSPlatform"><option value="">全部</option><option value="抖音">抖音</option><option value="视频号">视频号</option><option value="快手">快手</option></select>
        </div>
        <div class="search-item"><label>状态：</label>
          <select id="mSStatus"><option value="">全部</option><option value="已提交">已提交</option><option value="审核中">审核中</option><option value="已审核">已审核</option><option value="已驳回">已驳回</option></select>
        </div>
      </div>
      <div class="filter-sheet-foot">
        <button type="button" class="btn" onclick="resetMobileSearch()">重置</button>
        <button type="button" class="btn btn-primary" onclick="doMobileSearch()">查询</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: 在页面级 `<style>` 块末尾追加移动端样式（卡片、chip、抽屉、悬浮按钮、加载更多）**

在 `<style>` 块 `</style>` 之前追加：

```css
    /* 移动端（≤640px）：卡片流 + 底部抽屉筛选 + 加载更多 */
    .card-list, .load-more-bar, .filter-fab, .filter-sheet-overlay { display: none; }
    @media (max-width: 640px) {
      .search-area { display: none; }
      .table-area .table-scroll, .table-area .pagination { display: none; }
      .card-list { display: block; }
      .recruit-card {
        background: #fff; border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 12px;
      }
      .recruit-card-head {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
      }
      .recruit-card-head .name { font-size: 15px; font-weight: 700; color: var(--text); }
      .recruit-card-body { font-size: 13px; color: var(--text-secondary); line-height: 1.9; }
      .recruit-card-body .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .chip {
        display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 12px;
        background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 600;
      }
      .recruit-card-foot {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light);
      }
      .recruit-card-foot .time { font-size: 12px; color: #94a3b8; }
      .load-more-bar { display: block; text-align: center; margin: 8px 0 16px; }
      .load-more-bar .btn { width: 100%; height: 44px; }
      .filter-fab {
        display: inline-flex; align-items: center; gap: 6px;
        position: fixed; right: 16px; bottom: 24px; z-index: 50;
        height: 44px; padding: 0 18px; border: none; border-radius: 22px;
        background: var(--primary); color: #fff; font-size: 14px; font-weight: 600;
        box-shadow: 0 6px 18px rgba(91,108,245,.35); cursor: pointer;
      }
      .filter-sheet-overlay {
        display: flex; position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,.45); align-items: flex-end;
      }
      .filter-sheet {
        width: 100%; background: #fff; border-radius: 16px 16px 0 0;
        padding: 8px 20px calc(20px + env(safe-area-inset-bottom));
        animation: sheetUp .25s ease;
      }
      @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .filter-sheet-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 0; font-size: 15px; font-weight: 700; color: var(--text);
      }
      .filter-sheet-close { border: none; background: transparent; font-size: 22px; color: #94a3b8; cursor: pointer; }
      .filter-sheet-body .search-item { display: block; margin-bottom: 14px; }
      .filter-sheet-body .search-item label { display: block; margin-bottom: 6px; font-size: 13px; color: var(--text-secondary); }
      .filter-sheet-body .search-item input,
      .filter-sheet-body .search-item select { width: 100%; height: 48px; box-sizing: border-box; }
      .filter-sheet-foot { display: flex; gap: 10px; }
      .filter-sheet-foot .btn { flex: 1; height: 48px; }
    }
```

- [ ] **Step 3: 在 `<script>` 块新增卡片渲染、视口分发、抽屉与加载更多逻辑**

在 `pages/recruit/list.html` 现有 `clearSearchTag(id)` 与 Task 7 新增的 `toggleSearchFold()` 之后追加：

```javascript
var MOBILE_PAGE_SIZE = 10;
var mobileShownCount = MOBILE_PAGE_SIZE;
var currentFiltered = mockData.slice();

function isMobileView() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function renderCards(data) {
  var list = document.getElementById('cardList');
  var slice = data.slice(0, mobileShownCount);
  var html = '';
  if (slice.length === 0) {
    html = '<div class="recruit-card"><div class="recruit-card-body">暂无符合条件的申请</div></div>';
  } else {
    slice.forEach(function(row) {
      var chips = (row.platform_accounts || []).map(function(a) {
        return '<span class="chip">' + esc(a.platform) + ' ' + esc(a.account_name) + '</span>';
      }).join('');
      html += '<div class="recruit-card">';
      html += '<div class="recruit-card-head"><span class="name">' + esc(talentName(row.phone)) + '</span>' + st(row.status) + '</div>';
      html += '<div class="recruit-card-body">';
      html += '<div>手机号：' + esc(row.phone) + '</div>';
      html += '<div>近3个月GMV：&#165;' + Number(row.gmv).toLocaleString('zh-CN') + '</div>';
      if (chips) html += '<div class="chip-row">' + chips + '</div>';
      html += '</div>';
      html += '<div class="recruit-card-foot"><span class="time">' + esc(row.created_at) + '</span>';
      html += '<a class="btn btn-primary" style="height:36px;line-height:36px;padding:0 16px;" href="detail.html?id=' + row.id + '&mode=view">查看详情</a>';
      html += '</div></div>';
    });
  }
  list.innerHTML = html;
  var bar = document.getElementById('loadMoreBar');
  bar.style.display = data.length > mobileShownCount ? '' : 'none';
}

function renderView(data) {
  currentFiltered = data;
  if (isMobileView()) {
    renderCards(data);
  } else {
    renderTable(data);
  }
}

function loadMore() {
  mobileShownCount += MOBILE_PAGE_SIZE;
  renderCards(currentFiltered);
}

function toggleFilterSheet() {
  var overlay = document.getElementById('filterSheetOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
}

function doMobileSearch() {
  var p = document.getElementById('mSPhone').value.trim();
  var pf = document.getElementById('mSPlatform').value;
  var s = document.getElementById('mSStatus').value;
  var f = mockData.filter(function(x) {
    if (p && x.phone.indexOf(p) < 0) return false;
    if (pf && !x.platform_accounts.some(function(a){ return a.platform === pf; })) return false;
    if (s && x.status !== s) return false;
    return true;
  });
  mobileShownCount = MOBILE_PAGE_SIZE;
  renderView(f);
  toggleFilterSheet();
}

function resetMobileSearch() {
  document.getElementById('mSPhone').value = '';
  document.getElementById('mSPlatform').value = '';
  document.getElementById('mSStatus').value = '';
  mobileShownCount = MOBILE_PAGE_SIZE;
  renderView(mockData);
}

window.addEventListener('resize', function() { renderView(currentFiltered); });
```

- [ ] **Step 4: 将初始化与桌面搜索改为调用 `renderView`**

将文件末尾（约第 192-193 行）：

```javascript
localStorage.setItem('recruit_applications', JSON.stringify(mockData));
renderTable(mockData);
```

改为：

```javascript
localStorage.setItem('recruit_applications', JSON.stringify(mockData));
renderView(mockData);
```

将 `doSearch()` 函数（约第 132-144 行）末尾的 `renderTable(f);` 改为 `renderView(f);`；将 `resetSearch()` 函数（约第 145-151 行）中的 `renderTable(mockData);` 改为 `renderView(mockData);`。

- [ ] **Step 5: 手动验证**

用浏览器打开 `pages/recruit/list.html`，DevTools 设为 `375px`（移动端）：
- 确认表格与顶部搜索区消失，改为卡片流：每张卡片头部左侧姓名、右侧状态徽章；卡身含手机号、GMV、平台账号 chip；卡底左侧灰色提交时间、右侧"查看详情"按钮
- 确认右下角出现悬浮"筛选"按钮，点击后从底部弹出抽屉（含手机号/平台/状态三项 + 查询/重置），选择"状态=已驳回"点查询，确认卡片只剩林晓鹿一条，抽屉关闭
- 点击卡片"查看详情"，确认跳转到 `detail.html?id=...`
- 确认当数据条数 ≤10 时不显示"加载更多"按钮（mock 仅 4 条，符合预期）

将视口设为 `768px`，再设回 `375px`（触发 resize）：
- 确认跨断点时布局正确在表格与卡片间切换，无残留

将视口设为 `1440px`：
- 确认恢复为表格视图，悬浮按钮/抽屉/卡片容器均隐藏

- [ ] **Step 6: 提交**

```bash
git add pages/recruit/list.html
git commit -m "招商入驻：list.html 移动端卡片流、底部抽屉筛选与加载更多"
```

---

## Task 9: detail.html 响应式

**Files:**
- Modify: `pages/recruit/detail.html:8-76`（`<style>` 块内追加移动端媒体查询）

**Interfaces:**
- 不涉及 JS 改动，纯 CSS 追加，无对外接口。审核弹窗（approveModal/rejectModal）逻辑保持不变。

detail.html 在移动端保持独立页面（不改造为弹窗）。本任务仅让 `.detail-grid` 在移动端改为单列堆叠，并顺带收窄卡片内边距、让弹窗与截图网格在小屏更紧凑；桌面端（≥1024px）保留现有两列。

- [ ] **Step 1: 在 `<style>` 块末尾（`.form-textarea:focus { ... }` 之后，`</style>` 之前）追加移动端媒体查询**

在 `pages/recruit/detail.html` 第 75 行 `.form-textarea:focus { border-color:var(--primary); }` 之后插入：

```css
    @media (max-width: 640px) {
      .detail-card { padding: 16px; }
      .detail-grid { grid-template-columns: 1fr; gap: 12px; }
      .shot-thumb { width: calc(50% - 5px); height: 100px; }
      .modal { width: 92vw; }
      .form-actions { flex-direction: column; }
      .form-actions .btn { width: 100%; height: 48px; }
    }
```

- [ ] **Step 2: 手动验证**

用浏览器打开 `pages/recruit/list.html`，在移动端 `375px` 视口下点击任意卡片"查看详情"进入 detail.html：
- 确认"申请人信息"卡片内的字段由两列变为单列纵向堆叠
- 确认业绩截图缩略图每行显示两个、宽度自适应
- 确认底部操作按钮（驳回/通过）纵向排列且高度约 48px、宽度撑满
- 点击"驳回"，确认弹窗正常弹出（宽度约 92vw），填写原因后确认驳回流程正常（状态流转逻辑未被破坏）

将视口设为 `1440px` 重新进入详情页：
- 确认"申请人信息"恢复为两列布局，与改动前一致

- [ ] **Step 3: 提交**

```bash
git add pages/recruit/detail.html
git commit -m "招商入驻：detail.html 移动端单列堆叠响应式"
```

---

## Task 10: apply.html 编辑模式移动端数据填充验证

**Files:**
- Modify: `pages/recruit/apply.html`（`<script>` 块，仅在验证发现缺陷时补丁）

**Interfaces:**
- Consumes: Task 2 的 `updateStepUI()`/`isMobileStepMode()`、现有 `init()`（按字段 id 直接填值）

背景：移动端分步向导通过 CSS `display:none` 隐藏非当前步骤的卡片，字段节点仍在 DOM 中，因此现有 `init()` 按 id 填值的逻辑理论上对三步字段都生效。本任务是一次**验证 + 防御性兜底**：确认编辑模式（`mode=edit`）在移动端进入时，三步字段都被正确填充，且 `updateStepUI()` 在 `init()` 之后被调用以正确高亮步骤条。

- [ ] **Step 1: 手动验证编辑模式移动端填充**

用浏览器打开 `pages/recruit/apply.html?mode=edit&id=4`（mock 中已驳回、含驳回历史的记录），DevTools 设为 `375px`：
- 确认进入时默认停在第 1 步"基础信息"，且"运营品牌""主推产品"已填入该记录的值（品牌A / 口红套装）
- 点击"下一步"到第 2 步"平台账号"，确认已填入该记录的平台账号卡片（抖音 @美妆小鹿）
- 点击"下一步"到第 3 步"业绩证明"，确认 GMV 已填入（42000）
- 确认顶部锁定横幅（locked-banner）与只读态表现正常

- [ ] **Step 2: 若 Step 1 发现步骤条高亮或字段未填充，追加兜底调用**

若验证发现进入编辑模式时步骤条未正确高亮（例如 `init()` 之后 `currentStep` 未被刷新到 UI），在文件末尾已有的 `updateStepUI();`（Task 2 新增）确认位于 `init();` 之后即可——该调用已覆盖此场景，无需额外改动。

若验证发现某一步字段在编辑模式下确实为空（说明 `init()` 填值时机早于 DOM 就绪或字段 id 不匹配），则在 `init()` 函数体末尾、其闭合 `}` 之前追加一次强制刷新：

```javascript
  updateStepUI();
```

（仅当验证证实存在缺陷时才加入此补丁；若 Step 1 全部通过，本步骤不做任何代码改动。）

- [ ] **Step 3: 提交（仅当 Step 2 产生了代码改动时）**

```bash
git add pages/recruit/apply.html
git commit -m "招商入驻：apply.html 编辑模式移动端填充兜底"
```

若 Step 2 未产生任何代码改动，则跳过本提交步骤。

---

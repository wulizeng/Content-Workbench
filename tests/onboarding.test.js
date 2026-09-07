const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// 模拟 localStorage（onboarding-store 依赖）
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

global.localStorage = new MemoryStorage();

const Store = require(path.join(root, 'js/onboarding-store.js'));

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function compileInlineScripts(file) {
  const html = read(file);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    assert.doesNotThrow(() => new Function(match[1]), `${file} inline script ${index + 1} should compile`);
  });
}

function validForm(overrides) {
  const form = Store.emptyForm();
  form.business.intro = '公司成立于2019年，主营服饰电商。';
  form.contact.contactPhone = '13800138000';
  form.contact.address = '浙江省杭州市余杭区XX路1号';
  form.plan.annualTarget = '1200';
  form.plan.accountPlan = '账号定位…';
  form.plan.teamConfig = '主播2人…';
  form.plan.videoStrategy = '每周8条…';
  form.plan.adStrategy = '千川投放…';
  form.plan.venuePlan = '200平直播基地…';
  for (let m = 1; m <= 12; m++) form.plan.monthly['m' + m] = '100';
  form.finance.fullName = '杭州某某电子商务有限公司';
  form.finance.shortName = '某某电商';
  form.finance.region = 'domestic';
  form.finance.taxNo = '91330100MA27XXXXXX';
  form.finance.bankName = '招商银行';
  form.finance.province = '浙江省';
  form.finance.city = '杭州市';
  form.finance.branch = '招商银行杭州余杭支行';
  form.finance.taxpayerType = '一般纳税人';
  form.finance.accountHolder = '张三';
  form.finance.accountNo = '6225880137788990';
  return Object.assign(form, overrides || {});
}

test('store provides 6 onboarding modes and only DP requires brand', () => {
  assert.equal(Store.MODES.length, 6);
  const values = Store.MODES.map(m => m.value);
  ['DP', '客户KOC', '达播达人', '联营KOC', '达播机构', '素人KOC'].forEach(v => assert.ok(values.includes(v)));
  const dp = Store.MODES.find(m => m.value === 'DP');
  assert.equal(dp.needsBrand, true);
  Store.MODES.filter(m => m.value !== 'DP').forEach(m => assert.equal(m.needsBrand, false, `${m.value} 不应要求品牌`));
  assert.deepEqual(Store.BRANDS, ['巴拉', '迷你', '森马']);
});

test('14 workflow stages match the PRD sequence', () => {
  const names = Store.STAGES.map(s => s.name);
  assert.equal(names.length, 14);
  assert.deepEqual(names, [
    '客户注册', '选模式/品牌', '填企业信息', '审企业信息', '手机号申请', '项目规划',
    '审+BPM', '网签合同', '保证金', '授权书', '账号录入', '内部软件', '规则宣导', '入驻完毕'
  ]);
});

test('encryption roundtrip hides plaintext at rest', () => {
  const payload = JSON.stringify([{ id: 'OBTEST', form: { finance: { accountNo: '6225880137788990' } } }]);
  const enc = Store.encryptText(payload);
  assert.notEqual(enc, payload);
  assert.ok(!enc.includes('6225880137788990'), '密文不应包含明文敏感信息');
  assert.equal(Store.decryptText(enc), payload);
});

test('create application (unsubmit), autosave silently, explicit save keeps version history', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: 'DP', brand: '巴拉', owner: { phone: '138****2231', name: '李潮' } });
  assert.equal(app.status, 'unsubmit');
  assert.equal(app.brand, '巴拉');
  assert.equal(app.versions.length, 1);

  // 静默自动保存：不产生版本
  const form = validForm();
  form.business.intro = '公司成立于2019年，主营服饰电商（已补充）。';
  const silent = Store.saveDraft(app.id, form, '李潮', { silent: true });
  assert.ok(silent.ok);
  assert.equal(silent.app.versions.length, 1);

  // 显式保存：产生版本记录并包含变更字段
  form.business.intro = '公司成立于2019年，主营服饰电商（正式版）。';
  const explicit = Store.saveDraft(app.id, form, '李潮');
  assert.ok(explicit.ok);
  assert.equal(explicit.app.versions.length, 2);
  assert.ok(explicit.app.versions[1].changes.includes('企业介绍'));

  // 重新读取验证加密落盘后仍可解密读回
  const reloaded = Store.get(app.id);
  assert.equal(reloaded.form.business.intro, form.business.intro);
});

test('submit no longer blocked by form validation; validateForm still reports field errors', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: '客户KOC', brand: null, owner: { phone: '138****2231', name: '李潮' } });

  // 空表单：各步骤均有错误（validateForm 仍可用于页面提示）
  const empty = Store.validateForm(Store.emptyForm());
  const stepsWithError = new Set(empty.map(e => e.step));
  ['business', 'contact', 'plan', 'finance'].forEach(s => assert.ok(stepsWithError.has(s)));

  // 提交不再被表单校验拦截，空表单也可直接提交
  const ok = Store.submit(app.id, '李潮');
  assert.equal(ok.ok, true);
  assert.equal(ok.app.status, 'submitted');
  assert.equal(Store.currentStageOf(ok.app), 4, '已提交阶段应为第 4 步：审企业信息');

  // 审核后进入第 5 步
  const reviewed = Store.review(app.id, '', '张运营');
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.app.status, 'reviewed');
  assert.equal(Store.currentStageOf(reviewed.app), 5);
});

test('submitted applications remain editable; reviewed becomes read-only', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: '达播达人', owner: { phone: '159****8820', name: '王强' } });
  Store.saveDraft(app.id, validForm(), '王强', { silent: true });
  Store.submit(app.id, '王强');

  // 已提交状态仍可编辑补充
  const form = validForm();
  form.business.scale = '年营业额约 3000 万元';
  const edit = Store.saveDraft(app.id, form, '王强');
  assert.ok(edit.ok, '已提交状态应允许编辑');
  assert.ok(edit.app.versions[edit.app.versions.length - 1].action.includes('已提交'));

  // 运营审核：已提交 → 已审核（进入第 5 步），之后禁止编辑与重复提交
  const reviewed = Store.review(app.id, '资料齐全', '张运营');
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.app.status, 'reviewed');
  assert.equal(reviewed.app.reviewReason, '资料齐全');
  assert.equal(Store.currentStageOf(reviewed.app), 5);
  assert.equal(Store.saveDraft(app.id, form, '王强').ok, false, '已审核后应禁止编辑');
  assert.equal(Store.submit(app.id, '王强').ok, false, '已审核后应禁止重复提交');
});

test('uniqueness: same fullName + mode + brand can only be submitted once', () => {
  global.localStorage = new MemoryStorage();
  const a = Store.createDraft({ mode: 'DP', brand: '巴拉', owner: { phone: '138****2231', name: '李潮' } });
  const b = Store.createDraft({ mode: 'DP', brand: '巴拉', owner: { phone: '159****8820', name: '王强' } });

  // validForm 的企业全称相同：第二个申请提交应被唯一校验拦截
  Store.saveDraft(a.id, validForm(), '李潮', { silent: true });
  assert.equal(Store.submit(a.id, '李潮').ok, true);
  Store.saveDraft(b.id, validForm(), '王强', { silent: true });
  const dup = Store.submit(b.id, '王强');
  assert.equal(dup.ok, false, '相同企业全称+模式+品牌不允许重复提交');
  assert.match(dup.error, /重复/);

  // 品牌不同则不冲突
  const c = Store.createDraft({ mode: 'DP', brand: '森马', owner: { phone: '137****0001', name: '赵六' } });
  Store.saveDraft(c.id, validForm(), '赵六', { silent: true });
  assert.equal(Store.submit(c.id, '赵六').ok, true);
});

test('legacy four-state data migrates to the new three-state model on read', () => {
  global.localStorage = new MemoryStorage();
  Store._writeAll([
    { id: 'L1', status: 'draft', form: Store.emptyForm() },
    { id: 'L2', status: 'pending', form: Store.emptyForm() },
    { id: 'L3', status: 'approved', form: Store.emptyForm() },
    { id: 'L4', status: 'rejected', form: Store.emptyForm() }
  ]);
  const byId = {};
  Store.list().forEach(a => { byId[a.id] = a.status; });
  assert.equal(byId.L1, 'unsubmit');
  assert.equal(byId.L2, 'submitted');
  assert.equal(byId.L3, 'reviewed');
  assert.equal(byId.L4, 'reviewed');
});

test('field validators: phone, tax no, account no, overseas street, monthly grid', () => {
  const form = validForm();
  assert.deepEqual(Store.validateStep('business', form), {});
  assert.deepEqual(Store.validateStep('contact', form), {});
  assert.deepEqual(Store.validateStep('plan', form), {});
  assert.deepEqual(Store.validateStep('finance', form), {});

  // 联系方式
  const badPhone = validForm();
  badPhone.contact.contactPhone = 'abc';
  assert.match(Store.validateStep('contact', badPhone)['contact.contactPhone'], /联系方式/);

  // 收款账号
  const badAccount = validForm();
  badAccount.finance.accountNo = '123';
  assert.match(Store.validateStep('finance', badAccount)['finance.accountNo'], /收款账号/);

  // 境内时不校验街道；境外时必填
  const domestic = validForm();
  domestic.finance.street = '';
  assert.equal(Store.validateStep('finance', domestic)['finance.street'], undefined);
  const overseas = validForm();
  overseas.finance.region = 'overseas';
  overseas.finance.street = '';
  assert.match(Store.validateStep('finance', overseas)['finance.street'], /境外/);

  // 月度分解缺失 12 月数据
  const missingMonth = validForm();
  missingMonth.plan.monthly.m12 = '';
  assert.match(Store.validateStep('plan', missingMonth)['plan.monthly'], /月度分解目标/);

  // 月度合计与年度目标不一致为非阻塞警告
  const mismatch = validForm();
  mismatch.plan.monthly.m1 = '200';
  assert.equal(Store.validateStep('plan', mismatch)['plan.monthly'], undefined);
  assert.match(Store.planWarning(mismatch), /不一致/);
  assert.equal(Store.planWarning(validForm()), '');
});

test('manage page exposes primary actions, mode modal and DP brand linkage', () => {
  const html = read('pages/store-engine/manage.html');
  // 列表为默认页，含新增入口
  ['btnCreate', 'viewList', 'tableBody', 'cardList', 'reviewModal'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `页面应包含 #${id}`);
  });
  assert.match(html, /onboarding-store\.js/);
  assert.match(html, /data-needs-brand/);
  assert.match(html, /Auth\.filterApplications/);
  assert.match(html, /Auth\.isAuthenticated/);
  compileInlineScripts('pages/store-engine/manage.html');
});

test('manage page exposes stage strip and 4-section scrollable form', () => {
  const html = read('pages/store-engine/manage.html');
  ['viewForm', 'stageStrip', 'panelContainer', 'saveHint', 'statusBanner'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `填写页应包含 #${id}`);
  });
  // 13 阶段来自共享模块，页面应渲染 STAGES
  assert.match(html, /Store\.STAGES/);
  // 企业业务能力 / 企业负责人 / 项目规划 / 财务信息 四个面板（JS 动态生成 panel_<key>）
  assert.match(html, /'panel_' \+ step\.key/);
  Store.STEPS.forEach(step => {
    assert.ok(['business', 'contact', 'plan', 'finance'].includes(step.key), '步骤应包含 ' + step.key);
  });
  assert.match(html, /showIf/);
  // 单页视图切换（列表/表单），不新增页面文件
  assert.match(html, /function showView\(/);
  assert.doesNotMatch(html, /location\.href = 'create\.html/);
  // 版本历史已删除
  assert.doesNotMatch(html, /id="versionList"/);
  assert.doesNotMatch(html, /id="stepTabs"/);
  compileInlineScripts('pages/store-engine/manage.html');
});

test('persisted data is encrypted in localStorage', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: 'DP', brand: '森马', owner: { phone: '138****2231', name: '李潮' } });
  Store.saveDraft(app.id, validForm(), '李潮', { silent: true });
  const raw = global.localStorage.getItem(Store.STORAGE_KEY);
  assert.ok(raw.startsWith('OBENC1:'), '落盘数据应为加密格式');
  assert.ok(!raw.includes('杭州某某电子商务有限公司'), '落盘数据不应包含企业明文');
});

test('createDraft includes empty bdContact; typeOfMode maps onboarding types', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: 'DP', brand: '巴拉', platforms: ['抖音'], owner: { phone: '138****2231', name: '李潮' } });
  assert.equal(app.bdContact, '', '新申请应包含空的对接商务字段');

  assert.equal(Store.typeOfMode('DP'), 'DP');
  assert.equal(Store.typeOfMode('客户KOC'), 'KOC');
  assert.equal(Store.typeOfMode('联营KOC'), 'KOC');
  assert.equal(Store.typeOfMode('素人KOC'), 'KOC');
  assert.equal(Store.typeOfMode('达播达人'), '达播');
  assert.equal(Store.typeOfMode('达播机构'), '达播');
  assert.equal(Store.typeOfMode('unknown'), '-');
  assert.equal(Store.typeOfMode(''), '-');
});

test('updateBdContact updates value, updatedAt and appends version record', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: 'DP', brand: '巴拉', owner: { phone: '138****2231', name: '李潮' } });

  const res = Store.updateBdContact(app.id, '王商务', '张运营');
  assert.ok(res.ok);
  assert.equal(res.app.bdContact, '王商务');
  assert.ok(res.app.updatedAt >= app.createdAt, '更新时间应刷新');
  const last = res.app.versions[res.app.versions.length - 1];
  assert.equal(last.action, '更新对接商务');
  assert.ok(last.changes.some(c => c.includes('王商务')), '变更记录应包含新值');
  assert.equal(last.operator, '张运营');
  // 重新读取验证落盘
  assert.equal(Store.get(app.id).bdContact, '王商务');
});

test('updateBdContact: unchanged value skips version; reviewed rejected; missing id errors', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: '客户KOC', owner: { phone: '159****8820', name: '王强' } });

  // 值未变化：不落版本记录
  Store.updateBdContact(app.id, '王商务', '张运营');
  const before = Store.get(app.id).versions.length;
  const same = Store.updateBdContact(app.id, '王商务', '张运营');
  assert.ok(same.ok);
  assert.equal(Store.get(app.id).versions.length, before, '值未变化不应追加版本');

  // 已审核拒绝
  Store.submit(app.id, '王强');
  Store.review(app.id, '', '张运营');
  const denied = Store.updateBdContact(app.id, '李商务', '张运营');
  assert.equal(denied.ok, false);
  assert.match(denied.error, /已审核/);
  assert.equal(Store.get(app.id).bdContact, '王商务', '拒绝后数据不变');

  // 不存在的申请
  const missing = Store.updateBdContact('SQ99999999', 'x', '运营');
  assert.equal(missing.ok, false);
});

test('legacy data without bdContact reads fine and can be updated', () => {
  global.localStorage = new MemoryStorage();
  Store._writeAll([
    { id: 'L100', status: 'submitted', mode: 'DP', brand: '巴拉', platforms: ['抖音'], ownerName: '李潮', form: Store.emptyForm(), versions: [], createdAt: '2026-09-01 10:00:00', updatedAt: '2026-09-01 10:00:00' }
  ]);
  const app = Store.get('L100');
  assert.ok(app, '无 bdContact 字段的历史数据应可正常读取');
  assert.ok(!app.bdContact, '历史数据无该字段');
  const res = Store.updateBdContact('L100', '王商务', '张运营');
  assert.ok(res.ok, '历史申请也可更新对接商务');
  assert.equal(res.app.bdContact, '王商务');
});

test('manage page basic info exposes bdContact display and edit modal', () => {
  const html = read('pages/store-engine/manage.html');
  ['headBdContact', 'btnEditBdContact', 'bdContactModal', 'bdContactInput'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `基本信息区应包含 #${id}`);
  });
  assert.match(html, /Store\.updateBdContact/, '应调用 updateBdContact 保存');
  compileInlineScripts('pages/store-engine/manage.html');
});

test('cooperation list page reads onboarding store with new column set', () => {
  const html = read('pages/recruit/list.html');
  assert.match(html, /onboarding-store\.js/, '应引入入驻申请数据模块');
  ['客户名称', '入驻类型', '入驻模式', '入驻平台', '对接商务', '创建时间', '创建人', '更新人', '更新时间', '状态'].forEach(col => {
    assert.ok(html.includes(`<th>${col}</th>`), `列表应包含列 ${col}`);
  });
  assert.doesNotMatch(html, /recruit_applications/, '不应再读取旧数据');
  assert.doesNotMatch(html, /recruit_talents/, '不应再读取旧达人映射');
  assert.match(html, /typeOfMode/);
  compileInlineScripts('pages/recruit/list.html');
});

test('cooperation detail page is read-only over onboarding store', () => {
  const html = read('pages/recruit/detail.html');
  assert.match(html, /onboarding-store\.js/, '应引入入驻申请数据模块');
  assert.match(html, /Store\.get\(/, '应通过 Store.get 读取详情');
  ['基本信息', '版本历史', '月度分解目标'].forEach(t => assert.ok(html.includes(t), `详情页应包含「${t}」`));
  assert.doesNotMatch(html, /recruit_applications/, '不应再读取旧数据');
  assert.doesNotMatch(html, /recruit-application-templates\.js/, '不应再引用旧模板模块');
  compileInlineScripts('pages/recruit/detail.html');
});

test('manage page finance panel exposes license upload with mock recognition', () => {
  const html = read('pages/store-engine/manage.html');
  ['licenseUploadBlock', 'licenseFileInput', 'licensePreview', 'licenseStatus'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `营业执照上传区块应包含 #${id}`);
  });
  assert.match(html, /上传营业执照/, '应包含上传入口文案');
  assert.match(html, /识别中/, '应包含识别中状态');
  assert.match(html, /已识别/, '应包含识别完成状态');
  assert.match(html, /LICENSE_DEMO_DATA/, '应内置模拟识别演示数据池');
  assert.equal((html.match(/taxNo: '91/g) || []).length, 3, '演示数据池应有 3 组');
  assert.match(html, /f_finance_fullName/, '应回填企业全称');
  assert.match(html, /f_finance_taxNo/, '应回填税务登记号');
  assert.match(html, /f_finance_region_domestic/, '应回填企业所在地为境内');
  compileInlineScripts('pages/store-engine/manage.html');
});

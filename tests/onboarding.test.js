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

test('store provides 8 onboarding modes and all require brand', () => {
  assert.equal(Store.MODES.length, 8);
  const values = Store.MODES.map(m => m.value);
  ['账号代运营', '整店代运营', '达人', '机构', '联营KOC', '素人KOC', '客户KOC', '马卡乐合伙人'].forEach(v => assert.ok(values.includes(v), `应包含模式 ${v}`));
  Store.MODES.forEach(m => assert.equal(m.needsBrand, true, `${m.value} 需要选择品牌`));
  assert.deepEqual(Store.BRANDS, ['巴拉', '迷你', '森马']);
  assert.deepEqual(Store.PLATFORMS, ['抖音', '视频号', '小红书', '快手']);
});

test('13 workflow stages match the PRD sequence', () => {
  const names = Store.STAGES.map(s => s.name);
  assert.equal(names.length, 13);
  assert.deepEqual(names, [
    '客户注册', '选择入驻模式', '填写企业信息', '运营审核企业', '项目规划填写',
    'BPM供应商创建', '网签合同', '保证金缴纳', '授权书签署', '账号信息录入',
    '内部软件开通', '规则宣导培训', '入驻完毕'
  ]);
});

test('stage templates: default(13) / influencer(8) / customer_koc(10) / koc_lite(6), mode → template routing', () => {
  assert.equal(Store.STAGE_TEMPLATES.default.length, 13);
  assert.equal(Store.STAGE_TEMPLATES.influencer.length, 8);
  assert.equal(Store.STAGE_TEMPLATES.customer_koc.length, 10);
  assert.equal(Store.STAGE_TEMPLATES.koc_lite.length, 6);
  assert.deepEqual(Store.STAGE_TEMPLATES.influencer.map(s => s.name), [
    '客户注册', '选择入驻模式', '供应商信息录入', 'BPM供应商创建', '网签合同', '授权书签署', '账号信息录入', '入驻完毕'
  ]);
  assert.deepEqual(Store.STAGE_TEMPLATES.customer_koc.map(s => s.name), [
    '客户注册', '选择入驻模式', '供应商信息录入', 'BPM供应商创建', '网签合同', '授权书签署', '账号信息录入', '软件开通', '签署品牌规则', '入驻完毕'
  ]);
  assert.deepEqual(Store.STAGE_TEMPLATES.koc_lite.map(s => s.name), [
    '客户注册', '选择入驻模式', '账号信息录入', '内部软件开通', '签署品牌规则', '入驻完毕'
  ]);
  // 8 个模式的模板归属
  assert.equal(Store.flowKeyOfMode('账号代运营'), 'default');
  assert.equal(Store.flowKeyOfMode('整店代运营'), 'default');
  assert.equal(Store.flowKeyOfMode('机构'), 'default');
  assert.equal(Store.flowKeyOfMode('马卡乐合伙人'), 'default');
  assert.equal(Store.flowKeyOfMode('达人'), 'influencer');
  assert.equal(Store.flowKeyOfMode('客户KOC'), 'customer_koc');
  assert.equal(Store.flowKeyOfMode('素人KOC'), 'koc_lite');
  assert.equal(Store.flowKeyOfMode('联营KOC'), 'koc_lite');
  // 未知模式 → default（向后兼容）
  assert.equal(Store.flowKeyOfMode('不存在的模式'), 'default');
  // stagesForMode / stagesForApp 返回对应模板副本
  assert.equal(Store.stagesForMode('达人').length, 8);
  assert.equal(Store.stagesForMode('客户KOC').length, 10);
  assert.equal(Store.stagesForApp({ mode: '素人KOC' }).length, 6);
  assert.equal(Store.stagesForApp({ mode: '整店代运营' }).length, 13);
  // currentStageOf 会基于模板默认（unsubmit=3 / submitted=4 / reviewed=5）
  assert.equal(Store.currentStageOf({ mode: '达人', status: 'unsubmit' }), 3);
  assert.equal(Store.currentStageOf({ mode: '客户KOC', status: 'submitted' }), 4);
  assert.equal(Store.currentStageOf({ mode: '客户KOC', status: 'reviewed' }), 5);
  assert.equal(Store.currentStageOf({ mode: '素人KOC', status: 'unsubmit' }), 3);
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
  assert.equal(Store.currentStageOf(ok.app), 4, '已提交阶段应为第 4 步：运营审核企业');

  // 审核后进入第 5 步（项目规划填写）
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
  const app = Store.createDraft({ mode: '账号代运营', brand: '巴拉', platforms: ['抖音'], owner: { phone: '138****2231', name: '李潮' } });
  assert.equal(app.bdContact, '', '新申请应包含空的对接商务字段');

  assert.equal(Store.typeOfMode('账号代运营'), '代运营');
  assert.equal(Store.typeOfMode('整店代运营'), '代运营');
  assert.equal(Store.typeOfMode('达人'), '达播');
  assert.equal(Store.typeOfMode('机构'), '达播');
  assert.equal(Store.typeOfMode('客户KOC'), 'KOC');
  assert.equal(Store.typeOfMode('联营KOC'), 'KOC');
  assert.equal(Store.typeOfMode('素人KOC'), 'KOC');
  assert.equal(Store.typeOfMode('马卡乐合伙人'), '合伙人');
  // 历史模式向后兼容
  assert.equal(Store.typeOfMode('DP'), 'DP');
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

test('manage page no longer exposes bdContact display / edit UI', () => {
  const html = read('pages/store-engine/manage.html');
  ['headBdContact', 'btnEditBdContact', 'bdContactModal', 'bdContactInput'].forEach(id => {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `基本信息区不应包含 #${id}`);
  });
  assert.doesNotMatch(html, /Store\.updateBdContact/, '入驻申请页面不再直接调用 updateBdContact');
  assert.doesNotMatch(html, />对接商务</, '页面不再展示“对接商务”标签');
  compileInlineScripts('pages/store-engine/manage.html');
});

test('profile-list page renders customer registered account archive with fixed 8 columns', () => {
  const html = read('pages/recruit/profile-list.html');
  ['序号', '用户编号', '姓名', '手机号', '对接商务', '创建时间', '更新时间', '最近登录时间'].forEach(col => {
    assert.ok(html.includes(`<th>${col}</th>`), `列表应包含列 ${col}`);
  });
  assert.match(html, /recruit_talents/, '应读取客户注册账号存储');
  assert.match(html, /Auth\.requireAuth/, '需登录才能访问');
  assert.match(html, /talent_id/, '应展示用户编号 talent_id');
  assert.match(html, /last_login_at/, '应展示最近登录时间');
  assert.match(html, /bdContact/, '应展示对接商务');
  compileInlineScripts('pages/recruit/profile-list.html');
});

test('index sidebar mounts 客户注册账号 under 运营视角 (not visible to talent)', () => {
  const html = read('index.html');
  assert.match(html, /profileItem/, '侧边栏应定义 profileItem 变量');
  assert.match(html, /pages\/recruit\/profile-list\.html/, 'profileItem 应指向客户注册账号页');
  assert.match(html, /<span>客户注册账号<\/span>/, '菜单名称应为“客户注册账号”');
  // talent 菜单不包含 profileItem；operator/bd/admin 包含且位于 运营视角 分区内
  const talentLine = html.match(/role === 'talent'\s*\)\s*\{[\s\S]*?recruitMenu\.innerHTML\s*=\s*([^;]+);/);
  const operatorLine = html.match(/role === 'operator'\s*\)\s*\{[\s\S]*?recruitMenu\.innerHTML\s*=\s*([^;]+);/);
  const bdLine = html.match(/role === 'bd'\s*\)\s*\{[\s\S]*?recruitMenu\.innerHTML\s*=\s*([^;]+);/);
  const adminLine = html.match(/role === 'admin'\s*\)\s*\{[\s\S]*?recruitMenu\.innerHTML\s*=\s*([^;]+);/);
  assert.ok(talentLine && !talentLine[1].includes('profileItem'), 'talent 菜单不应包含 profileItem（仅运营侧可见）');
  assert.ok(operatorLine && operatorLine[1].includes('profileItem'), 'operator 菜单应包含 profileItem');
  assert.ok(bdLine && bdLine[1].includes('profileItem'), 'bd 菜单应包含 profileItem');
  assert.ok(adminLine && adminLine[1].includes('profileItem'), 'admin 菜单应包含 profileItem');
  // profileItem 处于 sectionLabel('运营视角'...) 与 operatorItems(...) 之间，确保位于运营视角分区内
  const inOperatorSection = /sectionLabel\('运营视角'[^)]*\)\s*\+\s*profileItem\s*\+\s*operatorItems/;
  assert.ok(inOperatorSection.test(operatorLine?.[1] || ''), 'operator 中 profileItem 应处于“运营视角”分区内');
  assert.ok(inOperatorSection.test(bdLine?.[1] || ''), 'bd 中 profileItem 应处于“运营视角”分区内');
  assert.ok(inOperatorSection.test(adminLine?.[1] || ''), 'admin 中 profileItem 应处于“运营视角”分区内');
});

test('cooperation list page reads onboarding store with new column set', () => {
  const html = read('pages/recruit/list.html');
  assert.match(html, /onboarding-store\.js/, '应引入入驻申请数据模块');
  ['客户名称', '入驻类型', '入驻模式', '入驻平台', '对接商务', '创建时间', '创建人', '更新人', '更新时间', '入驻节点', '节点状态'].forEach(col => {
    assert.ok(html.includes(`<th>${col}</th>`), `列表应包含列 ${col}`);
  });
  assert.doesNotMatch(html, /<th>状态<\/th>/, '旧的“状态”列应重命名为“节点状态”');
  assert.doesNotMatch(html, /recruit_applications/, '不应再读取旧数据');
  assert.doesNotMatch(html, /recruit_talents/, '不应再读取旧达人映射');
  assert.match(html, /typeOfMode/);
  // 入驻节点展示参考客户入驻申请页：相同阶段编号 + 阶段名 的 stage-badge 小徽章
  assert.match(html, /function\s+stageBadge\s*\(/, '应定义 stageBadge 渲染函数');
  assert.match(html, /Store\.currentStageOf\(app\)/, 'stageBadge 应读取当前阶段');
  assert.match(html, /stage-no/, '徽章内应包含 stage-no 子元素');
  compileInlineScripts('pages/recruit/list.html');
});

test('cooperation detail page is read-only over onboarding store', () => {
  const html = read('pages/recruit/detail.html');
  assert.match(html, /onboarding-store\.js/, '应引入入驻申请数据模块');
  assert.match(html, /Store\.get\(/, '应通过 Store.get 读取详情');
  ['基本信息', '操作日志', '月度分解目标', '当前节点', '入驻流程进度'].forEach(t => assert.ok(html.includes(t), `详情页应包含「${t}」`));
  assert.doesNotMatch(html, /\u7248\u672c\u5386\u53f2/, '旧“版本历史”卡片标题应重命名为“操作日志”');
  assert.doesNotMatch(html, /\u8282\u70b9\u6d41\u8f6c\u8bb0\u5f55/, '手工流转应已合入操作日志，不再保留独立卡片标题');
  assert.doesNotMatch(html, /dVersionBody|dStageHistoryBody/, '旧 td id 应完全重命名为 dOpLogBody');
  assert.match(html, /id="dOpLogBody"/, '操作日志 tbody id 应为 dOpLogBody');
  assert.match(html, /function\s+renderOpLog\s*\(/, '应定义 renderOpLog');
  assert.doesNotMatch(html, /v\.v.*v\.time/, '行内不应再输出 v版本号列');
  assert.match(html, /Store\.currentStageOf\(app\)/, '基本信息中应展示当前节点');
  // 操作日志：时间倒序 + 分页
  assert.match(html, /id="dOpLogPagination"/, '操作日志下方应存在分页容器');
  assert.match(html, /OP_LOG_PAGE_SIZE\s*=\s*10/, '分页页大小应为 10');
  assert.match(html, /function\s+renderOpLogPager\s*\(/, '应定义分页渲染函数');
  assert.match(html, /function\s+goOpLogPage\s*\(/, '应定义页码切换函数');
  assert.match(html, /tb\.localeCompare\(ta\)/, '时间倒序排列');
  // 13 节点流程指示器（与客户入驻申请页保持同一视觉）
  assert.match(html, /id="dStageStrip"/, '应包含 stage-strip 容器');
  assert.match(html, /class="stage-strip"/, '应使用 stage-strip 样式类');
  assert.match(html, /function\s+renderStages\s*\(/, '应定义 renderStages 渲染函数');
  assert.match(html, /stages\.forEach/, '应遍历当前模式对应的阶段列表');
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

test('cooperation detail page exposes review action for operator roles', () => {
  const html = read('pages/recruit/detail.html');
  ['btnReview', 'reviewModal', 'reviewRemark', 'reviewAppInfo'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `详情页应包含 #${id}`);
  });
  assert.match(html, /Store\.review\(/, '应调用 Store.review 完成审核');
  assert.match(html, /user\.role === 'operator'/, '运营角色应可审核');
  assert.match(html, /user\.role === 'admin'/, '管理员角色应可审核');
  assert.match(html, /app\.status === 'submitted'/, '仅已提交状态显示审核入口');
  compileInlineScripts('pages/recruit/detail.html');
});

test('currentStageOf prefers explicit stageNo over status derivation', () => {
  const base = { status: 'reviewed' }; // 默认 stage 5
  assert.equal(Store.currentStageOf(base), 5);
  assert.equal(Store.currentStageOf({ ...base, stageNo: 8 }), 8);
  assert.equal(Store.currentStageOf({ ...base, stageNo: 13 }), 13);
  // 非法值回落
  assert.equal(Store.currentStageOf({ ...base, stageNo: 0 }), 5);
  assert.equal(Store.currentStageOf({ ...base, stageNo: 99 }), 5);
  assert.equal(Store.currentStageOf({ ...base, stageNo: null }), 5);
});

test('advanceStage: only reviewed +1 with mandatory reason, writes kind=stage version', () => {
  global.localStorage = new MemoryStorage();
  Store._writeAll([]);
  const app = Store.createDraft({ owner: { phone: '13800000001', name: '张三' }, mode: '整店代运营', brand: '巴拉', platforms: ['抖音'] });
  // 默认 stageNo=null，状态 unsubmit，flowKey=default（13 阶段）
  let res = Store.advanceStage(app.id, { reason: 'x', operator: '运营' });
  assert.equal(res.ok, false, 'unsubmit 不可手工流转');
  assert.match(res.error, /仅已审核/);
  // 推进至 reviewed
  Store.saveDraft(app.id, validForm(), '张三');
  Store.submit(app.id, '张三');
  Store.review(app.id, '', '运营李四');
  const reviewed = Store.get(app.id);
  assert.equal(Store.currentStageOf(reviewed), 5);
  // 无备注 拒绝
  res = Store.advanceStage(app.id, { operator: '王五' });
  assert.equal(res.ok, false);
  assert.match(res.error, /备注/);
  // 正常推进 5→6
  res = Store.advanceStage(app.id, { reason: 'BPM已创建供应商S123456', operator: '王五' });
  assert.equal(res.ok, true);
  assert.equal(res.app.stageNo, 6);
  assert.equal(Store.currentStageOf(res.app), 6);
  // 写入一条 kind=stage 版本
  const stageVersions = Store.stageHistoryOf(res.app);
  assert.equal(stageVersions.length, 1);
  assert.equal(stageVersions[0].stageFrom, 5);
  assert.equal(stageVersions[0].stageTo, 6);
  assert.equal(stageVersions[0].stageReason, 'BPM已创建供应商S123456');
  assert.equal(stageVersions[0].operator, '王五');
  // 继续推进 6→...→13，共 7 次推进（包含上一句 5→6，累计 8 次）
  for (let i = 0; i < 7; i++) {
    const r = Store.advanceStage(app.id, { reason: '自动推进', operator: '王五' });
    assert.equal(r.ok, true, `第 ${i + 2} 次推进应成功`);
  }
  const done = Store.get(app.id);
  assert.equal(done.stageNo, 13, '应到达最后一个节点');
  const final = Store.advanceStage(app.id, { reason: '再推进一次', operator: '王五' });
  assert.equal(final.ok, false, '已为最后节点时拒绝推进');
  assert.match(final.error, /最后一个节点|无需/);
  // 不存在的 id
  assert.equal(Store.advanceStage('SQ_NOT_EXIST', { reason: 'x' }).ok, false);
});

test('cooperation list page exposes manual stage advance link and modal', () => {
  const html = read('pages/recruit/list.html');
  assert.match(html, /id="stageModal"/, '应包含手工流转弹窗');
  assert.match(html, /id="stgReason"/, '弹窗内应有备注输入');
  assert.match(html, /id="stgFromName"/, '弹窗应展示当前节点');
  assert.match(html, /id="stgToName"/, '弹窗应展示目标节点');
  assert.match(html, /function\s+openStageModal\s*\(/, '应定义 openStageModal');
  assert.match(html, /function\s+closeStageModal\s*\(/, '应定义 closeStageModal');
  assert.match(html, /function\s+confirmStageAdvance\s*\(/, '应定义 confirmStageAdvance');
  assert.match(html, /Store\.advanceStage\(/, '应调用 Store.advanceStage');
  assert.match(html, /更新节点/, '行内链接文案应为“更新节点”');
  assert.match(html, /canOperateStage\s*=\s*!!currentUser/, '应仅向 operator\/bd\/admin 展示链接');
  assert.match(html, /app\.status === Store\.STATUS\.REVIEWED && no < total/, '仅已审核 & 未到末节点时展示链接');
  compileInlineScripts('pages/recruit/list.html');
});

test('cooperation detail page also exposes manual stage advance button and modal', () => {
  const html = read('pages/recruit/detail.html');
  assert.match(html, /id="btnAdvanceStage"/, '手工流转入口按钮应存在');
  assert.match(html, /id="stageModal"/, '应包含手工流转弹窗');
  assert.match(html, /id="stgReason"/, '弹窗内应有备注输入');
  assert.match(html, /id="stgFromName"/, '弹窗应展示当前节点');
  assert.match(html, /id="stgToName"/, '弹窗应展示目标节点');
  assert.match(html, /function\s+openStageModal\s*\(/, '应定义 openStageModal');
  assert.match(html, /function\s+closeStageModal\s*\(/, '应定义 closeStageModal');
  assert.match(html, /function\s+confirmStageAdvance\s*\(/, '应定义 confirmStageAdvance');
  assert.match(html, /function\s+updateAdvanceEntry\s*\(/, '应定义 updateAdvanceEntry 控制可见性');
  assert.match(html, /Store\.advanceStage\(/, '应调用 Store.advanceStage');
  assert.match(html, /\['operator',\s*'bd',\s*'admin'\]/, '仅向 operator / bd / admin 开放');
  assert.match(html, /app\.status === Store\.STATUS\.REVIEWED && no < total/, '仅已审核 & 未到末节点时展示按钮');
  compileInlineScripts('pages/recruit/detail.html');
});

test('manage.html routes to influencer / koc-lite page after mode confirm', () => {
  const html = read('pages/store-engine/manage.html');
  assert.match(html, /Store\.flowKeyOfMode\(mode\)/, 'confirmMode 应基于 flowKeyOfMode 路由');
  assert.match(html, /flowKey === 'influencer' \|\| flowKey === 'customer_koc'/, '达人 与 客户KOC 同页，均路由至 manage-influencer.html');
  assert.match(html, /manage-influencer\.html\?id=/, 'influencer/customer_koc 应跳转至 manage-influencer.html');
  assert.match(html, /manage-koc-lite\.html\?id=/, 'koc_lite 模式应跳转至 manage-koc-lite.html');
  assert.match(html, /Store\.stagesForApp\(appData\)/, 'stageBadge 应基于 app 实际模式取对应阶段名');
  assert.match(html, /var flowKey = Store\.flowKeyOfMode\(loaded\.mode\)/, 'openFormView 应先判断 flowKey');
});

test('manage-influencer framework page: 同时承载达人(8) / 客户KOC(10)，包含供应商信息录入模块 (与 default 财务字段同源)', () => {
  const html = read('pages/store-engine/manage-influencer.html');
  assert.match(html, /达人 \/ 客户KOC 入驻申请/, '页题应明确适用模式');
  assert.match(html, /供应商信息录入/, '应包含供应商信息录入面板标题');
  assert.match(html, /id="financeFields"/, '字段容器 id 固定为 financeFields');
  assert.match(html, /Store\.FIELD_DEFS\.finance\.forEach/, '字段直接从 Store.FIELD_DEFS.finance 同源渲染');
  ['renderFinanceFields', 'readFinanceFields', 'toggleConditionalFields', 'onFieldChange', 'applyFinanceReadOnly'].forEach(fn => {
    assert.match(html, new RegExp('function\\s+' + fn + '\\s*\\('), '应定义 ' + fn);
  });
  assert.match(html, /var ALLOWED_FLOWS = \['influencer',\s*'customer_koc'\]/, '本页接受 influencer 与 customer_koc 两种流程');
  assert.match(html, /location\.replace\('manage\.html\?id=/, '不匹配时回跳 manage.html');
  assert.match(html, /location\.replace\('manage-koc-lite\.html\?id=/, 'koc_lite 模式时回跳 manage-koc-lite.html');
  assert.match(html, /Store\.stagesForApp\(app\)/, '阶段列表应基于实际模式读取');
  assert.match(html, /Store\.saveDraft\(/, '提供保存能力');
  assert.match(html, /Store\.submit\(/, '提供提交能力');
  assert.match(html, /Store\.advanceStage\(/, '提供手工流转能力');
  assert.match(html, /id="dOpLogBody"/, '包含操作日志');
  compileInlineScripts('pages/store-engine/manage-influencer.html');
});

test('manage-koc-lite framework page: 6 stages，无供应商信息录入，仅账号信息录入', () => {
  const html = read('pages/store-engine/manage-koc-lite.html');
  assert.match(html, /素人KOC \/ 联营KOC 入驻申请/, '页题应明确适用模式');
  // 6 阶段流程不包含供应商信息录入（无 stage 对应），应彻底移除相关面板与逻辑
  assert.doesNotMatch(html, /供应商信息录入/, 'koc_lite 页面不应出现供应商信息录入面板');
  assert.doesNotMatch(html, /id="financeFields"/, 'koc_lite 页面不应有财务字段容器');
  assert.doesNotMatch(html, /licenseUploadBlock/, 'koc_lite 页面不应有营业执照上传');
  assert.doesNotMatch(html, /Store\.FIELD_DEFS\.finance\.forEach/, 'koc_lite 页面不应渲染财务字段');
  assert.doesNotMatch(html, /renderFinanceFields|readFinanceFields/, 'koc_lite 页面不应保留财务函数');
  // 仅保留账号信息录入
  assert.match(html, /<h3>账号信息录入<\/h3>/, 'koc_lite 页面应包含账号信息录入面板');
  assert.match(html, /var FLOW_KEY = 'koc_lite'/, '页面声明自己的流程 key');
  // 路由已改为通用 flowTarget：非本流程（含 customer_koc）自动跳转
  assert.match(html, /location\.replace\(flowTarget\(flowKey\)/, '非本流程模式应跳转到对应页面');
  assert.match(html, /return 'manage-influencer\.html'/, 'flowTarget 将 influencer/customer_koc → manage-influencer.html');
  assert.match(html, /return 'manage\.html'/, 'flowTarget 默认→ manage.html');
  assert.match(html, /Store\.stagesForApp\(app\)/, '阶段列表应基于实际模式读取');
  assert.match(html, /Store\.advanceStage\(/, '提供手工流转能力');
  assert.match(html, /id="dOpLogBody"/, '包含操作日志');
  compileInlineScripts('pages/store-engine/manage-koc-lite.html');
});

test('list & detail pages use Store.stagesForApp instead of hardcoded Store.STAGES', () => {
  const list = read('pages/recruit/list.html');
  const detail = read('pages/recruit/detail.html');
  assert.match(list, /Store\.stagesForApp\(app\)/, 'list.html stageBadge 应读取实际模板');
  assert.match(detail, /Store\.stagesForApp\(app\)/, 'detail.html renderStages 应读取实际模板');
  // 旧硬编码 13 阶段相关已删除
  assert.doesNotMatch(list, /Store\.STAGES\.length/, 'list.html 不应再直接引用 Store.STAGES.length');
  assert.doesNotMatch(detail, /Store\.STAGES\.length/, 'detail.html 不应再直接引用 Store.STAGES.length');
});

test('influencer framework page exposes license upload block with mock recognition (koc-lite has none)', () => {
  const file = 'pages/store-engine/manage-influencer.html';
  const html = read(file);
  ['licenseUploadBlock', 'licenseFileInput', 'licensePreview', 'licenseStatus'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`), `${file} 应包含 #${id}`);
  });
  assert.match(html, /上传营业执照/, `${file} 应包含上传入口文案`);
  assert.match(html, /识别中/, `${file} 应包含识别中状态`);
  assert.match(html, /已识别/, `${file} 应包含识别完成状态`);
  assert.match(html, /LICENSE_DEMO_DATA/, `${file} 应内置演示数据池`);
  assert.equal((html.match(/taxNo: '91/g) || []).length, 3, `${file} 演示池应包含 3 组`);
  assert.match(html, /function\s+onLicenseFileChange\s*\(/, `${file} 应定义 onLicenseFileChange`);
  assert.match(html, /function\s+fillLicenseFields\s*\(/, `${file} 应定义 fillLicenseFields`);
  assert.match(html, /function\s+resetLicenseState\s*\(/, `${file} 应定义 resetLicenseState`);
  assert.match(html, /f_finance_fullName/, `${file} 应回填企业全称`);
  assert.match(html, /f_finance_taxNo/, `${file} 应回填税务登记号`);
  assert.match(html, /name="f_finance_region"\]\[value="domestic"/, `${file} 应将企业所在地预设为境内`);
});

test('influencer & koc-lite framework pages expose 账号信息录入 module with multi-account support', () => {
  ['pages/store-engine/manage-influencer.html', 'pages/store-engine/manage-koc-lite.html'].forEach(file => {
    const html = read(file);
    assert.match(html, /<h3>账号信息录入<\/h3>/, `${file} 应包含面板标题`);
    assert.match(html, /id="accountsContainer"/, `${file} 应包含容器`);
    assert.match(html, /id="btnAddAccount"/, `${file} 应包含新增按钮`);
    ['listAccounts', 'addAccountRow', 'removeAccountRow', 'renderAccountRows', 'onAccountField', 'onAccountImage', 'readAccountsFields', 'defaultBdContact']
      .forEach(fn => assert.match(html, new RegExp('function\\s+' + fn + '\\s*\\('), `${file} 应定义 ${fn}`));
    // 5 个字段标签 + 图片上传
    ['账号UID', '账号昵称', '合作码', '对接商务', 'UID 图片', '合作码图片'].forEach(label => {
      assert.ok(html.includes(label), `${file} 应包含字段标签 ${label}`);
    });
    // 对接商务默认从 recruit_talents 预取
    assert.match(html, /recruit_talents/, `${file} 应从 recruit_talents 读取默认对接商务`);
    // 保存时将 accounts 写回 store
    assert.match(html, /form\.accounts = readAccountsFields\(\)/, `${file} 保存时应写入 form.accounts`);
    // 会话内图片 object URL，不写回 form
    assert.match(html, /uidImageName|cooperationCodeImageName/, `${file} 应仅保存文件名，不入库图片数据`);
  });
});

test('influencer & koc-lite framework pages support modifying 入驻模式 with structure reload', () => {
  ['pages/store-engine/manage-influencer.html', 'pages/store-engine/manage-koc-lite.html'].forEach(file => {
    const html = read(file);
    // 入驻信息面板 + 修改入口 + 弹窗
    assert.match(html, /<h3>入驻信息<\/h3>/, `${file} 应包含入驻信息面板`);
    assert.match(html, /id="btnEditMode"[\s\S]*修改入驻模式/, `${file} 应提供修改入驻模式按钮`);
    assert.match(html, /id="miMode"|id="miBrand"|id="miPlatform"/, `${file} 应展示模式/品牌/平台`);
    ['modeModal', 'mcMode', 'mcBrand', 'mcPlatform'].forEach(id => {
      assert.match(html, new RegExp(`id="${id}"`), `${file} 弹窗应包含 #${id}`);
    });
    ['flowTarget', 'renderModeInfo', 'openModeModal', 'onMcModeChange', 'closeModeModal', 'confirmModeChange']
      .forEach(fn => assert.match(html, new RegExp('function\\s+' + fn + '\\s*\\('), `${file} 应定义 ${fn}`));
    // 调用 Store.updateMode；同流程原地 render，跨流程 location.replace 到 flowTarget
    assert.match(html, /Store\.updateMode\(/, `${file} 应调用 Store.updateMode`);
    assert.match(html, /location\.replace\(flowTarget\(flowKey\)/, `${file} 跨模式应跳转到对应流程页面`);
    assert.match(html, /Store\.flowKeyOfMode\(/, `${file} 应基于 flowKey 判定是否跨流程`);
    // 页面标题随具体模式刷新
    assert.match(html, /id="pageTitleText"/, `${file} 标题应可动态刷新`);
    compileInlineScripts(file);
  });
});

test('账号信息录入：入驻模式 → 字段集路由与直播账号字典', () => {
  ['客户KOC', '素人KOC', '联营KOC'].forEach(m => assert.equal(Store.accountEntryKindOfMode(m), 'koc', `${m} 应走 KOC 字段集`));
  ['账号代运营', '整店代运营', '达人', '机构', '马卡乐合伙人'].forEach(m => assert.equal(Store.accountEntryKindOfMode(m), 'standard', `${m} 应走完整字段集`));
  assert.equal(Store.accountEntryKindOfMode(''), 'standard', '未选模式默认完整字段集');
  // 运营模式字典：全站单一数据源，编码统一 AO 口径（共 13 项）
  assert.deepEqual(Store.ACCOUNT_OPERATION_MODES.map(o => o.label), [
    '自播', '达人播', '代播', '分销', '其他', '商品卡', '分销一组', '分销二组', '短视频', '头部达人',
    '头达矩阵号', '新锐达人', '达人机构'
  ]);
  assert.deepEqual(Store.ACCOUNT_OPERATION_MODES.map(o => o.code),
    ['AO001', 'AO004', 'AO006', 'AO007', 'AO008', 'AO015', 'AO016', 'AO017', 'AO018', 'AO019', 'AO020', 'AO021', 'AO022']);
  assert.ok(Store.ACCOUNT_OPERATION_MODES.every(o => /^AO\d{3}$/.test(o.code)), '编码统一为 AO + 3 位序号');
  // 账号信息录入只开放 10 项
  assert.deepEqual(Store.accountEntryOperationModes().map(o => o.code),
    ['AO001', 'AO004', 'AO006', 'AO007', 'AO008', 'AO015', 'AO016', 'AO017', 'AO018', 'AO019']);
  assert.equal(Store.accountEntryOperationModes().length, 10, '录入页运营模式10项');
  // 主销品牌 → 账号定位联动
  assert.deepEqual(Store.ACCOUNT_BRANDS, ['森马', '巴拉巴拉', '迷你巴拉']);
  assert.deepEqual(Store.positioningsOfBrand('森马'), ['男装', '女装']);
  assert.deepEqual(Store.positioningsOfBrand('巴拉巴拉'), ['中童', '幼童', '婴童']);
  assert.deepEqual(Store.positioningsOfBrand('迷你巴拉'), ['婴童']);
  assert.deepEqual(Store.positioningsOfBrand(''), []);
});

test('账号信息录入：主表 + 录入页 + 详情页三页体系与客户视角菜单', () => {
  const list = read('pages/recruit/account-entry.html');
  const edit = read('pages/recruit/account-entry-edit.html');
  const detail = read('pages/recruit/account-entry-detail.html');
  [list, edit, detail].forEach(html => {
    assert.match(html, /\.\.\/\.\.\/js\/onboarding-store\.js/, '三页均应复用业务字典');
    assert.match(html, /recruit_account_entries/, '三页应共用 recruit_account_entries 存储键');
  });
  ['pages/recruit/account-entry.html', 'pages/recruit/account-entry-edit.html', 'pages/recruit/account-entry-detail.html']
    .forEach(compileInlineScripts);
  // 主表：新增入口指向录入页，行操作提供编辑/查看
  assert.match(list, /href="account-entry-edit\.html\?mode=add"/, '主表应有新增入口');
  assert.match(list, /account-entry-detail\.html\?id=/, '主表应能查看详情');
  // 录入页：两套字段集卡片 + 模式驱动切换
  ['kocCard', 'stdCard', 'onModeChange', 'onBrandChange', 'KOC_FIELD_MAP', 'STD_FIELD_MAP'].forEach(sym => {
    assert.match(edit, new RegExp(sym), `录入页应包含 ${sym}`);
  });
  // KOC 字段集（客户KOC/素人KOC/联营KOC）
  ['账号UID', '账号昵称', '合作码', '对接商务', 'UID图片上传', '合作码图片上传'].forEach(label => {
    assert.ok(edit.includes(label), `录入页应包含 KOC 字段 ${label}`);
  });
  // 完整字段集（其余入驻模式）
  ['账号所属平台', '账号运营模式', '账号ID', '账号类型', '账号负责人', '账号绑定手机号',
    '主销品牌', '账号属性', '账号定位', '绑定店铺名称', '账号注册主体', '账号运营机构'].forEach(label => {
    assert.ok(edit.includes(label), `录入页应包含字段 ${label}`);
  });
  // 默认值：账号类型个人号、账号属性主账号
  assert.match(edit, /<option value="个人号" selected|<option value="个人号">/, '账号类型应默认个人号');
  assert.match(edit, /<option value="主账号">/, '账号属性应默认主账号');
  // 详情页按字段集分区展示
  assert.match(detail, /accountCardTitle/, '详情页标题应随字段集切换');
  assert.match(detail, /imageCard/, '详情页应包含 KOC 凭证图片区');
  // 菜单：客户视角下新增一级菜单
  assert.match(read('index.html'), /pages\/recruit\/account-entry\.html[\s\S]{0,400}<span>账号信息录入<\/span>/, '客户视角应包含账号信息录入菜单');
});

test('直播账号管理两套编辑页的运营模式与录入页同源（不再硬编码 A0001）', () => {
  ['pages/recruit/live-account-edit.html', 'pages/recruit/live-account-client-edit.html'].forEach(file => {
    const html = read(file);
    assert.doesNotMatch(html, /A00\d{2}/, `${file} 不应当再硬编码旧编码`);
    assert.match(html, /\.\.\/\.\.\/js\/onboarding-store\.js/, `${file} 应引入业务字典`);
    assert.match(html, /function\s+renderOperationModes\s*\(/, `${file} 应定义 renderOperationModes`);
    assert.match(html, /OnboardingStore\.ACCOUNT_OPERATION_MODES\.map/, `${file} 应从字典渲染选项`);
    assert.match(html, /function\s+init\s*\(\)\s*\{[\s\S]{0,80}renderOperationModes\(\);/, `${file} 应在回填记录值前先渲染选项`);
    compileInlineScripts(file);
  });
});

test('账号信息录入三页已接入 shared 模块，不再保留本地副本实现', () => {
  [
    'pages/recruit/account-entry.html',
    'pages/recruit/account-entry-edit.html',
    'pages/recruit/account-entry-detail.html'
  ].forEach(file => {
    const html = read(file);
    ['css/components.css', 'css/domains/recruit.css'].forEach(c => {
      assert.match(html, new RegExp(`href="\\.\\./\\.\\./${c}"`), `${file} 应引入 ${c}`);
    });
    ['escape-html.js', 'storage.js', 'toast.js'].forEach(s => {
      assert.match(html, new RegExp(`js/shared/${s}`), `${file} 应引入 shared/${s}`);
    });
    // 加载顺序：shared 脚本必须早于使用它们的业务内联脚本
    assert.ok(html.indexOf('js/shared/escape-html.js') < html.indexOf('esc('), `${file} escape-html 应先于 esc() 调用加载`);
    assert.ok(html.indexOf('js/shared/storage.js') < html.indexOf('AppStorage.'), `${file} storage 应先于 AppStorage 调用加载`);
    // 不允许再出现本地副本或裸 localStorage 读写
    ['function esc(', 'function showToast('].forEach(sym => assert.ok(!html.includes(sym), `${file} 不应保留副本 ${sym}`));
    assert.doesNotMatch(html, /JSON\.parse\(localStorage\.getItem/, `${file} 应改用 AppStorage.load`);
    assert.doesNotMatch(html, /localStorage\.setItem/, `${file} 应改用 AppStorage.save`);
    // 组件样式已上收到 components.css，页面内不再重复定义
    assert.doesNotMatch(html, /\.type-tag\s*\{/, `${file} 不应重复定义 .type-tag`);
    assert.doesNotMatch(html, /\.link-action-icon\s*\{/, `${file} 不应重复定义 .link-action-icon`);
    compileInlineScripts(file);
  });
});

// ================= 马卡乐合伙人：品牌默认仅「马卡乐」+ 专属字段集（流程节点不变） =================

test('马卡乐合伙人：品牌默认仅「马卡乐」，其余模式沿用通用品牌字典', () => {
  assert.equal(Store.isMakaleMode('马卡乐合伙人'), true);
  assert.equal(Store.isMakaleMode('账号代运营'), false);
  assert.deepEqual(Store.brandsForMode('马卡乐合伙人'), ['马卡乐']);
  assert.deepEqual(Store.brandsForMode('账号代运营'), ['巴拉', '迷你', '森马']);
  // 通用 BRANDS 字典本身不受影响
  assert.deepEqual(Store.BRANDS, ['巴拉', '迷你', '森马']);
});

test('马卡乐合伙人：流程节点仍为 default 13 阶段（流程节点不变）', () => {
  assert.equal(Store.flowKeyOfMode('马卡乐合伙人'), 'default');
  assert.equal(Store.stagesForMode('马卡乐合伙人').length, 13);
});

test('马卡乐合伙人：emptyForm 产出「企业信息 + 业务能力」两段结构并含 12 月分解', () => {
  const f = Store.emptyForm('马卡乐合伙人');
  assert.ok(f.enterprise && f.capability, '应含 enterprise/capability 两段');
  assert.ok(!f.finance && !f.plan, '不应包含标准四段字段');
  assert.equal(Object.keys(f.capability.monthly).length, 12, '月度分解应为 12 个月');
  assert.equal(f.enterprise.entName, '');
  assert.equal(f.capability.storeLink, '');
  // 普通模式仍走标准四段
  const std = Store.emptyForm('账号代运营');
  assert.ok(std.business && std.contact && std.plan && std.finance);
});

test('马卡乐合伙人：MAKALE_FIELD_DEFS 覆盖需求全部字段标签', () => {
  const entLabels = Store.MAKALE_FIELD_DEFS.enterprise.map(d => d.label);
  const capLabels = Store.MAKALE_FIELD_DEFS.capability.map(d => d.label);
  ['企业与机构名称（营业执照）', '客户经营详细地址', '客户简称', '客户电话', '客户联系人', '联系人电话', '纳税人类别',
    '客户银行账号名称', '银行账号', '开户银行', '开户支行', '联行号']
    .forEach(l => assert.ok(entLabels.includes(l), `企业信息应含字段 ${l}`));
  ['渠道能力', '意向平台', '年度目标', '主营品类', '货源情况', '通货情况', '款式开发能力', '追单能力', '货品价格',
    '公司资金能力', '授权历史', '现有其他品牌', '最好单店销售数据', '单品牌平均单店销售数据', '运营团队人数',
    '视觉模式', '付费费比', '退货率', '店铺模式', '目前店铺链接']
    .forEach(l => assert.ok(capLabels.includes(l), `业务能力应含字段 ${l}`));
  // 月度分解目标在年度目标之后单独渲染（12 个月），不作为普通 def
  const idxAnnual = capLabels.indexOf('年度目标');
  assert.ok(idxAnnual > -1, '业务能力应含年度目标');
});

test('马卡乐合伙人：createDraft 落库为专属表单，diffFormLabels 按模式统计变更', () => {
  global.localStorage = new MemoryStorage();
  const app = Store.createDraft({ mode: '马卡乐合伙人', brand: '马卡乐', platforms: ['抖音'], owner: { phone: '13800000001', name: '张三' } });
  assert.ok(app.form.enterprise && app.form.capability, '草稿表单应为马卡乐结构');
  const next = Store.emptyForm('马卡乐合伙人');
  next.enterprise.entName = '马卡乐测试合伙公司';
  next.capability.annualTarget = '500';
  next.capability.monthly.m1 = '500';
  const changed = Store.diffFormLabels(app.form, next, '马卡乐合伙人');
  assert.ok(changed.includes('企业与机构名称（营业执照）'), '应识别企业更名');
  assert.ok(changed.includes('年度目标'), '应识别年度目标变更');
  assert.ok(changed.includes('月度分解目标（1月）'), '应识别月度分解变更');
});

test('KOC账号信息录入：UID图片与合作码图片必填（多行页面）', () => {
  ['pages/store-engine/manage-influencer.html', 'pages/store-engine/manage-koc-lite.html'].forEach(file => {
    const html = read(file);
    assert.match(html, /accountImage\(i, 'uid', 'UID 图片',[^)]*, true\)/, `${file} UID图片应标记必填`);
    assert.match(html, /accountImage\(i, 'cooperationCode', '合作码图片',[^)]*, true\)/, `${file} 合作码图片应标记必填`);
    assert.match(html, /function\s+validateAccounts\s*\(/, `${file} 应定义 validateAccounts`);
    assert.match(html, /请上传UID图片/, `${file} 应校验 UID图片必填`);
    assert.match(html, /请上传合作码图片/, `${file} 应校验 合作码图片必填`);
    assert.match(html, /validateAccounts\(form\.accounts\)[\s\S]{0,60}showToast\(accErr, 'error'\)/, `${file} 提交前应拦截缺图`);
    compileInlineScripts(file);
  });
});

test('达人(influencer)流程页面隐藏账号信息录入模块，客户KOC 仍保留', () => {
  const html = read('pages/store-engine/manage-influencer.html');
  assert.match(html, /id="accountsPanel"/, '账号信息录入面板应有可切换的容器 id');
  assert.match(html, /Store\.flowKeyOfMode\(app\.mode\) === 'influencer'[\s\S]{0,120}panel\.style\.display = 'none'/, '达人流程应将账号面板隐藏');
  assert.match(html, /function\s+readAccountsFields[\s\S]{0,120}=== 'influencer'\) return \[\]/, '达人流程保存时不应写入 accounts');
  compileInlineScripts('pages/store-engine/manage-influencer.html');
});

test('manage.html 与 recruit/detail.html 已支持马卡乐字段集与品牌联动', () => {
  const manage = read('pages/store-engine/manage.html');
  assert.match(manage, /function\s+renderBrandOptions\s*\(/, 'manage.html 应定义按模式渲染品牌的函数');
  assert.match(manage, /Store\.brandsForMode\(mode\)/, '品牌下拉应取自 brandsForMode');
  assert.match(manage, /Store\.isMakaleMode\(app\.mode\)/, '表单构建/读写应按马卡乐模式分支');
  assert.match(manage, /Store\.MAKALE_FIELD_DEFS\[step\.key\]/, '应渲染马卡乐专属字段');
  assert.match(manage, /buildMonthlyGrid\('capability'\)/, '月度分解应在业务能力段渲染');
  compileInlineScripts('pages/store-engine/manage.html');

  const detail = read('pages/recruit/detail.html');
  assert.match(detail, /Store\.isMakaleMode\(app\.mode\)/, '详情页应按马卡乐模式只读展示');
  assert.match(detail, /Store\.MAKALE_STEPS\.forEach/, '详情页应渲染马卡乐两段字段');
  compileInlineScripts('pages/recruit/detail.html');
});

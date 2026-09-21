/**
 * 客户入驻申请 - 数据存储与业务规则模块
 *
 * 职责：
 * 1. 本地持久化（localStorage），静态数据落盘前做轻量加密（XOR 流密码 + Base64）
 * 2. 入驻模式 / 品牌 / 13 个流程阶段 等业务字典
 * 3. 表单校验（分步校验 + 整体校验）
 * 4. 版本历史（每次编辑 / 提交 / 审核都会追加一条版本记录）
 *
 * 说明：XOR+Base64 为演示级轻量加密，用于避免敏感信息明文落盘；
 * 生产环境应改为 HTTPS 传输 + 服务端 AES 落库。
 */
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OnboardingStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var STORAGE_KEY = 'onboarding_applications';
  var ENC_PREFIX = 'OBENC1:';
  var SECRET = 'onboarding-secret-v1';
  var MAX_VERSIONS = 30;

  // ========== 业务字典 ==========

  // 入驻模式：所有模式均需选择品牌（单选）与入驻平台（单选）
  var MODES = [
    { value: '账号代运营', label: '账号代运营', desc: '客户保留店铺主体，由我方代运营账号', needsBrand: true },
    { value: '整店代运营', label: '整店代运营', desc: '整店托管，含商品、供应链与客服', needsBrand: true },
    { value: '达人', label: '达人', desc: '达人主体直接进入供应商与合同流程', needsBrand: true },
    { value: '机构', label: '机构', desc: '机构主体补充达人矩阵与履约能力', needsBrand: true },
    { value: '联营KOC', label: '联营KOC', desc: '双方联合运营 KOC 项目', needsBrand: true },
    { value: '素人KOC', label: '素人KOC', desc: '个人内容创作者轻量入驻', needsBrand: true },
    { value: '客户KOC', label: '客户KOC', desc: '客户自有 KOC 资源合作', needsBrand: true },
    { value: '马卡乐合伙人', label: '马卡乐合伙人', desc: '马卡乐品牌合伙经营合作模式', needsBrand: true }
  ];

  var BRANDS = ['巴拉', '迷你', '森马'];
  var PLATFORMS = ['抖音', '视频号', '小红书', '快手'];

  // 马卡乐合伙人品牌固定为「马卡乐」，其余模式使用通用品牌字典
  var MAKALE_MODE = '马卡乐合伙人';
  var MAKALE_BRANDS = ['马卡乐'];
  function isMakaleMode(mode) { return mode === MAKALE_MODE; }
  function brandsForMode(mode) { return isMakaleMode(mode) ? MAKALE_BRANDS.slice() : BRANDS.slice(); }

  // 12 个入驻流程阶段（默认模板，适用于账号代运营/整店代运营/机构）
  var STAGES = [
    { no: 1, name: '客户注册' },
    { no: 2, name: '选择入驻模式' },
    { no: 3, name: '填写企业信息' },
    { no: 4, name: '运营审核企业' },
    { no: 5, name: 'BPM审批建档' },
    { no: 6, name: '签署合作合同' },
    { no: 7, name: '保证金缴纳' },
    { no: 8, name: '授权书签署' },
    { no: 9, name: '账号信息录入' },
    { no: 10, name: '内部软件开通' },
    { no: 11, name: '签署品牌规则' },
    { no: 12, name: '入驻完毕' }
  ];

  // 分模式的流程模板：
  //   default       → 12 阶段（同 STAGES），适用于账号代运营 / 整店代运营 / 机构
  //   makale        → 11 阶段，适用于马卡乐合伙人（default 基础上去掉「内部软件开通」）
  //   influencer    → 8 阶段，适用于达人
  //   customer_koc  → 10 阶段，适用于客户KOC（达人基础上多开软件 + 品牌规则两个环节）
  //   koc_lite      → 6 阶段，适用于素人KOC / 联营KOC
  var STAGE_TEMPLATES = {
    default: STAGES,
    makale: [
      { no: 1, name: '客户注册' },
      { no: 2, name: '选择入驻模式' },
      { no: 3, name: '填写企业信息' },
      { no: 4, name: '运营审核企业' },
      { no: 5, name: 'BPM审批建档' },
      { no: 6, name: '签署合作合同' },
      { no: 7, name: '保证金缴纳' },
      { no: 8, name: '授权书签署' },
      { no: 9, name: '账号信息录入' },
      { no: 10, name: '签署品牌规则' },
      { no: 11, name: '入驻完毕' }
    ],
    influencer: [
      { no: 1, name: '客户注册' },
      { no: 2, name: '选择入驻模式' },
      { no: 3, name: '供应商信息录入' },
      { no: 4, name: 'BPM审批建档' },
      { no: 5, name: '签署合作合同' },
      { no: 6, name: '授权书签署' },
      { no: 7, name: '账号信息录入' },
      { no: 8, name: '入驻完毕' }
    ],
    customer_koc: [
      { no: 1, name: '客户注册' },
      { no: 2, name: '选择入驻模式' },
      { no: 3, name: '供应商信息录入' },
      { no: 4, name: 'BPM审批建档' },
      { no: 5, name: '签署合作合同' },
      { no: 6, name: '授权书签署' },
      { no: 7, name: '账号信息录入' },
      { no: 8, name: '软件开通' },
      { no: 9, name: '签署品牌规则' },
      { no: 10, name: '入驻完毕' }
    ],
    koc_lite: [
      { no: 1, name: '客户注册' },
      { no: 2, name: '选择入驻模式' },
      { no: 3, name: '账号信息录入' },
      { no: 4, name: '内部软件开通' },
      { no: 5, name: '签署品牌规则' },
      { no: 6, name: '入驻完毕' }
    ]
  };

  // 入驻模式 → 流程模板 key；历史模式向后兼容
  var FLOW_GROUPS = {
    '账号代运营': 'default',
    '整店代运营': 'default',
    '机构': 'default',
    '马卡乐合伙人': 'makale',
    '达人': 'influencer',
    '客户KOC': 'customer_koc',
    '素人KOC': 'koc_lite',
    '联营KOC': 'koc_lite',
    'DP': 'default',
    '达播达人': 'influencer',
    '达播机构': 'default'
  };
  function flowKeyOfMode(mode) { return FLOW_GROUPS[mode] || 'default'; }
  function stagesForMode(mode) { return clone(STAGE_TEMPLATES[flowKeyOfMode(mode)]); }
  function stagesForApp(app) { return stagesForMode(app && app.mode); }

  // 状态流转：待提交 → 已提交 → 已审核（已审核前均可编辑，已审核后只读）
  var STATUS = {
    UNSUBMIT: 'unsubmit',   // 待提交：新建草稿，可编辑、可提交
    SUBMITTED: 'submitted', // 已提交：已提交运营审核，审核完成前仍可编辑
    REVIEWED: 'reviewed'    // 已审核：终态，只读
  };

  var STATUS_LABEL = {
    unsubmit: '待提交',
    submitted: '已提交',
    reviewed: '已审核'
  };

  // 旧四态数据迁移映射（读取时自动转换）
  var LEGACY_STATUS = {
    draft: STATUS.UNSUBMIT,
    pending: STATUS.SUBMITTED,
    approved: STATUS.REVIEWED,
    rejected: STATUS.REVIEWED
  };

  // 状态 -> 流程阶段映射：当前所处阶段（1 基）
  // 优先取显式 stageNo（手工流转写入）；否则按状态默认（三种模板下 stage 1-2 同名，
  // stage 3 = 客户信息录入；stage 4 = 中间处理环节；stage 5 = 后续处理环节）
  function currentStageOf(app) {
    if (!app) return 1;
    var stages = STAGE_TEMPLATES[flowKeyOfMode(app.mode)];
    var s = app.stageNo;
    if (typeof s === 'number' && s >= 1 && s <= stages.length) return s;
    if (app.status === STATUS.SUBMITTED) return Math.min(4, stages.length);
    if (app.status === STATUS.REVIEWED) return Math.min(5, stages.length);
    return Math.min(3, stages.length);
  }

  // ========== 表单字段定义（4 步） ==========

  var FIELD_DEFS = {
    business: [
      { key: 'intro', label: '企业介绍', type: 'textarea', required: true, placeholder: '请介绍企业成立时间、主营业务、团队规模等', maxlength: 1000 },
      { key: 'scale', label: '经营规模', type: 'textarea', required: false, placeholder: '如年营业额、店铺数量、员工人数等（选填）', maxlength: 500 },
      { key: 'brandInfo', label: '合作品牌信息', type: 'textarea', required: false, placeholder: '如曾合作或代理的品牌（选填）', maxlength: 500 },
      { key: 'trafficCases', label: '付费流量运营案例', type: 'textarea', required: false, placeholder: '如千川/磁力金牛投放案例及 ROI（选填）', maxlength: 500 },
      { key: 'contentCases', label: '内容打造案例', type: 'textarea', required: false, placeholder: '如代表账号、爆款内容案例（选填）', maxlength: 500 }
    ],
    contact: [
      { key: 'contactPhone', label: '负责人联系方式', type: 'text', required: true, placeholder: '请输入手机号或其他联系方式' },
      { key: 'address', label: '收件地址', type: 'text', required: true, placeholder: '请输入用于寄送合同、物料的收件地址' }
    ],
    plan: [
      { key: 'annualTarget', label: '年度目标', type: 'number', required: true, unit: '万元', placeholder: '请输入年度目标（万元）' },
      { key: 'accountPlan', label: '账号规划（定位、人群、渠道）', type: 'textarea', required: true, placeholder: '请说明账号定位、目标人群与运营渠道' },
      { key: 'teamConfig', label: '团队配置', type: 'textarea', required: true, placeholder: '请说明团队角色、人数与分工' },
      { key: 'videoStrategy', label: '短视频内容策略', type: 'textarea', required: true, placeholder: '请说明内容方向、更新频率等' },
      { key: 'adStrategy', label: '投放策略', type: 'textarea', required: true, placeholder: '请说明投放渠道与预算安排' },
      { key: 'venuePlan', label: '场地、设备计划', type: 'textarea', required: true, placeholder: '请说明直播间/场地与设备投入计划' }
    ],
    finance: [
      { key: 'region', label: '企业所在地', type: 'radio', required: true, options: [
        { value: 'domestic', label: '境内' },
        { value: 'overseas', label: '境外' }
      ] },
      { key: 'street', label: '街道/门牌号（境外地址）', type: 'text', required: 'overseas', placeholder: '境外企业请填写街道/门牌号', showIf: { key: 'region', value: 'overseas' } },
      { key: 'fullName', label: '企业全称/银行账户持有人', type: 'text', required: true, placeholder: '请输入营业执照上的企业全称' },
      { key: 'shortName', label: '企业简称/员工域登陆名', type: 'text', required: true, placeholder: '请输入企业简称（将用作员工域登陆名）' },
      { key: 'taxNo', label: '税务登记号（个人为身份证号）', type: 'text', required: true, placeholder: '请输入税务登记号或身份证号' },
      { key: 'bankName', label: '银行名称', type: 'text', required: true, placeholder: '如：招商银行' },
      { key: 'province', label: '开户省', type: 'text', required: true, placeholder: '请输入开户省' },
      { key: 'city', label: '开户市', type: 'text', required: true, placeholder: '请输入开户市' },
      { key: 'branch', label: '开户行', type: 'text', required: true, placeholder: '请输入开户支行名称' },
      { key: 'taxpayerType', label: '纳税人类别', type: 'select', required: true, options: ['一般纳税人', '小规模纳税人', '个人', '其他'] },
      { key: 'accountHolder', label: '银行账户持有人', type: 'text', required: true, placeholder: '请输入银行账户持有人姓名' },
      { key: 'accountNo', label: '收款账号', type: 'text', required: true, placeholder: '请输入对公/个人收款账号' }
    ]
  };

  var STEPS = [
    { key: 'business', label: '企业业务能力', icon: 'building' },
    { key: 'contact', label: '企业负责人', icon: 'user' },
    { key: 'plan', label: '项目规划', icon: 'target' },
    { key: 'finance', label: '财务信息', icon: 'wallet' }
  ];

  // 月度分解目标：1-12 月（万元）
  var MONTH_KEYS = ['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12'];

  // ========== 马卡乐合伙人专属表单字段（流程节点不变，仅字段集不同） ==========
  // 分两个区块：企业信息 / 业务能力；月度分解目标在「业务能力·年度目标」后单独渲染
  var MAKALE_STEPS = [
    { key: 'enterprise', label: '企业信息' },
    { key: 'capability', label: '业务能力' }
  ];
  var MAKALE_FIELD_DEFS = {
    enterprise: [
      { key: 'entName', label: '企业与机构名称（营业执照）', type: 'text', required: true, placeholder: '请输入营业执照上的企业与机构名称' },
      { key: 'address', label: '客户经营详细地址', type: 'text', required: false, placeholder: '请输入客户经营详细地址' },
      { key: 'shortName', label: '客户简称', type: 'text', required: false, placeholder: '请输入客户简称' },
      { key: 'custPhone', label: '客户电话', type: 'text', required: false, placeholder: '请输入客户电话' },
      { key: 'contact', label: '客户联系人', type: 'text', required: false, placeholder: '请输入客户联系人' },
      { key: 'contactPhone', label: '联系人电话', type: 'text', required: false, placeholder: '请输入联系人电话' },
      { key: 'taxpayerType', label: '纳税人类别', type: 'select', required: false, options: ['一般纳税人', '小规模纳税人', '个人', '其他'] },
      { key: 'bankAccountName', label: '客户银行账号名称', type: 'text', required: false, placeholder: '请输入银行账号名称（开户名）' },
      { key: 'bankAccountNo', label: '银行账号', type: 'text', required: false, placeholder: '请输入银行账号' },
      { key: 'bankName', label: '开户银行', type: 'text', required: false, placeholder: '请输入开户银行' },
      { key: 'bankBranch', label: '开户支行', type: 'text', required: false, placeholder: '请输入开户支行' },
      { key: 'unionBankNo', label: '联行号', type: 'text', required: false, placeholder: '请输入联行号（CNAPS）' }
    ],
    capability: [
      { key: 'channelAbility', label: '渠道能力', type: 'textarea', required: false, placeholder: '请说明可运营的渠道资源与能力' },
      { key: 'intentPlatform', label: '意向平台', type: 'text', required: false, placeholder: '请输入意向平台' },
      { key: 'annualTarget', label: '年度目标', type: 'number', required: false, unit: '万元', placeholder: '请输入年度目标（万元）' },
      { key: 'mainCategory', label: '主营品类', type: 'text', required: false, placeholder: '请输入主营品类' },
      { key: 'supplyStatus', label: '货源情况', type: 'textarea', required: false, placeholder: '请说明货源渠道与稳定性' },
      { key: 'commonGoods', label: '通货情况', type: 'textarea', required: false, placeholder: '请说明通货备货与供应情况' },
      { key: 'designAbility', label: '款式开发能力', type: 'textarea', required: false, placeholder: '请说明款式开发能力' },
      { key: 'reorderAbility', label: '追单能力', type: 'textarea', required: false, placeholder: '请说明追单响应与交付能力' },
      { key: 'goodsPrice', label: '货品价格', type: 'text', required: false, placeholder: '请输入货品价格区间' },
      { key: 'fundAbility', label: '公司资金能力', type: 'text', required: false, placeholder: '请说明公司资金实力' },
      { key: 'authHistory', label: '授权历史', type: 'textarea', required: false, placeholder: '请说明历史品牌授权情况' },
      { key: 'otherBrands', label: '现有其他品牌', type: 'text', required: false, placeholder: '请输入现有运营的其他品牌' },
      { key: 'bestStoreSales', label: '最好单店销售数据', type: 'text', required: false, placeholder: '请输入最好单店销售数据' },
      { key: 'avgStoreSales', label: '单品牌平均单店销售数据', type: 'text', required: false, placeholder: '请输入单品牌平均单店销售数据' },
      { key: 'teamSize', label: '运营团队人数', type: 'number', required: false, placeholder: '请输入运营团队人数' },
      { key: 'visualMode', label: '视觉模式', type: 'text', required: false, placeholder: '请说明视觉/内容呈现模式' },
      { key: 'paidRatio', label: '付费费比', type: 'text', required: false, placeholder: '请输入付费费比（如 15%）' },
      { key: 'returnRate', label: '退货率', type: 'text', required: false, placeholder: '请输入退货率（如 20%）' },
      { key: 'storeMode', label: '店铺模式', type: 'text', required: false, placeholder: '请说明店铺运营模式' },
      { key: 'storeLink', label: '目前店铺链接', type: 'text', required: false, placeholder: '请输入目前经营的店铺链接' }
    ]
  };

  // ========== 工具函数 ==========

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s);
  }

  function nowText() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function genId() {
    // SQ + YYYYMMDD + 4位流水号
    var now = new Date();
    var dateStr = now.getFullYear().toString() +
                  (now.getMonth() + 1).toString().padStart(2, '0') +
                  now.getDate().toString().padStart(2, '0');

    // 从 localStorage 读取当天已有申请,计算流水号
    var list = readAll();
    var todayPrefix = 'SQ' + dateStr;
    var todayApps = list.filter(function(app) { return app.id && app.id.startsWith(todayPrefix); });
    var maxSeq = 0;
    todayApps.forEach(function(app) {
      var seqStr = app.id.substring(todayPrefix.length);
      var seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
    var nextSeq = (maxSeq + 1).toString().padStart(4, '0');

    return todayPrefix + nextSeq;
  }

  // ========== 轻量加密（XOR 流密码 + Base64） ==========

  // 基于口令派生密钥字节流（FNV-1a 链式散列）
  function deriveKeyBytes(secret, length) {
    var bytes = [];
    var seed = 0x811c9dc5;
    for (var i = 0; i < secret.length; i++) {
      seed ^= secret.charCodeAt(i);
      seed = (seed * 0x01000193) >>> 0;
    }
    var base = [];
    for (var j = 0; j < 16; j++) {
      seed ^= (seed >>> 15);
      seed = (seed * 0x2545f491) >>> 0;
      base.push(seed & 0xff);
    }
    for (var k = 0; k < length; k++) {
      // 加入位置盐，避免重复明文产生重复密文
      bytes.push((base[k % 16] + ((k * 31 + 7) & 0xff)) & 0xff);
    }
    return bytes;
  }

  function textToBytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    // 兜底：UTF-8 手工编码
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return out;
  }

  function bytesToText(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(new Uint8Array(bytes));
    var out = '', i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      if (b < 0x80) { out += String.fromCharCode(b); i++; }
      else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
      else { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    }
    return out;
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
    }
    if (typeof btoa === 'function') return btoa(bin);
    // Node 环境兜底
    return Buffer.from(bytes).toString('base64');
  }

  function base64ToBytes(b64) {
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var bytes = [];
      for (var i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
      return bytes;
    }
    return Array.from(Buffer.from(b64, 'base64'));
  }

  function encryptText(text) {
    var bytes = textToBytes(text);
    var key = deriveKeyBytes(SECRET, bytes.length);
    var out = [];
    for (var i = 0; i < bytes.length; i++) out.push(bytes[i] ^ key[i]);
    return ENC_PREFIX + bytesToBase64(out);
  }

  function decryptText(payload) {
    if (payload.indexOf(ENC_PREFIX) !== 0) return payload; // 兼容未加密历史数据
    var bytes = base64ToBytes(payload.slice(ENC_PREFIX.length));
    var key = deriveKeyBytes(SECRET, bytes.length);
    var out = [];
    for (var i = 0; i < bytes.length; i++) out.push(bytes[i] ^ key[i]);
    return bytesToText(out);
  }

  // ========== 存储层 ==========

  var memoryStore = null; // 测试或无 localStorage 环境的兜底

  function getStorage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* ignore */ }
    return null;
  }

  function readAll() {
    var storage = getStorage();
    var raw = null;
    if (storage) raw = storage.getItem(STORAGE_KEY);
    else if (memoryStore !== null) raw = memoryStore;
    if (!raw) return [];
    try {
      var data = JSON.parse(decryptText(String(raw)));
      var arr = Array.isArray(data) ? data : [];
      // 旧四态（草稿/待审核/已通过/已驳回）自动迁移到新三态
      arr.forEach(function(item) {
        if (item && LEGACY_STATUS[item.status]) item.status = LEGACY_STATUS[item.status];
      });
      return arr;
    } catch (e) {
      return []; // 数据损坏时按空列表处理，避免页面白屏
    }
  }

  function writeAll(list) {
    var payload = encryptText(JSON.stringify(list));
    var storage = getStorage();
    if (storage) storage.setItem(STORAGE_KEY, payload);
    else memoryStore = payload;
  }

  // ========== 业务操作 ==========

  function emptyForm(mode) {
    // 马卡乐合伙人：使用「企业信息 + 业务能力」专属字段集（流程为 makale 专属 11 阶段模板）
    if (isMakaleMode(mode)) {
      var mkForm = { enterprise: {}, capability: {}, accounts: [] };
      MAKALE_STEPS.forEach(function(step) {
        MAKALE_FIELD_DEFS[step.key].forEach(function(def) {
          mkForm[step.key][def.key] = '';
        });
      });
      var mkMonthly = {};
      MONTH_KEYS.forEach(function(mk) { mkMonthly[mk] = ''; });
      mkForm.capability.monthly = mkMonthly;
      return mkForm;
    }
    var monthly = {};
    MONTH_KEYS.forEach(function(mk) { monthly[mk] = ''; });
    return {
      business: { intro: '', scale: '', brandInfo: '', trafficCases: '', contentCases: '' },
      contact: { contactPhone: '', address: '' },
      plan: { annualTarget: '', accountPlan: '', teamConfig: '', videoStrategy: '', adStrategy: '', venuePlan: '', monthly: monthly },
      finance: {
        fullName: '', shortName: '', region: 'domestic', street: '', taxNo: '',
        bankName: '', province: '', city: '', branch: '', taxpayerType: '', accountHolder: '', accountNo: ''
      },
      // 账号信息录入（多行），仅 influencer / customer_koc / koc_lite 流程页面写入；
      // default 13 阶段流程目前不展示该面板，因此保持空数组无副作用
      accounts: []
    };
  }

  function createDraft(options) {
    options = options || {};
    var user = options.owner || {};
    var app = {
      id: genId(),
      mode: options.mode || '',
      brand: options.brand || null,
      platforms: options.platforms || [],
      bdContact: '',
      stageNo: null,
      status: STATUS.UNSUBMIT,
      ownerPhone: user.phone || '',
      ownerName: user.name || '',
      form: emptyForm(options.mode),
      versions: [],
      createdAt: nowText(),
      updatedAt: nowText(),
      submittedAt: null,
      reviewedAt: null,
      reviewReason: ''
    };
    app.versions.push({
      v: 1, time: app.createdAt, operator: user.name || user.phone || '客户',
      action: '创建申请', changes: ['入驻模式：' + (app.mode || '-')].concat(app.brand ? ['品牌：' + app.brand] : []).concat(app.platforms && app.platforms.length ? ['入驻平台：' + app.platforms.join('、')] : []),
      snapshot: clone(app.form)
    });
    var list = readAll();
    list.unshift(app);
    writeAll(list);
    return clone(app);
  }

  // 追加版本记录；changes 为本次变更的字段中文名数组
  function pushVersion(app, action, changes, operator) {
    var list = app.versions || [];
    var lastV = list.length ? list[list.length - 1].v : 0;
    list.push({
      v: lastV + 1,
      time: nowText(),
      operator: operator || app.ownerName || app.ownerPhone || '客户',
      action: action,
      changes: changes || [],
      snapshot: clone(app.form)
    });
    while (list.length > MAX_VERSIONS) list.shift();
    app.versions = list;
  }

  // 对比两份表单，返回发生变化的字段中文名列表
  // mode 为马卡乐合伙人时，按专属「企业信息/业务能力」字段集 diff
  function diffFormLabels(oldForm, newForm, mode) {
    var labels = [];
    if (isMakaleMode(mode)) {
      MAKALE_STEPS.forEach(function(step) {
        var osec = (oldForm && oldForm[step.key]) || {};
        var nsec = (newForm && newForm[step.key]) || {};
        MAKALE_FIELD_DEFS[step.key].forEach(function(def) {
          if (esc(osec[def.key]) !== esc(nsec[def.key])) labels.push(def.label);
        });
        if (step.key === 'capability') {
          var om = (osec.monthly || {});
          var nm = (nsec.monthly || {});
          for (var i = 0; i < MONTH_KEYS.length; i++) {
            var mk = MONTH_KEYS[i];
            if (esc(om[mk]) !== esc(nm[mk])) labels.push('月度分解目标（' + (i + 1) + '月）');
          }
        }
      });
      return labels;
    }
    STEPS.forEach(function(step) {
      var defs = FIELD_DEFS[step.key];
      defs.forEach(function(def) {
        if (def.type === 'radio') {
          if (esc(oldForm[step.key][def.key]) !== esc(newForm[step.key][def.key])) labels.push(def.label);
          return;
        }
        if (def.showIf) {
          var activeOld = oldForm[step.key][def.showIf.key] === def.showIf.value;
          var activeNew = newForm[step.key][def.showIf.key] === def.showIf.value;
          if (activeOld || activeNew) {
            if (esc(activeOld ? oldForm[step.key][def.key] : '') !== esc(activeNew ? newForm[step.key][def.key] : '')) {
              labels.push(def.label);
            }
          }
          return;
        }
        if (esc(oldForm[step.key][def.key]) !== esc(newForm[step.key][def.key])) labels.push(def.label);
      });
      if (step.key === 'plan') {
        for (var i = 0; i < MONTH_KEYS.length; i++) {
          var mk = MONTH_KEYS[i];
          if (esc((oldForm.plan.monthly || {})[mk]) !== esc((newForm.plan.monthly || {})[mk])) {
            labels.push('月度分解目标（' + (i + 1) + '月）');
          }
        }
      }
    });
    return labels;
  }

  // 更新入驻模式、品牌和平台（已审核前均可修改）
  function updateMode(id, mode, brand, platforms, operator) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status === STATUS.REVIEWED) {
        return { ok: false, error: '当前状态（' + statusLabel(app.status) + '）不允许修改模式' };
      }
      var newPlatforms = platforms || [];
      var changes = [];
      if (app.mode !== mode) changes.push('入驻模式：' + (app.mode || '-') + ' → ' + (mode || '-'));
      if ((app.brand || '') !== (brand || '')) changes.push('品牌：' + (app.brand || '-') + ' → ' + (brand || '-'));
      var oldPlat = (app.platforms || []).join('、') || '-';
      var newPlat = newPlatforms.join('、') || '-';
      if (oldPlat !== newPlat) changes.push('入驻平台：' + oldPlat + ' → ' + newPlat);
      app.mode = mode;
      app.brand = brand || null;
      app.platforms = newPlatforms;
      app.updatedAt = nowText();
      if (changes.length) pushVersion(app, '修改模式/品牌/平台', changes, operator);
      writeAll(list);
      return { ok: true, app: clone(app) };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 更新对接商务（已审核前均可修改；值未变化不落版本记录）
  function updateBdContact(id, bdContact, operator) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status === STATUS.REVIEWED) {
        return { ok: false, error: '当前状态（' + statusLabel(app.status) + '）不允许修改对接商务' };
      }
      var newValue = String(bdContact || '').trim();
      var oldValue = app.bdContact || '';
      if (newValue === oldValue) return { ok: true, app: clone(app) };
      app.bdContact = newValue;
      app.updatedAt = nowText();
      pushVersion(app, '更新对接商务', ['对接商务：' + (oldValue || '-') + ' → ' + (newValue || '-')], operator);
      writeAll(list);
      return { ok: true, app: clone(app) };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 保存草稿 / 编辑更新（已审核前均允许编辑）
  // options.silent：自动保存静默模式 —— 只落盘、不产生版本记录，避免自动保存刷屏版本历史
  function saveDraft(id, form, operator, options) {
    options = options || {};
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status === STATUS.REVIEWED) {
        return { ok: false, error: '当前状态（' + statusLabel(app.status) + '）不允许编辑' };
      }
      var changes = diffFormLabels(app.form, form, app.mode);
      app.form = clone(form);
      app.updatedAt = nowText();
      if (!options.silent) {
        if (changes.length) {
          pushVersion(app, app.status === STATUS.SUBMITTED ? '已提交后补充资料' : '编辑资料', changes, operator);
        } else {
          pushVersion(app, '保存（无字段变更）', [], operator);
        }
      }
      writeAll(list);
      return { ok: true, app: clone(app), changes: changes };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 提交运营审核
  function submit(id, operator) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status === STATUS.SUBMITTED) return { ok: false, error: '申请已提交，请等待审核' };
      if (app.status === STATUS.REVIEWED) return { ok: false, error: '申请已审核，无需再次提交' };
      // 唯一校验：同一 客户名称 + 品牌 + 入驻模式 + 入驻平台 只能发起一次申请
      // 客户名称与列表口径一致：finance.fullName 优先，马卡乐取 enterprise.entName
      var fin = (app.form && app.form.finance) || {};
      var ent0 = (app.form && app.form.enterprise) || {};
      var custName = String(fin.fullName || ent0.entName || '').trim();
      if (custName) {
        var platKey = (app.platforms || []).join('、');
        var dup = list.some(function(o) {
          if (o.id === id) return false;
          var oFin = (o.form && o.form.finance) || {};
          var oEnt = (o.form && o.form.enterprise) || {};
          return String(oFin.fullName || oEnt.entName || '').trim() === custName &&
                 (o.brand || '') === (app.brand || '') &&
                 o.mode === app.mode &&
                 (o.platforms || []).join('、') === platKey;
        });
        if (dup) return { ok: false, error: '已存在相同「客户名称 + 品牌 + 入驻模式 + 入驻平台」的申请，不能重复发起' };
      }
      app.status = STATUS.SUBMITTED;
      app.submittedAt = nowText();
      app.updatedAt = nowText();
      pushVersion(app, '提交运营审核', [], operator);
      writeAll(list);
      return { ok: true, app: clone(app) };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 运营审核：已提交 → 已审核（remark 为可选审核备注）
  function review(id, remark, operator) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status !== STATUS.SUBMITTED) return { ok: false, error: '仅已提交状态可以审核' };
      app.status = STATUS.REVIEWED;
      app.reviewedAt = nowText();
      app.reviewReason = remark || '';
      app.updatedAt = nowText();
      pushVersion(app, '运营审核完成' + (remark ? '：' + remark : ''), [], operator || '运营');
      writeAll(list);
      return { ok: true, app: clone(app) };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 手工流转入驻节点：仅支持当前阶段 +1（适用于 BPM/保证金/授权书/培训等线下或独立事项）
  // 仅“已审核”状态可手工流转；前 4 个节点由系统链路驱动
  // opts: { reason: string(必填), operator: string }
  function advanceStage(id, opts) {
    opts = opts || {};
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      var app = list[i];
      if (app.status !== STATUS.REVIEWED) {
        return { ok: false, error: '仅已审核的申请可手工流转节点（前面的阶段由提交/审核链路驱动）' };
      }
      var stages = STAGE_TEMPLATES[flowKeyOfMode(app.mode)];
      var total = stages.length;
      var from = currentStageOf(app);
      if (from >= total) {
        return { ok: false, error: '当前已是最后一个节点（' + stages[total - 1].name + '），无需手工流转' };
      }
      var reason = String(opts.reason || '').trim();
      if (!reason) return { ok: false, error: '请填写流转备注（作为审计凭据）' };
      if (reason.length > 200) return { ok: false, error: '流转备注不超过 200 字' };
      var to = from + 1;
      var fromName = stages[from - 1].name;
      var toName = stages[to - 1].name;
      app.stageNo = to;
      app.updatedAt = nowText();
      pushVersion(app, '手工流转节点：' + fromName + ' → ' + toName,
        ['节点：' + from + '/' + total + ' ' + fromName + ' → ' + to + '/' + total + ' ' + toName,
         '备注：' + reason], opts.operator);
      var last = app.versions[app.versions.length - 1];
      last.kind = 'stage';
      last.stageFrom = from;
      last.stageTo = to;
      last.stageReason = reason;
      writeAll(list);
      return { ok: true, app: clone(app) };
    }
    return { ok: false, error: '申请不存在' };
  }

  // 提取入驻节点手工流转历史（仅供列表/详情页展示）
  function stageHistoryOf(app) {
    if (!app || !Array.isArray(app.versions)) return [];
    return app.versions.filter(function(v) { return v && v.kind === 'stage'; });
  }

  function remove(id) {
    var list = readAll();
    var next = list.filter(function(app) { return app.id !== id; });
    if (next.length === list.length) return false;
    writeAll(next);
    return true;
  }

  function get(id) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return clone(list[i]);
    return null;
  }

  function list(filterStatus, keyword) {
    var data = readAll();
    if (filterStatus) data = data.filter(function(app) { return app.status === filterStatus; });
    if (keyword) {
      var kw = String(keyword).toLowerCase();
      data = data.filter(function(app) {
        return (app.id + ' ' + (app.mode || '') + ' ' + (app.brand || '') + ' ' + (app.ownerName || '') + ' ' + (app.ownerPhone || ''))
          .toLowerCase().indexOf(kw) > -1;
      });
    }
    return data;
  }

  // ========== 校验 ==========

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  function isNumber(v) {
    return !isBlank(v) && isFinite(Number(v)) && Number(v) >= 0;
  }

  // 单字段校验，返回错误文案；无错误返回空字符串
  function validateField(def, value, form) {
    if (def.required === 'overseas') {
      // 仅境外企业必填，且仅在境外时显示
      if (!form || form.finance.region !== 'overseas') return '';
      if (isBlank(value)) return def.label + '为境外企业必填';
      return '';
    }
    if (def.required && isBlank(value)) return def.label + '为必填项';
    if (isBlank(value)) return '';
    switch (def.key) {
      case 'contactPhone': {
        var v = String(value).trim();
        var digits = v.replace(/[\s-]/g, '');
        if (!/^\+?\d{5,20}$/.test(digits)) return '请输入有效的联系方式（5-20 位数字）';
        if (/^1\d{10}$/.test(digits) && !/^1[3-9]\d{9}$/.test(digits)) return '手机号格式不正确';
        return '';
      }
      case 'annualTarget':
        if (!isNumber(value) || Number(value) <= 0) return '年度目标需为大于 0 的数字（万元）';
        return '';
      case 'accountNo': {
        var acc = String(value).replace(/\s/g, '');
        if (!/^\d{9,30}$/.test(acc)) return '收款账号应为 9-30 位数字';
        return '';
      }
      case 'taxNo': {
        var t = String(value).trim();
        if (/^\d{17}[\dXx]$/.test(t)) return ''; // 身份证
        if (!/^[A-Z0-9]{15,20}$/i.test(t)) return '请输入有效的税务登记号或身份证号';
        return '';
      }
      default:
        if (def.type === 'number' && !isNumber(value)) return def.label + '需为不小于 0 的数字';
        return '';
    }
  }

  // 分步校验：stepKey 为 business/contact/plan/finance
  // 返回 { [formKey]: '错误文案' }，无错误返回 {}
  function validateStep(stepKey, form) {
    var errors = {};
    var defs = FIELD_DEFS[stepKey] || [];
    defs.forEach(function(def) {
      if (def.showIf && form[stepKey][def.showIf.key] !== def.showIf.value) return; // 隐藏字段不校验
      var msg = validateField(def, form[stepKey][def.key], form);
      if (msg) errors[stepKey + '.' + def.key] = msg;
    });
    if (stepKey === 'plan') {
      var monthly = form.plan.monthly || {};
      var monthMissing = false;
      MONTH_KEYS.forEach(function(mk) {
        if (isBlank(monthly[mk]) || !isNumber(monthly[mk])) { monthMissing = true; }
      });
      if (monthMissing) errors['plan.monthly'] = '月度分解目标（1-12月/万元）为必填项，请完整填写 12 个月';
    }
    return errors;
  }

  // 项目规划非阻塞提示：月度合计与年度目标不一致时给出警告文案（不阻断提交）
  function planWarning(form) {
    if (!form || !form.plan) return '';
    var monthly = form.plan.monthly || {};
    var monthSum = 0, monthMissing = false;
    MONTH_KEYS.forEach(function(mk) {
      if (isBlank(monthly[mk]) || !isNumber(monthly[mk])) { monthMissing = true; }
      else monthSum += Number(monthly[mk]);
    });
    if (monthMissing || isBlank(form.plan.annualTarget) || !isNumber(form.plan.annualTarget)) return '';
    if (Math.abs(monthSum - Number(form.plan.annualTarget)) > 0.001) {
      return '月度分解目标合计（' + monthSum + ' 万元）与年度目标（' + form.plan.annualTarget + ' 万元）不一致，请确认';
    }
    return '';
  }

  // 整体校验，返回 [{step, key, message}]
  function validateForm(form) {
    var all = [];
    STEPS.forEach(function(step) {
      var errors = validateStep(step.key, form);
      Object.keys(errors).forEach(function(key) {
        all.push({ step: step.key, key: key, message: errors[key] });
      });
    });
    return all;
  }

  function statusLabel(status) {
    return STATUS_LABEL[status] || status;
  }

  function modeByValue(value) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].value === value) return clone(MODES[i]);
    return null;
  }

  // 入驻类型：按入驻模式归类推导（客户合作管理展示用）
  var TYPE_GROUPS = {
    '账号代运营': '代运营',
    '整店代运营': '代运营',
    '达人': '达播',
    '机构': '达播',
    '联营KOC': 'KOC',
    '素人KOC': 'KOC',
    '客户KOC': 'KOC',
    '马卡乐合伙人': '合伙人',
    // 历史模式向后兼容（旧数据仍能正常展示类型）
    'DP': 'DP',
    '达播达人': '达播',
    '达播机构': '达播'
  };
  function typeOfMode(mode) {
    return TYPE_GROUPS[mode] || '-';
  }

  // ========== 账号信息录入（客户视角菜单）业务字典 ==========

  // 入驻模式 → 账号信息字段集：KOC 类（客户KOC/素人KOC/联营KOC）走轻量字段集，其余模式走直播账号完整字段集
  var ACCOUNT_ENTRY_KINDS = {
    '客户KOC': 'koc',
    '素人KOC': 'koc',
    '联营KOC': 'koc'
  };
  function accountEntryKindOfMode(mode) {
    return ACCOUNT_ENTRY_KINDS[mode] || 'standard';
  }

  // 账号运营模式（全品牌直播账号管理系统字典，单一数据源，编码统一为 AO + 序号）
  // inEntry: 客户视角「账号信息录入」新增时可选的运营模式（10 项）；
  // 未标 inEntry 的三项仅「直播账号管理」使用，存量数据仍能正常回显
  var ACCOUNT_OPERATION_MODES = [
    { code: 'AO001', label: '自播', inEntry: true },
    { code: 'AO004', label: '达人播', inEntry: true },
    { code: 'AO006', label: '代播', inEntry: true },
    { code: 'AO007', label: '分销', inEntry: true },
    { code: 'AO008', label: '其他', inEntry: true },
    { code: 'AO015', label: '商品卡', inEntry: true },
    { code: 'AO016', label: '分销一组', inEntry: true },
    { code: 'AO017', label: '分销二组', inEntry: true },
    { code: 'AO018', label: '短视频', inEntry: true },
    { code: 'AO019', label: '头部达人', inEntry: true },
    { code: 'AO020', label: '头达矩阵号' },
    { code: 'AO021', label: '新锐达人' },
    { code: 'AO022', label: '达人机构' }
  ];
  function accountEntryOperationModes() {
    return clone(ACCOUNT_OPERATION_MODES).filter(function(o) { return o.inEntry; });
  }

  // 主销品牌与账号定位联动：定位取值由主销品牌决定
  var ACCOUNT_BRANDS = ['森马', '巴拉巴拉', '迷你巴拉'];
  var ACCOUNT_POSITIONINGS = {
    '森马': ['男装', '女装'],
    '巴拉巴拉': ['中童', '幼童', '婴童'],
    '迷你巴拉': ['婴童']
  };
  function positioningsOfBrand(brand) {
    return (ACCOUNT_POSITIONINGS[brand] || []).slice();
  }

  return {
    MODES: clone(MODES),
    BRANDS: clone(BRANDS),
    PLATFORMS: clone(PLATFORMS),
    MAKALE_MODE: MAKALE_MODE,
    MAKALE_BRANDS: clone(MAKALE_BRANDS),
    isMakaleMode: isMakaleMode,
    brandsForMode: brandsForMode,
    MAKALE_STEPS: clone(MAKALE_STEPS),
    MAKALE_FIELD_DEFS: {
      enterprise: clone(MAKALE_FIELD_DEFS.enterprise),
      capability: clone(MAKALE_FIELD_DEFS.capability)
    },
    STAGES: clone(STAGES),
    STAGE_TEMPLATES: {
      default: clone(STAGE_TEMPLATES.default),
      makale: clone(STAGE_TEMPLATES.makale),
      influencer: clone(STAGE_TEMPLATES.influencer),
      customer_koc: clone(STAGE_TEMPLATES.customer_koc),
      koc_lite: clone(STAGE_TEMPLATES.koc_lite)
    },
    FLOW_GROUPS: clone(FLOW_GROUPS),
    flowKeyOfMode: flowKeyOfMode,
    stagesForMode: stagesForMode,
    stagesForApp: stagesForApp,
    STATUS: clone(STATUS),
    STEPS: clone(STEPS),
    FIELD_DEFS: clone(FIELD_DEFS),
    MONTH_KEYS: clone(MONTH_KEYS),
    STORAGE_KEY: STORAGE_KEY,
    emptyForm: emptyForm,
    createDraft: createDraft,
    updateMode: updateMode,
    saveDraft: saveDraft,
    submit: submit,
    review: review,
    remove: remove,
    get: get,
    list: list,
    validateField: validateField,
    validateStep: validateStep,
    validateForm: validateForm,
    planWarning: planWarning,
    diffFormLabels: diffFormLabels,
    currentStageOf: currentStageOf,
    statusLabel: statusLabel,
    modeByValue: modeByValue,
    typeOfMode: typeOfMode,
    ACCOUNT_ENTRY_KINDS: clone(ACCOUNT_ENTRY_KINDS),
    accountEntryKindOfMode: accountEntryKindOfMode,
    ACCOUNT_OPERATION_MODES: clone(ACCOUNT_OPERATION_MODES),
    accountEntryOperationModes: accountEntryOperationModes,
    ACCOUNT_BRANDS: clone(ACCOUNT_BRANDS),
    ACCOUNT_POSITIONINGS: clone(ACCOUNT_POSITIONINGS),
    positioningsOfBrand: positioningsOfBrand,
    updateBdContact: updateBdContact,
    advanceStage: advanceStage,
    stageHistoryOf: stageHistoryOf,
    encryptText: encryptText,
    decryptText: decryptText,
    _writeAll: writeAll,
    _readAll: readAll
  };
});

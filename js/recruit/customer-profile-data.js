/* 客户档案库 — 种子数据（主从式可编辑 Demo）
 * 结构说明：
 *   profile.sections: 有序分区数组，每项 { title, hint, fields:[{label,value}] }
 *   profile.tables:   四个子表 { 账号子表/跟进记录/回款订单/资质附件 }，每项 { columns:[], rows:[[]] }
 *   profile.flags:    用于 KPI 统计的派生标记 { expiringSoon, risk }
 * 字段命名沿用项目 mock 数据规范（展示用中文 label，内部结构键 snake_case）。
 */
(function (global) {
  'use strict';

  // 账号子表 30 列（从左到右）
  var ACCOUNT_COLUMNS = [
    '平台', '供应商', '模式', '合作形式', '账号定位', '账号名称', '账号uid', '账号编码',
    '账号绑定手机号', '账号密码', '对应店铺名称', '店铺短ID', '店铺绑定手机号',
    '店铺绑定千川账户名称', '店铺绑定千川账户', '千川投放形式', '店铺名称', '店铺代码',
    '合作状态', '佣金结算进度', '保证金', '样衣授信', '合同时间', '投放激励', '品牌年度激励',
    '佣金比例', '结算形式', '结算时间', '粉丝数', '直播间类型'
  ];
  var FOLLOWUP_COLUMNS = ['跟进时间', '方式', '跟进内容', '结论', '下一步动作', '下次跟进', '跟进人'];
  var PAYMENT_COLUMNS = ['月份', '品牌线', 'GMV', '订单数', '退货额', '应付佣金', '实际回款', '状态'];
  var ATTACH_COLUMNS = ['类型', '文件名', '有效期至', '上传人'];

  // ===== 子表维护表单配置（独立维护页与主档编辑页共用） =====
  var SUBFORM = {
    tabs: ['账号子表', '跟进记录', '回款订单', '资质附件'],
    // 列级下拉枚举
    select: {
      '平台': ['抖音', '快手', '视频号', '小红书', '淘宝', '京东', '拼多多'],
      '模式': ['分销代发', '经销', '代销', '推广'],
      '合作形式': ['纯佣合作', '坑位费+佣金', '年度框架'],
      '账号定位': ['品牌自播号', '达人号', '店铺号', '达人矩阵'],
      '千川投放形式': ['直播间推广', '短视频推广', '商品卡推广', '笔记种草'],
      '合作状态': ['合作中', '洽谈中', '已暂停'],
      '结算形式': ['月结', '单结', '按单结算'],
      '直播间类型': ['品牌自播', '达人播', '店播'],
      '方式': ['电话', '微信', '飞书', '面谈', '邮件'],
      '结论': ['推进', '待定', '搁置', '终止'],
      '品牌线': ['巴拉巴拉', '迷你巴拉', '森马', '马卡乐'],
      '状态': ['已回款', '待回款', '部分回款', '逾期'],
      '类型': ['营业执照', '合同', '授权书', '开户许可', '身份证', '其他']
    },
    percent: { '佣金比例': 1 },
    textarea: { '跟进内容': 1, '下一步动作': 1 },
    span2: { '跟进内容': 1, '下一步动作': 1, '合同时间': 1, '品牌年度激励': 1, '投放激励': 1, '文件名': 1 },
    placeholder: {
      '账号uid': '平台账号 uid', '账号编码': '如 ACC-DY-001', '账号绑定手机号': '11 位手机号',
      '店铺短ID': '平台店铺短 ID', '店铺绑定千川账户': '如 QCH-88290000', '店铺代码': '如 R3-100200',
      '佣金结算进度': '如 2026-10 已结清', '保证金': '金额，元', '样衣授信': '金额，元',
      '合同时间': '如 2024-03-12 ~ 2027-03-11', '结算时间': '如 次月 15 日 / T+7', '粉丝数': '数字',
      '跟进时间': '如 2026-09-05 15:20', '下次跟进': '如 2026-09-15',
      '月份': '如 2026-09', 'GMV': '金额，元', '订单数': '数字', '退货额': '金额，元', '应付佣金': '金额，元', '实际回款': '金额，元',
      '有效期至': '日期或「长期」', '文件名': '如 营业执照.pdf'
    },
    // 各子表必填列
    required: {
      '账号子表': ['平台', '账号名称'],
      '跟进记录': ['跟进时间', '跟进内容'],
      '回款订单': ['月份', '品牌线'],
      '资质附件': ['类型', '文件名']
    },
    // 数值列（金额/数量）：非空时须为数字
    numeric: { '保证金': 1, '样衣授信': 1, '粉丝数': 1, 'GMV': 1, '订单数': 1, '退货额': 1, '应付佣金': 1, '实际回款': 1 },
    // 附件列：该单元格支持“上传本地文件”或“粘贴附件链接”，值可为字符串（旧：纯文件名）或 {name,url,kind,size}
    attach: { '文件名': 1 },
    attachMaxMB: 3
  };
  // 新增子表行默认值：审计类字段自动带出
  function subDefaultRow(columns, uname) {
    var n = new Date();
    var stamp = n.toISOString().slice(0, 10) + ' ' + String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
    return columns.map(function(c){
      if (c === '跟进人' || c === '上传人') return uname || '当前用户';
      if (c === '跟进时间') return stamp;
      if (c === '月份') return n.toISOString().slice(0, 7);
      return '';
    });
  }

  function accRow(o) {
    // 存量兼容：旧键 R3店铺代码 → 规范列 店铺代码
    return ACCOUNT_COLUMNS.map(function (c) { return o[c] || (c === '店铺代码' ? o['R3店铺代码'] : '') || ''; });
  }

  // ===== 客户主档字段 Schema（5 大分区，对齐 46 字段产品清单） =====
  var PROFILE_SCHEMA = [
    { title: '基础身份', hint: '静态', fields: ['客户编号', '客户名称', '客户关联主体名称', '客户类型', '主体性质', '是否为线下零售商', '联系人', '联系手机', '微信 / 飞书', '所在城市', '公司地址', '公司主体地址', '所属品牌线', '客户来源', '归属商务', '建档日期'] },
    { title: '经营画像', hint: '半静态', fields: ['主营平台', '主账号昵称', '粉丝量级', '内容形式', '直播间类型', '主推品类', '月开播场次'] },
    { title: '商务条款', hint: '合作核心', fields: ['客户等级', '合作状态', '合作模式', '佣金比例', '结算方式', '账期天数', '开票能力', '税号', '结算主体', '银行账号', '供货价结算方式', '是否整店经营'] },
    { title: '资质与合规', hint: '', fields: ['合同编号', '合同签订日', '合同到期日', '授权品牌', '授权有效期', '保证金', '样衣授信', '客户持有样衣金额', '到期提醒'] },
    { title: '系统信息', hint: '审计', fields: ['数据来源', '创建人', '创建时间', '最后更新人'] }
  ];
  // 旧标签 → 规范标签（存量 localStorage 数据迁移用）
  var LABEL_ALIAS = { '主账号': '主账号昵称', '账期': '账期天数', '保证金 / 押金': '保证金', '收货地址': '公司地址' };

  // 按字段取值：优先种子属性，新增字段派生合理默认值
  function resolveValue(o, label) {
    switch (label) {
      case '客户编号': return o.code;
      case '客户名称': return o.name;
      case '客户类型': return o.type;
      case '客户等级': return o.level;
      case '合作状态': return o.status;
      case '所在城市': return o.city;
      case '微信 / 飞书': return o.微信;
      case '主账号昵称': return o.主账号;
      case '账期天数': return o.账期;
      case '公司地址': return o.收货地址;
      case '客户关联主体名称': return o.客户关联主体名称 || o.结算主体 || o.name || '';
      case '是否为线下零售商': return o.是否为线下零售商 || (o.type === '零售商' ? '是' : '否');
      case '公司主体地址': return o.公司主体地址 || o.收货地址 || '';
      case '是否整店经营': return o.是否整店经营 || ((o.type === '分销商' || o.type === '零售商' || o.type === '自播') ? '是' : '否');
      case '样衣授信': return o.样衣授信 || (o.accounts && o.accounts[0] && o.accounts[0]['样衣授信']) || '0';
      case '客户持有样衣金额': return o.客户持有样衣金额 || String(Math.round(Number(o.样衣授信 || (o.accounts && o.accounts[0] && o.accounts[0]['样衣授信']) || 0) * 0.6));
      case '创建人': return o.创建人 || o.归属商务 || '系统';
      case '创建时间': return o.创建时间 || (o.建档日期 ? o.建档日期 + ' 09:00' : '');
      case '最后更新人': return o.最后更新人 || o.归属商务 || '系统';
      case '数据来源': return o.数据来源 || '—';
      default: return o[label] != null ? o[label] : '';
    }
  }
  function materializeSections(o) {
    return PROFILE_SCHEMA.map(function(sec){
      return { title: sec.title, hint: sec.hint, fields: sec.fields.map(function(lab){
        var v = resolveValue(o, lab);
        return { label: lab, value: v == null ? '' : v };
      }) };
    });
  }
  // 将存量客户迁移到规范 Schema：保留旧值（含旧标签别名），缺失字段补默认值
  function migrateProfile(p) {
    if (!p) return p;
    var flat = {};
    (p.sections || []).forEach(function(s){ (s.fields || []).forEach(function(f){ var lab = LABEL_ALIAS[f.label] || f.label; if (!(lab in flat)) flat[lab] = f.value; }); });
    var o = {
      code: p.code, name: p.name, type: p.type, level: p.level, status: p.status, city: p.city,
      微信: flat['微信 / 飞书'], 主账号: flat['主账号昵称'], 账期: flat['账期天数'], 收货地址: flat['公司地址'],
      结算主体: flat['结算主体'], 归属商务: flat['归属商务'], 建档日期: flat['建档日期'], accounts: null
    };
    Object.keys(flat).forEach(function(k){ if (!(k in o)) o[k] = flat[k]; });
    o.所属品牌线 = (p.brandLines || []).join('、');
    o.主营平台 = flat['主营平台'] || String(p.platforms || '').split(/[\/、,，\s]+/).filter(Boolean).join('、');
    p.sections = materializeSections(o);
    // 子表结构兜底：缺失的 Tab 补空表，保证详情页与维护页可安全读写
    p.tables = p.tables || {};
    [['账号子表', ACCOUNT_COLUMNS], ['跟进记录', FOLLOWUP_COLUMNS], ['回款订单', PAYMENT_COLUMNS], ['资质附件', ATTACH_COLUMNS]].forEach(function(pair){
      if (!p.tables[pair[0]] || !Array.isArray(p.tables[pair[0]].rows)) p.tables[pair[0]] = { columns: pair[1], rows: [] };
    });
    return p;
  }

  function build(o) {
    return {
      id: o.id,
      code: o.code,
      name: o.name,
      type: o.type,          // DP / KOC / KOL / MCN
      level: o.level,        // S / A / B / C
      status: o.status,      // 已合作 / 洽谈 / 暂停
      city: o.city,
      platforms: o.platforms,
      brandLines: o.brandLines,
      tags: o.tags || [],
      summaryContact: o.联系人 + ' ' + o.联系手机,
      summaryBd: o.归属商务,
      summaryDate: o.建档日期,
      sections: materializeSections(o),
      tables: {
        '账号子表': { columns: ACCOUNT_COLUMNS, rows: (o.accounts || []).map(accRow) },
        '跟进记录': { columns: FOLLOWUP_COLUMNS, rows: o.followups || [] },
        '回款订单': { columns: PAYMENT_COLUMNS, rows: o.payments || [] },
        '资质附件': { columns: ATTACH_COLUMNS, rows: o.attachments || [] }
      },
      flags: { expiringSoon: !!o.到期提醒 && String(o.到期提醒).indexOf('90') >= 0, risk: !!o.risk }
    };
  }

  var SEED = [
    build({
      id: 1, code: 'DP-2026-001', name: '杭州童趣母婴供应链有限公司', type: '分销商', level: 'ka', status: '已合作',
      city: '浙江省 杭州市 余杭区', platforms: '抖音/视频号', brandLines: ['巴拉巴拉', '迷你巴拉', '森马'],
      tags: ['童装垂类', '优质内容'],
      主体性质: '一般纳税人', 所属品牌线: '巴拉巴拉、迷你巴拉、森马', 客户来源: '老客转介绍',
      联系人: '周敏', 联系手机: '138 5712 8846', 微信: 'tongqu_zhou',
      收货地址: '浙江省杭州市余杭区良渚街道莫干山路 1588 号 3 幢', 归属商务: '林悦', 建档日期: '2024-03-12',
      主营平台: '抖音、视频号', 主账号: '童趣母婴官方旗舰店', 粉丝量级: '50-100w', 内容形式: '直播、短视频',
      直播间类型: '品牌自播', 主推品类: '童装、母婴', 月开播场次: '26',
      合作模式: '分销代发', 佣金比例: '17', 结算方式: '月结', 账期: '30', 开票能力: '专票',
      税号: '91330110MA2XXXXX8K', 结算主体: '杭州童趣母婴供应链有限公司', 银行账号: '6222 **** **** 3412',
      供货价结算方式: '预付 30% + 发货前付清',
      合同编号: 'HT-2024-0312-001', 合同签订日: '2024-03-12', 合同到期日: '2027-03-11',
      授权品牌: '巴拉巴拉、迷你巴拉、森马', 授权有效期: '2027-03-11', 保证金: '50000', 到期提醒: '正常',
      accounts: [
        { '平台': '抖音', '供应商': '森马电商', '模式': '分销代发', '合作形式': '纯佣合作', '账号定位': '品牌自播号', '账号名称': '童趣母婴官方旗舰店', '账号uid': 'tongqu_official', '账号编码': 'ACC-DY-001', '账号绑定手机号': '138****8800', '账号密码': '••••••（密码库 A-01）', '对应店铺名称': '童趣母婴官方旗舰店', '店铺短ID': '55000000', '店铺绑定手机号': '139****1200', '店铺绑定千川账户名称': '千川-童趣母婴官方', '店铺绑定千川账户': 'QCH-88290000', '千川投放形式': '直播间推广', '店铺名称': '童趣母婴官方旗舰店（R3）', '店铺代码': 'R3-100200', '合作状态': '合作中', '佣金结算进度': '2026-10 已结清', '保证金': '20000', '样衣授信': '5000', '合同时间': '2024-03-12 ~ 2027-03-11', '投放激励': 'GMV 3% 返点', '品牌年度激励': '年度 GMV 500w 返 2%', '佣金比例': '17', '结算形式': '月结', '结算时间': '次月 15 日', '粉丝数': '863000', '直播间类型': '品牌自播' },
        { '平台': '视频号', '供应商': '浙江森马服饰股份有限公司', '模式': '经销', '合作形式': '坑位费+佣金', '账号定位': '品牌自播号', '账号名称': '童趣母婴优选', '账号uid': 'tongqu_wx_01', '账号编码': 'ACC-WX-002', '账号绑定手机号': '138****8807', '账号密码': '••••••（密码库 A-02）', '对应店铺名称': '童趣母婴优选', '店铺短ID': '55000137', '店铺绑定手机号': '139****1213', '店铺绑定千川账户名称': '千川-童趣母婴优选', '店铺绑定千川账户': 'QCH-88290097', '千川投放形式': '短视频推广', '店铺名称': '童趣母婴优选（R3）', '店铺代码': 'R3-100213', '合作状态': '合作中', '佣金结算进度': '2026-10 待结算', '保证金': '50000', '样衣授信': '10000', '合同时间': '2024-03-12 ~ 2027-03-11', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '17', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '212000', '直播间类型': '品牌自播' },
        { '平台': '抖音', '供应商': '巴拉巴拉供应链', '模式': '代销', '合作形式': '年度框架', '账号定位': '店铺号', '账号名称': '童趣清仓号', '账号uid': 'tongqu_clear', '账号编码': 'ACC-DY-003', '账号绑定手机号': '138****8814', '账号密码': '••••••（密码库 A-03）', '对应店铺名称': '童趣清仓号', '店铺短ID': '55000274', '店铺绑定手机号': '139****1226', '店铺绑定千川账户名称': '千川-童趣清仓号', '店铺绑定千川账户': 'QCH-88290194', '千川投放形式': '商品卡推广', '店铺名称': '童趣清仓号（R3）', '店铺代码': 'R3-100226', '合作状态': '合作中', '佣金结算进度': '2026-09 已结清', '保证金': '10000', '样衣授信': '3000', '合同时间': '2024-03-12 ~ 2027-03-11', '投放激励': '季度 2% 返点', '品牌年度激励': '年度 GMV 300w 返 1.5%', '佣金比例': '17', '结算形式': '月结', '结算时间': 'T+7', '粉丝数': '96000', '直播间类型': '店播' }
      ],
      followups: [
        ['2026-09-05 15:20', '飞书', '沟通 Q4 双十一备货节奏，确认 11 月目标 60w', '推进', '9/15 前确认备货清单', '2026-09-15', '林悦'],
        ['2026-08-18 10:05', '面谈', '季度复盘：夏款退货率 4.2% 低于均值，追加秋款配额', '推进', '秋款选品会', '2026-08-25', '林悦'],
        ['2026-07-22 16:40', '电话', '账期由 45 天缩短至 30 天，已签署补充协议', '推进', '财务同步', '2026-07-25', '陈昊']
      ],
      payments: [
        ['2026-09', '巴拉巴拉', '386000', '2180', '16200', '65620', '386000', '已回款'],
        ['2026-08', '巴拉巴拉', '343400', '1960', '15800', '58378', '343400', '已回款'],
        ['2026-07', '森马', '298700', '1710', '12400', '50779', '298700', '已回款'],
        ['2026-06', '迷你巴拉', '264100', '1520', '11900', '44897', '264100', '已回款']
      ],
      attachments: [
        ['营业执照', '杭州童趣-营业执照.pdf', '长期', '林悦'],
        ['合同', 'HT-2024-0312-001 分销协议.pdf', '2027-03-11', '林悦'],
        ['授权书', '巴拉巴拉品牌授权书 2024-2027.pdf', '2027-03-11', '陈昊'],
        ['开户许可', '开户许可证.pdf', '长期', '林悦']
      ]
    }),
    build({
      id: 2, code: 'KOL-2026-018', name: '一颗甜栗子', type: '达播', level: 'ka', status: '已合作',
      city: '北京市 北京市 朝阳区', platforms: '抖音/小红书', brandLines: ['巴拉巴拉'],
      tags: ['亲子生活', '优质内容'],
      主体性质: '小规模纳税人', 所属品牌线: '巴拉巴拉', 客户来源: '服务商推荐',
      联系人: '李甜', 联系手机: '138 0100 2233', 微信: 'tianli_2026',
      收货地址: '北京市朝阳区建国路 88 号 SOHO 现代城 A 座', 归属商务: '苏晴', 建档日期: '2024-05-20',
      主营平台: '抖音、小红书', 主账号: '一颗甜栗子', 粉丝量级: '100w 以上', 内容形式: '短视频、图文',
      直播间类型: '达人播', 主推品类: '童装、亲子', 月开播场次: '8',
      合作模式: '纯佣', 佣金比例: '20', 结算方式: '月结', 账期: '30', 开票能力: '不可开票',
      税号: '—', 结算主体: '李甜（个人）', 银行账号: '6217 **** **** 8890',
      供货价结算方式: '款到发货（100% 预付）',
      合同编号: 'HT-2024-0520-018', 合同签订日: '2024-05-20', 合同到期日: '2026-11-30',
      授权品牌: '巴拉巴拉', 授权有效期: '2026-11-30', 保证金: '0', 到期提醒: '⚠ 90 天内到期，需续签',
      accounts: [
        { '平台': '抖音', '供应商': '巴拉巴拉供应链', '模式': '推广', '合作形式': '纯佣合作', '账号定位': '达人号', '账号名称': '一颗甜栗子', '账号uid': 'tianli_018', '账号编码': 'ACC-DY-018', '账号绑定手机号': '138****2233', '账号密码': '••••••（密码库 B-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '短视频推广', '店铺名称': '—', '店铺代码': '—', '合作状态': '合作中', '佣金结算进度': '2026-10 已结清', '保证金': '0', '样衣授信': '2000', '合同时间': '2024-05-20 ~ 2026-11-30', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '20', '结算形式': '月结', '结算时间': '次月 15 日', '粉丝数': '1250000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-09-01 11:00', '微信', '双十一选品对接，确认主推秋装 3 套', '推进', '出样排期', '2026-09-10', '苏晴']
      ],
      payments: [
        ['2026-09', '巴拉巴拉', '186000', '980', '6200', '37200', '186000', '已回款'],
        ['2026-08', '巴拉巴拉', '152000', '820', '5100', '30400', '152000', '已回款']
      ],
      attachments: [
        ['身份证', '李甜-身份证.jpg', '长期', '苏晴'],
        ['授权书', '巴拉巴拉达人授权 2024-2026.pdf', '2026-11-30', '苏晴']
      ]
    }),
    build({
      id: 3, code: 'DP-2026-002', name: '广州小象童装贸易有限公司', type: '零售商', level: 'ka', status: '已合作',
      city: '广东省 广州市 白云区', platforms: '抖音/快手', brandLines: ['巴拉巴拉'],
      tags: ['华南分销', '优质内容'],
      主体性质: '一般纳税人', 所属品牌线: '巴拉巴拉', 客户来源: '老客转介绍',
      联系人: '何军', 联系手机: '138 0228 6600', 微信: 'xiaohang_he',
      收货地址: '广东省广州市白云区机场路 12 号', 归属商务: '林悦', 建档日期: '2024-04-08',
      主营平台: '抖音、快手', 主账号: '小象童装优选', 粉丝量级: '10-50w', 内容形式: '直播、短视频',
      直播间类型: '品牌自播', 主推品类: '童装', 月开播场次: '18',
      合作模式: '分销代发', 佣金比例: '16', 结算方式: '月结', 账期: '45', 开票能力: '专票',
      税号: '91440110MA5XXXXX2L', 结算主体: '广州小象童装贸易有限公司', 银行账号: '6228 **** **** 1207',
      供货价结算方式: '预付 30% + 发货前付清',
      合同编号: 'HT-2024-0408-002', 合同签订日: '2024-04-08', 合同到期日: '2026-12-15',
      授权品牌: '巴拉巴拉', 授权有效期: '2026-12-15', 保证金: '30000', 到期提醒: '⚠ 90 天内到期，需续签',
      accounts: [
        { '平台': '抖音', '供应商': '巴拉巴拉供应链', '模式': '分销代发', '合作形式': '纯佣合作', '账号定位': '品牌自播号', '账号名称': '小象童装优选', '账号uid': 'xiaohang_dy', '账号编码': 'ACC-DY-002', '账号绑定手机号': '138****6600', '账号密码': '••••••（密码库 C-01）', '对应店铺名称': '小象童装优选', '店铺短ID': '55000350', '店铺绑定手机号': '139****2200', '店铺绑定千川账户名称': '千川-小象童装', '店铺绑定千川账户': 'QCH-88290350', '千川投放形式': '直播间推广', '店铺名称': '小象童装优选（R3）', '店铺代码': 'R3-100350', '合作状态': '合作中', '佣金结算进度': '2026-10 已结清', '保证金': '30000', '样衣授信': '8000', '合同时间': '2024-04-08 ~ 2026-12-15', '投放激励': 'GMV 2% 返点', '品牌年度激励': '年度 GMV 300w 返 1.5%', '佣金比例': '16', '结算形式': '月结', '结算时间': '次月 15 日', '粉丝数': '320000', '直播间类型': '品牌自播' }
      ],
      followups: [
        ['2026-08-30 14:10', '电话', '确认华南仓备货，沟通冬季羽绒配额', '推进', '备货清单', '2026-09-08', '林悦']
      ],
      payments: [
        ['2026-09', '巴拉巴拉', '228000', '1320', '9800', '36480', '228000', '已回款'],
        ['2026-08', '巴拉巴拉', '201000', '1180', '8600', '32160', '201000', '已回款']
      ],
      attachments: [
        ['营业执照', '广州小象-营业执照.pdf', '长期', '林悦'],
        ['合同', 'HT-2024-0408-002 分销协议.pdf', '2026-12-15', '林悦']
      ]
    }),
    build({
      id: 4, code: 'KOC-2026-011', name: '豆豆妈咪的日常', type: 'KOC', level: '非ka', status: '已合作',
      city: '江苏省 苏州市 工业园区', platforms: '抖音', brandLines: ['迷你巴拉'],
      tags: ['母婴垂类'],
      主体性质: '小规模纳税人', 所属品牌线: '迷你巴拉', 客户来源: '服务商推荐',
      联系人: '王豆豆', 联系手机: '137 6612 3390', 微信: 'ddmami_2023',
      收货地址: '江苏省苏州市工业园区星湖街 328 号', 归属商务: '苏晴', 建档日期: '2025-09-14',
      主营平台: '抖音', 主账号: '豆豆妈咪的日常', 粉丝量级: '1-10w', 内容形式: '直播、短视频',
      直播间类型: '达人播', 主推品类: '母婴、童装', 月开播场次: '12',
      合作模式: '纯佣', 佣金比例: '22', 结算方式: '月结', 账期: '30', 开票能力: '不可开票',
      税号: '—', 结算主体: '王豆豆（个人）', 银行账号: '6217 **** **** 3390',
      供货价结算方式: '款到发货（100% 预付）',
      合同编号: 'HT-2025-0914-011', 合同签订日: '2025-09-14', 合同到期日: '2027-09-13',
      授权品牌: '迷你巴拉', 授权有效期: '2027-09-13', 保证金: '0', 到期提醒: '正常',
      accounts: [
        { '平台': '抖音', '供应商': '森马电商', '模式': '推广', '合作形式': '纯佣合作', '账号定位': '达人号', '账号名称': '豆豆妈咪的日常', '账号uid': 'ddmami_011', '账号编码': 'ACC-DY-011', '账号绑定手机号': '137****3390', '账号密码': '••••••（密码库 D-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '短视频推广', '店铺名称': '—', '店铺代码': '—', '合作状态': '合作中', '佣金结算进度': '2026-10 待结算', '保证金': '0', '样衣授信': '1000', '合同时间': '2025-09-14 ~ 2027-09-13', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '22', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '68000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-09-02 09:30', '微信', '沟通母婴节活动坑位', '推进', '报名确认', '2026-09-12', '苏晴']
      ],
      payments: [
        ['2026-09', '迷你巴拉', '42000', '260', '1800', '9240', '42000', '已回款']
      ],
      attachments: [
        ['身份证', '王豆豆-身份证.jpg', '长期', '苏晴']
      ]
    }),
    build({
      id: 5, code: 'KOL-2026-019', name: '潮童馆主理人 Amy', type: '达播', level: 'ka', status: '已合作',
      city: '广东省 深圳市 南山区', platforms: '视频号/抖音', brandLines: ['巴拉巴拉', '森马'],
      tags: ['潮流童装', '优质内容'],
      主体性质: '小规模纳税人', 所属品牌线: '巴拉巴拉、森马', 客户来源: '老客转介绍',
      联系人: 'Amy 陈', 联系手机: '135 9000 2020', 微信: 'amy_trendkid',
      收货地址: '广东省深圳市南山区科技园南区', 归属商务: '林悦', 建档日期: '2024-06-18',
      主营平台: '视频号、抖音', 主账号: '潮童馆主理人 Amy', 粉丝量级: '50-100w', 内容形式: '短视频、直播',
      直播间类型: '达人播', 主推品类: '童装、潮童穿搭', 月开播场次: '10',
      合作模式: '纯佣', 佣金比例: '19', 结算方式: '月结', 账期: '30', 开票能力: '不可开票',
      税号: '—', 结算主体: '陈艾米（个人）', 银行账号: '6217 **** **** 2020',
      供货价结算方式: '款到发货（100% 预付）',
      合同编号: 'HT-2024-0618-019', 合同签订日: '2024-06-18', 合同到期日: '2027-06-17',
      授权品牌: '巴拉巴拉、森马', 授权有效期: '2027-06-17', 保证金: '0', 到期提醒: '正常',
      accounts: [
        { '平台': '视频号', '供应商': '浙江森马服饰股份有限公司', '模式': '推广', '合作形式': '坑位费+佣金', '账号定位': '达人号', '账号名称': '潮童馆主理人 Amy', '账号uid': 'amy_wx_019', '账号编码': 'ACC-WX-019', '账号绑定手机号': '135****2020', '账号密码': '••••••（密码库 E-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '短视频推广', '店铺名称': '—', '店铺代码': '—', '合作状态': '合作中', '佣金结算进度': '2026-10 已结清', '保证金': '0', '样衣授信': '3000', '合同时间': '2024-06-18 ~ 2027-06-17', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '19', '结算形式': '月结', '结算时间': '次月 15 日', '粉丝数': '480000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-08-28 16:00', '面谈', '深圳线下选品会，敲定秋冬主推款', '推进', '寄样', '2026-09-05', '林悦']
      ],
      payments: [
        ['2026-09', '巴拉巴拉', '168000', '880', '6800', '31920', '168000', '已回款']
      ],
      attachments: [
        ['身份证', '陈艾米-身份证.jpg', '长期', '林悦']
      ]
    }),
    build({
      id: 6, code: 'DP-2026-004', name: '武汉悦童服饰有限公司', type: '自播', level: 'ka', status: '洽谈中',
      city: '湖北省 武汉市 江汉区', platforms: '视频号/小红书', brandLines: ['森马'],
      tags: ['华中分销'],
      主体性质: '一般纳税人', 所属品牌线: '森马', 客户来源: '服务商推荐',
      联系人: '赵磊', 联系手机: '134 0277 8800', 微信: 'yuetong_zhao',
      收货地址: '湖北省武汉市江汉区解放大道 688 号', 归属商务: '陈昊', 建档日期: '2025-06-30',
      主营平台: '视频号、小红书', 主账号: '悦童服饰', 粉丝量级: '10-50w', 内容形式: '短视频、图文',
      直播间类型: '品牌自播', 主推品类: '童装、休闲', 月开播场次: '6',
      合作模式: '分销代发', 佣金比例: '15', 结算方式: '月结', 账期: '45', 开票能力: '专票',
      税号: '91420103MA4XXXXX7Q', 结算主体: '武汉悦童服饰有限公司', 银行账号: '6228 **** **** 8800',
      供货价结算方式: '预付 30% + 发货前付清',
      合同编号: 'HT-2025-0630-004', 合同签订日: '2025-06-30', 合同到期日: '2026-12-01',
      授权品牌: '森马', 授权有效期: '2026-12-01', 保证金: '20000', 到期提醒: '⚠ 90 天内到期，需续签',
      accounts: [
        { '平台': '视频号', '供应商': '浙江森马服饰股份有限公司', '模式': '经销', '合作形式': '坑位费+佣金', '账号定位': '品牌自播号', '账号名称': '悦童服饰', '账号uid': 'yuetong_wx', '账号编码': 'ACC-WX-004', '账号绑定手机号': '134****8800', '账号密码': '••••••（密码库 F-01）', '对应店铺名称': '悦童服饰', '店铺短ID': '55000404', '店铺绑定手机号': '135****8800', '店铺绑定千川账户名称': '千川-悦童服饰', '店铺绑定千川账户': 'QCH-88290404', '千川投放形式': '短视频推广', '店铺名称': '悦童服饰（R3）', '店铺代码': 'R3-100404', '合作状态': '洽谈中', '佣金结算进度': '—', '保证金': '20000', '样衣授信': '5000', '合同时间': '2025-06-30 ~ 2026-12-01', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '15', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '150000', '直播间类型': '品牌自播' }
      ],
      followups: [
        ['2026-09-03 10:20', '电话', '洽谈双十一合作框架，等待对方法务确认', '待定', '回签协议', '2026-09-18', '陈昊']
      ],
      payments: [],
      attachments: [
        ['营业执照', '武汉悦童-营业执照.pdf', '长期', '陈昊']
      ]
    }),
    build({
      id: 7, code: 'DP-2026-003', name: '成都星贝母婴用品有限公司', type: '分销商', level: '非ka', status: '已合作',
      city: '四川省 成都市 高新区', platforms: '抖音', brandLines: ['迷你巴拉'],
      tags: ['西南分销'],
      主体性质: '一般纳税人', 所属品牌线: '迷你巴拉', 客户来源: '老客转介绍',
      联系人: '刘星', 联系手机: '139 0812 5566', 微信: 'xingbei_liu',
      收货地址: '四川省成都市高新区天府大道 500 号', 归属商务: '苏晴', 建档日期: '2024-08-12',
      主营平台: '抖音', 主账号: '星贝母婴', 粉丝量级: '10-50w', 内容形式: '直播、短视频',
      直播间类型: '品牌自播', 主推品类: '母婴、童装', 月开播场次: '14',
      合作模式: '分销代发', 佣金比例: '16', 结算方式: '月结', 账期: '30', 开票能力: '专票',
      税号: '91510100MA6XXXXX3P', 结算主体: '成都星贝母婴用品有限公司', 银行账号: '6228 **** **** 5566',
      供货价结算方式: '预付 30% + 发货前付清',
      合同编号: 'HT-2024-0812-003', 合同签订日: '2024-08-12', 合同到期日: '2027-08-11',
      授权品牌: '迷你巴拉', 授权有效期: '2027-08-11', 保证金: '20000', 到期提醒: '正常',
      accounts: [
        { '平台': '抖音', '供应商': '森马电商', '模式': '分销代发', '合作形式': '纯佣合作', '账号定位': '品牌自播号', '账号名称': '星贝母婴', '账号uid': 'xingbei_dy', '账号编码': 'ACC-DY-003', '账号绑定手机号': '139****5566', '账号密码': '••••••（密码库 G-01）', '对应店铺名称': '星贝母婴', '店铺短ID': '55000403', '店铺绑定手机号': '138****5566', '店铺绑定千川账户名称': '千川-星贝母婴', '店铺绑定千川账户': 'QCH-88290403', '千川投放形式': '直播间推广', '店铺名称': '星贝母婴（R3）', '店铺代码': 'R3-100403', '合作状态': '合作中', '佣金结算进度': '2026-10 已结清', '保证金': '20000', '样衣授信': '4000', '合同时间': '2024-08-12 ~ 2027-08-11', '投放激励': 'GMV 2% 返点', '品牌年度激励': '无', '佣金比例': '16', '结算形式': '月结', '结算时间': '次月 15 日', '粉丝数': '128000', '直播间类型': '品牌自播' }
      ],
      followups: [
        ['2026-08-25 15:40', '飞书', '季度目标对齐，追加冬款配额', '推进', '备货', '2026-09-06', '苏晴']
      ],
      payments: [
        ['2026-09', '迷你巴拉', '96000', '620', '4200', '15360', '96000', '已回款']
      ],
      attachments: [
        ['营业执照', '成都星贝-营业执照.pdf', '长期', '苏晴']
      ]
    }),
    build({
      id: 8, code: 'MCN-2026-003', name: '星禾文化传播（长沙）有限公司', type: '达播', level: 'ka', status: '洽谈中',
      city: '湖南省 长沙市 岳麓区', platforms: '抖音/快手/视频号', brandLines: ['巴拉巴拉', '迷你巴拉'],
      tags: ['达人矩阵'],
      主体性质: '一般纳税人', 所属品牌线: '巴拉巴拉、迷你巴拉', 客户来源: '服务商推荐',
      联系人: '周禾', 联系手机: '131 0731 6688', 微信: 'xinghe_zhou',
      收货地址: '湖南省长沙市岳麓区麓谷企业广场', 归属商务: '陈昊', 建档日期: '2025-07-05',
      主营平台: '抖音、快手、视频号', 主账号: '星禾达人矩阵', 粉丝量级: '100w 以上（矩阵）', 内容形式: '短视频、直播',
      直播间类型: '达人播', 主推品类: '童装、母婴', 月开播场次: '30（矩阵合计）',
      合作模式: '纯佣+阶梯返利', 佣金比例: '18', 结算方式: '月结', 账期: '45', 开票能力: '专票',
      税号: '91430100MA4XXXXX9R', 结算主体: '星禾文化传播（长沙）有限公司', 银行账号: '6228 **** **** 6688',
      供货价结算方式: '预付 30% + 发货前付清',
      合同编号: 'HT-2025-0705-003', 合同签订日: '2025-07-05', 合同到期日: '2026-11-20',
      授权品牌: '巴拉巴拉、迷你巴拉', 授权有效期: '2026-11-20', 保证金: '50000', 到期提醒: '⚠ 90 天内到期，需续签',
      risk: true,
      accounts: [
        { '平台': '抖音', '供应商': '巴拉巴拉供应链', '模式': '推广', '合作形式': '年度框架', '账号定位': '达人矩阵', '账号名称': '星禾达人矩阵', '账号uid': 'xinghe_matrix', '账号编码': 'ACC-DY-M03', '账号绑定手机号': '131****6688', '账号密码': '••••••（密码库 H-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '短视频推广', '店铺名称': '—', '店铺代码': '—', '合作状态': '洽谈中', '佣金结算进度': '—', '保证金': '50000', '样衣授信': '10000', '合同时间': '2025-07-05 ~ 2026-11-20', '投放激励': 'GMV 3% 返点', '品牌年度激励': '年度 GMV 800w 返 2.5%', '佣金比例': '18', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '2600000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-09-04 11:30', '面谈', '矩阵达人合作框架谈判，等待报价确认', '待定', '内部评审', '2026-09-20', '陈昊']
      ],
      payments: [],
      attachments: [
        ['营业执照', '星禾文化-营业执照.pdf', '长期', '陈昊']
      ]
    }),
    build({
      id: 9, code: 'KOC-2026-012', name: '小柠檬穿搭记', type: 'KOC', level: '非ka', status: '已合作',
      city: '上海市 上海市 徐汇区', platforms: '小红书', brandLines: ['森马'],
      tags: ['穿搭种草'],
      主体性质: '小规模纳税人', 所属品牌线: '森马', 客户来源: '服务商推荐',
      联系人: '林小柠檬', 联系手机: '136 0100 7788', 微信: 'lemon_xhs',
      收货地址: '上海市徐汇区漕溪北路 100 号', 归属商务: '苏晴', 建档日期: '2025-03-18',
      主营平台: '小红书', 主账号: '小柠檬穿搭记', 粉丝量级: '1-10w', 内容形式: '图文、短视频',
      直播间类型: '达人播', 主推品类: '休闲穿搭', 月开播场次: '4',
      合作模式: '纯佣', 佣金比例: '21', 结算方式: '月结', 账期: '30', 开票能力: '不可开票',
      税号: '—', 结算主体: '林某某（个人）', 银行账号: '6217 **** **** 7788',
      供货价结算方式: '款到发货（100% 预付）',
      合同编号: 'HT-2025-0318-012', 合同签订日: '2025-03-18', 合同到期日: '2027-03-17',
      授权品牌: '森马', 授权有效期: '2027-03-17', 保证金: '0', 到期提醒: '正常',
      accounts: [
        { '平台': '小红书', '供应商': '浙江森马服饰股份有限公司', '模式': '推广', '合作形式': '纯佣合作', '账号定位': '达人号', '账号名称': '小柠檬穿搭记', '账号uid': 'lemon_xhs_012', '账号编码': 'ACC-XHS-012', '账号绑定手机号': '136****7788', '账号密码': '••••••（密码库 I-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '笔记种草', '店铺名称': '—', '店铺代码': '—', '合作状态': '合作中', '佣金结算进度': '2026-10 待结算', '保证金': '0', '样衣授信': '1000', '合同时间': '2025-03-18 ~ 2027-03-17', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '21', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '45000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-08-29 13:00', '微信', '秋冬穿搭笔记排期确认', '推进', '出稿', '2026-09-07', '苏晴']
      ],
      payments: [
        ['2026-09', '森马', '28000', '180', '1200', '5880', '28000', '已回款']
      ],
      attachments: [
        ['身份证', '林某某-身份证.jpg', '长期', '苏晴']
      ]
    }),
    build({
      id: 10, code: 'KOC-2026-013', name: '虎爸选品官', type: 'KOC', level: '非ka', status: '退出',
      city: '河南省 郑州市 金水区', platforms: '快手', brandLines: [],
      tags: ['待激活'],
      主体性质: '小规模纳税人', 所属品牌线: '', 客户来源: '服务商推荐',
      联系人: '张虎', 联系手机: '132 0371 9900', 微信: 'huba_ks',
      收货地址: '河南省郑州市金水区花园路 66 号', 归属商务: '陈昊', 建档日期: '2024-11-11',
      主营平台: '快手', 主账号: '虎爸选品官', 粉丝量级: '1-10w', 内容形式: '短视频',
      直播间类型: '达人播', 主推品类: '玩具、母婴', 月开播场次: '0',
      合作模式: '纯佣', 佣金比例: '20', 结算方式: '月结', 账期: '30', 开票能力: '不可开票',
      税号: '—', 结算主体: '张虎（个人）', 银行账号: '6217 **** **** 9900',
      供货价结算方式: '款到发货（100% 预付）',
      合同编号: 'HT-2024-1111-013', 合同签订日: '2024-11-11', 合同到期日: '2026-11-10',
      授权品牌: '—', 授权有效期: '—', 保证金: '0', 到期提醒: '正常',
      risk: true,
      accounts: [
        { '平台': '快手', '供应商': '森马电商', '模式': '推广', '合作形式': '纯佣合作', '账号定位': '达人号', '账号名称': '虎爸选品官', '账号uid': 'huba_ks_013', '账号编码': 'ACC-KS-013', '账号绑定手机号': '132****9900', '账号密码': '••••••（密码库 J-01）', '对应店铺名称': '—', '店铺短ID': '—', '店铺绑定手机号': '—', '店铺绑定千川账户名称': '—', '店铺绑定千川账户': '—', '千川投放形式': '短视频推广', '店铺名称': '—', '店铺代码': '—', '合作状态': '已暂停', '佣金结算进度': '—', '保证金': '0', '样衣授信': '0', '合同时间': '2024-11-11 ~ 2026-11-10', '投放激励': '无', '品牌年度激励': '无', '佣金比例': '20', '结算形式': '月结', '结算时间': '次月 10 日', '粉丝数': '22000', '直播间类型': '达人播' }
      ],
      followups: [
        ['2026-06-15 10:00', '电话', '连续 3 月无产出，暂停合作待评估', '搁置', '季度回访', '2026-12-15', '陈昊']
      ],
      payments: [],
      attachments: []
    })
  ];

  global.CUSTOMER_PROFILE_SEED = SEED;
  global.CUSTOMER_PROFILE_SCHEMA = PROFILE_SCHEMA;
  global.CUSTOMER_PROFILE_MIGRATE = migrateProfile;
  global.CUSTOMER_PROFILE_COLUMNS = {
    account: ACCOUNT_COLUMNS,
    followup: FOLLOWUP_COLUMNS,
    payment: PAYMENT_COLUMNS,
    attach: ATTACH_COLUMNS
  };
  global.CUSTOMER_PROFILE_SUBFORM = SUBFORM;
  global.CUSTOMER_PROFILE_SUB_DEFAULT = subDefaultRow;

  // ===== 附件引擎（资质附件“文件名”列）：两个表单与两处渲染共用 =====
  var ATTACH = (function () {
    function esc(s) { if (s == null) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
    // 归一：字符串（旧）/ http 开头的链接 / 对象
    function info(cell) {
      if (cell == null) return { name: '', url: '', kind: '', size: 0 };
      if (typeof cell === 'object') return { name: cell.name || '', url: cell.url || '', kind: cell.kind || '', size: cell.size || 0 };
      var s = String(cell);
      if (/^https?:\/\//i.test(s)) return { name: s, url: s, kind: 'link', size: 0 };
      return { name: s, url: '', kind: '', size: 0 };
    }
    // 回写行值：无链接则保留为纯字符串（向后兼容），有则存对象
    function cell(obj) {
      if (!obj) return '';
      if (obj.kind === 'link' || obj.kind === 'file') {
        var o = { name: obj.name || '', url: obj.url || '', kind: obj.kind };
        if (obj.kind === 'file' && obj.size) o.size = obj.size;
        return o;
      }
      return obj.name || '';
    }
    function validate(i) {
      if (i.kind === 'link' && !/^https?:\/\//i.test(i.url || '')) return '附件链接需以 http:// 或 https:// 开头';
      return '';
    }
    function tailName(url) {
      try { var seg = String(url).split('/').filter(Boolean).pop() || ''; return decodeURIComponent(seg.split('?')[0]) || url; }
      catch (e) { return url; }
    }
    function fmtSize(b) {
      if (!b) return '';
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
      return (b / 1024 / 1024).toFixed(1) + ' MB';
    }
    // 只读渲染（列表/详情）：有链接可点，旧纯文件名仅文本
    function linkHtml(cellVal) {
      var i = info(cellVal);
      if (!i.name) return '';
      if (i.kind === 'file' && i.url) return '<a class="att-open" href="' + esc(i.url) + '" download="' + esc(i.name) + '">' + esc(i.name) + '</a><span class="att-tag">已上传' + (i.size ? ' ' + fmtSize(i.size) : '') + '</span>';
      if (i.kind === 'link' && i.url) return '<a class="att-open" href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.name) + '</a><span class="att-tag">链接</span>';
      return esc(i.name);
    }
    // 表单控件 HTML
    function fieldHtml(key, label, cellVal, req) {
      var i = info(cellVal);
      var sizeAttr = i.size ? ' data-size="' + i.size + '"' : '';
      var urlHidden = i.kind === 'file' ? esc(i.url) : '';
      var linkVal = i.kind === 'link' ? esc(i.url) : '';
      return '<div class="cf-item span-2 att-item" data-att-key="' + key + '"' + sizeAttr + '>'
        + '<span class="cf-label">' + esc(label) + (req ? '<span class="req">*</span>' : '') + '</span>'
        + '<div class="att-box">'
        + '<input type="text" class="att-name" data-fkey="' + key + '" data-att="name" value="' + esc(i.name) + '" placeholder="附件名称，如 营业执照.pdf">'
        + '<div class="att-ops">'
        + '<button type="button" class="att-btn" data-att="up">上传附件</button>'
        + '<input type="file" class="att-file" data-att="file" hidden>'
        + '<span class="att-or">或粘贴附件链接</span>'
        + '</div>'
        + '<input type="text" class="att-link" data-att="link" value="' + linkVal + '" placeholder="http:// 或 https:// 开头">'
        + '<input type="hidden" class="att-url" data-att="url" value="' + urlHidden + '">'
        + '<input type="hidden" class="att-kind" data-att="kind" value="' + esc(i.kind) + '">'
        + '<div class="att-cur" data-att="cur"></div>'
        + '</div></div>';
    }
    function refresh(root) {
      var kind = root.querySelector('[data-att="kind"]').value;
      var name = root.querySelector('[data-att="name"]').value.trim();
      var cur = root.querySelector('[data-att="cur"]');
      if (kind === 'file') {
        var url = root.querySelector('[data-att="url"]').value;
        var sz = Number(root.getAttribute('data-size') || 0);
        cur.innerHTML = '<span class="att-badge file">已上传</span><a class="att-open" href="' + url + '" download="' + esc(name) + '">' + esc(name || '附件') + '</a>'
          + (sz ? '<span class="att-size">' + fmtSize(sz) + '</span>' : '') + '<button type="button" class="att-clear" data-att="clear">移除</button>';
      } else if (kind === 'link') {
        var lv = root.querySelector('[data-att="link"]').value.trim();
        if (lv && /^https?:\/\//i.test(lv)) {
          cur.innerHTML = '<span class="att-badge link">链接</span><a class="att-open" href="' + esc(lv) + '" target="_blank" rel="noopener">' + esc(name || lv) + '</a><button type="button" class="att-clear" data-att="clear">移除</button>';
        } else { cur.innerHTML = ''; }
      } else { cur.innerHTML = ''; }
    }
    function clearState(root) {
      root.querySelector('[data-att="kind"]').value = '';
      root.querySelector('[data-att="url"]').value = '';
      root.querySelector('[data-att="link"]').value = '';
      root.querySelector('[data-att="file"]').value = '';
      root.removeAttribute('data-size');
      refresh(root);
    }
    function bind(container, notify) {
      notify = notify || function () {};
      if (container.__attBound) return;
      container.__attBound = 1;
      var max = SUBFORM.attachMaxMB * 1024 * 1024;
      container.addEventListener('click', function (e) {
        var up = e.target.closest && e.target.closest('[data-att="up"]');
        if (up) { up.closest('[data-att-key]').querySelector('[data-att="file"]').click(); return; }
        var cl = e.target.closest && e.target.closest('[data-att="clear"]');
        if (cl) { clearState(cl.closest('[data-att-key]')); }
      });
      container.addEventListener('change', function (e) {
        var f = e.target.closest && e.target.closest('[data-att="file"]');
        if (!f || !f.files || !f.files[0]) return;
        var root = f.closest('[data-att-key]');
        var file = f.files[0];
        if (file.size > max) { notify('附件过大（超过 ' + SUBFORM.attachMaxMB + 'MB），请改用附件链接', 'error'); f.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function () {
          root.querySelector('[data-att="url"]').value = reader.result;
          root.querySelector('[data-att="kind"]').value = 'file';
          root.querySelector('[data-att="link"]').value = '';
          root.setAttribute('data-size', file.size);
          var nameEl = root.querySelector('[data-att="name"]');
          if (!nameEl.value.trim()) { nameEl.value = file.name; }
          refresh(root); notify('附件已上传：' + file.name, 'success');
        };
        reader.onerror = function () { notify('附件读取失败，请重试或改用链接', 'error'); };
        reader.readAsDataURL(file);
      });
      container.addEventListener('input', function (e) {
        var l = e.target.closest && e.target.closest('[data-att="link"]');
        if (l) { var root = l.closest('[data-att-key]'); root.querySelector('[data-att="kind"]').value = l.value.trim() ? 'link' : ''; if (l.value.trim() && /^https?:\/\//i.test(l.value.trim())) { root.querySelector('[data-att="url"]').value = ''; root.querySelector('[data-att="file"]').value = ''; root.removeAttribute('data-size'); } refresh(root); }
        var n = e.target.closest && e.target.closest('[data-att="name"]');
        if (n) refresh(n.closest('[data-att-key]'));
      });
      container.querySelectorAll('[data-att-key]').forEach(function (root) { refresh(root); });
    }
    function read(key, container) {
      var root = container.querySelector('[data-att-key="' + key + '"]');
      if (!root) return { cell: '', error: '', empty: true };
      var name = root.querySelector('[data-att="name"]').value.trim();
      var kind = root.querySelector('[data-att="kind"]').value;
      var link = root.querySelector('[data-att="link"]').value.trim();
      var url = kind === 'file' ? root.querySelector('[data-att="url"]').value : link;
      var size = Number(root.getAttribute('data-size') || 0);
      if (kind === 'link' && link) { var err = validate({ name: name, url: link, kind: 'link' }); if (err) return { cell: '', error: err, empty: false }; }
      if (kind === 'link' && !name) name = tailName(link);
      if (!name && !url) return { cell: '', error: '', empty: true };
      return { cell: cell({ name: name, url: url, kind: kind, size: size }), error: '', empty: false };
    }
    return { info: info, cell: cell, validate: validate, esc: esc, tailName: tailName, fmtSize: fmtSize, linkHtml: linkHtml, fieldHtml: fieldHtml, bind: bind, read: read };
  })();
  global.CUSTOMER_PROFILE_ATTACH = ATTACH;
})(window);

/* 售后挽单策略中心 — 共享演示数据（纯前端 mock，各 wd-*.html 页面统一引用） */
var WD = (function () {
  'use strict';

  // ===== 基础字典 =====
  var WEEK = '2026W44';
  var VERSION = 'v2026W44-01';
  var PREV_VERSION = 'v2026W43-01';

  var BRANDS = ['森马', '巴拉', '马卡乐'];

  // cfg_brand_tier：档位参数（左闭右开）
  var TIERS = [
    { code: 'L', name: 'L 低档', marginLower: 45, marginUpper: 54, target: 5, ratioHint: 5 },
    { code: 'YM', name: 'YM 中档', marginLower: 54, marginUpper: 63, target: 15, ratioHint: 8 },
    { code: 'YH', name: 'YH 高档', marginLower: 63, marginUpper: null, target: 30, ratioHint: 12 }
  ];

  // cfg_price_band 断点子集 → 一期策略带 {50,100,200,400}
  var BANDS = [
    { label: '50-100元', lower: 50, upper: 100, maxRatio: 0.31, safety: 0.80 },
    { label: '100-200元', lower: 100, upper: 200, maxRatio: 0.21, safety: 0.80 },
    { label: '200-400元', lower: 200, upper: 400, maxRatio: 0.16, safety: 0.80 }
  ];

  // 策略状态机（§3.7）
  var STRATEGY_STATUS = {
    DRAFT: '草稿',
    GUARD_PASSED: '门检通过',
    GUARD_BLOCKED: '门检阻断',
    PENDING_SYNC: '待同步',
    SYNCING: '同步中',
    SYNCED_UNVERIFIED: '已同步待校验',
    ACTIVE: '生效中',
    VERIFY_FAILED: '校验失败',
    DISABLED: '已停用',
    RETIRED: '已归档'
  };

  // 挽单标签（业务可见的唯一结论字段，周度动态更新）
  var POOL_TAG = {
    WD: { code: 'WD', text: '挽单', cls: 'tag-wd' },
    NOWD: { code: 'NOWD', text: '不挽', cls: 'tag-nowd' }
  };

  // 标签枚举（§5.1）
  var LABELS = {
    Y: { text: 'Y 进池', cls: 'submitted' },
    N1: { text: 'N1 必要性低', cls: 'pending' },
    N2: { text: 'N2 异常先排查', cls: 'cancelled' },
    O: { text: 'O 样本不足', cls: 'running' }
  };

  // ===== C5 门检清单（§6） =====
  var GUARDS = [
    { id: 'G1', name: '档位区间互斥且无缝覆盖', rule: '全量款命中数 = 1', action: '阻断发布', result: 'PASS', detail: '3 档区间已修订完成，1,286 款命中数均为 1' },
    { id: 'G2', name: '补偿上限不超平台上限', rule: 'spending_cap ≤ cap_band', action: '阻断发布', result: 'PASS', detail: '22 条策略全部满足带下界保守值' },
    { id: 'G3', name: '同一平台商品仅属一条启用策略', rule: '跨品牌/跨档/跨带全局查', action: '阻断发布', result: 'DIFF', detail: '发现 2 个商品同时挂在存量 legacy 方案与本期策略上' },
    { id: 'G4', name: '单周商品变更幅度 ≤ 30%', rule: '|Δ| / 上周集合', action: '转人工确认', result: 'WARN', detail: '森马 YM 档变更 34.6%，需人工确认基准是否抖动' },
    { id: 'G5', name: '回读 item_list_hash 一致', rule: '无 MISSING / EXTRA_IN_PLATFORM', action: '置 VERIFY_FAILED 并冻结下周发布', result: 'DIFF', detail: 'WD20261026007 回读少 1 个商品 ID' },
    { id: 'G6', name: '引用售后原因均可选', rule: 'reason_code.is_selectable = true', action: '自动 DISABLED + 告警', result: 'PASS', detail: '品质类 13 项已下线，策略未引用' },
    { id: 'G7', name: '剔挽口径可用', rule: 'retention_success_cnt 缺失或占比 > 30%', action: '冻结档位、沿用上期', result: 'PASS', detail: '挽单成功回流占申请数 12.4%，口径可用' },
    { id: 'G8', name: 'Σ daily_budget ≤ 预算', rule: '按实验组→高档→高价带截断', action: '截断启用清单', result: 'PASS', detail: '合计日预算 41,800 元 / 预算 50,000 元' },
    { id: 'G9', name: '连续 3 天零下发', rule: 'deliver_cnt = 0', action: '告警 + 三因诊断（不下线）', result: 'WARN', detail: '3 条启用策略命中，详见效果页零下发诊断' }
  ];

  // ===== strategy（§3.5） =====
  var STRATEGIES = [
    { id: 'WD20261026001', brand: '森马', tier: 'YH', band: '200-400元', priority: 10, ratio: 12, cap: 30, dailyBudget: 6000, freq: '1_per_after_sale_order', reasons: ['无理由', '其他'], group: 'A_model', status: 'ACTIVE', itemCnt: 128, physicalCnt: 2, prevId: 'WD20261019001', guard: true, reason: '剔挽退货率 1.42× 基准，毛利率 68.4%', updated: '2026-10-26 04:12' },
    { id: 'WD20261026002', brand: '森马', tier: 'YM', band: '100-200元', priority: 20, ratio: 8, cap: 15, dailyBudget: 4500, freq: '1_per_after_sale_order', reasons: ['无理由'], group: 'A_model', status: 'ACTIVE', itemCnt: 342, physicalCnt: 4, prevId: 'WD20261019002', guard: true, reason: '剔挽退货率 1.31× 基准，毛利率 58.2%', updated: '2026-10-26 04:12' },
    { id: 'WD20261026003', brand: '森马', tier: 'L', band: '50-100元', priority: 30, ratio: 5, cap: 5, dailyBudget: 2200, freq: '1_per_after_sale_order', reasons: ['无理由', '物流品质'], group: 'B_platform', status: 'SYNCING', itemCnt: 205, physicalCnt: 3, prevId: 'WD20261019003', guard: true, reason: '补偿额 5.6 元达有感下限', updated: '2026-10-26 09:40' },
    { id: 'WD20261026004', brand: '巴拉', tier: 'YH', band: '100-200元', priority: 15, ratio: 12, cap: 19, dailyBudget: 5200, freq: '1_per_after_sale_order', reasons: ['无理由'], group: 'A_model', status: 'PENDING_SYNC', itemCnt: 486, physicalCnt: 5, prevId: 'WD20261019005', guard: true, reason: '高档高基数，商品清单本周扩充', updated: '2026-10-26 04:15' },
    { id: 'WD20261026005', brand: '巴拉', tier: 'YM', band: '200-400元', priority: 25, ratio: 8, cap: 15, dailyBudget: 3800, freq: '1_per_after_sale_order', reasons: ['无理由', '其他'], group: 'NONE', status: 'SYNCED_UNVERIFIED', itemCnt: 97, physicalCnt: 1, prevId: 'WD20261019006', guard: true, reason: '待回读校验推进 ACTIVE', updated: '2026-10-27 10:05' },
    { id: 'WD20261026006', brand: '巴拉', tier: 'L', band: '50-100元', priority: 35, ratio: 5, cap: 5, dailyBudget: 1500, freq: '1_per_after_sale_order', reasons: ['无理由'], group: 'B_platform', status: 'GUARD_PASSED', itemCnt: 63, physicalCnt: 1, prevId: 'WD20261019007', guard: true, reason: '补偿 5.2 元，档位退化已告警合并', updated: '2026-10-26 04:15' },
    { id: 'WD20261026007', brand: '马卡乐', tier: 'YH', band: '100-200元', priority: 12, ratio: 12, cap: 19, dailyBudget: 3300, freq: '1_per_after_sale_order', reasons: ['无理由'], group: 'A_model', status: 'VERIFY_FAILED', itemCnt: 174, physicalCnt: 2, prevId: 'WD20261019009', guard: true, reason: '回读 item_list_hash 不一致（少 1 商品）', updated: '2026-10-28 10:00' },
    { id: 'WD20261026008', brand: '马卡乐', tier: 'YM', band: '50-100元', priority: 40, ratio: 6, cap: 4.9, dailyBudget: 0, freq: '1_per_after_sale_order', reasons: ['无理由'], group: 'NONE', status: 'DRAFT', itemCnt: 88, physicalCnt: 1, prevId: '', guard: false, reason: 'spending_cap 4.9 < MIN_FEELING 5，本期不生成', updated: '2026-10-26 04:15' },
    { id: 'WD20261026009', brand: '马卡乐', tier: 'L', band: '200-400元', priority: 45, ratio: 5, cap: 8, dailyBudget: 800, freq: '1_per_after_sale_order', reasons: ['无理由', '物流品质'], group: 'B_platform', status: 'DISABLED', itemCnt: 31, physicalCnt: 1, prevId: 'WD20261019011', guard: true, reason: '本周二人工急停（预算临近熔断）', updated: '2026-10-27 15:22' },
    { id: 'WD20261020001', isLegacy: true, brand: '森马', tier: '—', band: '全店', priority: 99, ratio: 10, cap: 10, dailyBudget: 5000, freq: '1_per_after_sale_order', reasons: ['无理由', '商品品质'], group: 'NONE', status: 'ACTIVE', itemCnt: 512, physicalCnt: 6, prevId: '', guard: false, reason: '存量方案导入（source=legacy），待归因剥离', updated: '2026-10-20 18:00' }
  ];

  // ===== result_sku_label（§3.4，含 basis_snapshot 可解释性） =====
  var SKU_LABELS = [
    { sku: 'SN-26A-1001', brand: '森马', mid: '针织上衣', status: '在售', label: 'Y', tier: 'YH', ship: 3820, retApply: 512, retRate: 0.1246, baseline: 0.0877, ratio: 1.42, margin: 68.4, src: 'normal', prev: 'Y', hyst: false, skip: '', basis: { 判据: '基准倍数 1.42× 落在退货率判定区间 1.00~1.50× 内，销量与毛利率均在区间内', 阈值: '进池 1.00× / 出池 0.80× / 异常 1.50×（未触发）', 滞回: '上期已进池，本期仍 ≥ 出池阈值，无需滞回', 档位: '毛利率 68.4% 命中 YH [63%, ∞)', 价格带: '实付 P50 268 元 → 200-400 元带', 补偿: '带内保守上限 = 0.80×16%×200 = 25.6 元；与档位目标 30 元取小 → 25.6 元' } },
    { sku: 'SN-26A-1002', brand: '森马', mid: '牛仔下装', status: '在售', label: 'Y', tier: 'YM', ship: 2410, retApply: 388, retRate: 0.118, baseline: 0.0901, ratio: 1.31, margin: 58.2, src: 'normal', prev: 'Y', hyst: true, skip: '', basis: { 判据: '基准倍数 1.31× 在退货率判定区间 1.00~1.50× 内，维持挽单', 阈值: '1.31× ≥ 0.80× → 维持挽单（滞回生效）', 滞回: '生效：若无滞回，边界抖动会造成款在策略间迁移', 档位: '毛利率 58.2% 命中 YM [54%, 63)', 价格带: '实付 P50 156 元 → 100-200 元带', 补偿: '带内保守上限 = 0.80×21%×100 = 16.8 元；与档位目标 15 元取小 → 15 元' } },
    { sku: 'SN-26A-1003', brand: '森马', mid: '外套', status: '在售', label: 'N1', tier: '', ship: 1620, retApply: 96, retRate: 0.061, baseline: 0.0855, ratio: 0.71, margin: 61.5, src: 'normal', prev: 'Y', hyst: true, skip: '', basis: { 判据: '基准倍数 0.71× 低于退货率判定区间下界 1.00×', 阈值: '滞回出池判定', 滞回: '生效：未采用进池阈值 1.00×，避免边界抖动', 档位: '不挽，不判档', 价格带: '—', 补偿: '—' } },
    { sku: 'SN-26B-2001', brand: '巴拉', mid: '针织上衣', status: '在售', label: 'N2', tier: '', ship: 1180, retApply: 342, retRate: 0.166, baseline: 0.0912, ratio: 1.82, margin: 55.0, src: 'normal', prev: 'N2', hyst: false, skip: '', basis: { 判据: '基准倍数 1.82× 高于退货率判定区间上限 1.50×，先排查商品与直播表达', 阈值: '异常判定优先于进池判定（顺序不可调换）', 滞回: '不适用', 档位: '不投补偿：先排查商品质量与直播表达', 价格带: '—', 补偿: '—' } },
    { sku: 'SN-26B-2002', brand: '巴拉', mid: '连衣裙', status: '在售', label: 'Y', tier: 'YH', ship: 2960, retApply: 604, retRate: 0.132, baseline: 0.0902, ratio: 1.46, margin: 66.8, src: 'normal', prev: 'O', hyst: false, skip: '', basis: { 判据: '销售件数 2,960 件在区间内，基准倍数 1.46× 在 1.00~1.50× 内，毛利率 66.8% 命中 YH 档', 阈值: '基准倍数 1.46× 在进池阈值 1.00× 与异常上限 1.50× 之间 → 判挽单', 滞回: '上期不挽，首次进池用进池阈值 1.00×', 档位: '毛利率 66.8% 命中 YH', 价格带: '实付 P50 143 元 → 100-200 元带', 补偿: '带内保守上限 = 0.80×21%×100 = 16.8 元；与档位目标 30 元取小 → 16.8 元' } },
    { sku: 'SN-26B-2003', brand: '巴拉', mid: '婴幼内衣', status: '在售', label: 'O', tier: '', ship: 540, retApply: 21, retRate: 0.041, baseline: 0.0899, ratio: 0.46, margin: 52.3, src: 'normal', prev: 'O', hyst: false, skip: 'BLACKLIST', basis: { 判据: '业务黑名单排除（贴身衣物），不参与判定', 阈值: '不参与判定', 滞回: '—', 档位: '—', 价格带: '—', 补偿: '销售周期与库存压力本期不自动判定，改由业务人工排除' } },
    { sku: 'SN-26C-3001', brand: '马卡乐', mid: '牛仔下装', status: '在售', label: 'Y', tier: 'YM', ship: 820, retApply: 143, retRate: 0.132, baseline: 0.0899, ratio: 1.47, margin: 57.1, src: 'normal', prev: 'Y', hyst: false, skip: '', basis: { 判据: '基准倍数 1.47× 在该店铺退货率判定区间 1.10~1.50× 内', 阈值: '进池 1.10× / 出池 0.85× / 异常 1.50×（该品牌基数低，阈值高于森马与巴拉）', 滞回: '上期已挽单，本期仍 ≥ 出池阈值 0.85×，无需滞回', 档位: '毛利率 57.1% 命中 YM', 价格带: '实付 P50 88 元 → 50-100 元带', 补偿: '带内保守上限 = 0.80×31%×50 = 12.4 元；与档位目标 15 元取小 → 12.4 元' } },
    { sku: 'SN-26C-3002', brand: '马卡乐', mid: '外套', status: '在售', label: 'O', tier: '', ship: 96, retApply: 12, retRate: 0.125, baseline: 0.0866, ratio: 1.44, margin: 41.2, src: 'normal', prev: 'O', hyst: false, skip: 'SAMPLE_INSUFFICIENT', basis: { 判据: '销售件数 96 件低于判定区间下界 150 件', 阈值: '销量样本不足 / 上播初期', 滞回: '—', 档位: '—', 价格带: '—', 补偿: '—' } },
    { sku: 'SN-26C-3003', brand: '马卡乐', mid: '鞋品', status: '在售', label: 'O', tier: '', ship: 1450, retApply: 231, retRate: 0.159, baseline: 0.0, ratio: 0, margin: 48.9, src: 'missing', prev: 'O', hyst: false, skip: 'BASELINE_MISSING', basis: { 判据: '同品类基准缺失，无法计算倍数', 阈值: '直接跳过并出告警，不静默丢款', 滞回: '—', 档位: '—', 价格带: '—', 补偿: '—' } },
    { sku: 'SN-26A-1004', brand: '森马', mid: '针织上衣', status: '在售', label: 'N1', tier: '', ship: 1980, retApply: 178, retRate: 0.089, baseline: 0.0877, ratio: 1.02, margin: 38.6, src: 'normal', prev: 'N1', hyst: false, skip: 'MARGIN_BELOW', basis: { 判据: '基准倍数 1.02× 在区间内，但毛利率 38.6% 低于判定区间下界 45%', 阈值: '低于最低毛利率线 → 不挽', 滞回: '—', 档位: '不投补偿', 价格带: '—', 补偿: '—' } },
    { sku: 'SN-26B-2004', brand: '巴拉', mid: '连衣裙', status: '在售', label: 'O', tier: '', ship: 0, retApply: 0, retRate: 0, baseline: 0.0902, ratio: 0, margin: 0, src: 'normal', prev: 'O', hyst: false, skip: 'NO_PLATFORM_ITEM', basis: { 判据: '该款未建立平台商品映射，不能静默入池', 阈值: '生成阶段跳过并出告警', 滞回: '—', 档位: '—', 价格带: '—', 补偿: '不能静默丢款：本款需业务补建映射' } },
    { sku: 'SN-26A-1005', brand: '森马', mid: '外套', status: '在售', label: 'Y', tier: 'L', ship: 3120, retApply: 402, retRate: 0.128, baseline: 0.0855, ratio: 1.44, margin: 47.2, src: 'normal', prev: 'Y', hyst: false, skip: '', basis: { 判据: '基准倍数 1.44× 在区间内，毛利率 47.2% 命中 L 档（补偿额恰在有感下限，已告警合并档位）', 阈值: '未超异常上限 1.50×', 滞回: '—', 档位: '毛利率 47.2% 命中 L [45%, 54)', 价格带: '实付 P50 92 元 → 50-100 元带', 补偿: '带内保守上限 12.4 元；与档位目标 5 元取小 → 5 元，与相邻低档同值 → 已告警并合并档位' } }
  ];

  // ===== sync_task 配置工单（§3.6 / P5） =====
  var SYNC_TASKS = [
    { taskId: 'TD-2026W44-0001', strategyId: 'WD20261026001', physicalId: 'PH-001-1', action: 'CREATE', assignee: '陈执行', status: 'PENDING', schemeId: '', doneAt: '', shot: '', items: 100, name: 'WD-森马-YH-200-400', remark: '' },
    { taskId: 'TD-2026W44-0002', strategyId: 'WD20261026001', physicalId: 'PH-001-2', action: 'CREATE', assignee: '未领取', status: 'PENDING', schemeId: '', doneAt: '', shot: '', items: 28, name: 'WD-森马-YH-200-400-2', remark: '' },
    { taskId: 'TD-2026W44-0003', strategyId: 'WD20261026002', physicalId: 'PH-002-1', action: 'UPDATE_ITEMS', assignee: '陈执行', status: 'DONE', schemeId: '74128930561', doneAt: '2026-10-27 16:20', shot: 'oss://wd-sync/TD-0003.png', items: 342, name: 'WD-森马-YM-100-200', remark: '新增 46 个商品，移除 12 个' },
    { taskId: 'TD-2026W44-0004', strategyId: 'WD20261026004', physicalId: 'PH-004-1', action: 'CREATE', assignee: '周执行', status: 'PENDING', schemeId: '', doneAt: '', shot: '', items: 100, name: 'WD-巴拉-YH-100-200', remark: '' },
    { taskId: 'TD-2026W44-0005', strategyId: 'WD20261026005', physicalId: 'PH-005-1', action: 'UPDATE_SPENDING', assignee: '周执行', status: 'VERIFIED', schemeId: '74128930902', doneAt: '2026-10-27 09:10', shot: 'oss://wd-sync/TD-0005.png', items: 97, name: 'WD-巴拉-YM-200-400', remark: '补偿 12 → 15 元，回读 hash 一致' },
    { taskId: 'TD-2026W44-0006', strategyId: 'WD20261026007', physicalId: 'PH-007-1', action: 'UPDATE_ITEMS', assignee: '陈执行', status: 'FAILED', schemeId: '74128930877', doneAt: '2026-10-28 10:00', shot: '', items: 174, name: 'WD-马卡乐-YH-100-200', remark: '回读少 1 个商品 ID，状态置 VERIFY_FAILED' },
    { taskId: 'TD-2026W44-0007', strategyId: 'WD20261026009', physicalId: 'PH-009-1', action: 'OFFLINE', assignee: '陈执行', status: 'DONE', schemeId: '74128930455', doneAt: '2026-10-27 15:25', shot: 'oss://wd-sync/TD-0007.png', items: 31, name: 'WD-马卡乐-L-200-400', remark: '预算临近熔断，人工急停' },
    { taskId: 'TD-2026W44-0008', strategyId: 'WD20261026003', physicalId: 'PH-003-1', action: 'ADJUST_PRIORITY', assignee: '未领取', status: 'PENDING', schemeId: '', doneAt: '', shot: '', items: 205, name: 'WD-森马-L-50-100', remark: '优先级 35 → 30，避让新高档' }
  ];

  var TASK_STATUS = {
    PENDING: { text: '待领取', cls: 'pending' },
    DONE: { text: '已回填', cls: 'running' },
    VERIFIED: { text: '已校验', cls: 'submitted' },
    FAILED: { text: '失败', cls: 'cancelled' }
  };

  var ACTIONS = {
    CREATE: { text: '新建方案', cls: 'partial' },
    UPDATE_ITEMS: { text: '改商品清单', cls: 'running' },
    UPDATE_SPENDING: { text: '改补偿值', cls: 'pending' },
    ADJUST_PRIORITY: { text: '调优先级', cls: 'running' },
    OFFLINE: { text: '下线方案', cls: 'cancelled' }
  };

  // ===== consistency_check（G5 回读 diff） =====
  var CHECKS = [
    { batch: 'IMP-20261028-01', strategyId: 'WD20261026007', physicalId: 'PH-007-1', type: 'ITEM_HASH', expected: 'a91f…c03（174 项）', actual: '7be2…14d（173 项）', result: 'DIFF', severity: '高', at: '2026-10-28 10:00' },
    { batch: 'IMP-20261028-01', strategyId: 'WD20261026007', physicalId: 'PH-007-1', type: 'MISSING_IN_PLATFORM', expected: 'DY_3829107755', actual: '—', result: 'MISSING_IN_PLATFORM', severity: '高', at: '2026-10-28 10:00' },
    { batch: 'IMP-20261028-01', strategyId: 'WD20261020001', physicalId: 'PH-LGC-3', type: 'DUP_ITEM', expected: 'DY_5512098331 仅属 1 条策略', actual: '同时挂在 legacy 与 WD20261026002', result: 'DIFF', severity: '高', at: '2026-10-28 10:00' },
    { batch: 'IMP-20261028-01', strategyId: 'WD20261020001', physicalId: 'PH-LGC-5', type: 'EXTRA_IN_PLATFORM', expected: '本系统无该方案', actual: '平台存在「品质挽单-统一10元」（启用中）', result: 'EXTRA_IN_PLATFORM', severity: '极高', at: '2026-10-28 10:00' },
    { batch: 'IMP-20261028-01', strategyId: 'WD20261026005', physicalId: 'PH-005-1', type: 'SPENDING', expected: '15.00 元 / 8%', actual: '15.00 元 / 8%', result: 'PASS', severity: '—', at: '2026-10-28 10:00' },
    { batch: 'IMP-20261028-01', strategyId: 'WD20261026002', physicalId: 'PH-002-1', type: 'PRIORITY', expected: '20', actual: '20', result: 'PASS', severity: '—', at: '2026-10-28 10:00' }
  ];

  // ===== 变更 diff（§5.4 / P4） =====
  var DIFFS = {
    created: [
      { key: '巴拉 · YH · 100-200元', strategyId: 'WD20261026004', items: 486, physical: 5, cap: 16.8, ratio: 12, priority: 15, note: '新建（上周无此业务主键）' },
      { key: '马卡乐 · L · 200-400元', strategyId: 'WD20261026009', items: 31, physical: 1, cap: 8.0, ratio: 5, priority: 45, note: '新建（滞回后首次进池）' }
    ],
    updated: [
      { key: '森马 · YM · 100-200元', strategyId: 'WD20261026002', items: 342, physical: 4, cap: 15.0, ratio: 8, priority: 20, note: '商品清单 +46 / -12，补偿与优先级不变' },
      { key: '巴拉 · YM · 200-400元', strategyId: 'WD20261026005', items: 97, physical: 1, cap: 15.0, ratio: 8, priority: 25, note: '补偿 12 → 15 元（UPDATE_SPENDING）' },
      { key: '森马 · L · 50-100元', strategyId: 'WD20261026003', items: 205, physical: 3, cap: 5.0, ratio: 5, priority: 30, note: '优先级 35 → 30（ADJUST_PRIORITY）' }
    ],
    offlined: [
      { key: '森马 · L · 100-200元', strategyId: 'WD20261019014', items: 58, physical: 1, cap: 5.0, ratio: 5, priority: 38, note: '业务主键消失：本带全部款出池' }
    ],
    skipped: [
      { key: '马卡乐 · YM · 50-100元', reason: 'CAP_TOO_SMALL', detail: 'spending_cap 4.90 元 < MIN_FEELING 5 元，不生成策略', strategyId: 'WD20261026008' },
      { key: '森马 · YH · 50-100元', reason: 'TIER_DEGENERATED', detail: '与相邻低档同带 cap 相同（12.4 元），已合并档位并告警', strategyId: '—' },
      { key: '巴拉 · 4 款', reason: 'NO_PLATFORM_ITEM', detail: '未建立款↔平台商品映射，跳过并出告警', strategyId: '—' }
    ]
  };

  // ===== 效果回流（P7，R3：不提供平台 ROI） =====
  var EFFECT_GROUPS = [
    { group: 'A_model', name: 'A 组 · 本系统模型策略', deliver: 18420, accept: 6218, rate: 33.8, recovered: 486200, spending: 71350, net: null },
    { group: 'B_platform', name: 'B 组 · 平台默认托管对照', deliver: 9130, accept: 2410, rate: 26.4, recovered: 168400, spending: 33680, net: null },
    { group: 'NONE', name: '未分组 / 存量 legacy', deliver: 5240, accept: 1102, rate: 21.0, recovered: 71800, spending: 18940, net: null }
  ];

  var EFFECT_TREND = [
    { date: '10-22', deliver: 2410, accept: 812, recovered: 61200, spending: 8930 },
    { date: '10-23', deliver: 2680, accept: 902, recovered: 68400, spending: 9840 },
    { date: '10-24', deliver: 2290, accept: 741, recovered: 56100, spending: 8120 },
    { date: '10-25', deliver: 3120, accept: 1063, recovered: 82400, spending: 11980 },
    { date: '10-26', deliver: 3480, accept: 1204, recovered: 94600, spending: 13420 },
    { date: '10-27', deliver: 2960, accept: 986, recovered: 76800, spending: 10850 },
    { date: '10-28', deliver: 1600, accept: 512, recovered: 39200, spending: 5600 }
  ];

  var EFFECT_DRILL = [
    { dim: '森马 / YH / 200-400元', strategyId: 'WD20261026001', group: 'A_model', deliver: 6420, accept: 2380, rate: 37.1, recovered: 198400, spending: 24100, reReturn: 118 },
    { dim: '森马 / YM / 100-200元', strategyId: 'WD20261026002', group: 'A_model', deliver: 5210, accept: 1742, rate: 33.4, recovered: 126800, spending: 18300, reReturn: 96 },
    { dim: '巴拉 / YH / 100-200元', strategyId: 'WD20261026004', group: 'A_model', deliver: 4080, accept: 1266, rate: 31.0, recovered: 96200, spending: 14900, reReturn: 71 },
    { dim: '森马 / L / 50-100元', strategyId: 'WD20261026003', group: 'B_platform', deliver: 2130, accept: 512, rate: 24.0, recovered: 21400, spending: 6080, reReturn: 38 },
    { dim: '巴拉 / L / 50-100元', strategyId: 'WD20261026006', group: 'B_platform', deliver: 0, accept: 0, rate: 0, recovered: 0, spending: 0, reReturn: 0 },
    { dim: '森马 / 全店（存量）', strategyId: 'WD20261020001', group: 'NONE', deliver: 5240, accept: 1102, rate: 21.0, recovered: 71800, spending: 18940, reReturn: 164 }
  ];

  var ZERO_DELIVER = [
    { strategyId: 'WD20261026006', name: 'WD-巴拉-L-50-100', days: 4, causes: ['引用的商品品质类原因已于 2026-08-05 下线（G6 已复检）', '被高优先级 legacy 方案遮蔽（优先级 99 > 本策略 35）'], suggest: '重设优先级并改挂可选原因' },
    { strategyId: 'WD20261026009', name: 'WD-马卡乐-L-200-400', days: 3, causes: ['策略已人工 DISABLED，本周不再下发'], suggest: '预算释放后重新启用' },
    { strategyId: 'WD20261026003', name: 'WD-森马-L-50-100', days: 3, causes: ['价格带 50-100 元下 cap 5 元触及平台带内比例上限，下发被静默压量'], suggest: '若需有感补偿，应先砍网格维度（§14）' }
  ];

  // ===== 规则配置（P6） =====
  var RULES = {
    pool: [
      { brand: '森马', version: 'v3', enter: 1.00, exit: 0.80, abnormal: 1.50, minShip: 200, minRet: 30, window: 90, fallback: '是', status: '生效中' },
      { brand: '巴拉', version: 'v3', enter: 1.00, exit: 0.80, abnormal: 1.50, minShip: 200, minRet: 30, window: 60, fallback: '是', status: '生效中' },
      { brand: '马卡乐', version: 'v2', enter: 1.10, exit: 0.85, abnormal: 1.50, minShip: 150, minRet: 20, window: 90, fallback: '否', status: '生效中' }
    ],
    tier: [
      { brand: '森马', tier: 'L', lower: 45, upper: 54, target: 5, hint: 5, enabled: '是', version: 'v2' },
      { brand: '森马', tier: 'YM', lower: 54, upper: 63, target: 15, hint: 8, enabled: '是', version: 'v2' },
      { brand: '森马', tier: 'YH', lower: 63, upper: '', target: 30, hint: 12, enabled: '是', version: 'v2' },
      { brand: '巴拉', tier: 'L', lower: 45, upper: 54, target: 5, hint: 5, enabled: '是', version: 'v4' },
      { brand: '巴拉', tier: 'YM', lower: 54, upper: 63, target: 15, hint: 8, enabled: '是', version: 'v4' },
      { brand: '巴拉', tier: 'YH', lower: 63, upper: '', target: 30, hint: 12, enabled: '是', version: 'v4' },
      { brand: '马卡乐', tier: 'L', lower: 42, upper: 52, target: 5, hint: 5, enabled: '是', version: 'v1' },
      { brand: '马卡乐', tier: 'YM', lower: 52, upper: 62, target: 15, hint: 8, enabled: '是', version: 'v1' },
      { brand: '马卡乐', tier: 'YH', lower: 62, upper: '', target: 30, hint: 12, enabled: '是', version: 'v1' }
    ],
    band: [
      { band: '[0,10)', upper: 10, maxRatio: 50, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08' },
      { band: '[10,20)', upper: 20, maxRatio: 41, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08' },
      { band: '[20,50)', upper: 50, maxRatio: 31, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08' },
      { band: '[50,100)', upper: 100, maxRatio: 31, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08', inUse: true },
      { band: '[100,200)', upper: 200, maxRatio: 21, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08', inUse: true },
      { band: '[200,400)', upper: 400, maxRatio: 16, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08', inUse: true },
      { band: '[1000,1500)', upper: 1500, maxRatio: 11, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08' },
      { band: '[5000,∞)', upper: '', maxRatio: 16, safety: 80, from: '2026-05-08', to: '', src: '抖店官方 2026-05-08' }
    ],
    reason: [
      { code: 'R-001', name: '不想要了', group: '无理由', selectable: '是', offline: '', note: '' },
      { code: 'R-002', name: '尺码不合适', group: '无理由', selectable: '是', offline: '', note: '' },
      { code: 'R-003', name: '多拍/错拍', group: '无理由', selectable: '是', offline: '', note: '' },
      { code: 'R-014', name: '商品与描述不符', group: '商品品质', selectable: '否', offline: '2026-08-05', note: '平台已下线，已配置方案不再向消费者触发（触发 G6 复检）' },
      { code: 'R-015', name: '质量问题（开线/破损）', group: '商品品质', selectable: '否', offline: '2026-08-05', note: '品质类 13 项之一下线' },
      { code: 'R-021', name: '物流未按承诺时效送达', group: '物流品质', selectable: '是', offline: '', note: '' },
      { code: 'R-022', name: '包裹破损/缺件', group: '物流品质', selectable: '是', offline: '', note: '' },
      { code: 'R-031', name: '优惠券挽单', group: '其他', selectable: '否', offline: '2026-08-05', note: '能力整体下线，本期不做发券/赠品' }
    ],
    budget: [
      { id: 'BG-001', platform: 'douyin', shop: 'DY-S001 森马旗舰店', period: 'daily', amount: 30000, hardStop: '是', range: '2026-10-01 ~ 2026-12-31' },
      { id: 'BG-002', platform: 'douyin', shop: 'DY-S001 森马旗舰店', period: 'weekly', amount: 150000, hardStop: '否', range: '2026-10-01 ~ 2026-12-31' },
      { id: 'BG-003', platform: 'douyin', shop: 'DY-S002 巴拉旗舰店', period: 'daily', amount: 12000, hardStop: '是', range: '2026-10-01 ~ 2026-12-31' },
      { id: 'BG-004', platform: 'douyin', shop: 'DY-S003 马卡乐旗舰店', period: 'daily', amount: 8000, hardStop: '是', range: '2026-10-15 ~ 2026-12-31' }
    ],
    whitelist: [
      { sku: 'SN-26B-2003', brand: '巴拉', mid: '婴幼内衣', type: '黑名单', op: '王业务', at: '2026-09-18', reason: '贴身衣物业务排除' },
      { sku: 'SN-26C-3005', brand: '马卡乐', mid: '鞋品', type: '黑名单', op: '李业务', at: '2026-10-12', reason: '鞋品退货率口径特殊' },
      { sku: 'SN-26A-1008', brand: '森马', mid: '羽绒服', type: '白名单强制进池', op: '王业务', at: '2026-10-20', reason: 'N3 销售周期不适合，人工排除' },
      { sku: 'SN-26B-2009', brand: '巴拉', mid: '家居服', type: '黑名单', op: '李业务', at: '2026-10-25', reason: '库存压力低（N4 本期不自动判定）' }
    ],
    split: { maxItems: 100, key: 'category', note: 'T1 实测未回前保守取 100；实测回来只改本配置，不改表结构' }
  };

  // ===== RBAC（§2） =====
  var RBAC = [
    { role: '业务运营（品牌/渠道）', can: '白名单增删、圈款阈值、价格带开关、生成新版本、创建同步工单', cannot: '改档补偿金额、改预算' },
    { role: '财务/毛利负责人', can: '档位毛利率区间、目标补偿额、日/周预算', cannot: '改白名单' },
    { role: '配置执行员', can: '领取同步工单、回填平台方案 ID、导入平台清单', cannot: '改任何规则' },
    { role: '数据分析', can: '查看/导出、维护基准表与效果回流、实验分组', cannot: '发布策略' },
    { role: '系统管理员', can: '权限、字典（售后原因/价格带上限）、调度与告警订阅', cannot: '修改业务规则参数' },
    { role: '只读观察者（管理层）', can: '总览看板', cannot: '其余全部' }
  ];

  // ===== 调度 J1~J8（§4） =====
  var JOBS = [
    { code: 'J1', name: '指标快照生成', freq: '周一 02:00', key: 'snapshot_week', last: '2026-10-26 02:00', result: '成功', cost: '8m12s', status: 'SUCCESS', fail: '延迟重试 4 次（每 2h），08:00 仍缺则不生成新版本并告警' },
    { code: 'J2', name: '品类基准计算', freq: '周一 03:00', key: 'snapshot_week', last: '2026-10-26 03:00', result: '成功', cost: '3m40s', status: 'SUCCESS', fail: '同上；样本款数 < 30 标记不可用并触发全店分位退化' },
    { code: 'J3', name: '打档 + 策略生成', freq: '周一 04:00', key: 'week + ruleVer + tierVer', last: '2026-10-26 04:00', result: '成功', cost: '12m26s', status: 'SUCCESS', fail: '重跑覆盖式，保留 version 血缘' },
    { code: 'J4', name: '门检', freq: '随 J3', key: '同上', last: '2026-10-26 04:12', result: 'G3/G4 阻断', cost: '1m08s', status: 'BLOCKED', fail: '阻断，置 GUARD_BLOCKED，不发工单' },
    { code: 'J5', name: '回读校验', freq: '周三 10:00 + 手动', key: 'import_batch', last: '2026-10-28 10:00', result: '1 条不一致', cost: '0m52s', status: 'WARN', fail: 'VERIFY_FAILED + 告警 + 冻结下周发布' },
    { code: 'J6', name: '零下发扫描', freq: '每日 09:00', key: 'stat_date', last: '2026-10-28 09:00', result: '3 条命中', cost: '0m18s', status: 'WARN', fail: '告警并给三因诊断' },
    { code: 'J7', name: '效果回流导入', freq: '日/周', key: 'stat_date + scheme_ext_id', last: '2026-10-28 08:30', result: '成功', cost: '1m02s', status: 'SUCCESS', fail: '重复导入 upsert 覆盖并留 source 轨迹' },
    { code: 'J8', name: '版本归档', freq: '月', key: '—', last: '2026-10-01 03:30', result: '成功', cost: '2m14s', status: 'SUCCESS', fail: '仅归档 RETIRED 与 12 周前快照' }
  ];

  var ALERTS = [
    { obj: 'G3 一致性', level: '阻断', msg: '2 个商品同时挂在 legacy 与本期策略，发布被拦截', at: '2026-10-26 04:12', sub: '业务运营, 系统管理员' },
    { obj: 'G5 回读', level: '阻断', msg: 'WD20261026007 item_list_hash 不一致，下周发布已冻结', at: '2026-10-28 10:00', sub: '配置执行员, 业务运营' },
    { obj: 'G6 原因下线', level: '重要', msg: '存量 legacy 方案引用已下线品质类原因，自动 DISABLED', at: '2026-10-27 11:00', sub: '系统管理员' },
    { obj: 'G9 零下发', level: '重要', msg: '3 条启用策略连续 ≥3 天零下发，已生成三因诊断', at: '2026-10-28 09:00', sub: '业务运营, 数据分析' },
    { obj: '工单堆积', level: '重要', msg: '待领取工单 4 张，堆积时长 26h（采纳度仪表）', at: '2026-10-28 12:00', sub: '配置执行员' },
    { obj: 'TIER_DEGENERATED', level: '提示', msg: '巴拉 L/YM 在 50-100 元带补偿同值，已合并档位', at: '2026-10-26 04:15', sub: '财务/毛利负责人' }
  ];

  // ===== P1 总览聚合 =====
  var OVERVIEW = {
    week: WEEK,
    version: VERSION,
    prevVersion: PREV_VERSION,
    generatedAt: '2026-10-26 04:12',
    checkedAt: '2026-10-28 10:00',
    snapshotSku: 1286,
    poolSku: 742,
    platformItems: 8214,
    pendingTasks: 4,
    taskBacklogHours: 26,
    lastEffect: { rate: 31.2, recovered: 486200, spending: 71350, deliver: 18420 },
    adoptTrend: +2.4,
    recoverTrend: +8.6,
    spendTrend: -3.1,
    deliverTrend: +5.2
  };

  // ===== 挽单商品池补充指标（大数据侧算好后回流的实付分位与本周动态） =====
  // paidP50 是价格带切分的唯一依据（§5.3：用平均值会把带切错）；change 为池子本周进出动态
  var SKU_EXTRA = {
    'SN-26A-1001': { paidP25: 219, paidP50: 268, paidP75: 349, change: '维持' },
    'SN-26A-1002': { paidP25: 128, paidP50: 156, paidP75: 188, change: '维持' },
    'SN-26A-1003': { paidP25: 165, paidP50: 198, paidP75: 236, change: '移出' },
    'SN-26B-2001': { paidP25: 112, paidP50: 138, paidP75: 172, change: '维持' },
    'SN-26B-2002': { paidP25: 118, paidP50: 143, paidP75: 176, change: '新进池' },
    'SN-26B-2003': { paidP25: 59,  paidP50: 72,  paidP75: 88,  change: '维持' },
    'SN-26C-3001': { paidP25: 69,  paidP50: 88,  paidP75: 96,  change: '维持' },
    'SN-26C-3002': { paidP25: 246, paidP50: 312, paidP75: 372, change: '维持' },
    'SN-26C-3003': { paidP25: 132, paidP50: 161, paidP75: 194, change: '维持' },
    'SN-26A-1004': { paidP25: 205, paidP50: 248, paidP75: 296, change: '维持' },
    'SN-26B-2004': { paidP25: 0,   paidP50: 0,   paidP75: 0,   change: '维持' },
    'SN-26A-1005': { paidP25: 71,  paidP50: 92,  paidP75: 99,  change: '维持' }
  };

  // 按 §5.3 计算式补：命中策略带 → 带内最保守上限 cap_band → 建议补偿上限
  function pickBand(p50) {
    for (var i = 0; i < BANDS.length; i++) {
      if (p50 >= BANDS[i].lower && p50 < BANDS[i].upper) return BANDS[i];
    }
    return null;
  }
  SKU_LABELS.forEach(function(r) {
    var ex = SKU_EXTRA[r.sku] || {};
    r.paid = Math.round(r.ship * 0.93);          // 成交件数：仅作旁证，圈款口径用发货件数
    r.paidP25 = ex.paidP25 || 0;
    r.paidP50 = ex.paidP50 || 0;
    r.paidP75 = ex.paidP75 || 0;
    r.change = ex.change || '维持';
    r.retDone = Math.round(r.retApply * 0.92);   // 退货件数（完成口径），申请数仅作旁证
    var b = r.paidP50 ? pickBand(r.paidP50) : null;
    r.band = r.label === 'Y' && b ? b.label : '';
    var t = TIERS.filter(function(x) { return x.code === r.tier; })[0];
    if (r.label === 'Y' && b && t) {
      var capBand = Math.floor(b.safety * b.maxRatio * b.lower * 10) / 10;
      r.cap = Math.min(t.target, capBand);
      r.capBand = capBand;
    } else {
      r.cap = null;
      r.capBand = null;
    }
    // 挽单 / 不挽：由判据标签映射而来，不挽必须带原因（不允许“不知道为什么不挽”）
    r.tag = r.label === 'Y' ? 'WD' : 'NOWD';
    r.prevTag = r.prev === 'Y' ? 'WD' : 'NOWD';
    r.tagReason = r.tag === 'WD' ? '' : notWdReason(r);
  });

  function notWdReason(r) {
    if (r.skip === 'BLACKLIST') return '业务黑名单排除（内衣类等贴身衣物）';
    if (r.skip === 'NO_PLATFORM_ITEM') return '无平台商品映射，不能静默入池';
    if (r.skip === 'BASELINE_MISSING') return '同品类基准缺失，无法计算倍数';
    if (r.skip === 'SAMPLE_INSUFFICIENT') return '销售件数不在判定区间内';
    if (r.skip === 'MARGIN_BELOW') return '毛利率低于判定区间下界';
    if (r.label === 'N2') return '退货率高于判定区间上界，先排查商品与直播表达';
    if (r.label === 'N1') return '退货率低于判定区间下界';
    return '不满足判定区间';
  }

  // 商品池元信息（数据由大数据周度批处理产出，页面只读不实时算）
  var POOL = {
    week: WEEK,
    version: VERSION,
    snapshotAt: '2026-10-26 02:08',
    labeledAt: '2026-10-26 04:12',
    nextRun: '2026-11-02 02:00（下周一凌晨）',
    source: '内网大数据：商品主数据 / 交易履约 / 售后退款 / 财务毛利 → 商品指标快照（每周一冻结一个版本）',
    totalSku: 1286,
    inPool: 742,
    newIn: 96,
    movedOut: 132,
    needMapping: 4,
    window: '近 30 天滚动 ｜ 基准窗口 90 天',
    tierDist: { YH: 214, YM: 306, L: 222 },
    // 挽单标签：随周度批处理 J3 动态更新，不挽必须带原因
    tagVersion: 'tag-v12（圈款规则 v3 + 档表 v4）',
    tagUpdatedAt: '2026-10-26 04:12',
    tagNextAt: '2026-11-02 04:12',
    tagCycle: '每周一 04:00 随快照重算标签；周内不翻转，人工改标走黑/白名单且下周生效',
    wdCnt: 742,
    nowdCnt: 544,
    toWd: 96,
    toNowd: 132,
    nowdDist: { '退货率低于基准': 268, '销量样本不足': 96, '毛利率低于最低线': 74, '退货率异常 N2': 42, '黑名单排除': 38, '基准缺失': 18, '无平台映射': 8 }
  };

  // ===== 商品判定策略（商品池「是否挽单」标签的生产者，由业务维护）：主表 + 详情编辑 =====
  var TAG_SHOPS = [
    { code: 'DY-S001', name: '森马旗舰店', brand: '森马' },
    { code: 'DY-S002', name: '巴拉旗舰店', brand: '巴拉' },
    { code: 'DY-S003', name: '马卡乐旗舰店', brand: '马卡乐' },
    { code: 'DY-S004', name: '森马奥莱店', brand: '森马/巴拉' }
  ];

  var TAG_STATUS = { DRAFT: '草稿', ACTIVE: '生效中', PENDING: '待生效', DISABLED: '已停用' };

  // 品牌 → 默认店铺（方案需明确同步到哪个店铺）
  function shopByBrand(brand) {
    var hit = TAG_SHOPS.filter(function(s) { return String(s.brand).split('/').indexOf(brand) > -1; })[0];
    return hit || TAG_SHOPS[0];
  }

  // 判定维度参数：每个维度只有一个参数，形式为区间范围（上限为空表示无上限）
  function tagDims(over) {
    var base = {
      rate:   { lo: 1.00, hi: 1.50 },
      sales:  { lo: 200,  hi: 5000 },
      margin: { lo: 45,   hi: null },
      midCat: { include: [], exclude: [] }
    };
    if (!over) return base;
    Object.keys(over).forEach(function(k) { if (base[k]) Object.assign(base[k], over[k]); });
    return base;
  }

  // 商品挽单判定策略：一条策略只对应一个店铺；编号规则 PD + 年月日 + 3位流水
  var TAG_RULES = [
    {
      id: 'PD20260818001', name: '森马旗舰店挽单判定策略', shopCode: 'DY-S001', shopName: '森马旗舰店',
      dims: tagDims(), status: 'ACTIVE', skuCnt: 620,
      remark: '主力店铺策略，三个维度均沿用默认区间',
      createdBy: '王业务', createdAt: '2026-08-18 10:00', updatedBy: '王业务（品牌/渠道运营）', updatedAt: '2026-10-19 16:20',
      audit: [
        { at: '2026-10-19 16:20', by: '王业务（品牌/渠道运营）', obj: 'dims.margin', txt: '毛利率判定区间 42% ~ 无上限 → 45% ~ 无上限' },
        { at: '2026-10-12 10:05', by: '王业务（品牌/渠道运营）', obj: 'dims.rate', txt: '退货率判定区间 0.95× ~ 1.50× → 1.00× ~ 1.50×' },
        { at: '2026-09-21 09:12', by: '王业务（品牌/渠道运营）', obj: 'dims.sales', txt: '销售件数判定区间 150件 ~ 5000件 → 200件 ~ 5000件（对齐发货口径）' }
      ]
    },
    {
      id: 'PD20260820001', name: '巴拉旗舰店挽单判定策略', shopCode: 'DY-S002', shopName: '巴拉旗舰店',
      dims: tagDims({ sales: { lo: 150 }, midCat: { include: ['针织上衣', '连衣裙', '外套'], exclude: ['配饰'] } }), status: 'ACTIVE', skuCnt: 430,
      remark: '童装基数小，销售件数区间下界下调；中类仅包含针织上衣/连衣裙/外套，排除配饰',
      createdBy: '李业务', createdAt: '2026-08-20 09:30', updatedBy: '李业务（品牌/渠道运营）', updatedAt: '2026-10-15 11:20',
      audit: [
        { at: '2026-10-15 11:20', by: '李业务（品牌/渠道运营）', obj: 'dims.midCat', txt: '商品中类 包含[不限] 排除[无] → 包含[针织上衣、连衣裙、外套] 排除[配饰]' },
        { at: '2026-10-15 11:20', by: '李业务（品牌/渠道运营）', obj: 'dims.sales', txt: '销售件数判定区间 200件 ~ 5000件 → 150件 ~ 5000件' }
      ]
    },
    {
      id: 'PD20260905001', name: '马卡乐旗舰店挽单判定策略', shopCode: 'DY-S003', shopName: '马卡乐旗舰店',
      dims: tagDims({ rate: { lo: 1.10, hi: 1.50 }, sales: { lo: 150, hi: 4000 } }), status: 'ACTIVE', skuCnt: 236,
      remark: '合伙人渠道基数低：退货率区间下界抬到 1.10× 防误判',
      createdBy: '李业务', createdAt: '2026-09-05 10:10', updatedBy: '王业务（品牌/渠道运营）', updatedAt: '2026-10-10 15:30',
      audit: [
        { at: '2026-10-10 15:30', by: '王业务（品牌/渠道运营）', obj: 'dims.rate', txt: '退货率判定区间 1.00× ~ 1.50× → 1.10× ~ 1.50×（基数低防误判）' }
      ]
    },
    {
      id: 'PD20260912001', name: '森马奥莱店挽单判定策略', shopCode: 'DY-S004', shopName: '森马奥莱店',
      dims: tagDims({ rate: { lo: 1.20, hi: 1.60 }, sales: { lo: 180, hi: 3000 }, margin: { lo: 38, hi: null } }),
      status: 'DISABLED', skuCnt: 180,
      remark: '清仓期价格失真且补偿易被套，已于 2026-10-08 停用',
      createdBy: '王业务', createdAt: '2026-09-12 16:00', updatedBy: '王业务（品牌/渠道运营）', updatedAt: '2026-10-08 09:40',
      audit: [
        { at: '2026-10-08 09:40', by: '王业务（品牌/渠道运营）', obj: 'status', txt: '生效中 → 已停用（清仓款补偿被套风险）' }
      ]
    },
    {
      id: 'PD20261028001', name: '新客占比高店铺试探策略', shopCode: '', shopName: '',
      dims: tagDims({ rate: { lo: 0.90, hi: 1.50 } }), status: 'DRAFT', skuCnt: 0,
      remark: '草稿：待确认适用店铺与毛利率区间后提交生效',
      createdBy: '李业务', createdAt: '2026-10-28 17:20', updatedBy: '李业务（品牌/渠道运营）', updatedAt: '2026-10-28 17:20',
      audit: [
        { at: '2026-10-28 17:20', by: '李业务（品牌/渠道运营）', obj: 'base', txt: '新建草稿策略（未指定店铺，不参与重算）' }
      ]
    }
  ];

  var TAG_RULE_TPL = {
    id: '', name: '', shopCode: '', shopName: '', dims: tagDims(),
    status: 'DRAFT', skuCnt: 0, remark: ''
  };

  // 策略主表与详情页在不同 iframe，编辑结果用 localStorage 打通（与其他模块的演示数据持久化方式一致）
  var TAG_RULE_KEY = 'wd_tag_rules';
  function loadTagRules() {
    try {
      var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(TAG_RULE_KEY);
      if (raw) { var arr = JSON.parse(raw); if (arr && arr.length) return arr; }
    } catch (e) {}
    return null;
  }
  function persistTagRules() {
    try { localStorage.setItem(TAG_RULE_KEY, JSON.stringify(TAG_RULES)); return true; } catch (e) { return false; }
  }
  function reloadTagRules() {
    var s = loadTagRules();
    if (s) {
      // 旧数据兼容：多店铺与已废弃参数 → 单店铺 + 三区间
      s.forEach(function(r) {
        if (!r.shopCode && r.shops) {
          r.shopCode = r.shops[0] || '';
          var sh = TAG_SHOPS.filter(function(x) { return x.code === r.shopCode; })[0];
          r.shopName = sh ? sh.name : '';
        }
        delete r.shops; delete r.productStatus; delete r.excludeMids;
        delete r.itemCnt; delete r.hitWd; delete r.hitNowd; delete r.effective; delete r.version;
        var d = r.dims || {};
        // 旧编号 WD-PR-0NN → PD + 创建年月日 + 3位流水
        if (/^WD-PR-\d{3}$/.test(String(r.id || ''))) {
          var day = String(r.createdAt || '').replace(/[^0-9]/g, '').slice(0, 8) || '20261028';
          r.id = 'PD' + day + '001';
        }
        // 旧编号 WD+年月日+3位流水 → PD+年月日+3位流水（存量 localStorage 兼容）
        if (/^WD\d{8}\d{3}$/.test(String(r.id || ''))) {
          r.id = 'PD' + String(r.id).slice(2);
        }
        // 区间参数归一化：已是 lo/hi 的直接沿用（不得用默认值覆盖已保存的下界）；仅在命中旧字段时才换算
        function pick(group, oldKey, defLo, defHi, oldHiKey) {
          var g = d[group] || {};
          if (g.lo !== undefined || g.hi !== undefined) {
            return { lo: g.lo === undefined ? defLo : g.lo, hi: g.hi === undefined ? defHi : g.hi };
          }
          return {
            lo: g[oldKey] !== undefined ? g[oldKey] : defLo,
            hi: oldHiKey ? (g[oldHiKey] !== undefined ? g[oldHiKey] : defHi) : defHi
          };
        }
        r.dims = {
          rate:   pick('rate', 'enter', 1.00, 1.50, 'abnormal'),
          sales:  pick('sales', 'minShip', 200, 5000, null),
          margin: pick('margin', 'gMin', 45, null, null),
          midCat: { include: (d.midCat && d.midCat.include) || [],
                    exclude: (d.midCat && d.midCat.exclude) || [] }
        };
      });
      TAG_RULES.length = 0;
      s.forEach(function(r) { TAG_RULES.push(r); });
    }
    return TAG_RULES;
  }
  function resetTagRules() {
    try { localStorage.removeItem(TAG_RULE_KEY); } catch (e) {}
  }
  reloadTagRules();

  // cfg_price_band 全量断点（官方 2026-05-08，实际以后台为准）
  var PRICE_BANDS = [
    { label: '[0,10)', lower: 0, upper: 10, maxRatio: 50 },
    { label: '[10,20)', lower: 10, upper: 20, maxRatio: 41 },
    { label: '[20,50)', lower: 20, upper: 50, maxRatio: 31 },
    { label: '[50,100)', lower: 50, upper: 100, maxRatio: 31 },
    { label: '[100,200)', lower: 100, upper: 200, maxRatio: 21 },
    { label: '[200,300)', lower: 200, upper: 300, maxRatio: 16 },
    { label: '[300,400)', lower: 300, upper: 400, maxRatio: 16 },
    { label: '[400,600)', lower: 400, upper: 600, maxRatio: 16 },
    { label: '[600,800)', lower: 600, upper: 800, maxRatio: 16 },
    { label: '[800,1000)', lower: 800, upper: 1000, maxRatio: 16 },
    { label: '[1000,1500)', lower: 1000, upper: 1500, maxRatio: 11 },
    { label: '[1500,2000)', lower: 1500, upper: 2000, maxRatio: 11 },
    { label: '[2000,3000)', lower: 2000, upper: 3000, maxRatio: 11 },
    { label: '[3000,5000)', lower: 3000, upper: 5000, maxRatio: 11 },
    { label: '[5000,∞)', lower: 5000, upper: null, maxRatio: 16 }
  ];
  var BAND_SAFETY = 0.80;

  // 抖店侧方案字段（由逻辑策略派生，保证“生成的”与“平台上配的”字段一一对应）
  function bandRange(label) {
    if (label === '全店') return [0, null];
    var m = String(label).match(/(\d+)-(\d+)/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, null];
  }
  function planOf(s) {
    var rng = bandRange(s.band), isLegacy = !!s.isLegacy;
    var rows = PRICE_BANDS.filter(function(b) {
      return rng[1] === null ? true : (b.lower >= rng[0] && b.lower < rng[1]);
    }).map(function(b) {
      var capPct = Math.floor(b.maxRatio * BAND_SAFETY);
      return { band: b.label, lower: b.lower, upper: b.upper, maxRatio: b.maxRatio, capPct: capPct,
               raw: s.ratio, suggest: Math.min(s.ratio, capPct), over: false, clamped: s.ratio > capPct };
    });
    return {
      recoverType: isLegacy ? 'smart' : 'custom',
      name: isLegacy ? (s.brand + '全店统一挽回金额方案')
                      : (s.brand + ' ' + s.tier + '档 ' + s.band + ' 实付金额挽留方案'),
      scene: 'after_sale',
      afterSaleTypes: ['退货退款'],
      reasons: s.reasons.slice(),
      productScope: isLegacy ? 'exclude' : 'include',
      crowdScope: 'all',
      ruleType: 'percent',
      amountRows: rows,
      costMode: s.dailyBudget > 0 ? 'limit' : 'all',
      dailyBudget: s.dailyBudget,
      freqText: '每笔子订单最多挽单 1 次',
      source: isLegacy ? '抖店存量导入（source=legacy）' : '本系统 J3 批处理生成'
    };
  }

  // 平台方案ID（同步平台创建成功后回写的单个 ID；未同步为空）
  function deriveSchemeId(s, order) {
    var synced = ['SYNCING','SYNCED_UNVERIFIED','ACTIVE','VERIFY_FAILED','DISABLED'];
    if (synced.indexOf(s.status) === -1) return '';
    return '741289' + String(30000 + order * 137 + 61);
  }

  // 方案状态（业务可见枚举，仅两值）
  var PLAN_STATUS = { ENABLED: '启用', DISABLED: '禁用' };

  // 同步平台状态（方案信息需人工照抄到抖店，回读校验一致才算同步成功）
  var PLAN_SYNC_STATUS = {
    PENDING: { code: 'PENDING', label: '待同步', tone: 'sy-pending', note: '尚未推送到抖店，待执行员照抄配置' },
    SYNCING: { code: 'SYNCING', label: '同步中', tone: 'sy-doing', note: '部分物理方案已回填平台方案ID，尚未全部完成回读校验' },
    SUCCESS: { code: 'SUCCESS', label: '同步成功', tone: 'sy-done', note: '回读 item_list_hash 一致，平台上真实生效' },
    FAILED:  { code: 'FAILED', label: '同步失败', tone: 'sy-fail', note: '回读不一致，已冻结下周发布' }
  };

  // 由策略流转状态推导同步平台状态（保证列表与详情取值一致）
  function syncStatusOf(s) {
    if (s.status === 'DISABLED') return { code: 'PENDING', label: PLAN_SYNC_STATUS.PENDING.label, tone: 'sy-pending',
      note: '方案已禁用，需人工在抖店下线该方案', at: s.updated };
    var map = { DRAFT: 'PENDING', GUARD_PASSED: 'PENDING', PENDING_SYNC: 'PENDING', RETIRED: 'PENDING',
                SYNCING: 'SYNCING', SYNCED_UNVERIFIED: 'SYNCING', ACTIVE: 'SUCCESS', VERIFY_FAILED: 'FAILED' };
    var code = map[s.status] || 'PENDING';
    return { code: code, label: PLAN_SYNC_STATUS[code].label, tone: PLAN_SYNC_STATUS[code].tone,
             note: PLAN_SYNC_STATUS[code].note, at: s.updated };
  }

  // 同步失败原因（仅同步失败时有值，其余为空）
  function syncFailReason(s) {
    if (s.status !== 'VERIFY_FAILED') return '';
    return '回读 item_list_hash 不一致：平台缺少 1 个商品ID（DY_3829107755），已冻结下周发布';
  }

  // 操作日志流水（时间、操作人、操作类型、变动内容）
  function seedLogs(s) {
    var isLegacy = !!s.isLegacy;
    var rows = [
      { at: s.createdAt, by: s.createdBy, act: '创建方案',
        detail: isLegacy ? '抖店存量方案导入（source=legacy），标记待归因剥离'
          : '周一 J3 批处理生成：档位 ' + s.tier + ' × 策略带 ' + s.band + '，商品 ' + s.itemCnt + ' 款 / 物理方案 ' + s.physicalCnt + ' 条' }
    ];
    if (s.status === 'DRAFT') {
      rows.push({ at: s.updated, by: s.updatedBy, act: '保存配置', detail: '草稿未提交，不参与下周批处理' });
      return rows;
    }
    if (s.status !== 'GUARD_PASSED') {
      rows.push({ at: '2026-10-26 04:13', by: '系统（门检 J4）', act: '门检通过',
        detail: 'G1 档位区间互斥无缝、G2 补偿不超平台上限、G3 商品未被多条方案重复覆盖' });
    }
    if (s.schemeId) {
      rows.push({ at: '2026-10-27 09:30', by: '陈执行（配置执行员）', act: '同步平台',
        detail: '在 ' + (s.shopCode || '') + ' ' + (s.shopName || '') + ' 创建抖店方案，回写平台方案ID ' + s.schemeId });
    }
    if (s.status === 'ACTIVE') {
      rows.push({ at: '2026-10-28 10:00', by: '系统（回读 J5）', act: '回读校验通过', detail: 'item_list_hash 一致，方案状态置为生效中' });
    }
    if (s.status === 'VERIFY_FAILED') {
      rows.push({ at: s.updated, by: s.updatedBy, act: '回读校验不一致', detail: s.syncFailReason || '' });
    }
    if (s.status === 'DISABLED') {
      rows.push({ at: s.updated, by: s.updatedBy, act: '禁用方案', detail: '预算临近熔断，人工急停；需同步到抖店下线' });
    }
    if (s.status === 'SYNCED_UNVERIFIED') {
      rows.push({ at: s.updated, by: s.updatedBy, act: '等待回读校验', detail: '已回填平台方案ID，周三 J5 比对 hash 后才能推进为生效中' });
    }
    return rows;
  }

  // 为每条逻辑策略挂上抖店侧方案字段（可被详情页编辑并持久化）
  function initPlans() {
    STRATEGIES.forEach(function(s, order) {
      if (!s.plan) s.plan = planOf(s);
      if (!s.planStatus) s.planStatus = (s.status === 'DISABLED' || s.status === 'DRAFT') ? 'DISABLED' : 'ENABLED';
      var isLegacy = !!s.isLegacy;
      if (!s.createdBy) s.createdBy = isLegacy ? '周执行（存量导入）' : '系统批处理（J3）';
      if (!s.createdAt) s.createdAt = isLegacy ? '2026-10-20 18:00' : '2026-10-26 04:12';
      if (!s.updatedBy) s.updatedBy = s.status === 'VERIFY_FAILED' ? '陈执行（回读校验）'
        : s.status === 'DISABLED' ? '王业务（品牌/渠道运营）' : s.createdBy;
      if (!s.updated) s.updated = s.createdAt;
      // 同步目标店铺：方案必须知道要同步到抖店哪个店铺
      if (!s.shopCode) {
        var sh = shopByBrand(s.brand);
        s.shopCode = sh.code; s.shopName = sh.name;
      }
      // 平台方案ID：单个 ID（兼容旧数据中的 schemeIds 数组）
      if (s.schemeId === undefined) {
        s.schemeId = s.schemeId || (s.schemeIds && s.schemeIds[0]) || deriveSchemeId(s, order + 1);
      }
      delete s.schemeIds;
      if (!s.syncStatus) s.syncStatus = syncStatusOf(s);
      if (s.syncFailReason === undefined) s.syncFailReason = syncFailReason(s);
      if (!s.logs) s.logs = seedLogs(s);
    });
  }
  initPlans();

  var PLAN_KEY = 'wd_plans';
  function loadPlans() {
    try {
      var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(PLAN_KEY);
      if (raw) { var arr = JSON.parse(raw); if (arr && arr.length) return arr; }
    } catch (e) {}
    return null;
  }
  function persistPlans(id) {
    try {
      // 列表与详情在不同 iframe 并行写入：传 id 时只合并回写单条，避免用过期内存数组覆盖另一边的修改
      var arr = STRATEGIES;
      if (id) {
        var saved = loadPlans() || STRATEGIES;
        var target = STRATEGIES.filter(function(s){ return s.id === id; })[0];
        var idx = -1;
        saved.forEach(function(s, i) { if (s.id === id) idx = i; });
        arr = saved.slice();
        // 保留原有顺序，只在不存在时追加（避免单条合并把记录排到尾部）
        if (idx > -1) { if (target) arr[idx] = target; }
        else if (target) arr.push(target);
      }
      localStorage.setItem(PLAN_KEY, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  }
  function reloadPlans() {
    var p = loadPlans();
    if (p) { STRATEGIES.length = 0; p.forEach(function(s) { STRATEGIES.push(s); }); }
    return STRATEGIES;
  }
  function resetPlans() { try { localStorage.removeItem(PLAN_KEY); } catch (e) {} }
  reloadPlans();
  initPlans();

  return {
    WEEK: WEEK, VERSION: VERSION, PREV_VERSION: PREV_VERSION,
    BRANDS: BRANDS, TIERS: TIERS, BANDS: BANDS,
    STRATEGY_STATUS: STRATEGY_STATUS, LABELS: LABELS, TASK_STATUS: TASK_STATUS, ACTIONS: ACTIONS,
    GUARDS: GUARDS, STRATEGIES: STRATEGIES, SKU_LABELS: SKU_LABELS, POOL: POOL, POOL_TAG: POOL_TAG, SYNC_TASKS: SYNC_TASKS,
    CHECKS: CHECKS, DIFFS: DIFFS,
    EFFECT_GROUPS: EFFECT_GROUPS, EFFECT_TREND: EFFECT_TREND, EFFECT_DRILL: EFFECT_DRILL, ZERO_DELIVER: ZERO_DELIVER,
    RULES: RULES, RBAC: RBAC, JOBS: JOBS, ALERTS: ALERTS, OVERVIEW: OVERVIEW,
    PRICE_BANDS: PRICE_BANDS, BAND_SAFETY: BAND_SAFETY, planOf: planOf, bandRange: bandRange,
    shopByBrand: shopByBrand, deriveSchemeId: deriveSchemeId,
    PLAN_STATUS: PLAN_STATUS, PLAN_SYNC_STATUS: PLAN_SYNC_STATUS, syncStatusOf: syncStatusOf, syncFailReason: syncFailReason, initPlans: initPlans,
    persistPlans: persistPlans, reloadPlans: reloadPlans, resetPlans: resetPlans,
    TAG_RULES: TAG_RULES, TAG_SHOPS: TAG_SHOPS, TAG_STATUS: TAG_STATUS, TAG_RULE_TPL: TAG_RULE_TPL, tagDims: tagDims,
    persistTagRules: persistTagRules, reloadTagRules: reloadTagRules, resetTagRules: resetTagRules
  };
})();

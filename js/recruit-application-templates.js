(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RecruitApplicationTemplates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var BUSINESS_TYPES = [
    { value: 'DP', label: 'DP', group: 'dp', desc: '完整准入、规划、合同与保证金流程' },
    { value: '达播达人', label: '达播达人', group: 'talent', desc: '达人主体直接进入供应商与合同流程' },
    { value: '达播机构', label: '达播机构', group: 'talent', desc: '机构主体补充达人矩阵与履约能力' },
    { value: '客户KOC', label: '客户 KOC', group: 'koc', desc: '客户自有 KOC 资源合作' },
    { value: '联营KOC', label: '联营 KOC', group: 'koc', desc: '双方联合运营 KOC 项目' },
    { value: '素人KOC', label: '素人 KOC', group: 'koc', desc: '个人内容创作者轻量入驻' }
  ];

  var BRANDS = [
    { value: '巴拉', label: '巴拉' },
    { value: '迷你', label: '迷你' },
    { value: '森马', label: '森马' }
  ];

  var WORKFLOWS = {
    dp: [
      { key: 'application_material', title: '入驻资料提交', owner: '客户' },
      { key: 'application_review', title: '运营审核入驻资料', owner: '运营' },
      { key: 'project_plan', title: '项目规划', owner: '客户' },
      { key: 'project_review', title: '运营审核项目规划', owner: '运营' },
      { key: 'supplier', title: '供应商申请入驻', owner: '系统/运营' },
      { key: 'supplier_review', title: '运营审核供应商准入', owner: '运营' },
      { key: 'contract', title: '选择合同类型并网签', owner: '客户/运营' },
      { key: 'deposit', title: '提交保证金', owner: '客户' },
      { key: 'account', title: '录入账号信息', owner: '客户/运营' },
      { key: 'redline', title: '阅读红线告知书', owner: '客户' }
    ],
    talent: [
      { key: 'supplier', title: '供应商申请入驻', owner: '系统/运营' },
      { key: 'supplier_review', title: '运营审核供应商准入', owner: '运营' },
      { key: 'contract', title: '达人类合同网签', owner: '客户/运营' },
      { key: 'account', title: '录入账号信息', owner: '客户/运营' },
      { key: 'redline', title: '阅读红线告知书', owner: '客户' }
    ],
    koc: [
      { key: 'supplier', title: '供应商申请入驻', owner: '系统/运营' },
      { key: 'supplier_review', title: '运营审核供应商准入', owner: '运营' },
      { key: 'contract', title: 'KOC 类合同网签', owner: '客户/运营' },
      { key: 'account', title: '录入账号信息', owner: '客户/运营' },
      { key: 'redline', title: '阅读红线告知书', owner: '客户' }
    ]
  };

  var TYPE_FIELDS = {
    'DP': [
      { key: 'company_name', label: '合作主体公司', type: 'text', required: true, placeholder: '请输入营业执照上的公司全称' },
      { key: 'operation_years', label: '电商运营年限', type: 'number', required: true, placeholder: '请输入运营年限' },
      { key: 'team_size', label: '项目团队人数', type: 'number', required: true, placeholder: '请输入预计投入人数' },
      { key: 'annual_gmv_target', label: '年度 GMV 目标（万元）', type: 'number', required: true, placeholder: '请输入年度目标' }
    ],
    '达播达人': [
      { key: 'talent_name', label: '达人名称', type: 'text', required: true, placeholder: '请输入达人实名或常用名称' },
      { key: 'fans_count', label: '全网粉丝数', type: 'number', required: true, placeholder: '请输入粉丝总数' },
      { key: 'content_category', label: '主要内容类目', type: 'text', required: true, placeholder: '如服饰穿搭、母婴好物' },
      { key: 'cooperation_case', label: '代表合作案例', type: 'textarea', required: true, placeholder: '请简述代表品牌及合作成果' }
    ],
    '达播机构': [
      { key: 'agency_name', label: '机构名称', type: 'text', required: true, placeholder: '请输入机构全称' },
      { key: 'signed_talent_count', label: '签约达人数', type: 'number', required: true, placeholder: '请输入签约达人数' },
      { key: 'core_category', label: '核心经营类目', type: 'text', required: true, placeholder: '请输入机构核心类目' },
      { key: 'cooperation_case', label: '机构代表案例', type: 'textarea', required: true, placeholder: '请简述机构代表案例与结果' }
    ],
    '客户KOC': [
      { key: 'company_name', label: '客户主体公司', type: 'text', required: true, placeholder: '请输入客户主体公司' },
      { key: 'koc_count', label: '可合作 KOC 数量', type: 'number', required: true, placeholder: '请输入可合作人数' },
      { key: 'coverage_city', label: '主要覆盖区域', type: 'text', required: true, placeholder: '请输入主要城市或区域' },
      { key: 'content_plan', label: '内容合作计划', type: 'textarea', required: true, placeholder: '请说明内容形式与发布节奏' }
    ],
    '联营KOC': [
      { key: 'operation_team', label: '联营团队名称', type: 'text', required: true, placeholder: '请输入联营团队名称' },
      { key: 'koc_count', label: '首期 KOC 数量', type: 'number', required: true, placeholder: '请输入首期计划人数' },
      { key: 'annual_gmv_target', label: '年度 GMV 目标（万元）', type: 'number', required: true, placeholder: '请输入年度目标' },
      { key: 'joint_plan', label: '联营分工方案', type: 'textarea', required: true, placeholder: '请说明双方投入与职责分工' }
    ],
    '素人KOC': [
      { key: 'real_name', label: '申请人姓名', type: 'text', required: true, placeholder: '请输入真实姓名' },
      { key: 'content_category', label: '擅长内容方向', type: 'text', required: true, placeholder: '如穿搭、测评、生活方式' },
      { key: 'monthly_content_count', label: '月均内容发布量', type: 'number', required: true, placeholder: '请输入月均发布数量' },
      { key: 'sample_link', label: '代表内容链接', type: 'url', required: true, placeholder: '请输入公开视频或主页链接' }
    ]
  };

  var BRAND_FIELDS = {
    '巴拉': [{ key: 'brand_note', label: '巴拉目标客群与童装经验', type: 'textarea', required: true, placeholder: '请说明目标客群及童装类目经验' }],
    '迷你': [{ key: 'brand_note', label: '迷你主推产品线', type: 'text', required: true, placeholder: '请输入计划主推的产品线' }],
    '森马': [{ key: 'brand_note', label: '森马重点合作渠道', type: 'select', required: true, options: ['抖音', '视频号', '快手', '小红书'] }]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function findByValue(list, value) {
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i];
    return null;
  }

  function getTemplate(type, brand) {
    var typeInfo = findByValue(BUSINESS_TYPES, type);
    if (!typeInfo) throw new Error('Unsupported business type: ' + type);
    if (!findByValue(BRANDS, brand)) throw new Error('Unsupported brand: ' + brand);
    return {
      key: typeInfo.group + ':' + type + ':' + brand,
      version: '1.0',
      businessType: type,
      brand: brand,
      workflowKey: typeInfo.group,
      description: typeInfo.desc,
      fields: clone(TYPE_FIELDS[type]),
      brandFields: clone(BRAND_FIELDS[brand]),
      workflowNodes: clone(WORKFLOWS[typeInfo.group])
    };
  }

  function getFieldLabel(key, type, brand) {
    var template = getTemplate(type, brand);
    var fields = template.fields.concat(template.brandFields);
    for (var i = 0; i < fields.length; i++) if (fields[i].key === key) return fields[i].label;
    return key;
  }

  return {
    BUSINESS_TYPES: clone(BUSINESS_TYPES),
    BRANDS: clone(BRANDS),
    getTemplate: getTemplate,
    getFieldLabel: getFieldLabel
  };
});

const test = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../js/recruit-application-templates.js');

test('exposes all supported business types and brands', () => {
  assert.deepEqual(templates.BUSINESS_TYPES.map(item => item.value), [
    'DP', '达播达人', '达播机构', '客户KOC', '联营KOC', '素人KOC'
  ]);
  assert.deepEqual(templates.BRANDS.map(item => item.value), ['巴拉', '迷你', '森马']);
});

test('resolves every business type and brand combination', () => {
  templates.BUSINESS_TYPES.forEach(type => {
    templates.BRANDS.forEach(brand => {
      const template = templates.getTemplate(type.value, brand.value);
      assert.equal(template.businessType, type.value);
      assert.equal(template.brand, brand.value);
      assert.ok(template.fields.length > 0);
      assert.ok(template.brandFields.length > 0);
      assert.ok(template.workflowNodes.length > 0);
    });
  });
});

test('resolves distinct workflow templates by business type', () => {
  const dp = templates.getTemplate('DP', '巴拉');
  const talent = templates.getTemplate('达播达人', '巴拉');
  const koc = templates.getTemplate('客户KOC', '巴拉');

  assert.equal(dp.workflowKey, 'dp');
  assert.equal(talent.workflowKey, 'talent');
  assert.equal(koc.workflowKey, 'koc');
  assert.ok(dp.workflowNodes.some(node => node.key === 'deposit'));
  assert.ok(!talent.workflowNodes.some(node => node.key === 'deposit'));
  assert.ok(!koc.workflowNodes.some(node => node.key === 'project_plan'));
});

test('merges type and brand fields without sharing mutable state', () => {
  const first = templates.getTemplate('达播机构', '森马');
  const second = templates.getTemplate('达播机构', '森马');

  assert.ok(first.fields.some(field => field.key === 'agency_name'));
  assert.equal(first.brandFields[0].key, 'brand_note');
  assert.match(first.brandFields[0].label, /森马/);
  first.fields[0].label = 'changed';
  first.workflowNodes.pop();
  assert.notEqual(second.fields[0].label, 'changed');
  assert.notEqual(first.workflowNodes.length, second.workflowNodes.length);
});

test('rejects unknown business types or brands', () => {
  assert.throws(() => templates.getTemplate('未知类型', '巴拉'), /Unsupported business type/);
  assert.throws(() => templates.getTemplate('DP', '未知品牌'), /Unsupported brand/);
});

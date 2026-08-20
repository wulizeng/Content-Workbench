const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

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

test('application page contains the template selection and persistence contract', () => {
  const html = read('pages/recruit/apply.html');
  ['templateSelector', 'businessTypeChoices', 'brandChoices', 'templatePreview', 'dynamicFields'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"`));
  });
  ['business_type', 'template_key', 'template_version', 'workflow_nodes', 'dynamic_fields'].forEach(field => {
    assert.match(html, new RegExp(`${field}:`));
  });
  assert.match(html, /brand:\s*selectedBrand/);
  assert.doesNotMatch(html, /recordBrandValue/);
  assert.match(html, /currentUser\s*&&\s*currentUser\.phone/);
  assert.match(html, /recruit-application-templates\.js/);
  compileInlineScripts('pages/recruit/apply.html');
});

test('application list and detail views expose template metadata', () => {
  const mine = read('pages/recruit/mine.html');
  const list = read('pages/recruit/list.html');
  const detail = read('pages/recruit/detail.html');

  assert.match(mine, /a\.business_type/);
  assert.match(list, /id="sBusinessType"/);
  assert.match(list, /id="sBrand"/);
  assert.match(list, /row\.business_type/);
  assert.match(detail, /id="dBusinessType"/);
  assert.match(detail, /id="dWorkflowNodes"/);
  assert.match(detail, /id="dDynamicFields"/);
  assert.match(detail, /currentRecord\.business_type !== 'DP'/);
  assert.match(detail, /skipsProjectPlan/);
  compileInlineScripts('pages/recruit/mine.html');
  compileInlineScripts('pages/recruit/list.html');
  compileInlineScripts('pages/recruit/detail.html');
});

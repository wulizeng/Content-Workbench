/** HTML 文本转义，避免各页面重复维护同一份实现。 */
(function (root) {
  'use strict';
  function escapeHtml(value) {
    if (value === null || value === undefined || value === '') return '';
    var element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
  }
  root.escapeHtml = escapeHtml;
  root.esc = root.esc || escapeHtml;
})(window);

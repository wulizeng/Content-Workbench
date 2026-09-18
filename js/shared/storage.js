/** 轻量本地存储适配器：只负责序列化、默认值和安全读取。 */
(function (root) {
  'use strict';
  function clone(value) { return value === undefined ? value : JSON.parse(JSON.stringify(value)); }
  function load(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      if (raw !== null && raw !== '') return JSON.parse(raw);
    } catch (error) {}
    return clone(fallback);
  }
  function save(key, value) {
    try { if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { return false; }
    return true;
  }
  function remove(key) {
    try { if (root.localStorage) root.localStorage.removeItem(key); } catch (error) { return false; }
    return true;
  }
  root.AppStorage = { load: load, save: save, remove: remove, clone: clone };
})(window);

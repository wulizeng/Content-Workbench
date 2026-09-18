# 原型工程结构约定

本项目保持静态多页面形态，不引入框架构建链。新页面和被修改的旧页面按以下边界组织：

```text
页面结构       pages/**/*.html
共享样式       css/style.css、css/components.css
业务域样式     css/domains/<domain>.css
共享交互       js/shared/*.js
业务数据       js/domains/<domain>/*-fixtures.js
数据存取       js/domains/<domain>/*-store.js
页面控制器     js/pages/<domain>/<page>.page.js
```

迁移规则：

1. 新增页面直接遵守上述结构，旧页面不做无收益的全量重写。
2. 只把至少被两个页面复用且行为稳定的能力抽到 `js/shared/`。
3. 模拟数据与 localStorage 读写分离：fixtures 只提供默认数据，store 只负责持久化和领域操作。
4. 页面专属逻辑保留在对应的 `.page.js`，不要继续把大型业务脚本堆回 HTML。
5. 每迁移一个业务域，先验证列表、筛选、保存、刷新、移动端布局，再迁移下一批页面。

当前试点：分销枢纽的客户合作、合同、供应商、保证金流水和开票信息列表页。第一阶段已抽取 Toast、HTML 转义、基础组件样式和安全存储适配器，确保行为不变；后续再迁移领域 Store 和页面控制器。

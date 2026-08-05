// 统一权限管理系统
(function(window) {
  'use strict';

  var Auth = {
    // 获取当前登录用户
    getCurrentUser: function() {
      var user = localStorage.getItem('system_current_user');
      return user ? JSON.parse(user) : null;
    },

    // 设置当前登录用户
    setCurrentUser: function(user) {
      localStorage.setItem('system_current_user', JSON.stringify(user));
    },

    // 检查是否已登录
    isAuthenticated: function() {
      return !!this.getCurrentUser();
    },

    // 检查用户角色
    hasRole: function(role) {
      var user = this.getCurrentUser();
      return user && user.role === role;
    },

    // 检查是否有某个权限
    hasPermission: function(permission) {
      var user = this.getCurrentUser();
      if (!user || !user.permissions) return false;
      return user.permissions.indexOf(permission) > -1;
    },

    // 检查是否有任一权限
    hasAnyPermission: function(permissions) {
      var self = this;
      return permissions.some(function(p) { return self.hasPermission(p); });
    },

    // 检查是否有全部权限
    hasAllPermissions: function(permissions) {
      var self = this;
      return permissions.every(function(p) { return self.hasPermission(p); });
    },

    // 退出登录
    logout: function() {
      localStorage.removeItem('system_current_user');
      window.location.href = 'login.html';
    },

    // 要求登录（未登录则跳转）
    requireAuth: function() {
      if (!this.isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },

    // 要求特定角色
    requireRole: function(role) {
      if (!this.requireAuth()) return false;
      if (!this.hasRole(role)) {
        alert('您没有权限访问此页面');
        window.location.href = 'index.html';
        return false;
      }
      return true;
    },

    // 要求特定权限
    requirePermission: function(permission) {
      if (!this.requireAuth()) return false;
      if (!this.hasPermission(permission)) {
        alert('您没有权限执行此操作');
        return false;
      }
      return true;
    },

    // 根据角色过滤申请列表
    filterApplications: function(applications) {
      var user = this.getCurrentUser();
      if (!user) return [];

      if (user.role === 'talent') {
        // 达人只看自己的申请
        return applications.filter(function(app) {
          return app.phone === user.phone;
        });
      } else if (user.role === 'operator' || user.role === 'bd' || user.role === 'admin') {
        // 运营、BD和管理员看全部申请
        return applications;
      }
      return [];
    },

    // 判断是否可以编辑申请
    canEditApplication: function(application) {
      var user = this.getCurrentUser();
      if (!user) return false;

      // 达人只能编辑自己的且状态为"已驳回"的申请
      if (user.role === 'talent') {
        return application.phone === user.phone && application.status === '已驳回';
      }
      return false;
    },

    // 判断是否可以提交项目规划
    canSubmitPlan: function(application) {
      var user = this.getCurrentUser();
      if (!user) return false;

      if (user.role === 'talent') {
        return application.phone === user.phone &&
               (application.status === '待提交项目规划' || application.status === '规划已驳回');
      }
      return false;
    },

    // 判断是否可以审核申请
    canReviewApplication: function() {
      return this.hasPermission('application:approve') || this.hasPermission('application:reject');
    },

    // 判断是否可以审核项目规划
    canReviewPlan: function() {
      return this.hasPermission('plan:review');
    },

    // 根据角色和状态显示操作按钮
    getApplicationActions: function(application) {
      var user = this.getCurrentUser();
      if (!user) return [];

      var actions = [];

      if (user.role === 'talent') {
        // 达人端操作
        if (application.status === '已驳回') {
          actions.push({ label: '修改重提', action: 'edit', type: 'primary' });
        } else if (application.status === '待提交项目规划' || application.status === '规划已驳回') {
          actions.push({ label: '填写项目规划', action: 'plan', type: 'primary' });
        } else if (application.status === '规划审核中' || application.status === '已通过') {
          actions.push({ label: '查看详情', action: 'view', type: 'default' });
        } else {
          actions.push({ label: '审核中', action: 'none', type: 'disabled' });
        }
      } else if (user.role === 'operator' || user.role === 'admin') {
        // 运营/管理员端操作
        if (application.status === '已提交' || application.status === '审核中') {
          actions.push({ label: '审核', action: 'review', type: 'primary' });
        } else if (application.status === '规划审核中') {
          actions.push({ label: '审核项目规划', action: 'review_plan', type: 'primary' });
        } else {
          actions.push({ label: '查看详情', action: 'view', type: 'default' });
        }
      } else if (user.role === 'bd') {
        // BD端操作
        actions.push({ label: '查看详情', action: 'view', type: 'default' });
      }

      return actions;
    },

    // 获取角色权限配置
    getRolePermissions: function(role) {
      var permissions = {
        'talent': ['application:create', 'application:edit_own', 'plan:submit'],
        'operator': ['application:view_all', 'application:approve', 'application:reject', 'plan:review', 'plan:approve', 'plan:reject'],
        'bd': ['application:view_all'],
        'admin': ['application:view_all', 'application:approve', 'application:reject', 'plan:review', 'plan:approve', 'plan:reject', 'system:manage']
      };
      return permissions[role] || [];
    }
  };

  // 导出到全局
  window.Auth = Auth;

})(window);

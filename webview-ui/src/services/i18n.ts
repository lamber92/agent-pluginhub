import { ref, computed } from 'vue';

export type Language = 'zh' | 'en';

const initialLang: Language =
  typeof window !== 'undefined' && window.navigator.language.startsWith('zh') ? 'zh' : 'en';

const currentLang = ref<Language>(initialLang);

const translations = {
  zh: {
    title: 'Agent-PluginHub',
    subtitle: '通用 AI 插件与技能管理器',
    tabs: {
      discover: '插件市场',
      installed: '已安装',
      settings: '源与偏好'
    },
    badges: {
      native: '原生',
      plugin: '📦 插件',
      pluginBundle: '📦 插件包',
      standaloneSkill: '⚡ 单体技能',
      custom: '🛠️ 本地自建',
      market: '集市'
    },
    searchPlaceholder: '搜索插件、技能、标签或作者...',
    searchInstalledPlaceholder: '搜索已安装插件包或技能...',
    allCategories: '全部',
    categories: {
      all: '全部分类',
      development: '编码与开发',
      design: '设计与 UI',
      ai: 'AI 与智能体',
      productivity: '效率与流程',
      data: '数据与数据库',
      devops: '运维与容器',
      security: '安全与审计',
      writing: '文案与写作',
      media: '多媒体处理',
      testing: '测试与质量',
      tools: '工具链',
      utility: '实用工具',
      communication: '协作与沟通',
      custom: '本地自建',
      general: '通用',
      other: '其他'
    },
    runtimes: {
      title: '目标 AI Agent 运行环境',
      desc: '支持 Google Antigravity、OpenCode 与 OpenAI Codex 三生态规范，可智能自动探测或手动锁定',
      auto: '智能自动探测 (Auto-Detect)',
      antigravity: 'Google Antigravity',
      opencode: 'OpenCode',
      codex: 'OpenAI Codex',
      currentDetected: '当前探测结果',
      currentEffective: '当前生效环境',
      globalDir: 'AI Agent 专属配置目录',
      workspaceDir: '当前工作区插件根目录',
      names: {
        antigravity: 'Google Antigravity',
        opencode: 'OpenCode',
        codex: 'OpenAI Codex'
      }
    },
    runtimeSwitchModal: {
      title: '切换目标 AI Agent 运行环境',
      subtitle: '切换环境将变更本地目录扫描路径与市场兼容状态',
      prompt: '确定要将目标 Agent 运行时切换为',
      notice: '系统将重新扫描对应生态的插件目录，并同步市场安装状态。此设置将持久化保存。',
      switching: '正在切换环境并重新加载...',
      confirmBtn: '确认切换',
      switchSuccess: '环境切换成功！'
    },
    statusFilter: {
      all: '全部状态',
      enabled: '🟢 生效中',
      disabled: '🔴 已禁用',
      hasUpdate: '✨ 有更新'
    },
    scopeFilter: {
      all: '全部作用域',
      workspace: '📂 当前工作区',
      agent: '🤖 AI Agent',
      global: '🌐 全局系统'
    },
    sources: {
      all: '全部市场源',
      manage: '源管理',
      addSource: '添加自定义源',
      official: '官方源',
      git: 'Git 仓库',
      url: 'HTTP/API',
      local: '本地目录',
      enabled: '已启用',
      disabled: '已停用'
    },
    actions: {
      install: '安装',
      reinstall: '重新安装',
      installing: '安装中...',
      installed: '已安装',
      hasUpdate: '发现新版本',
      upgradeTo: '升级到',
      updateNow: '立即更新',
      viewDetail: '详情',
      delete: '卸载',
      deleting: '卸载中...',
      enable: '启用',
      disable: '禁用',
      exportZip: '导出 ZIP',
      importZip: '导入 ZIP',
      newSkill: '新建独立技能',
      revealInOS: '在文件夹中定位',
      editInEditor: '在编辑器中打开',
      save: '保存',
      saveChanges: '保存更改',
      confirmAdd: '确认添加',
      cancel: '取消',
      confirm: '确认',
      refresh: '刷新',
      collapse: '收起',
      expand: '展开'
    },
    cards: {
      subSkills: '包含 {count} 个技能',
      subSkillsList: '包含技能',
      subSkillsTag: '技能',
      moreSkills: '+{count}'
    },
    installedView: {
      headerTitle: '已安装插件与技能',
      headerSubtitle: '已纳管 {total} 项能力（{filtered} 项符合筛选条件）',
      workspaceTitle: '📂 工作区插件与技能 (Workspace Scope)',
      agentTitle: '🤖 AI Agent 插件与技能 (Agent Scope)',
      globalTitle: '🌐 全局系统插件与技能 (Global Scope)',
      emptyWorkspace: '当前工作区尚未安装插件或技能',
      emptyWorkspaceDesc: '可在市场中选择插件安装，或点击“新建独立技能”在当前项目中创建。',
      emptyAgent: '暂无 AI Agent 专属插件与技能',
      emptyAgentDesc: 'AI Agent 专属插件为该 Agent 的通用能力，在所有项目中可用。',
      emptyGlobal: '暂无全局系统插件与技能 (~/.agents/plugins/)',
      emptyGlobalDesc: '全局系统插件为操作系统级通用库，支持的 Agent 均可读取。',
      emptyFilter: '没有找到符合筛选条件的插件',
      emptyFilterDesc: '当前筛选组合下无结果，请尝试调整关键词或重置筛选。',
      resetFilters: '重置筛选条件',
      statusEnabled: '生效中',
      statusDisabled: '已禁用',
      nativeBadge: '原生',
      nativePluginTip: '系统原生内置插件，受系统保护禁止删除',
      filterByCategory: '按分类筛选',
      customSkill: '本地自建技能',
      installedInWorkspace: '已安装到工作区',
      installedInAgent: 'AI AGENT 已安装',
      installedInGlobal: 'GLOBAL 已安装',
      expandSection: '展开',
      collapseSection: '收起',
      noMatches: '没有找到符合筛选条件的插件',
      noMatchesDesc: '当前筛选组合下无结果，请尝试调整关键词或重置筛选。',
      noPlugins: '尚未安装任何插件或技能',
      noPluginsDesc: '浏览插件市场，一键安装丰富的 AI Agent 扩展与技能库。',
      browseMarketplace: '浏览插件市场'
    },
    discoverView: {
      emptyTitle: '未找到匹配的插件',
      emptyDesc: '请尝试更换搜索关键词、分类筛选标签，或在“源与偏好”中添加更多 Git 仓库源。'
    },
    sidebarView: {
      openFull: '打开完整插件中心',
      openFullDesc: '在编辑器标签页中浏览、搜索与管理扩展',
      installedCount: '已安装',
      empty: '暂无已安装插件或技能',
      goToDiscover: '前往市场浏览',
      details: '详情',
      custom: '自建',
      market: '集市',
      new: '新建',
      openSkillMd: '在编辑器中打开 SKILL.md',
      openInFolder: '在文件夹中定位',
      deleteSkill: '卸载',
      updateAvailable: '发现新版本，点击更新'
    },
    sourceModal: {
      editTitle: '编辑市场源',
      addTitle: '添加新市场源',
      editSubtitle: '修改插件市场源连接配置',
      addSubtitle: '配置团队或第三方插件市场源',
      sourceName: '市场源名称',
      sourceNamePlaceholder: '例如: 团队内部扩展库',
      sourceType: '市场源类型',
      locationRepo: '仓库地址 / 路径 (例如: https://github.com/obra/superpowers)',
      locationUrl: '清单 URL (例如: https://.../marketplace.json)',
      locationLocal: '本地目录路径',
      branch: '分支 (默认 main)',
      token: 'PAT Token (私有源可选)'
    },
    deleteModal: {
      title: '确认卸载插件',
      subtitle: '卸载后相关文件将从磁盘物理移除',
      prompt: '确定要从当前环境中彻底卸载插件',
      warning: '此操作不可撤销，若有本地自定义修改请先做好备份。',
      irreversible: '此操作将永久删除本地插件目录与文件',
      confirmPrompt: '确定要从',
      currentWorkspace: '当前项目工作区',
      agentEnv: 'AI Agent 专属能力库',
      globalEnv: '操作系统全局系统库 (~/.agents/)',
      confirmPromptEnd: '中彻底卸载插件',
      confirmBtn: '确认卸载',
      confirmDelete: '立即卸载',
      deleting: '正在卸载...',
      cancelBtn: '取消'
    },
    detail: {
      scriptsDetected: '检测到可执行脚本',
      scriptsWarning: '此项目包含以下可执行指令/脚本，请审查确认安全后使用：',
      mcpIncluded: '附带 MCP 工具配置',
      author: '作者',
      homepage: '主页',
      category: '分类',
      source: '来源',
      readDocumentation: '详细指南 (文档)',
      includedSkills: '包含的技能清单',
      tabOverview: '概览与技能清单',
      tabDocs: '完整说明文档',
      commitHash: 'Commit 哈希',
      installedAt: '安装时间',
      installedVersionLabel: '当前已安装版本',
      latestVersionLabel: '市场最新版本',
      updateAvailableTitle: '检测到可用新版本',
      localPath: '本地存储路径',
      runtimeStatus: '运行状态',
      openInEditor: '预览文档',
      revealInFolder: '在文件管理器中打开',
      skillsRoster: '内置技能清单与摘要',
      copySuccess: '已复制到剪贴板！',
      noSkillsFound: '此插件未包含独立子技能目录。',
      loading: '正在加载插件详情...'
    },
    pluginDetailModal: {
      scriptsDetected: '检测到可执行脚本',
      scriptsWarning: '此项目包含以下可执行指令/脚本，请审查确认安全后使用：',
      mcpIncluded: '附带 MCP 工具配置',
      author: '作者',
      homepage: '主页',
      category: '分类',
      source: '来源',
      readDocumentation: '详细指南 (文档)',
      includedSkills: '包含的技能清单',
      tabOverview: '概览与技能清单',
      tabDocs: '完整说明文档',
      commitHash: 'Commit 哈希',
      installedAt: '安装时间',
      localPath: '本地存储路径',
      runtimeStatus: '运行状态',
      openInEditor: '预览文档',
      revealInFolder: '在文件管理器中打开',
      skillsRoster: '内置技能清单与摘要',
      copySuccess: '已复制到剪贴板！',
      noSkillsFound: '此插件未包含独立子技能目录。'
    },
    installModal: {
      title: '安装插件包 (Install Plugin)',
      installing: '正在准备安装',
      targetRuntime: '目标 AI Agent 环境：',
      targetScope: '选择安装作用域：',
      workspaceScopeTitle: '📂 项目工作区级 (Workspace)',
      workspaceScopeDesc: '仅在当前工程项目内生效，随项目 Git 版本受控',
      agentScopeTitle: '🤖 AI Agent 级 (Agent Scope)',
      agentScopeDesc: '赋予该 Agent 专属能力库，在所有项目中通用',
      globalScopeTitle: '🌐 全局系统级 (Global Scope)',
      globalScopeDesc: '安装至操作系统通用目录 (~/.agents/plugins/)，支持的 Agent 均可读取',
      targetWorkspaceFolder: '选择目标工作区文件夹：',
      mcpInclude: '配置配套 MCP 工具链 (Model Context Protocol)',
      mcpDesc: '检测到该插件附带 MCP 服务器配置，安装后将自动合并写入对应 Agent 的配置文件。',
      envVariables: '配置所需环境变量 / Token：',
      enterEnv: '请输入 {key}',
      confirmBtn: '立即安装',
      installingBtn: '正在安装...',
      cancelBtn: '取消'
    },
    createModal: {
      title: '新建本地独立技能',
      subtitle: '快速生成标准 SKILL.md 技能定义脚手架',
      nameLabel: '技能名称 (例如: code-audit):',
      descLabel: '用途与触发描述 (Agent 判定依据):',
      scopeLabel: '创建范围:',
      targetRuntimeLabel: '目标 AI 助手:',
      includeScript: '生成 scripts/ 示例辅助脚本',
      createBtn: '立即创建'
    },
    settingsView: {
      targetRuntimeTitle: 'AI 助手运行环境',
      targetAgentRuntime: '目标 AI 助手 (Target Agent Runtime)',
      targetAgentRuntimeDesc: '指定安装技能与 MCP 自动路由的目标助手目录（默认为自动探测当前 IDE）',
      marketSources: '市场源管理',
      addSourceBtn: '添加新市场源',
      officialBuiltIn: '官方内置',
      sourceToggleOn: '已启用 (点击停用)',
      sourceToggleOff: '已停用 (点击启用)',
      editConfig: '编辑配置',
      deleteSource: '删除市场源',
      deleteModalTitle: '确认移除市场源',
      deleteModalSubtitle: '移除后不影响已安装的本地技能',
      deleteModalPrompt: '确定要从市场源列表中移除',
      confirmRemove: '确认移除',
      saveBtn: '保存设置',
      preferences: '通用偏好与加速',
      preferencesDesc: '网络连接、镜像加速通道与 GitHub 认证',
      networkSettings: '网络与加速通道',
      networkDesc: '网络连接、镜像加速通道与 GitHub 认证',
      sourcesDesc: '管理官方与团队自定义市场源（支持 Git 仓库、API 清单与本地目录）',
      mirrorAcceleration: '启用国内镜像加速 (jsDelivr / GitMirror)',
      mirrorDesc: '加速拉取 GitHub 上的 SKILL.md 与脚本资源',
      githubToken: 'GitHub 个人访问令牌 (PAT)',
      githubTokenDesc: '配置后可突破 GitHub API 未鉴权 60次/小时 的限制',
      proxyUrl: 'HTTP 代理地址',
      proxyUrlDesc: '例如: http://127.0.0.1:7890',
      savedSuccess: '设置已成功保存！'
    }
  },
  en: {
    title: 'Agent-PluginHub',
    subtitle: 'Universal AI Plugin & Skill Manager',
    tabs: {
      discover: 'Marketplace',
      installed: 'Installed',
      settings: 'Settings & Sources'
    },
    badges: {
      native: 'Native',
      plugin: '📦 Plugin',
      pluginBundle: '📦 Plugin Bundle',
      standaloneSkill: '⚡ Skill',
      custom: '🛠️ Custom',
      market: 'Market'
    },
    searchPlaceholder: 'Search plugins, skills, tags, or authors...',
    searchInstalledPlaceholder: 'Search installed plugins or skills...',
    allCategories: 'All',
    categories: {
      all: 'All Categories',
      development: 'Development',
      design: 'Design & UI',
      ai: 'AI & ML',
      productivity: 'Productivity',
      data: 'Data & DB',
      devops: 'DevOps & Containers',
      security: 'Security & Compliance',
      writing: 'Writing & Content',
      media: 'Media',
      testing: 'Testing & QA',
      tools: 'Tools & Utilities',
      utility: 'Utilities',
      communication: 'Communication',
      custom: 'Custom Local',
      general: 'General',
      other: 'Other'
    },
    runtimes: {
      title: 'Target AI Agent Runtime',
      desc: 'Supports Google Antigravity, OpenCode & OpenAI Codex ecosystems with auto-detection or manual lock',
      auto: 'Auto-Detect',
      antigravity: 'Google Antigravity',
      opencode: 'OpenCode',
      codex: 'OpenAI Codex',
      currentDetected: 'Detected Runtime',
      currentEffective: 'Effective Runtime',
      globalDir: 'AI Agent Profile Directory',
      workspaceDir: 'Workspace Plugins Directory',
      names: {
        antigravity: 'Google Antigravity',
        opencode: 'OpenCode',
        codex: 'OpenAI Codex'
      }
    },
    runtimeSwitchModal: {
      title: 'Switch Target AI Agent Runtime',
      subtitle: 'Switching environment will change directory scanning and market status',
      prompt: 'Are you sure you want to switch target runtime to',
      notice: 'The plugin directories will be rescanned and marketplace status will be synchronized. This choice will be saved permanently.',
      switching: 'Switching environment & reloading...',
      confirmBtn: 'Confirm Switch',
      switchSuccess: 'Runtime switched successfully'
    },
    statusFilter: {
      all: 'All Status',
      enabled: '🟢 Active',
      disabled: '🔴 Disabled',
      hasUpdate: '✨ Has Update'
    },
    scopeFilter: {
      all: 'All Scopes',
      workspace: '📂 Workspace',
      agent: '🤖 AI Agent',
      global: '🌐 Global System'
    },
    sources: {
      all: 'All Sources',
      manage: 'Manage Sources',
      addSource: 'Add Custom Source',
      official: 'Official',
      git: 'Git Repo',
      url: 'HTTP/API',
      local: 'Local Folder',
      enabled: 'Enabled',
      disabled: 'Disabled'
    },
    actions: {
      install: 'Install',
      reinstall: 'Reinstall',
      installing: 'Installing...',
      installed: 'Installed',
      hasUpdate: 'Update',
      upgradeTo: 'Upgrade to',
      updateNow: 'Update Now',
      viewDetail: 'Details',
      delete: 'Uninstall',
      deleting: 'Uninstalling...',
      enable: 'Enable',
      disable: 'Disable',
      exportZip: 'Export ZIP',
      importZip: 'Import ZIP',
      newSkill: 'New Standalone Skill',
      revealInOS: 'Reveal in Finder/Explorer',
      editInEditor: 'Open in Editor',
      save: 'Save',
      saveChanges: 'Save Changes',
      confirmAdd: 'Confirm Add',
      cancel: 'Cancel',
      confirm: 'Confirm',
      refresh: 'Refresh',
      collapse: 'Collapse',
      expand: 'Expand'
    },
    cards: {
      subSkills: 'Includes {count} skills',
      subSkillsList: 'Included Skills',
      subSkillsTag: 'Skills',
      moreSkills: '+{count}'
    },
    installedView: {
      headerTitle: 'Installed Plugins & Skills',
      headerSubtitle: 'Managing {total} items ({filtered} matching filter)',
      workspaceTitle: '📂 Workspace Plugins & Skills',
      agentTitle: '🤖 AI Agent Plugins & Skills (Agent Scope)',
      globalTitle: '🌐 Global System Plugins & Skills (Global Scope)',
      emptyWorkspace: 'No plugins or skills installed in current workspace',
      emptyWorkspaceDesc: 'Install from marketplace or click "New Standalone Skill" to create in the current project.',
      emptyAgent: 'No AI Agent profile plugins installed',
      emptyAgentDesc: 'Agent-level plugins are innate capabilities equipped to this AI Agent, available across all projects.',
      emptyGlobal: 'No global system plugins installed (~/.agents/plugins/)',
      emptyGlobalDesc: 'Global system plugins are installed machine-wide and can be read by all supported agents.',
      emptyFilter: 'No items matched filter criteria',
      emptyFilterDesc: 'No items matched the current filter. Try adjusting keywords or resetting filters.',
      resetFilters: 'Clear All Filters',
      statusEnabled: 'Active',
      statusDisabled: 'Disabled',
      nativeBadge: 'Native',
      nativePluginTip: 'System native built-in plugin (protected from deletion)',
      filterByCategory: 'Filter Category',
      customSkill: 'Custom Local Skill',
      installedInWorkspace: 'Installed in Workspace',
      installedInAgent: 'AGENT Installed',
      installedInGlobal: 'GLOBAL Installed',
      expandSection: 'Expand',
      collapseSection: 'Collapse',
      noMatches: 'No plugins found matching filter',
      noMatchesDesc: 'Try adjusting keywords or resetting filters.',
      noPlugins: 'No plugins or skills installed yet',
      noPluginsDesc: 'Browse the marketplace to install AI Agent extensions and skills.',
      browseMarketplace: 'Browse Marketplace'
    },
    discoverView: {
      emptyTitle: 'No Plugins Found',
      emptyDesc: 'Try adjusting search keywords, category filters, or add more Git repository sources in Settings.'
    },
    sidebarView: {
      openFull: 'Open Full Marketplace',
      openFullDesc: 'Browse, search, and install in editor tab',
      installedCount: 'Installed',
      empty: 'No plugins or skills installed yet',
      goToDiscover: 'Discover in Marketplace',
      details: 'Details',
      custom: 'Custom',
      market: 'Market',
      new: 'New',
      openSkillMd: 'Open SKILL.md in Editor',
      openInFolder: 'Reveal in Folder',
      deleteSkill: 'Uninstall',
      updateAvailable: 'New version available, click to update'
    },
    sourceModal: {
      editTitle: 'Edit Source',
      addTitle: 'Add New Source',
      editSubtitle: 'Modify marketplace source connection settings',
      addSubtitle: 'Configure team or third-party plugin marketplace',
      sourceName: 'Source Name',
      sourceNamePlaceholder: 'e.g. Internal Team Skills',
      sourceType: 'Source Type',
      locationRepo: 'Repository URL / Path (e.g. https://github.com/obra/superpowers)',
      locationUrl: 'Manifest URL (e.g. https://.../marketplace.json)',
      locationLocal: 'Local Directory Path',
      branch: 'Branch (default main)',
      token: 'PAT Token (Optional for private repos)'
    },
    deleteModal: {
      title: 'Confirm Uninstall Plugin',
      subtitle: 'Associated files will be physically removed from disk',
      prompt: 'Are you sure you want to completely uninstall plugin',
      warning: 'This action cannot be undone. Please backup any local customizations before uninstalling.',
      irreversible: 'This action will permanently delete local plugin files',
      confirmPrompt: 'Are you sure you want to uninstall plugin from',
      currentWorkspace: 'Current Project Workspace',
      agentEnv: 'AI Agent Profile Library',
      globalEnv: 'Global System Library (~/.agents/)',
      confirmPromptEnd: '',
      confirmBtn: 'Confirm Uninstall',
      confirmDelete: 'Uninstall Now',
      deleting: 'Uninstalling...',
      cancelBtn: 'Cancel'
    },
    detail: {
      scriptsDetected: 'Executable Scripts Detected',
      scriptsWarning: 'This package contains executable scripts/commands. Please audit before execution:',
      mcpIncluded: 'MCP Configuration Included',
      author: 'Author',
      homepage: 'Homepage',
      category: 'Category',
      source: 'Source',
      readDocumentation: 'Documentation (Details)',
      includedSkills: 'Included Skills',
      tabOverview: 'Overview & Skills',
      tabDocs: 'Documentation',
      commitHash: 'Commit Hash',
      installedAt: 'Installed Date',
      installedVersionLabel: 'Currently Installed',
      latestVersionLabel: 'Latest in Market',
      updateAvailableTitle: 'Update Available',
      localPath: 'Storage Path',
      runtimeStatus: 'Runtime Status',
      openInEditor: 'Preview Doc',
      revealInFolder: 'Reveal in OS',
      skillsRoster: 'Included Skills & Capabilities',
      copySuccess: 'Copied to clipboard!',
      noSkillsFound: 'No sub-skills directories found.',
      loading: 'Loading plugin details...'
    },
    pluginDetailModal: {
      scriptsDetected: 'Executable Scripts Detected',
      scriptsWarning: 'This package contains executable scripts/commands. Please audit before execution:',
      mcpIncluded: 'MCP Configuration Included',
      author: 'Author',
      homepage: 'Homepage',
      category: 'Category',
      source: 'Source',
      readDocumentation: 'Documentation (Details)',
      includedSkills: 'Included Skills',
      tabOverview: 'Overview & Skills',
      tabDocs: 'Documentation',
      commitHash: 'Commit Hash',
      installedAt: 'Installed Date',
      localPath: 'Storage Path',
      runtimeStatus: 'Runtime Status',
      openInEditor: 'Preview Doc',
      revealInFolder: 'Reveal in Folder',
      skillsRoster: 'Included Skills & Capabilities',
      copySuccess: 'Copied to clipboard!',
      noSkillsFound: 'No sub-skills directories found.'
    },
    installModal: {
      title: 'Install Plugin Package',
      installing: 'Preparing to install',
      targetRuntime: 'Target AI Agent Runtime:',
      targetScope: 'Select Installation Scope:',
      workspaceScopeTitle: '📂 Workspace Scope',
      workspaceScopeDesc: 'Active only within current project, version-controlled with Git',
      agentScopeTitle: '🤖 AI Agent Scope',
      agentScopeDesc: 'Equipped to this Agent profile, available across all projects',
      globalScopeTitle: '🌐 Global System Scope',
      globalScopeDesc: 'Installed to machine-wide directory (~/.agents/plugins/)',
      targetWorkspaceFolder: 'Target Workspace Folder:',
      mcpInclude: 'Configure Bundled MCP Servers (Model Context Protocol)',
      mcpDesc: 'This plugin includes MCP server definitions and will automatically merge into the target config.',
      envVariables: 'Required Environment Variables / Tokens:',
      enterEnv: 'Enter {key}',
      confirmBtn: 'Install Now',
      installingBtn: 'Installing...',
      cancelBtn: 'Cancel'
    },
    createModal: {
      title: 'Create Standalone Skill',
      subtitle: 'Quickly generate standard SKILL.md scaffold',
      nameLabel: 'Skill Name (e.g. code-audit):',
      descLabel: 'Usage & Trigger Description:',
      scopeLabel: 'Scope:',
      targetRuntimeLabel: 'Target AI Agent:',
      includeScript: 'Generate scripts/ example',
      createBtn: 'Create Skill'
    },
    settingsView: {
      targetRuntimeTitle: 'AI Agent Runtime Environment',
      targetAgentRuntime: 'Target AI Agent Runtime',
      targetAgentRuntimeDesc: 'Specify target directory routing for skills and MCP servers (defaults to Auto-Detect current IDE)',
      marketSources: 'Marketplace Sources',
      addSourceBtn: 'Add New Source',
      officialBuiltIn: 'Official Built-in',
      sourceToggleOn: 'Enabled (Click to disable)',
      sourceToggleOff: 'Disabled (Click to enable)',
      editConfig: 'Edit Config',
      deleteSource: 'Delete Source',
      deleteModalTitle: 'Confirm Remove Source',
      deleteModalSubtitle: 'Removing source does not affect installed local skills',
      deleteModalPrompt: 'Are you sure you want to remove from marketplace sources list',
      confirmRemove: 'Confirm Remove',
      saveBtn: 'Save Settings',
      preferences: 'Preferences & Mirror Acceleration',
      preferencesDesc: 'Network connectivity, mirror acceleration channels & GitHub auth',
      networkSettings: 'Network & Acceleration Channels',
      networkDesc: 'Network connectivity, mirror acceleration channels & GitHub auth',
      sourcesDesc: 'Manage official and custom team marketplace sources (Git repos, API manifests, and local folders)',
      mirrorAcceleration: 'Enable Mirror / CDN Acceleration',
      mirrorDesc: 'Accelerate fetching SKILL.md and scripts from GitHub',
      githubToken: 'GitHub Personal Access Token (PAT)',
      githubTokenDesc: 'Bypass GitHub unauthenticated API rate limit (60 req/hr)',
      proxyUrl: 'HTTP Proxy URL',
      proxyUrlDesc: 'e.g. http://127.0.0.1:7890',
      savedSuccess: 'Settings saved successfully!'
    }
  }
};

export function useI18n() {
  const t = (path: string, params?: Record<string, any>): string => {
    const keys = path.split('.');
    let current: any = translations[currentLang.value];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English if missing in current language
        let fallback: any = translations['en'];
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = fallback[fbKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => {
        return str.replace(new RegExp(`\\{\\s*${k}\\s*\\}`, 'g'), String(v));
      }, current);
    }

    return current;
  };

  const setLanguage = (lang: Language) => {
    currentLang.value = lang;
  };

  const toggleLanguage = () => {
    currentLang.value = currentLang.value === 'zh' ? 'en' : 'zh';
  };

  return {
    t,
    lang: computed(() => currentLang.value),
    setLanguage,
    toggleLanguage
  };
}

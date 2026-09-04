import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { sanitizeMarketName } from '../utils/PathSafety';

export interface MarketplaceConfigEntry {
  sourceType: 'git' | 'local' | string;
  source: string;
  ref?: string;
  sparsePaths?: string[];
}

export interface McpServerConfigEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: any;
}

interface TomlSection {
  headerLine: string;
  headerKey: string;
  lines: string[];
}

function parseTomlSections(raw: string): { preamble: string[]; sections: TomlSection[] } {
  const lines = raw.split(/\r?\n/);
  const preamble: string[] = [];
  const sections: TomlSection[] = [];
  let currentSection: TomlSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const headerKey = trimmed.slice(1, -1).trim();
      currentSection = {
        headerLine: trimmed,
        headerKey,
        lines: []
      };
      sections.push(currentSection);
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        preamble.push(line);
      }
    }
  }

  return { preamble, sections };
}

function serializeTomlSections(preamble: string[], sections: TomlSection[]): string {
  const parts: string[] = [];

  const preambleStr = preamble.join('\n').trim();
  if (preambleStr) {
    parts.push(preambleStr);
  }

  for (const section of sections) {
    const bodyStr = section.lines.join('\n').trim();
    if (bodyStr) {
      parts.push(`${section.headerLine}\n${bodyStr}`);
    } else {
      parts.push(section.headerLine);
    }
  }

  return parts.join('\n\n') + '\n';
}

/**
 * 结构化安全处理 OpenAI Codex config.toml 的读写助手
 * 基于 Section 结构化解析，彻底杜绝换行吞并、语法损坏与非法命名
 */
export class CodexConfigHelper {
  public static readonly CONFIG_FILE = 'config.toml';

  public static getConfigPath(codexHome: string): string {
    return path.join(codexHome, this.CONFIG_FILE);
  }

  /**
   * 读取 config.toml 文本
   */
  public static readRawConfig(codexHome: string): string {
    const configPath = this.getConfigPath(codexHome);
    if (!fs.existsSync(configPath)) return '';
    try {
      return fs.readFileSync(configPath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * 严格校验 config.toml 的 TOML 语法格式与 OpenAI Codex 专属规范
   * 校验项目：
   * 1. 标准 TOML 1.0 语法解析（杜绝任何缺少换行、引号未闭合、段落粘连等错误）
   * 2. 插件键与市场源名称合法性（严禁包含空格等非法字符）
   */
  public static validateConfig(content: string): { valid: boolean; error?: string } {
    if (!content.trim()) {
      return { valid: true };
    }

    // 1. 标准 TOML 语法校验
    let parsed: any;
    try {
      parsed = TOML.parse(content);
    } catch (err: any) {
      return {
        valid: false,
        error: `TOML 语法校验失败: ${err.message || String(err)}`
      };
    }

    // 2. 结构与插件/市场段命名规范校验
    if (parsed && typeof parsed === 'object') {
      if (parsed.plugins && typeof parsed.plugins === 'object') {
        for (const key of Object.keys(parsed.plugins)) {
          if (/\s/.test(key)) {
            return {
              valid: false,
              error: `插件配置键包含非法空格: [plugins."${key}"]`
            };
          }
        }
      }
      if (parsed.marketplaces && typeof parsed.marketplaces === 'object') {
        for (const key of Object.keys(parsed.marketplaces)) {
          if (/\s/.test(key)) {
            return {
              valid: false,
              error: `市场源名称包含非法空格: [marketplaces."${key}"]`
            };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * 原子化安全写入 config.toml
   * 写入前自动备份已有配置；写入前和写入后均进行严格语法格式校验；
   * 一旦校验失败或发生任何写入异常，立即自动回滚还原为修改前的配置，绝对保证 ChatGPT/Codex 配置文件 100% 安全！
   */
  public static writeRawConfig(codexHome: string, content: string): void {
    if (!fs.existsSync(codexHome)) {
      fs.mkdirSync(codexHome, { recursive: true });
    }
    const configPath = this.getConfigPath(codexHome);
    const backupPath = `${configPath}.bak`;

    // 1. 预写入前校验拟写入内容的格式与规范
    const preCheck = this.validateConfig(content);
    if (!preCheck.valid) {
      console.error(`[CodexConfigHelper] 拟写入的内容格式错误，已拦截写入并保护现有配置: ${preCheck.error}`);
      throw new Error(`配置格式校验未通过，已阻止写入以保护 ChatGPT 配置: ${preCheck.error}`);
    }

    // 2. 备份修改前的已有配置
    let hasExisting = false;
    let originalContent = '';
    if (fs.existsSync(configPath)) {
      hasExisting = true;
      try {
        originalContent = fs.readFileSync(configPath, 'utf-8');
        fs.writeFileSync(backupPath, originalContent, 'utf-8');
      } catch (err) {
        console.warn('[CodexConfigHelper] 创建配置备份失败:', err);
      }
    }

    // 3. 写入临时文件并通过二次落盘校验，最后执行原子替换
    const tempPath = `${configPath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, content, 'utf-8');

      // 4. 二次落盘读取校验
      const writtenContent = fs.readFileSync(tempPath, 'utf-8');
      const postCheck = this.validateConfig(writtenContent);
      if (!postCheck.valid) {
        throw new Error(`文件落盘后格式校验失败: ${postCheck.error}`);
      }

      // 5. 原子重命名生效
      fs.renameSync(tempPath, configPath);
    } catch (writeErr: any) {
      // 触发自动回滚保护
      console.error(`[CodexConfigHelper] 写入或校验过程发生异常，正在执行自动回滚...`, writeErr);
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }

      if (hasExisting) {
        try {
          fs.writeFileSync(configPath, originalContent, 'utf-8');
          console.log('[CodexConfigHelper] 已成功自动回滚还原为修改前的配置！');
        } catch (rollbackErr) {
          console.error('[CodexConfigHelper] 自动回滚失败:', rollbackErr);
        }
      }

      throw new Error(`写入 config.toml 发生错误并已自动回滚还原: ${writeErr.message || String(writeErr)}`);
    }
  }

  /**
   * 从 .bak 备份副本强制还原 config.toml
   */
  public static rollbackFromBackup(codexHome: string): boolean {
    const configPath = this.getConfigPath(codexHome);
    const backupPath = `${configPath}.bak`;
    if (fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf-8');
        const check = this.validateConfig(backupContent);
        if (check.valid) {
          fs.copyFileSync(backupPath, configPath);
          return true;
        }
      } catch {}
    }
    return false;
  }

  /**
   * 获取指定插件的启停状态 (true / false / null)
   */
  public static getPluginEnabled(codexHome: string, pluginKeyOrName: string): boolean | null {
    const raw = this.readRawConfig(codexHome);
    if (!raw) return null;

    const { sections } = parseTomlSections(raw);
    const pluginName = pluginKeyOrName.includes('@') ? pluginKeyOrName.split('@')[0] : pluginKeyOrName;
    const rawMarket = pluginKeyOrName.includes('@') ? pluginKeyOrName.split('@')[1] : '';
    const safeMarket = rawMarket ? sanitizeMarketName(rawMarket) : '';

    // 1. 精确匹配
    for (const section of sections) {
      const match = section.headerKey.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      if (key === pluginKeyOrName || (safeMarket && key === `${pluginName}@${safeMarket}`)) {
        for (const line of section.lines) {
          const m = line.match(/^\s*enabled\s*=\s*(true|false)/i);
          if (m) return m[1].toLowerCase() === 'true';
        }
        return true;
      }
    }

    // 2. 模糊匹配 pluginName
    for (const section of sections) {
      const match = section.headerKey.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      const name = key.includes('@') ? key.split('@')[0] : key;
      if (name.toLowerCase() === pluginName.toLowerCase()) {
        for (const line of section.lines) {
          const m = line.match(/^\s*enabled\s*=\s*(true|false)/i);
          if (m) return m[1].toLowerCase() === 'true';
        }
        return true;
      }
    }

    return null;
  }

  /**
   * 写入/更新插件的启用或禁用状态
   */
  public static setPluginEnabled(codexHome: string, pluginKey: string, enabled: boolean): void {
    const raw = this.readRawConfig(codexHome);
    const { preamble, sections } = parseTomlSections(raw);

    const pluginName = pluginKey.includes('@') ? pluginKey.split('@')[0] : pluginKey;
    const rawMarket = pluginKey.includes('@') ? pluginKey.split('@')[1] : 'default';
    const safeMarket = sanitizeMarketName(rawMarket);
    const safePluginKey = `${pluginName}@${safeMarket}`;
    const targetHeaderLine = `[plugins."${safePluginKey}"]`;

    let found = false;
    for (const section of sections) {
      const match = section.headerKey.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      const name = key.includes('@') ? key.split('@')[0] : key;

      if (name.toLowerCase() === pluginName.toLowerCase()) {
        found = true;
        section.headerLine = targetHeaderLine;
        section.headerKey = `plugins."${safePluginKey}"`;

        let hasEnabledLine = false;
        section.lines = section.lines.map((line) => {
          if (/^\s*enabled\s*=\s*(?:true|false)/i.test(line)) {
            hasEnabledLine = true;
            return `enabled = ${enabled}`;
          }
          return line;
        });

        if (!hasEnabledLine) {
          section.lines.unshift(`enabled = ${enabled}`);
        }
        break;
      }
    }

    if (!found) {
      sections.push({
        headerLine: targetHeaderLine,
        headerKey: `plugins."${safePluginKey}"`,
        lines: [`enabled = ${enabled}`]
      });
    }

    const updated = serializeTomlSections(preamble, sections);
    this.writeRawConfig(codexHome, updated);
  }

  /**
   * 从 config.toml 中移除插件声明
   */
  public static removePlugin(codexHome: string, pluginKey: string): void {
    const raw = this.readRawConfig(codexHome);
    if (!raw) return;

    const { preamble, sections } = parseTomlSections(raw);
    const pluginName = pluginKey.includes('@') ? pluginKey.split('@')[0] : pluginKey;

    const filteredSections = sections.filter((section) => {
      const match = section.headerKey.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) return true;
      const key = match[1] || match[2] || match[3];
      const name = key.includes('@') ? key.split('@')[0] : key;
      return name.toLowerCase() !== pluginName.toLowerCase();
    });

    const updated = serializeTomlSections(preamble, filteredSections);
    this.writeRawConfig(codexHome, updated);
  }

  /**
   * 记录/更新市场源声明 [marketplaces."<name>"]
   */
  public static recordMarketplace(
    codexHome: string,
    marketplaceName: string,
    entry: MarketplaceConfigEntry
  ): void {
    const safeMarket = sanitizeMarketName(marketplaceName);
    const raw = this.readRawConfig(codexHome);
    const { preamble, sections } = parseTomlSections(raw);

    const targetHeaderLine = `[marketplaces."${safeMarket}"]`;
    const targetHeaderKey = `marketplaces."${safeMarket}"`;

    const bodyLines = [
      `source_type = "${entry.sourceType}"`,
      `source = "${entry.source}"`
    ];
    if (entry.ref) {
      bodyLines.push(`ref = "${entry.ref}"`);
    }
    if (entry.sparsePaths && entry.sparsePaths.length > 0) {
      const paths = entry.sparsePaths.map((p) => `"${p}"`).join(', ');
      bodyLines.push(`sparse_paths = [${paths}]`);
    }

    let found = false;
    for (const section of sections) {
      const match = section.headerKey.match(/^marketplaces\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      if (key === safeMarket || key === marketplaceName) {
        found = true;
        section.headerLine = targetHeaderLine;
        section.headerKey = targetHeaderKey;
        section.lines = bodyLines;
        break;
      }
    }

    if (!found) {
      sections.push({
        headerLine: targetHeaderLine,
        headerKey: targetHeaderKey,
        lines: bodyLines
      });
    }

    const updated = serializeTomlSections(preamble, sections);
    this.writeRawConfig(codexHome, updated);
  }

  /**
   * 合并 MCP Server 配置到 [mcp_servers."<name>"]
   */
  public static mergeMcpServer(
    codexHome: string,
    serverName: string,
    config: McpServerConfigEntry
  ): void {
    const raw = this.readRawConfig(codexHome);
    const { preamble, sections } = parseTomlSections(raw);

    const targetHeaderLine = `[mcp_servers."${serverName}"]`;
    const targetHeaderKey = `mcp_servers."${serverName}"`;

    const bodyLines: string[] = [];
    if (config.command) bodyLines.push(`command = "${config.command}"`);
    if (config.args && Array.isArray(config.args)) {
      const argsStr = config.args.map((a) => `"${a}"`).join(', ');
      bodyLines.push(`args = [${argsStr}]`);
    }
    if (config.env && typeof config.env === 'object') {
      bodyLines.push(`env = { ${Object.entries(config.env).map(([k, v]) => `"${k}" = "${v}"`).join(', ')} }`);
    }

    let found = false;
    for (const section of sections) {
      const match = section.headerKey.match(/^mcp_servers\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      if (key === serverName) {
        found = true;
        section.headerLine = targetHeaderLine;
        section.headerKey = targetHeaderKey;
        section.lines = bodyLines;
        break;
      }
    }

    if (!found) {
      sections.push({
        headerLine: targetHeaderLine,
        headerKey: targetHeaderKey,
        lines: bodyLines
      });
    }

    const updated = serializeTomlSections(preamble, sections);
    this.writeRawConfig(codexHome, updated);
  }

  /**
   * 列出所有已声明的插件及其状态
   */
  public static listConfiguredPlugins(codexHome: string): Record<string, boolean> {
    const raw = this.readRawConfig(codexHome);
    const result: Record<string, boolean> = {};
    if (!raw) return result;

    const { sections } = parseTomlSections(raw);
    for (const section of sections) {
      const match = section.headerKey.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_@.-]+))$/);
      if (!match) continue;
      const key = match[1] || match[2] || match[3];
      let isEnabled = true;
      for (const line of section.lines) {
        const m = line.match(/^\s*enabled\s*=\s*(true|false)/i);
        if (m) {
          isEnabled = m[1].toLowerCase() === 'true';
          break;
        }
      }
      result[key] = isEnabled;
    }
    return result;
  }
}

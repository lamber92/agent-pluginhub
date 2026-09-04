import * as fs from 'fs';
import * as path from 'path';

/**
 * 统一技能扫描与解析工具类
 * 准确处理不同生态（Codex, Antigravity, OpenCode）下原生插件、第三方插件与自建单体技能的技能列表提取
 */
export class SkillScanner {
  /**
   * 规范化已有的 skills 列表，彻底排除路径字符串（如 "./skills/"）引发的异常
   */
  public static normalizeSkillsArray(skillsInput: any): string[] {
    if (!skillsInput) return [];
    if (Array.isArray(skillsInput)) {
      return skillsInput
        .map((s) => (typeof s === 'string' ? s.trim() : (s as any)?.name?.trim()))
        .filter((s): s is string => !!s && !s.startsWith('.') && !s.includes('/'));
    }
    return [];
  }

  /**
   * 深度扫描并解析插件内部包含的所有子技能 (Skills)
   */
  public static scanPluginSkills(
    pluginPath: string,
    lockfileSkills?: any,
    pluginJsonSkills?: any,
    fallbackPluginName?: string
  ): string[] {
    // 1. 如果 lockfile 明确记录了有效的 skills 数组
    const fromLockfile = this.normalizeSkillsArray(lockfileSkills);
    if (fromLockfile.length > 0) {
      return fromLockfile;
    }

    // 2. 如果 plugin.json 中的 skills 是明确的数组（且不是路径字符串）
    const fromJson = this.normalizeSkillsArray(pluginJsonSkills);
    if (fromJson.length > 0) {
      return fromJson;
    }

    // 3. 扫描真实文件系统
    const candidateDirs: string[] = [];

    // 若 pluginJson.skills 是路径字符串（例如 "./skills/" 或 "skills"）
    if (typeof pluginJsonSkills === 'string' && pluginJsonSkills.trim()) {
      const customPath = path.resolve(pluginPath, pluginJsonSkills.trim());
      if (fs.existsSync(customPath) && !candidateDirs.includes(customPath)) {
        candidateDirs.push(customPath);
      }
    }

    // 默认标准 skills 目录
    const defaultSkillsDir = path.join(pluginPath, 'skills');
    if (fs.existsSync(defaultSkillsDir) && !candidateDirs.includes(defaultSkillsDir)) {
      candidateDirs.push(defaultSkillsDir);
    }

    // .agents/skills 或 .codex-plugin/skills
    const agentSkillsDir = path.join(pluginPath, '.agents', 'skills');
    if (fs.existsSync(agentSkillsDir) && !candidateDirs.includes(agentSkillsDir)) {
      candidateDirs.push(agentSkillsDir);
    }

    const discoveredSkills: string[] = [];

    for (const dir of candidateDirs) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // 检查子目录是否为有效技能：包含 SKILL.md、skill.md、skills.md 或任意说明文档
            if (
              fs.existsSync(path.join(fullPath, 'SKILL.md')) ||
              fs.existsSync(path.join(fullPath, 'skill.md')) ||
              fs.existsSync(path.join(fullPath, 'skills.md')) ||
              fs.existsSync(path.join(fullPath, 'instructions.md'))
            ) {
              if (!discoveredSkills.includes(entry.name)) {
                discoveredSkills.push(entry.name);
              }
            }
          } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.skill'))) {
            const skillName = entry.name.replace(/\.(md|skill)$/, '');
            if (skillName && !discoveredSkills.includes(skillName)) {
              discoveredSkills.push(skillName);
            }
          }
        }
      } catch {}
    }

    if (discoveredSkills.length > 0) {
      return discoveredSkills;
    }

    // 4. 检查插件根目录是否本身就是一个单体技能（根目录包含 SKILL.md）
    if (
      fs.existsSync(path.join(pluginPath, 'SKILL.md')) ||
      fs.existsSync(path.join(pluginPath, 'skill.md'))
    ) {
      return [fallbackPluginName || path.basename(pluginPath)];
    }

    return [];
  }
}

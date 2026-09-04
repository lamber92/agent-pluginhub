/**
 * Skill 文档与配套脚本高危指令静态安全审计引擎
 * 采用严格正则过滤策略，精准识别真正的系统破坏性命令与动态执行管道，杜绝普通代码块误报
 */

export interface SecurityRiskRule {
  id: string;
  pattern: RegExp;
  message: string;
  level: 'high' | 'medium' | 'low';
}

export class SecurityAuditor {
  // 核心高危正则规则库
  private static readonly RISK_RULES: SecurityRiskRule[] = [
    {
      id: 'curl-pipe-bash',
      pattern: /curl\s+[^|\r\n]+\|\s*(ba)?sh/i,
      message: '检测到远程脚本管道直接执行 (curl ... | bash)',
      level: 'high'
    },
    {
      id: 'wget-pipe-sh',
      pattern: /wget\s+[^|\r\n]+\|\s*(ba)?sh/i,
      message: '检测到远程脚本管道直接执行 (wget ... | sh)',
      level: 'high'
    },
    {
      id: 'destructive-rm',
      pattern: /rm\s+-rf\s+(\/|~|\$HOME|\$\{HOME\})/i,
      message: '检测到危险的系统/主目录递归删除命令 (rm -rf /)',
      level: 'high'
    },
    {
      id: 'powershell-iex',
      pattern: /(Invoke-Expression|iex)\s+/i,
      message: '检测到 PowerShell 动态表达式执行 (Invoke-Expression)',
      level: 'high'
    },
    {
      id: 'powershell-encoded',
      pattern: /powershell(\.exe)?\s+(-enc|-encodedcommand)/i,
      message: '检测到 PowerShell Base64 隐藏编码命令',
      level: 'high'
    }
  ];

  /**
   * 静态扫描 SKILL.md Markdown 正文与 scripts/ 脚本内容，返回所有命中的安全警告清单
   * @param rawContent SKILL.md 文档原文
   * @param scripts 配套脚本列表
   */
  public static scan(rawContent: string, scripts?: { name: string; content?: string }[]): string[] {
    const warnings: string[] = [];
    const textsToAudit = [rawContent];

    if (scripts && scripts.length > 0) {
      for (const script of scripts) {
        if (script.content) {
          textsToAudit.push(script.content);
        }
      }
    }

    const fullAuditText = textsToAudit.join('\n');

    for (const rule of SecurityAuditor.RISK_RULES) {
      if (rule.pattern.test(fullAuditText)) {
        if (!warnings.includes(rule.message)) {
          warnings.push(rule.message);
        }
      }
    }

    return warnings;
  }
}

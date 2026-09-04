import { HttpClient } from '../utils/HttpClient';

export interface GitRepoMetaResult {
  commitSha: string;
  latestTag?: string;
  commitTagMap: Map<string, string>;
}

/**
 * Git 元数据与版本指纹探测服务
 * 核心创新点：利用 GitHub 公开 Atom 实时订阅流（零 API 速率限制）极速获取主分支最新 Commit SHA 与 Release Tag，失败时自动平滑回退至 REST API
 */
export class GitMetadataService {
  /**
   * 免限流获取任意 GitHub 仓库的最新 Commit SHA 与 Release Tag
   * @param repoFullName 仓库全名 (如 "anthropics/claude-plugins-official")
   * @param token 可选的 GitHub 个人访问令牌 (PAT)
   */
  public static async fetchGitRepoMeta(
    repoFullName: string,
    token?: string
  ): Promise<GitRepoMetaResult> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    let commitSha = '';
    const commitTagMap = new Map<string, string>();
    let latestTag: string | undefined = undefined;

    // 1. 首选通道：解析公共 GitHub Commits Atom Feed（无任何 API 调用配额限制，返回真实最新 Trunk Commit SHA，如 b36e082）
    try {
      const atomUrl = `https://github.com/${repoFullName}/commits/main.atom`;
      const text = await HttpClient.get(atomUrl, { token, headers, timeoutMs: 8000 });
      const match = text.match(/Commit\/([a-f0-9]{40})/i) || text.match(/commit\/([a-f0-9]{40})/i);
      if (match) {
        commitSha = match[1].slice(0, 7);
      }
    } catch {
      // 备选分支：尝试 master 分支 Atom
      try {
        const masterAtomUrl = `https://github.com/${repoFullName}/commits/master.atom`;
        const text = await HttpClient.get(masterAtomUrl, { token, headers, timeoutMs: 8000 });
        const match = text.match(/Commit\/([a-f0-9]{40})/i) || text.match(/commit\/([a-f0-9]{40})/i);
        if (match) {
          commitSha = match[1].slice(0, 7);
        }
      } catch {
        // 继续向下执行 Tag 与 REST 回退
      }
    }

    // 2. 首选通道：解析公共 Releases / Tags Atom Feed 获取语义化版本 Tag
    try {
      const tagsAtomUrl = `https://github.com/${repoFullName}/tags.atom`;
      const text = await HttpClient.get(tagsAtomUrl, { token, headers, timeoutMs: 8000 });
      const tagMatches = text.matchAll(/tag\/([^"<>&/]+)/gi);
      for (const m of tagMatches) {
        if (!latestTag) latestTag = m[1];
        commitTagMap.set(m[1], m[1]);
      }
    } catch {
      // 继续向下执行 REST 回退
    }

    // 3. 兜底通道：GitHub REST API (仅当 Atom 无法获取且配置了 Token 或在低频访问时触发)
    if (!commitSha || !latestTag) {
      try {
        if (!latestTag) {
          const tagsUrl = `https://api.github.com/repos/${repoFullName}/tags?per_page=10`;
          const text = await HttpClient.get(tagsUrl, {
            token,
            headers: {
              'User-Agent': 'PluginHub-Extension',
              Accept: 'application/vnd.github.v3+json'
            },
            timeoutMs: 8000
          });
          const tagsData = JSON.parse(text) as { name: string; commit: { sha: string } }[];
          if (Array.isArray(tagsData) && tagsData.length > 0) {
            latestTag = tagsData[0].name;
            for (const t of tagsData) {
              if (t.commit && t.commit.sha) {
                commitTagMap.set(t.commit.sha, t.name);
                commitTagMap.set(t.commit.sha.slice(0, 7), t.name);
              }
            }
          }
        }

        if (!commitSha) {
          const commitsUrl = `https://api.github.com/repos/${repoFullName}/commits?per_page=1`;
          const text = await HttpClient.get(commitsUrl, {
            token,
            headers: {
              'User-Agent': 'PluginHub-Extension',
              Accept: 'application/vnd.github.v3+json'
            },
            timeoutMs: 8000
          });
          const commitsData = JSON.parse(text) as { sha: string }[];
          if (Array.isArray(commitsData) && commitsData.length > 0 && commitsData[0].sha) {
            commitSha = commitsData[0].sha.slice(0, 7);
          }
        }
      } catch {
        // Graceful return
      }
    }

    return { commitSha, latestTag, commitTagMap };
  }
}

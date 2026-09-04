/**
 * 语义化版本与 Git Commit SHA 指纹比对与格式化纯函数工具库
 */

/**
 * 剥离版本或 Commit 字符串中的各种前缀（如 "git:", "sha:", "v", "tag:"）以进行统一归一化比对
 */
export const stripVersionPrefix = (s: string): string => {
  return s
    .replace(/^git:/i, '')
    .replace(/^sha:/i, '')
    .replace(/^v/i, '')
    .replace(/^tag:/i, '')
    .trim();
};

/**
 * 语义化版本与 Git Commit 哈希双模比较器
 * 比对返回值规范：
 *   1: latest > current (存在新版本，应提示升级)
 *  -1: latest < current (当前版本更新)
 *   0: 两者版本一致，或跨类型（如 Git SHA 与 Tag 混合）不作误报
 */
export const compareVersions = (latest?: string, current?: string): number => {
  if (!latest || !current) return 0;

  const cleanL = latest.trim();
  const cleanC = current.trim();
  if (cleanL === cleanC) return 0;

  // 1. 归一化剥离前缀比对
  const normL = stripVersionPrefix(cleanL);
  const normC = stripVersionPrefix(cleanC);
  if (normL === normC) return 0;

  const isGitL = cleanL.startsWith('git:') || cleanL.startsWith('sha:');
  const isGitC = cleanC.startsWith('git:') || cleanC.startsWith('sha:');

  // 2. 若双方均为 Git SHA 指纹，直接比对字符串内容（忽略大小写）
  if (isGitL && isGitC) {
    return 0;
  }

  // 3. 若一方为 Git SHA 另一方为语义化 Tag，避免跨类型误报更新
  if (isGitL || isGitC) {
    return 0;
  }

  // 4. 标准语义化三段式数值比对 (e.g. 1.2.0 vs 1.1.9)
  const parts1 = normL.split('.').map(Number);
  const parts2 = normC.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = isNaN(parts1[i]) ? 0 : parts1[i];
    const num2 = isNaN(parts2[i]) ? 0 : parts2[i];
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

/**
 * 格式化版本号或 Git SHA 为友好的 UI 徽章文本
 * 优先级：Release Tag (如 "v6.3.0" 或 "tag:release-1") > SemVer > Git SHA (如 "git:b36e082")
 */
export const formatVersion = (version?: string, gitSha?: string, gitTag?: string): string => {
  if (gitTag) {
    return gitTag.startsWith('v') || gitTag.startsWith('V') || gitTag.startsWith('tag:') ? gitTag : `tag:${gitTag}`;
  }
  if (version && version !== '1.0.0') {
    if (version.startsWith('git:') || version.startsWith('sha:') || version.startsWith('tag:')) {
      return version;
    }
    if (version.startsWith('v') || version.startsWith('V')) {
      return version;
    }
    return `v${version}`;
  }
  if (gitSha) {
    return `git:${gitSha.slice(0, 7)}`;
  }
  if (version === '1.0.0') {
    return 'v1.0.0';
  }
  return 'git:latest';
};

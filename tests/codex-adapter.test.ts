import test from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CodexConfigHelper } from '../src/adapters/CodexConfigHelper';
import { CodexAdapter } from '../src/adapters/CodexAdapter';
import { RuntimePathResolver } from '../src/services/RuntimePathResolver';
import { SkillScanner } from '../src/utils/SkillScanner';

test('CodexConfigHelper: can read, set and clear plugin states in config.toml', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-config-test-'));
  const configPath = path.join(tempDir, 'config.toml');

  // Initial state: no file
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempDir, 'demo@market'), null);

  // Set enabled to true
  CodexConfigHelper.setPluginEnabled(tempDir, 'demo@market', true);
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempDir, 'demo@market'), true);

  const fileContent = fs.readFileSync(configPath, 'utf-8');
  assert.match(fileContent, /\[plugins\."demo@market"\]/);
  assert.match(fileContent, /enabled\s*=\s*true/);

  // Toggle to false
  CodexConfigHelper.setPluginEnabled(tempDir, 'demo@market', false);
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempDir, 'demo@market'), false);

  // Verify that config.toml.bak was created containing previous content
  const backupPath = path.join(tempDir, 'config.toml.bak');
  assert.strictEqual(fs.existsSync(backupPath), true);
  const backupContent = fs.readFileSync(backupPath, 'utf-8');
  assert.match(backupContent, /enabled\s*=\s*true/);

  // Clear plugin
  CodexConfigHelper.removePlugin(tempDir, 'demo@market');
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempDir, 'demo@market'), null);

  // Latest backup now contains enabled = false
  const updatedBackup = fs.readFileSync(backupPath, 'utf-8');
  assert.match(updatedBackup, /enabled\s*=\s*false/);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('CodexConfigHelper: can record marketplace and mcp server configurations safely with sanitization', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-config-market-'));

  CodexConfigHelper.recordMarketplace(tempDir, 'Anthropic Official Marketplace', {
    sourceType: 'git',
    source: 'https://github.com/owner/repo.git',
    ref: 'main'
  });

  const content1 = fs.readFileSync(path.join(tempDir, 'config.toml'), 'utf-8');
  assert.match(content1, /\[marketplaces\."anthropic-official-marketplace"\]/);
  assert.match(content1, /source_type\s*=\s*"git"/);
  assert.match(content1, /source\s*=\s*"https:\/\/github\.com\/owner\/repo\.git"/);

  CodexConfigHelper.mergeMcpServer(tempDir, 'my server', {
    command: 'node',
    args: ['index.js'],
    env: { API_KEY: 'secret123' }
  });

  const content2 = fs.readFileSync(path.join(tempDir, 'config.toml'), 'utf-8');
  assert.match(content2, /\[mcp_servers\."my server"\]/);
  assert.match(content2, /command\s*=\s*"node"/);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('CodexConfigHelper: preserves existing sections and does not corrupt TOML boundaries', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-preserve-test-'));
  const configPath = path.join(tempDir, 'config.toml');

  const initialContent = `model = "gpt-5.6-sol"

[features]
js_repl = false

[projects.'d:\\project\\agent-pluginhub']
trust_level = "trusted"
`;
  fs.writeFileSync(configPath, initialContent, 'utf-8');

  // Add plugin
  CodexConfigHelper.setPluginEnabled(tempDir, 'superpowers@Anthropic Official Marketplace', true);

  const afterAdd = fs.readFileSync(configPath, 'utf-8');
  assert.match(afterAdd, /model\s*=\s*"gpt-5\.6-sol"/);
  assert.match(afterAdd, /\[features\]\njs_repl = false/);
  assert.match(afterAdd, /\[plugins\."superpowers@anthropic-official-marketplace"\]\nenabled = true/);
  assert.match(afterAdd, /\[projects\.'d:\\project\\agent-pluginhub'\]\ntrust_level = "trusted"/);
  // Ensure no concatenated lines like `js_repl = false[plugins...]`
  assert.strictEqual(/false\[/i.test(afterAdd), false);
  assert.strictEqual(/trusted\[/i.test(afterAdd), false);

  // Toggle plugin
  CodexConfigHelper.setPluginEnabled(tempDir, 'superpowers@anthropic-official-marketplace', false);
  const afterToggle = fs.readFileSync(configPath, 'utf-8');
  assert.match(afterToggle, /\[plugins\."superpowers@anthropic-official-marketplace"\]\nenabled = false/);
  assert.strictEqual(/false\[/i.test(afterToggle), false);

  // Remove plugin
  CodexConfigHelper.removePlugin(tempDir, 'superpowers@anthropic-official-marketplace');
  const afterRemove = fs.readFileSync(configPath, 'utf-8');
  assert.strictEqual(afterRemove.includes('superpowers'), false);
  assert.match(afterRemove, /\[features\]/);
  assert.match(afterRemove, /\[projects\.'d:\\project\\agent-pluginhub'\]/);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('CodexAdapter: supports agent, workspace, and global scopes', () => {
  const adapter = new CodexAdapter();
  assert.deepStrictEqual(adapter.supportedScopes, ['workspace', 'agent', 'global']);

  const agentPaths = adapter.resolvePaths('agent');
  assert.strictEqual(agentPaths.runtime, 'codex');
  assert.match(agentPaths.baseConfigDir, /\.codex$/);
  assert.match(agentPaths.pluginsDir, /cache$/);

  const wsPaths = adapter.resolvePaths('workspace', 'D:\\fake-workspace');
  assert.strictEqual(wsPaths.runtime, 'codex');
  assert.strictEqual(wsPaths.baseConfigDir, path.join('D:\\fake-workspace', '.codex'));
});

test('RuntimePathResolver: accurately resolves Codex native plugins/cache path structure', () => {
  const resolvedAgent = RuntimePathResolver.resolve(
    'superpowers',
    'agent',
    undefined,
    'codex',
    'openai-curated',
    '0.1.0'
  );
  assert.strictEqual(resolvedAgent.runtime, 'codex');
  assert.match(
    resolvedAgent.pluginDir.replace(/\\/g, '/'),
    /\.codex\/plugins\/cache\/openai-curated\/superpowers\/0\.1\.0$/
  );

  const resolvedWs = RuntimePathResolver.resolve(
    'superpowers',
    'workspace',
    'D:\\my-project',
    'codex',
    'default',
    '1.0.0'
  );
  assert.strictEqual(
    resolvedWs.pluginDir.replace(/\\/g, '/'),
    'D:/my-project/.codex/plugins/cache/default/superpowers/1.0.0'
  );
});

test('CodexAdapter: scans plugins/cache directory and respects config.toml status', async () => {
  const adapter = new CodexAdapter();
  const tempCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-adapter-home-'));
  const cacheRoot = path.join(tempCodexHome, 'plugins', 'cache');

  // Create plugin structure: cache/default/superpowers/1.0.0/
  const pluginDir = path.join(cacheRoot, 'default', 'superpowers', '1.0.0');
  fs.mkdirSync(pluginDir, { recursive: true });

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify({
      name: 'superpowers',
      version: '1.0.0',
      description: 'Superpowers plugin for Codex'
    })
  );

  // Set enabled in config.toml
  CodexConfigHelper.setPluginEnabled(tempCodexHome, 'superpowers@default', true);

  const scanned = adapter.scanPluginsDirectory(cacheRoot, 'agent');
  assert.strictEqual(scanned.length, 1);
  assert.strictEqual(scanned[0].name, 'superpowers');
  assert.strictEqual(scanned[0].enabled, true);
  assert.strictEqual(scanned[0].version, '1.0.0');
  assert.strictEqual(scanned[0].runtime, 'codex');

  // Test toggling state via adapter
  await adapter.togglePluginState(scanned[0].path, false, 'agent');
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempCodexHome, 'superpowers@default'), false);

  // Rescan should immediately return enabled === false
  const rescanned = adapter.scanPluginsDirectory(cacheRoot, 'agent');
  assert.strictEqual(rescanned.length, 1);
  assert.strictEqual(rescanned[0].enabled, false);

  // Test deleting plugin via adapter
  await adapter.deletePlugin(scanned[0].path, 'agent');
  assert.strictEqual(fs.existsSync(pluginDir), false);
  assert.strictEqual(CodexConfigHelper.getPluginEnabled(tempCodexHome, 'superpowers@default'), null);

  fs.rmSync(tempCodexHome, { recursive: true, force: true });
});

test('CodexAdapter: handles flat plugins and marketplace metadata names seamlessly', async () => {
  const adapter = new CodexAdapter();
  const tempCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-flat-home-'));
  const pluginsRoot = path.join(tempCodexHome, 'plugins');

  // Create flat plugin structure: plugins/my-tool/
  const pluginDir = path.join(pluginsRoot, 'my-tool');
  fs.mkdirSync(pluginDir, { recursive: true });

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify({
      name: 'my-tool',
      version: '2.0.0',
      description: 'A custom tool'
    })
  );

  adapter.writePluginhubMetadata(pluginDir, {
    name: 'my-tool',
    description: 'A custom tool',
    version: '2.0.0',
    runtime: 'codex',
    sourceName: 'Codex Marketplace',
    installedAt: Date.now(),
    installedScope: 'workspace',
    enabled: true
  });

  const scanned = adapter.scanPluginsDirectory(pluginsRoot, 'workspace', 'test-ws', tempCodexHome);
  assert.strictEqual(scanned.length, 1);
  assert.strictEqual(scanned[0].name, 'my-tool');
  assert.strictEqual(scanned[0].enabled, true);

  // Toggle to false
  await adapter.togglePluginState(scanned[0].path, false, 'workspace', tempCodexHome);

  // Check that config.toml was updated and rescanning returns false
  const rescanned = adapter.scanPluginsDirectory(pluginsRoot, 'workspace', 'test-ws', tempCodexHome);
  assert.strictEqual(rescanned.length, 1);
  assert.strictEqual(rescanned[0].enabled, false);

  // Toggle back to true
  await adapter.togglePluginState(scanned[0].path, true, 'workspace', tempCodexHome);
  const rescanned2 = adapter.scanPluginsDirectory(pluginsRoot, 'workspace', 'test-ws', tempCodexHome);
  assert.strictEqual(rescanned2.length, 1);
  assert.strictEqual(rescanned2[0].enabled, true);

  fs.rmSync(tempCodexHome, { recursive: true, force: true });
});

test('CodexAdapter: handles .codex-plugin/plugin.json manifests, extracts marketplace, and protects native plugins', async () => {
  const adapter = new CodexAdapter();
  const tempCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-native-home-'));
  const cacheRoot = path.join(tempCodexHome, 'plugins', 'cache');

  // Create native plugin structure: cache/openai-bundled/browser/26.825.51511/.codex-plugin/plugin.json
  const browserVersionDir = path.join(cacheRoot, 'openai-bundled', 'browser', '26.825.51511');
  const codexPluginDir = path.join(browserVersionDir, '.codex-plugin');
  fs.mkdirSync(codexPluginDir, { recursive: true });

  const activeManifestPath = path.join(codexPluginDir, 'plugin.json');
  fs.writeFileSync(
    activeManifestPath,
    JSON.stringify({
      name: 'browser',
      version: '26.825.51511',
      description: 'Browser / browser-use plugin'
    })
  );

  // 1. Scan: should detect browser with isNative: true and correct sourceName 'openai-bundled'
  const scanned = adapter.scanPluginsDirectory(cacheRoot, 'agent');
  assert.strictEqual(scanned.length, 1);
  assert.strictEqual(scanned[0].name, 'browser');
  assert.strictEqual(scanned[0].sourceName, 'openai-bundled');
  assert.strictEqual(scanned[0].isNative, true);
  assert.strictEqual(scanned[0].enabled, true);

  // 2. Toggle to false: keeps plugin.json intact so Codex client can discover it,
  // and writes [plugins."browser@openai-bundled"] enabled = false into config.toml
  await adapter.togglePluginState(scanned[0].path, false, 'agent');

  // Manifest file remains intact on disk
  assert.strictEqual(fs.existsSync(activeManifestPath), true);

  const configContent = fs.readFileSync(path.join(tempCodexHome, 'config.toml'), 'utf-8');
  assert.match(configContent, /\[plugins\."browser@openai-bundled"\]/);
  assert.match(configContent, /enabled\s*=\s*false/);

  // Rescan should reflect disabled state from config.toml
  const rescanned = adapter.scanPluginsDirectory(cacheRoot, 'agent');
  assert.strictEqual(rescanned.length, 1);
  assert.strictEqual(rescanned[0].enabled, false);

  // 3. Toggle back to true: config.toml is updated to enabled = true
  await adapter.togglePluginState(scanned[0].path, true, 'agent');
  const rescanned2 = adapter.scanPluginsDirectory(cacheRoot, 'agent');
  assert.strictEqual(rescanned2.length, 1);
  assert.strictEqual(rescanned2[0].enabled, true);

  // 4. Delete: must throw error because it is a native plugin
  await assert.rejects(
    async () => {
      await adapter.deletePlugin(scanned[0].path, 'agent');
    },
    (err: any) => {
      assert.match(err.message, /原生内置插件/);
      return true;
    }
  );

  // Plugin files must remain intact
  assert.strictEqual(fs.existsSync(browserVersionDir), true);

  fs.rmSync(tempCodexHome, { recursive: true, force: true });
});

test('CodexConfigHelper: validates TOML format and automatically rolls back if format is invalid', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-validate-rollback-'));
  const configPath = path.join(tempDir, 'config.toml');

  const validOriginal = `model = "gpt-5.6-sol"

[features]
js_repl = false
`;
  fs.writeFileSync(configPath, validOriginal, 'utf-8');

  // 1. validateConfig tests
  const checkGood = CodexConfigHelper.validateConfig(validOriginal);
  assert.strictEqual(checkGood.valid, true);

  // Missing newline / concatenated table
  const checkBad1 = CodexConfigHelper.validateConfig('enabled = true[features]');
  assert.strictEqual(checkBad1.valid, false);
  assert.match(checkBad1.error || '', /TOML 语法校验失败/);

  // Plugin key with space
  const checkBad2 = CodexConfigHelper.validateConfig('[plugins."bad plugin@market"]\nenabled = true');
  assert.strictEqual(checkBad2.valid, false);
  assert.match(checkBad2.error || '', /插件配置键包含非法空格/);

  // Marketplace name with space
  const checkBad3 = CodexConfigHelper.validateConfig('[marketplaces."bad market"]\nsource_type = "git"');
  assert.strictEqual(checkBad3.valid, false);
  assert.match(checkBad3.error || '', /市场源名称包含非法空格/);

  // 2. Attempting to write invalid config via writeRawConfig MUST throw and preserve original file
  assert.throws(() => {
    CodexConfigHelper.writeRawConfig(tempDir, 'enabled = true[features]');
  });

  // Verify file was NOT modified and matches validOriginal
  const currentContent = fs.readFileSync(configPath, 'utf-8');
  assert.strictEqual(currentContent, validOriginal);

  // 3. Writing valid configuration succeeds
  const updatedValid = `${validOriginal}\n[plugins."demo@openai-bundled"]\nenabled = true\n`;
  CodexConfigHelper.writeRawConfig(tempDir, updatedValid);
  assert.strictEqual(fs.readFileSync(configPath, 'utf-8'), updatedValid);

  // 4. Test rollbackFromBackup
  assert.strictEqual(CodexConfigHelper.rollbackFromBackup(tempDir), true);
  assert.strictEqual(fs.readFileSync(configPath, 'utf-8'), validOriginal);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('SkillScanner: accurately scans skills from filesystem, ignores path strings like ./skills/, and detects standalone skills', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-scanner-test-'));

  // 1. Plugin with skills/ directory containing sub-skills
  const pluginDir = path.join(tempDir, 'sample-plugin');
  fs.mkdirSync(path.join(pluginDir, 'skills', 'skill-one'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'skills', 'skill-one', 'SKILL.md'), '# Skill One', 'utf-8');
  fs.mkdirSync(path.join(pluginDir, 'skills', 'skill-two'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'skills', 'skill-two', 'SKILL.md'), '# Skill Two', 'utf-8');

  // plugin.json with path string "./skills/"
  const scanned = SkillScanner.scanPluginSkills(pluginDir, undefined, './skills/', 'sample-plugin');
  assert.deepStrictEqual(scanned.sort(), ['skill-one', 'skill-two']);

  // 2. Standalone skill with root SKILL.md
  const standaloneDir = path.join(tempDir, 'single-skill');
  fs.mkdirSync(standaloneDir, { recursive: true });
  fs.writeFileSync(path.join(standaloneDir, 'SKILL.md'), '# Single Skill', 'utf-8');
  const standaloneScanned = SkillScanner.scanPluginSkills(standaloneDir, undefined, undefined, 'single-skill');
  assert.deepStrictEqual(standaloneScanned, ['single-skill']);

  // 3. normalizeSkillsArray rejects string paths
  assert.deepStrictEqual(SkillScanner.normalizeSkillsArray('./skills/'), []);
  assert.deepStrictEqual(SkillScanner.normalizeSkillsArray(['valid-skill', './path/', '']), ['valid-skill']);

  fs.rmSync(tempDir, { recursive: true, force: true });
});



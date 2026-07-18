import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

test('plugins modal uses a stable per-user or per-install agent id', () => {
  assert.match(source, /const PLUGINS_AGENT_ID_STORAGE_KEY = 'obot_plugins_agent_id';/);
  assert.match(source, /function getPluginsAgentId\(user: any\): string/);
  assert.match(source, /plugins-user-\$\{sanitizeAgentIdPart\(userId\)\}/);
  assert.match(source, /plugins-install-/);
  assert.match(source, /const pluginsAgentId = useMemo\(\(\) => getPluginsAgentId\(user\), \[user\?\.id\]\);/);
  assert.match(source, /agentId=\{pluginsAgentId\}/);
  assert.doesNotMatch(source, /<PluginsModal\s+agentId=\{activeThreadId\}/);
  assert.doesNotMatch(source, /const PLUGINS_AGENT_ID = 'plugins';/);
});

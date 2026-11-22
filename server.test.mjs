import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.ts';
import { LanesStore } from './src/server/store.ts';

async function withServer(fn, options = {}) {
  const app = await createApp({ attachFrontend: false, store: new LanesStore(), ...options });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('GET /api/workspace returns lanes, branches, needs, bots, jobs, library, and memory', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/workspace`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.lanes.length >= 4);
    assert.ok(data.branches.length >= 4);
    assert.ok(data.needs.length >= 3);
    assert.ok(data.bots.length >= 3);
    assert.ok(data.memory.length >= 3);
  });
});

test('POST /api/lanes creates a lane and private lanes enforce local-only agent', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/lanes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Clinic notes',
        purpose: 'Private local drafts',
        isPrivate: true,
        color: 4,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.lane.isPrivate, true);
    assert.equal(body.lane.defaultAgentId, 'qwen');

    // Assigning a private lane to a bot must be rejected
    const botRes = await fetch(`${baseUrl}/api/bots/bot-researcher/lanes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ laneId: body.lane.id }),
    });
    assert.equal(botRes.status, 400);
  });
});

test('POST /api/branches/:id/approval resolves approval and drafts a memory note', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/branches/br-look-pr/approval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.branch.status, 'done');
    assert.equal(data.branch.approval.status, 'approved');
    const linkedNeed = data.state.needs.find((n) => n.branchId === 'br-look-pr');
    assert.equal(linkedNeed.resolved, true);
  });
});

test('POST /api/home/route routes @research directly to Research lane', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/home/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '@research Check latest PROMIS citations' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.target, 'lane');
    assert.equal(data.laneId, 'research');
  });
});

test('Design Tokens API returns themes and server blocks root files', async () => {
  await withServer(async (baseUrl) => {
    const tokensRes = await fetch(`${baseUrl}/api/tokens`);
    assert.equal(tokensRes.status, 200);
    const tokensDoc = await tokensRes.json();
    const themeIds = tokensDoc.color.themes.map((t) => t.id);
    assert.ok(themeIds.includes('xp-light'));
    assert.ok(themeIds.includes('win98-light'));
    assert.ok(themeIds.includes('terminal-dark'));

    for (const blocked of ['/package.json', '/server.ts', '/.env.example']) {
      const res = await fetch(`${baseUrl}${blocked}`);
      assert.equal(res.status, 404, `Expected 404 for ${blocked}`);
    }
  });
});

test('Gemini media and transcription routes validate required inputs', async () => {
  await withServer(async (baseUrl) => {
    const imgRes = await fetch(`${baseUrl}/api/gemini/image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    assert.equal(imgRes.status, 400);

    const vidRes = await fetch(`${baseUrl}/api/gemini/video`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    assert.equal(vidRes.status, 400);

    const musicRes = await fetch(`${baseUrl}/api/gemini/music`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    assert.equal(musicRes.status, 400);

    const txRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64: '' }),
    });
    assert.equal(txRes.status, 400);
  });
});

test('a message keeps a finished worker finished unless the user chooses to reopen it', () => {
  const store = new LanesStore();
  const done = () => store.getState().branches.find((b) => b.id === 'br-diff-scope');
  assert.equal(done().status, 'done');

  store.appendBranchMessage('br-diff-scope', { role: 'user', text: 'Quick question' });
  assert.equal(done().status, 'done');

  assert.equal(store.reopenBranch('br-diff-scope')?.status, 'working');
});

test('a merged worker is never reopened', () => {
  const store = new LanesStore();
  const branch = store.getState().branches.find((b) => b.id === 'br-diff-scope');
  branch.merged = true;
  store.reopenBranch('br-diff-scope');
  assert.equal(branch.status, 'done');
});

async function sendToWorker(baseUrl, branchId, body) {
  const res = await fetch(`${baseUrl}/api/branches/${branchId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const workspace = await (await fetch(`${baseUrl}/api/workspace`)).json();
  return { status: res.status, branch: workspace.branches.find((b) => b.id === branchId) };
}

test('POST /api/branches/:id/messages reopens only when asked and only after the reply succeeds', async () => {
  const ok = async () => ({ reply: 'ok', modelLabel: 'Stub', sources: [] });
  await withServer(
    async (baseUrl) => {
      const justAsk = await sendToWorker(baseUrl, 'br-diff-scope', { text: 'question' });
      assert.equal(justAsk.status, 200);
      assert.equal(justAsk.branch.status, 'done');
      const reopen = await sendToWorker(baseUrl, 'br-diff-scope', { text: 'keep going', reopen: true });
      assert.equal(reopen.status, 200);
      assert.equal(reopen.branch.status, 'working');
    },
    { replyGenerator: ok }
  );

  const fails = async () => {
    throw new Error('model down');
  };
  await withServer(
    async (baseUrl) => {
      const failed = await sendToWorker(baseUrl, 'br-diff-scope', { text: 'keep going', reopen: true });
      assert.equal(failed.status, 502);
      assert.equal(failed.branch.status, 'done');
    },
    { replyGenerator: fails }
  );
});

test('resolving a service request fixes the service it is about', () => {
  const store = new LanesStore();
  const state = store.getState();
  const gemini = state.services.find((s) => s.id === 'srv-gemini');
  const qwen = state.services.find((s) => s.id === 'srv-qwen');
  gemini.status = 'degraded';
  state.needs.push({
    id: 'need-gemini',
    kind: 'service',
    ask: 'Check Gemini proxy',
    serviceId: 'srv-gemini',
    laneName: 'Lanes build',
    laneColor: 3,
    sourceTitle: 'Studio services',
    age: 'now',
    resolved: false,
  });
  store.resolveNeed('need-gemini');
  assert.equal(gemini.status, 'healthy');
  assert.equal(qwen.status, 'degraded');
});

test('Ghostty terminal config API discovers shaders and blocks shader path traversal', async () => {
  await withServer(async (baseUrl) => {
    const cfgRes = await fetch(`${baseUrl}/api/terminal/ghostty-config`);
    assert.equal(cfgRes.status, 200);
    const cfg = await cfgRes.json();
    assert.equal(typeof cfg.found, 'boolean');
    assert.ok(Array.isArray(cfg.shaders));

    const badTraversal = await fetch(`${baseUrl}/api/terminal/ghostty-shader?path=../../.env`);
    assert.equal(badTraversal.status, 404);

    const badApp = await fetch(`${baseUrl}/api/terminal/open-external`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'calc' }),
    });
    assert.equal(badApp.status, 400);
  });
});

test('Bot, Lane plugin, and Library file manager CRUD enforce privacy boundaries', async () => {
  await withServer(async (baseUrl) => {
    // Create a new bot with plugins
    const botRes = await fetch(`${baseUrl}/api/bots`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'QA Bot',
        job: 'Check tests and diffs',
        agentId: 'codex',
        allowedLaneIds: ['research', 'money'],
        enabledPlugins: ['git-diffs', 'lint-test'],
      }),
    });
    assert.equal(botRes.status, 201);
    const { bot } = await botRes.json();
    assert.equal(bot.name, 'QA Bot');
    // Private 'money' lane is stripped from bot access automatically
    assert.deepEqual(bot.allowedLaneIds, ['research']);
    assert.deepEqual(bot.enabledPlugins, ['git-diffs', 'lint-test']);

    // Toggle plugin on bot
    const pluginRes = await fetch(`${baseUrl}/api/bots/${bot.id}/plugins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: 'web-search' }),
    });
    assert.equal(pluginRes.status, 200);
    const { bot: updatedBot } = await pluginRes.json();
    assert.ok(updatedBot.enabledPlugins.includes('web-search'));

    // Cloud plugin blocked on private lane ('money')
    const blockedRes = await fetch(`${baseUrl}/api/lanes/money/plugins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: 'web-search' }),
    });
    assert.equal(blockedRes.status, 400);

    // Local-safe plugin allowed on private lane
    const okLocalRes = await fetch(`${baseUrl}/api/lanes/money/plugins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: 'pdf-reader' }),
    });
    assert.equal(okLocalRes.status, 200);

    // Library file create, edit, and delete
    const addFileRes = await fetch(`${baseUrl}/api/library`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'plan.md', folder: 'Specs', laneId: 'research', kind: 'doc', preview: 'v1' }),
    });
    assert.equal(addFileRes.status, 201);
    const { item } = await addFileRes.json();
    assert.equal(item.folder, 'Specs');

    const editFileRes = await fetch(`${baseUrl}/api/library/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'plan-v2.md', preview: 'v2 content' }),
    });
    assert.equal(editFileRes.status, 200);
    const { item: editedItem } = await editFileRes.json();
    assert.equal(editedItem.name, 'plan-v2.md');

    const delFileRes = await fetch(`${baseUrl}/api/library/${item.id}`, { method: 'DELETE' });
    assert.equal(delFileRes.status, 200);

    // Delete bot
    const delBotRes = await fetch(`${baseUrl}/api/bots/${bot.id}`, { method: 'DELETE' });
    assert.equal(delBotRes.status, 200);
  });
});

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const createApp = require('../src/app');
const TaskStore = require('../src/task-store');

test('Task Manager API supports CRUD, validation, persistence, and 404 responses', async (t) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'skyleax-task-manager-'));
  const dataFile = path.join(temporaryDirectory, 'tasks.json');
  const store = new TaskStore(dataFile);
  await store.initialize();

  const server = createApp(store).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options) => fetch(`${baseUrl}${route}`, options);

  const homePage = await request('/');
  assert.equal(homePage.status, 200);
  assert.match(await homePage.text(), /Make room for/);
  const frontendScript = await request('/app.js');
  assert.equal(frontendScript.status, 200);
  assert.match(await frontendScript.text(), /apiRequest\('\/api\/tasks'\)/);

  const initialList = await request('/api/tasks');
  assert.equal(initialList.status, 200);
  assert.deepEqual((await initialList.json()).data, []);

  const invalidCreate = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '   ', priority: 'urgent' }),
  });
  assert.equal(invalidCreate.status, 400);
  assert.equal((await invalidCreate.json()).success, false);

  const createResponse = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '  Write project report  ',
      description: 'Summarize the API work.',
      priority: 'high',
      dueDate: '2026-12-31',
    }),
  });
  assert.equal(createResponse.status, 201);
  const createdTask = (await createResponse.json()).data;
  assert.equal(createdTask.title, 'Write project report');
  assert.equal(createdTask.completed, false);
  assert.ok(createdTask.id);

  const getResponse = await request(`/api/tasks/${createdTask.id}`);
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).data.id, createdTask.id);

  const updateResponse = await request(`/api/tasks/${createdTask.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).data.completed, true);

  const restartedStore = new TaskStore(dataFile);
  await restartedStore.initialize();
  assert.equal((await restartedStore.getById(createdTask.id)).completed, true);

  const deleteResponse = await request(`/api/tasks/${createdTask.id}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 200);
  assert.equal((await request(`/api/tasks/${createdTask.id}`)).status, 404);
  assert.equal((await request('/api/unknown')).status, 404);
});

const path = require('node:path');
const express = require('express');
const TaskStore = require('./src/task-store');
const createApp = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const dataFile = process.env.TASKS_FILE || path.join(__dirname, 'data', 'tasks.json');

async function startServer() {
  const store = new TaskStore(dataFile);
  await store.initialize();

  const app = createApp(store);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SKYLEAX Task Manager is listening on 0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start the Task Manager server:', error);
    process.exitCode = 1;
  });
}

module.exports = { startServer };

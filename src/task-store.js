const fs = require('node:fs/promises');
const path = require('node:path');

class TaskStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await fs.writeFile(this.filePath, '[]\n', 'utf8');
    }

    await this.readAll();
  }

  async readAll() {
    const contents = await fs.readFile(this.filePath, 'utf8');
    const tasks = JSON.parse(contents);

    if (!Array.isArray(tasks)) {
      throw new Error('Task data must be a JSON array.');
    }

    return tasks;
  }

  async getAll() {
    return this.readAll();
  }

  async getById(id) {
    const tasks = await this.readAll();
    return tasks.find((task) => task.id === id) || null;
  }

  async create(task) {
    return this.withWriteLock(async () => {
      const tasks = await this.readAll();
      tasks.push(task);
      await this.writeAll(tasks);
      return task;
    });
  }

  async update(id, changes) {
    return this.withWriteLock(async () => {
      const tasks = await this.readAll();
      const index = tasks.findIndex((task) => task.id === id);

      if (index === -1) {
        return null;
      }

      tasks[index] = { ...tasks[index], ...changes };
      await this.writeAll(tasks);
      return tasks[index];
    });
  }

  async remove(id) {
    return this.withWriteLock(async () => {
      const tasks = await this.readAll();
      const index = tasks.findIndex((task) => task.id === id);

      if (index === -1) {
        return null;
      }

      const [removedTask] = tasks.splice(index, 1);
      await this.writeAll(tasks);
      return removedTask;
    });
  }

  async withWriteLock(operation) {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.catch(() => {});
    return result;
  }

  async writeAll(tasks) {
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');

    try {
      await fs.rename(temporaryPath, this.filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

module.exports = TaskStore;

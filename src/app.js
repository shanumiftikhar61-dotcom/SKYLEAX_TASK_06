const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');

const publicDirectory = path.join(__dirname, '..', 'public');
const allowedPriorities = new Set(['low', 'medium', 'high']);

function validateTask(input, isUpdate = false) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Request body must be a JSON object.'];
  }

  if (!isUpdate || Object.hasOwn(input, 'title')) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      errors.push('Title is required and must be a non-empty string.');
    } else if (input.title.trim().length > 120) {
      errors.push('Title must be 120 characters or fewer.');
    }
  }

  if (Object.hasOwn(input, 'description')) {
    if (typeof input.description !== 'string') {
      errors.push('Description must be a string.');
    } else if (input.description.trim().length > 1000) {
      errors.push('Description must be 1000 characters or fewer.');
    }
  }

  if (Object.hasOwn(input, 'priority') && !allowedPriorities.has(input.priority)) {
    errors.push('Priority must be low, medium, or high.');
  }

  if (Object.hasOwn(input, 'dueDate') && input.dueDate !== '') {
    if (
      typeof input.dueDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
      Number.isNaN(Date.parse(`${input.dueDate}T00:00:00Z`)) ||
      new Date(`${input.dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.dueDate
    ) {
      errors.push('Due date must be a valid date in YYYY-MM-DD format.');
    }
  }

  if (Object.hasOwn(input, 'completed') && typeof input.completed !== 'boolean') {
    errors.push('Completed must be true or false.');
  }

  return errors;
}

function createApp(taskStore) {
  const app = express();

  app.use(express.json({ limit: '20kb' }));
  app.use(express.static(publicDirectory));

  app.get('/api/tasks', async (request, response, next) => {
    try {
      const tasks = await taskStore.getAll();
      response.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tasks/:id', async (request, response, next) => {
    try {
      const task = await taskStore.getById(request.params.id);
      if (!task) {
        return response.status(404).json({
          success: false,
          error: { message: 'Task not found.' },
        });
      }
      return response.json({ success: true, data: task });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/tasks', async (request, response, next) => {
    const errors = validateTask(request.body);
    if (errors.length) {
      return response.status(400).json({
        success: false,
        error: { message: 'Please correct the task details.', details: errors },
      });
    }

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: request.body.title.trim(),
      description: (request.body.description || '').trim(),
      priority: request.body.priority || 'medium',
      dueDate: request.body.dueDate || '',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const createdTask = await taskStore.create(task);
      return response.status(201).json({ success: true, data: createdTask });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/tasks/:id', async (request, response, next) => {
    const errors = validateTask(request.body, true);
    if (errors.length) {
      return response.status(400).json({
        success: false,
        error: { message: 'Please correct the task details.', details: errors },
      });
    }

    const changes = {};
    for (const field of ['title', 'description', 'priority', 'dueDate', 'completed']) {
      if (Object.hasOwn(request.body, field)) {
        changes[field] = typeof request.body[field] === 'string'
          ? request.body[field].trim()
          : request.body[field];
      }
    }
    changes.updatedAt = new Date().toISOString();

    try {
      const updatedTask = await taskStore.update(request.params.id, changes);
      if (!updatedTask) {
        return response.status(404).json({
          success: false,
          error: { message: 'Task not found.' },
        });
      }
      return response.json({ success: true, data: updatedTask });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/tasks/:id', async (request, response, next) => {
    try {
      const deletedTask = await taskStore.remove(request.params.id);
      if (!deletedTask) {
        return response.status(404).json({
          success: false,
          error: { message: 'Task not found.' },
        });
      }
      return response.json({ success: true, data: deletedTask });
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', (request, response) => {
    response.status(404).json({
      success: false,
      error: { message: 'API route not found.' },
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      success: false,
      error: { message: 'Route not found.' },
    });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      return next(error);
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return response.status(400).json({
        success: false,
        error: { message: 'Request body contains invalid JSON.' },
      });
    }

    console.error('Request failed:', error);
    return response.status(500).json({
      success: false,
      error: { message: 'An unexpected server error occurred.' },
    });
  });

  return app;
}

module.exports = createApp;

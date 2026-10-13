# SKYLEAX Task Manager

A beginner-friendly task manager built with Node.js, Express, and plain HTML, CSS, and JavaScript. The browser interface uses `fetch()` to communicate with a REST API, and task data is saved in a local JSON file so it remains available after restarting the server.

## Requirements

- Node.js 18 or newer (Node.js 20 or newer recommended)
- npm

## Run locally

1. Open a terminal in this project folder.
2. Install the one runtime dependency:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

The server creates `data/tasks.json` on first start if it does not exist. It keeps this file when the server restarts. The data file is excluded from Git so personal tasks are not accidentally committed.

For automatic restarts while developing, use `npm run dev`. Set the `PORT` environment variable to use a different port. Set `TASKS_FILE` if you want the server to store its JSON data in a different location.

## What you can do

- Add tasks with a description, priority, and optional due date.
- Edit task details, mark tasks complete or active, and delete tasks.
- Search task names and descriptions and filter by completion status.
- Review total, active, and completed task counts.

## API

All endpoints return JSON. Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "message": "...", "details": [...] } }`; `details` is included for validation errors.

| Method | Endpoint | Description | Success status |
| --- | --- | --- | --- |
| `GET` | `/api/tasks` | Retrieve all tasks | `200 OK` |
| `GET` | `/api/tasks/:id` | Retrieve one task by its ID | `200 OK` |
| `POST` | `/api/tasks` | Create a task | `201 Created` |
| `PUT` | `/api/tasks/:id` | Update one or more task fields | `200 OK` |
| `DELETE` | `/api/tasks/:id` | Delete a task | `200 OK` |

Task IDs are generated UUIDs. A task has this shape:

```json
{
  "id": "generated-uuid",
  "title": "Prepare project presentation",
  "description": "Gather the latest project screenshots.",
  "priority": "medium",
  "dueDate": "2026-12-31",
  "completed": false,
  "createdAt": "2026-10-13T12:00:00.000Z",
  "updatedAt": "2026-10-13T12:00:00.000Z"
}
```

For `POST`, `title` is required. `description` is optional (up to 1000 characters), `priority` is optional (`low`, `medium`, or `high`; default `medium`), and `dueDate` is optional and must use the `YYYY-MM-DD` format. For `PUT`, send any one or more of those fields plus `completed` (`true` or `false`). Invalid input returns `400 Bad Request`; a missing task returns `404 Not Found`. Unknown API and page routes return a structured `404` JSON response.

## Test endpoints with curl

Start the server in one terminal using `npm start`. Run these examples in another terminal (PowerShell users can use `curl.exe`).

Create a task:

```bash
curl -i -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Prepare project presentation\",\"description\":\"Gather screenshots\",\"priority\":\"high\",\"dueDate\":\"2026-12-31\"}"
```

Copy the `id` from the response, then list and retrieve tasks:

```bash
curl -i http://localhost:3000/api/tasks
curl -i http://localhost:3000/api/tasks/YOUR_TASK_ID
```

Update, complete, and delete that task:

```bash
curl -i -X PUT http://localhost:3000/api/tasks/YOUR_TASK_ID \
  -H "Content-Type: application/json" \
  -d "{\"completed\":true,\"title\":\"Finalize project presentation\"}"

curl -i -X DELETE http://localhost:3000/api/tasks/YOUR_TASK_ID
```

To check validation, send an empty title; the API responds with `400` and a list of validation messages:

```bash
curl -i -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\" \"}"
```

In Postman, create requests with the methods and URLs in the API table. For `POST` and `PUT`, select **Body → raw → JSON** and provide the corresponding JSON request body.

## Run the automated checks

```bash
npm test
```

The built-in Node.js test runner exercises the API's CRUD operations, input validation, JSON-file persistence, and unknown-route handling without requiring a database or test framework dependency.

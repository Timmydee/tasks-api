import "dotenv/config"; // must be first: loads .env before anything reads it
import express from "express";
import { pool, setupDatabase } from "./db";

const app = express();
app.use(express.json()); // lets us read JSON sent in requests

const PORT = Number(process.env.PORT) || 3000;
const SERVER_NAME = process.env.SERVER_NAME || "my-laptop";

// Adds a header to every answer saying which server replied.
// Later this shows you whether Railway or Render answered.
app.use((req, res, next) => {
  res.setHeader("x-served-by", SERVER_NAME);
  next();
});

// Turns "5" from the URL into the number 5, or null if it isn't a valid id.
function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

app.get("/", (req, res) => {
  res.json({ message: "Tasks API is running", servedBy: SERVER_NAME });
});

// CREATE: add a new task
app.post("/tasks", async (req, res) => {
  const title = req.body?.title;
  if (typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const result = await pool.query(
    "INSERT INTO tasks (title) VALUES ($1) RETURNING *",
    [title.trim()]
  );
  res.status(201).json(result.rows[0]);
});

// READ: list all tasks
app.get("/tasks", async (req, res) => {
  const result = await pool.query("SELECT * FROM tasks ORDER BY id");
  res.json(result.rows);
});

// READ: one task
app.get("/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.json(result.rows[0]);
});

// UPDATE: change the title and/or mark done
app.put("/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const { title, done } = req.body ?? {};
  if (id === null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  if (title !== undefined && typeof title !== "string") {
    res.status(400).json({ error: "title must be text" });
    return;
  }
  if (done !== undefined && typeof done !== "boolean") {
    res.status(400).json({ error: "done must be true or false" });
    return;
  }
  // COALESCE means "use the new value, or keep the old one if none was sent"
  const result = await pool.query(
    `UPDATE tasks
       SET title = COALESCE($1, title), done = COALESCE($2, done)
     WHERE id = $3
     RETURNING *`,
    [title ?? null, done ?? null, id]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.json(result.rows[0]);
});

// DELETE: remove a task
app.delete("/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.status(204).end(); // 204 = "done, nothing to send back"
});

// HEALTH: hosts and Cloudflare call this to ask "are you OK?"
// It only says OK if the database answers too.
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", servedBy: SERVER_NAME });
  } catch {
    res.status(503).json({ status: "database unreachable", servedBy: SERVER_NAME });
  }
});

async function start() {
  await setupDatabase();
  app.listen(PORT, () => {
    console.log(`${SERVER_NAME} is listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Could not start:", err.message);
  process.exit(1);
});
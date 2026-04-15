#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { request, HttpError, NetworkError } from "./client.js";

type TodoResponse = {
  id: number;
  title: string;
  completed: boolean;
  priority?: number | null;
  startAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

function log(step: string, ok: boolean, detail: string) {
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${step}: ${detail}`);
}

async function main() {
  const config = loadConfig();
  console.log("─ g1x5j MCP smoke test ─");
  console.log(`baseUrl: ${config.baseUrl}`);
  console.log("");

  // 1. list_todos (initial)
  const initial = await request<PageResponse<TodoResponse>>(config, "/todos", {
    query: { size: 5 },
  });
  log("1. list_todos", true, `총 ${initial.totalCount}개`);

  // 2. create_todo
  const created = await request<TodoResponse>(config, "/todos", {
    method: "POST",
    body: {
      title: "g1x5j smoke test",
      priority: 3,
    },
  });
  log("2. create_todo", true, `id=${created.id}, title="${created.title}"`);
  const id = created.id;

  // 3. get_todo
  const got = await request<TodoResponse>(config, `/todos/${id}`);
  log("3. get_todo", true, `title="${got.title}", completed=${got.completed}`);

  // 4. update_todo
  const updated = await request<TodoResponse>(config, `/todos/${id}`, {
    method: "PATCH",
    body: { title: "g1x5j smoke test (updated)" },
  });
  log("4. update_todo", true, `title="${updated.title}"`);

  // 5. complete_todo
  const completed = await request<TodoResponse>(config, `/todos/${id}`, {
    method: "PATCH",
    body: { isCompleted: true },
  });
  log("5. complete_todo", true, `completed=${completed.completed}`);

  // 6. delete_todo
  await request<void>(config, `/todos/${id}`, { method: "DELETE" });
  log("6. delete_todo", true, `id=${id} soft-deleted`);

  console.log("");
  console.log("─ all 6 steps passed ─");
  console.log("");
  console.log("Verify ai_actions rows with:");
  console.log(
    '  SELECT id, user_id, agent_type, agent_name, action_type, target_type, target_id, created_at',
  );
  console.log("  FROM todolist_db.ai_actions");
  console.log(`  WHERE target_id = ${id} AND target_type = 'todo'`);
  console.log("  ORDER BY id;");
  console.log("");
  console.log("Cleanup the smoke-test todo (already soft-deleted; hard-delete if desired):");
  console.log(`  DELETE FROM todolist_db.todos WHERE id = ${id};`);
  console.log(`  DELETE FROM todolist_db.ai_actions WHERE target_id = ${id} AND target_type = 'todo';`);
}

main().catch((e) => {
  if (e instanceof HttpError) {
    console.error(`✗ smoke failed (HTTP ${e.status}): ${e.message}`);
  } else if (e instanceof NetworkError) {
    console.error(`✗ smoke failed (network): ${e.message}`);
  } else if (e instanceof Error) {
    console.error(`✗ smoke failed: ${e.message}`);
  } else {
    console.error(`✗ smoke failed:`, e);
  }
  process.exit(1);
});

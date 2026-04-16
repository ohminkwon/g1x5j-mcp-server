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

type WeeklyGoalResponse = {
  id: number;
  title: string;
  weekStart: string;
  weekEnd: string;
  journeys: { journeyOrder: number; todoId: number; title: string }[];
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

  // 7. get_calendar_summary
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const calSummary = await request<{ month: string; days: { date: string; items: unknown[] }[] }>(
    config,
    "/todos/calendar/summary",
    { query: { month }, extraHeaders: { "X-Timezone": config.timezone } },
  );
  log("7. get_calendar_summary", true, `month=${calSummary.month}, days=${calSummary.days.length}`);

  // 8. get_calendar_day
  const today = now.toISOString().slice(0, 10);
  const calDay = await request<{ date: string; items: { id: number; title: string }[] }>(
    config,
    "/todos/calendar/day",
    { query: { date: today, includeCompleted: true }, extraHeaders: { "X-Timezone": config.timezone } },
  );
  log("8. get_calendar_day", true, `date=${calDay.date}, items=${calDay.items.length}`);

  // 9-11. share flow (create → get → revoke) — needs a live todo
  const shareTodo = await request<TodoResponse>(config, "/todos", {
    method: "POST",
    body: { title: "g1x5j share smoke test", priority: 2 },
  });
  const shareId = shareTodo.id;
  log("9a. create todo for share", true, `id=${shareId}`);

  const shareRes = await request<{ shareToken: string; shareUrl: string; expiresAt: string | null }>(
    config,
    `/todos/${shareId}/share`,
    { method: "POST", body: { expiresIn: "7d" } },
  );
  log("9. share_todo", true, `url=${shareRes.shareUrl}`);

  const shareGet = await request<{ shareToken: string; shareUrl: string }>(
    config,
    `/todos/${shareId}/share`,
  );
  log("10. get_share", true, `token=${shareGet.shareToken.slice(0, 8)}...`);

  await request<void>(config, `/todos/${shareId}/share`, { method: "DELETE" });
  log("11. revoke_share", true, `todoId=${shareId} share revoked`);

  // cleanup share test todo
  await request<void>(config, `/todos/${shareId}`, { method: "DELETE" });
  log("11a. cleanup share todo", true, `id=${shareId} soft-deleted`);

  // 12. create_goal
  const goal = await request<WeeklyGoalResponse>(config, "/weekly-goals", {
    method: "POST",
    body: { title: "g1x5j goal smoke test" },
  });
  log("12. create_goal", true, `id=${goal.id}, title="${goal.title}"`);
  const goalId = goal.id;

  // 13. get_current_goal
  const gotGoal = await request<WeeklyGoalResponse>(config, "/weekly-goals/current");
  log("13. get_current_goal", true, `id=${gotGoal.id}, week=${gotGoal.weekStart}~${gotGoal.weekEnd}`);

  // 14. update_goal
  const updatedGoal = await request<WeeklyGoalResponse>(config, `/weekly-goals/${goalId}`, {
    method: "PATCH",
    body: { title: "g1x5j goal smoke test (updated)" },
  });
  log("14. update_goal", true, `title="${updatedGoal.title}"`);

  // 15. delete_goal
  await request<void>(config, `/weekly-goals/${goalId}`, { method: "DELETE" });
  log("15. delete_goal", true, `goalId=${goalId} soft-deleted`);

  console.log("");
  console.log("─ all 15 steps passed ─");
  console.log("");
  console.log("Cleanup smoke-test data (already soft-deleted):");
  console.log(`  DELETE FROM todolist_db.todos WHERE id IN (${id}, ${shareId});`);
  console.log(`  DELETE FROM todolist_db.ai_actions WHERE target_id IN (${id}, ${shareId}) AND target_type = 'todo';`);
  console.log(`  DELETE FROM todolist_db.weekly_goals WHERE id = ${goalId};`);
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

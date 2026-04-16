#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config.js";
import { HttpError, NetworkError, request } from "./client.js";

const config = loadConfig();

const server = new McpServer({
  name: "g1x5j-mcp-server",
  version: "0.1.0",
});

export type TodoResponse = {
  id: number;
  title: string;
  completed: boolean;
  priority?: number | null;
  startAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  shared?: boolean;
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

type WeeklyGoalJourney = {
  journeyOrder: number;
  todoId: number;
  title: string;
  isCompleted: boolean;
  priority: number;
  startAt: string | null;
  dueAt: string | null;
};

type WeeklyGoalResponse = {
  id: number;
  title: string;
  weekStart: string;
  weekEnd: string;
  journeys: WeeklyGoalJourney[];
};

function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function toErrorContent(e: unknown) {
  let message: string;
  if (e instanceof HttpError) {
    message = `요청 실패 (HTTP ${e.status}): ${e.message}`;
  } else if (e instanceof NetworkError) {
    message = `연결 실패: ${e.message}`;
  } else if (e instanceof Error) {
    message = `오류: ${e.message}`;
  } else {
    message = "알 수 없는 오류가 발생했습니다.";
  }
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function formatTodoLine(todo: TodoResponse, idx?: number): string {
  const check = todo.completed ? "[x]" : "[ ]";
  const pri = todo.priority ? `P${todo.priority} ` : "";
  const due = todo.dueAt ? ` — due ${todo.dueAt.slice(0, 10)}` : "";
  const prefix = idx !== undefined ? `${idx}. ` : "";
  return `${prefix}${check} ${pri}${todo.title} (id=${todo.id})${due}`;
}

function formatTodoFull(todo: TodoResponse): string {
  const lines = [
    `id: ${todo.id}`,
    `title: ${todo.title}`,
    `completed: ${todo.completed}`,
  ];
  if (todo.priority) lines.push(`priority: P${todo.priority}`);
  if (todo.startAt) lines.push(`startAt: ${todo.startAt}`);
  if (todo.dueAt) lines.push(`dueAt: ${todo.dueAt}`);
  lines.push(`createdAt: ${todo.createdAt}`);
  lines.push(`updatedAt: ${todo.updatedAt}`);
  return lines.join("\n");
}

function formatGoalFull(goal: WeeklyGoalResponse): string {
  const lines = [
    `id: ${goal.id}`,
    `title: ${goal.title}`,
    `week: ${goal.weekStart} ~ ${goal.weekEnd}`,
  ];
  if (goal.journeys.length === 0) {
    lines.push("journeys: (비어있음)");
  } else {
    lines.push(`journeys (${goal.journeys.length}/5):`);
    for (const j of goal.journeys) {
      const check = j.isCompleted ? "[x]" : "[ ]";
      const pri = j.priority ? `P${j.priority} ` : "";
      lines.push(`  ${j.journeyOrder}. ${check} ${pri}${j.title} (todoId=${j.todoId})`);
    }
  }
  return lines.join("\n");
}

// ---------- list_todos ----------
server.registerTool(
  "list_todos",
  {
    title: "List todos",
    description: "Get a paginated list of the authenticated user's todos.",
    inputSchema: {
      status: z
        .enum(["all", "active", "completed"])
        .optional()
        .describe('Filter by completion. "active" excludes completed; default "all".'),
      source: z
        .enum(["all", "user", "ai"])
        .optional()
        .describe('Filter by origin. "ai" = created via MCP/agents; default "all".'),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("1-based page number. Default 1."),
      size: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Items per page (1-100). Default 10."),
    },
  },
  async ({ status, source, page, size }) => {
    try {
      const data = await request<PageResponse<TodoResponse>>(config, "/todos", {
        query: { status, source, page, size },
      });
      const totalPages = Math.max(data.totalPages, 1);
      const header = `${data.totalCount}개 중 ${data.items.length}개 표시 (page ${data.page}/${totalPages}):`;
      if (data.items.length === 0) {
        return textContent(`${header}\n(비어있음)`);
      }
      const lines = data.items.map((t, i) => formatTodoLine(t, i + 1));
      return textContent([header, ...lines].join("\n"));
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- get_todo ----------
server.registerTool(
  "get_todo",
  {
    title: "Get a todo by id",
    description: "Retrieve a single todo's full details.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ id }) => {
    try {
      const todo = await request<TodoResponse>(config, `/todos/${id}`);
      return textContent(formatTodoFull(todo));
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- create_todo ----------
server.registerTool(
  "create_todo",
  {
    title: "Create a new todo",
    description:
      "Create a new todo for the authenticated user. Only the title is required.",
    inputSchema: {
      title: z
        .string()
        .min(1)
        .max(500)
        .describe("Todo title (1-500 characters)."),
      priority: z
        .union([z.literal(1), z.literal(2), z.literal(3)])
        .optional()
        .describe("Priority: 1=high, 2=medium, 3=low."),
      startAt: z
        .string()
        .optional()
        .describe("ISO 8601 datetime for start (e.g. 2026-04-15T09:00:00+09:00)."),
      dueAt: z
        .string()
        .optional()
        .describe("ISO 8601 datetime for due date."),
    },
  },
  async ({ title, priority, startAt, dueAt }) => {
    try {
      const todo = await request<TodoResponse>(config, "/todos", {
        method: "POST",
        body: { title, priority, startAt, dueAt },
      });
      return textContent(`생성 완료:\n${formatTodoFull(todo)}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- update_todo ----------
server.registerTool(
  "update_todo",
  {
    title: "Update a todo",
    description:
      "Partially update a todo's fields. Only include the fields you want to change.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
      title: z.string().min(1).max(500).optional().describe("New title."),
      priority: z
        .union([z.literal(1), z.literal(2), z.literal(3)])
        .optional()
        .describe("New priority (1=high, 2=medium, 3=low)."),
      startAt: z.string().optional().describe("New start datetime (ISO 8601)."),
      dueAt: z.string().optional().describe("New due datetime (ISO 8601)."),
    },
  },
  async ({ id, title, priority, startAt, dueAt }) => {
    try {
      const patch: Record<string, unknown> = {};
      if (title !== undefined) patch.title = title;
      if (priority !== undefined) patch.priority = priority;
      if (startAt !== undefined) patch.startAt = startAt;
      if (dueAt !== undefined) patch.dueAt = dueAt;
      if (Object.keys(patch).length === 0) {
        return textContent("수정할 필드가 없습니다.");
      }
      const todo = await request<TodoResponse>(config, `/todos/${id}`, {
        method: "PATCH",
        body: patch,
      });
      return textContent(`수정 완료:\n${formatTodoFull(todo)}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- complete_todo ----------
server.registerTool(
  "complete_todo",
  {
    title: "Mark a todo as completed",
    description: "Set a todo's isCompleted to true.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ id }) => {
    try {
      const todo = await request<TodoResponse>(config, `/todos/${id}`, {
        method: "PATCH",
        body: { isCompleted: true },
      });
      return textContent(`완료 처리됨:\n${formatTodoFull(todo)}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- delete_todo ----------
server.registerTool(
  "delete_todo",
  {
    title: "Delete a todo",
    description: "Soft-delete a todo.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ id }) => {
    try {
      await request<void>(config, `/todos/${id}`, { method: "DELETE" });
      return textContent(`삭제 완료: id=${id}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- get_calendar_summary ----------
server.registerTool(
  "get_calendar_summary",
  {
    title: "Get monthly calendar summary",
    description:
      "Returns a summary of todos for a given month, grouped by date. Useful for seeing the overall schedule.",
    inputSchema: {
      month: z
        .string()
        .describe('Month in YYYY-MM format (e.g. "2026-04").'),
      includeCompleted: z
        .boolean()
        .optional()
        .describe("Include completed todos. Default false."),
    },
  },
  async ({ month, includeCompleted }) => {
    try {
      const data = await request<{
        month: string;
        days: { date: string; items: { todoId: number; title: string; priority: number; isCompleted: boolean }[] }[];
      }>(config, "/todos/calendar/summary", {
        query: { month, includeCompleted },
        extraHeaders: { "X-Timezone": config.timezone },
      });
      if (data.days.length === 0) {
        return textContent(`${data.month}: 일정 없음`);
      }
      const lines = data.days.map((day) => {
        const items = day.items
          .map((t) => {
            const check = t.isCompleted ? "[x]" : "[ ]";
            const pri = t.priority ? `P${t.priority} ` : "";
            return `  ${check} ${pri}${t.title} (id=${t.todoId})`;
          })
          .join("\n");
        return `${day.date} (${day.items.length}건)\n${items}`;
      });
      return textContent(`${data.month} 캘린더:\n\n${lines.join("\n\n")}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- get_calendar_day ----------
server.registerTool(
  "get_calendar_day",
  {
    title: "Get todos for a specific day",
    description:
      "Returns all todos that overlap with a given date. Useful for daily planning.",
    inputSchema: {
      date: z
        .string()
        .describe('Date in YYYY-MM-DD format (e.g. "2026-04-16").'),
      includeCompleted: z
        .boolean()
        .optional()
        .describe("Include completed todos. Default false."),
    },
  },
  async ({ date, includeCompleted }) => {
    try {
      const data = await request<{
        date: string;
        items: { id: number; title: string; isCompleted: boolean; priority: number; startAt: string | null; dueAt: string | null }[];
      }>(config, "/todos/calendar/day", {
        query: { date, includeCompleted },
        extraHeaders: { "X-Timezone": config.timezone },
      });
      if (data.items.length === 0) {
        return textContent(`${data.date}: 일정 없음`);
      }
      const lines = data.items.map((t, i) => {
        const check = t.isCompleted ? "[x]" : "[ ]";
        const pri = t.priority ? `P${t.priority} ` : "";
        const due = t.dueAt ? ` — due ${t.dueAt.slice(0, 10)}` : "";
        return `${i + 1}. ${check} ${pri}${t.title} (id=${t.id})${due}`;
      });
      return textContent(`${data.date} (${data.items.length}건):\n${lines.join("\n")}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- share_todo ----------
server.registerTool(
  "share_todo",
  {
    title: "Create a share link for a todo",
    description:
      "Generate a public share link for a todo. Others can view it without login.",
    inputSchema: {
      todoId: z.number().int().positive().describe("The numeric id of the todo."),
      expiresIn: z
        .enum(["none", "1d", "7d", "30d"])
        .optional()
        .describe('Expiration: "none" (never), "1d", "7d", "30d". Default "7d".'),
    },
  },
  async ({ todoId, expiresIn }) => {
    try {
      const data = await request<{
        shareToken: string;
        shareUrl: string;
        expiresAt: string | null;
      }>(config, `/todos/${todoId}/share`, {
        method: "POST",
        body: { expiresIn: expiresIn ?? "7d" },
      });
      const expires = data.expiresAt ? `만료: ${data.expiresAt.slice(0, 10)}` : "만료 없음";
      return textContent(`공유 링크 생성:\n${data.shareUrl}\n${expires}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- get_share ----------
server.registerTool(
  "get_share",
  {
    title: "Get existing share link",
    description: "Check if a todo has an active share link.",
    inputSchema: {
      todoId: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ todoId }) => {
    try {
      const data = await request<{
        shareToken: string;
        shareUrl: string;
        expiresAt: string | null;
      }>(config, `/todos/${todoId}/share`);
      const expires = data.expiresAt ? `만료: ${data.expiresAt.slice(0, 10)}` : "만료 없음";
      return textContent(`공유 링크:\n${data.shareUrl}\n${expires}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- revoke_share ----------
server.registerTool(
  "revoke_share",
  {
    title: "Revoke a share link",
    description: "Remove a todo's public share link. The shared URL will stop working.",
    inputSchema: {
      todoId: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ todoId }) => {
    try {
      await request<void>(config, `/todos/${todoId}/share`, { method: "DELETE" });
      return textContent(`공유 해제 완료: todoId=${todoId}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- pin_todo ----------
server.registerTool(
  "pin_todo",
  {
    title: "Pin a todo to weekly goal",
    description:
      "Pin a todo to a journey slot on the weekly goal board. Requires an existing weekly goal.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
      goalId: z.number().int().positive().describe("The numeric id of the weekly goal."),
      journeyOrder: z
        .number()
        .int()
        .min(1)
        .max(5)
        .describe("Journey slot position (1-5)."),
    },
  },
  async ({ id, goalId, journeyOrder }) => {
    try {
      await request<void>(config, `/todos/${id}/pin`, {
        method: "PATCH",
        body: { goalId, journeyOrder },
      });
      return textContent(`고정 완료: todoId=${id} → goalId=${goalId}, slot=${journeyOrder}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- unpin_todo ----------
server.registerTool(
  "unpin_todo",
  {
    title: "Unpin a todo from weekly goal",
    description: "Remove a todo from its weekly goal journey slot.",
    inputSchema: {
      id: z.number().int().positive().describe("The numeric id of the todo."),
    },
  },
  async ({ id }) => {
    try {
      await request<void>(config, `/todos/${id}/pin`, { method: "DELETE" });
      return textContent(`고정 해제 완료: todoId=${id}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- get_current_goal ----------
server.registerTool(
  "get_current_goal",
  {
    title: "Get current weekly goal",
    description:
      "Retrieve the current week's goal with its journey slots. Returns empty if no goal is set.",
    inputSchema: {},
  },
  async () => {
    try {
      const goal = await request<WeeklyGoalResponse>(config, "/weekly-goals/current");
      if (!goal) {
        return textContent("현재 주간 목표가 없습니다.");
      }
      return textContent(formatGoalFull(goal));
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- create_goal ----------
server.registerTool(
  "create_goal",
  {
    title: "Create a weekly goal",
    description:
      "Create a new weekly goal for the current week. Only one goal per week is allowed.",
    inputSchema: {
      title: z
        .string()
        .min(1)
        .max(500)
        .describe("Goal title (1-500 characters)."),
    },
  },
  async ({ title }) => {
    try {
      const goal = await request<WeeklyGoalResponse>(config, "/weekly-goals", {
        method: "POST",
        body: { title },
      });
      return textContent(`주간 목표 생성 완료:\n${formatGoalFull(goal)}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- update_goal ----------
server.registerTool(
  "update_goal",
  {
    title: "Update a weekly goal",
    description: "Update the title of an existing weekly goal.",
    inputSchema: {
      goalId: z.number().int().positive().describe("The numeric id of the weekly goal."),
      title: z
        .string()
        .min(1)
        .max(500)
        .describe("New goal title (1-500 characters)."),
    },
  },
  async ({ goalId, title }) => {
    try {
      const goal = await request<WeeklyGoalResponse>(config, `/weekly-goals/${goalId}`, {
        method: "PATCH",
        body: { title },
      });
      return textContent(`주간 목표 수정 완료:\n${formatGoalFull(goal)}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

// ---------- delete_goal ----------
server.registerTool(
  "delete_goal",
  {
    title: "Delete a weekly goal",
    description: "Soft-delete a weekly goal. Pinned todos are preserved but unpinned.",
    inputSchema: {
      goalId: z.number().int().positive().describe("The numeric id of the weekly goal."),
    },
  },
  async ({ goalId }) => {
    try {
      await request<void>(config, `/weekly-goals/${goalId}`, { method: "DELETE" });
      return textContent(`주간 목표 삭제 완료: goalId=${goalId}`);
    } catch (e) {
      return toErrorContent(e);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("g1x5j-mcp-server running on stdio");
}

main().catch((e) => {
  console.error("fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

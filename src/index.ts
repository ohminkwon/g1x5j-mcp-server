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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("g1x5j-mcp-server running on stdio");
}

main().catch((e) => {
  console.error("fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});

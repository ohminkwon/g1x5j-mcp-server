import type { Config } from "./config.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  extraHeaders?: Record<string, string>;
};

export async function request<T>(
  config: Config,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, extraHeaders } = options;

  let url = config.baseUrl + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) {
      url += (path.includes("?") ? "&" : "?") + qs;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new NetworkError("백엔드 요청이 10초 안에 응답하지 않았습니다.");
    }
    throw new NetworkError("백엔드에 연결하지 못했습니다.");
  }

  if (res.status >= 500) {
    throw new HttpError(res.status, "서비스 오류, 잠시 후 다시 시도하세요.");
  }

  if (!res.ok) {
    let message = "요청이 거부되었습니다.";
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const errorBody = (await res.json()) as { message?: unknown };
        if (errorBody && typeof errorBody.message === "string" && errorBody.message) {
          message = errorBody.message;
        }
      }
    } catch {
      // swallow parse error; use default message
    }
    throw new HttpError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

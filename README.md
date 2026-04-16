# g1x5j-mcp-server

[![npm version](https://img.shields.io/npm/v/g1x5j-mcp-server)](https://www.npmjs.com/package/g1x5j-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green)](https://nodejs.org/)

MCP server for [G1x5J](https://g1x5j.app) todo service — Claude Desktop, VS Code, Cursor 등 MCP 클라이언트에서 Todo 관리를 할 수 있게 해주는 Node.js stdio 서버.

## Quick Start

```bash
git clone https://github.com/ohminkwon/g1x5j-mcp-server.git
cd g1x5j-mcp-server
npm install
npm run build
```

Claude Desktop `claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "tdl": {
      "command": "node",
      "args": ["/path/to/g1x5j-mcp-server/dist/index.js"],
      "env": {
        "TDL_PAT": "tdl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TDL_BASE_URL": "https://api.g1x5j.app"
      }
    }
  }
}
```

> `args`의 경로를 clone한 실제 절대 경로로 변경하세요.
> `TDL_PAT`은 TDL 설정 페이지에서 발급한 Personal Access Token입니다.

Claude Desktop 재시작 후 tool 목록에 17개 tool이 노출됩니다.

## 환경변수

| 이름 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `TDL_PAT` | O | — | TDL 설정 페이지에서 발급한 Personal Access Token |
| `TDL_BASE_URL` | X | `http://localhost:8080` | Backend API base URL |
| `TDL_TIMEZONE` | X | 시스템 자동 감지 | IANA 타임존 (예: `Asia/Seoul`) |

## 제공 Tool (17개)

### Todo CRUD (6)
| Tool | 설명 |
|------|------|
| `list_todos` | 페이지네이션 todo 목록 |
| `get_todo` | 단건 조회 |
| `create_todo` | 새 todo 생성 |
| `update_todo` | 부분 수정 (title/priority/startAt/dueAt) |
| `complete_todo` | todo 완료 처리 |
| `delete_todo` | soft delete |

### Calendar (2)
| Tool | 설명 |
|------|------|
| `get_calendar_summary` | 월간 요약 (YYYY-MM) |
| `get_calendar_day` | 일자별 todo 목록 (YYYY-MM-DD) |

### Share (3)
| Tool | 설명 |
|------|------|
| `share_todo` | 공유 링크 생성 |
| `get_share` | 기존 공유 링크 조회 |
| `revoke_share` | 공유 해제 |

### Pin (2)
| Tool | 설명 |
|------|------|
| `pin_todo` | 주간 목표 슬롯에 고정 |
| `unpin_todo` | 고정 해제 |

### Goal (4)
| Tool | 설명 |
|------|------|
| `get_current_goal` | 이번 주 목표 + journey 슬롯 조회 |
| `create_goal` | 주간 목표 생성 |
| `update_goal` | 주간 목표 제목 수정 |
| `delete_goal` | 주간 목표 삭제 |

## 설치 (npm)

```bash
npx g1x5j-mcp-server
```

또는 전역 설치:

```bash
npm install -g g1x5j-mcp-server
g1x5j-mcp-server
```

## 요구사항
- Node.js 20 이상
- [G1x5J](https://g1x5j.app) 계정 + PAT 발급

## 버전
v0.2.0 — Todo CRUD, Calendar, Share, Pin, Goal 17개 tool 지원.

## 라이선스
MIT

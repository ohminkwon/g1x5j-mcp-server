# g1x5j-mcp-server

[![npm version](https://img.shields.io/npm/v/g1x5j-mcp-server)](https://www.npmjs.com/package/g1x5j-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green)](https://nodejs.org/)

MCP server for [G1x5J](https://g1x5j.app) todo service — Claude Desktop, VS Code, Cursor 등 MCP 클라이언트에서 Todo 관리를 할 수 있게 해주는 Node.js stdio 서버.

## Quick Start

### [클로드 데스크탑 코드탭](https://claude.com/download) / Claude Code CLI 사용자

Claude Code 또는 claude.ai 코드탭에서 아래와 같이 요청하면 설치부터 설정까지 자동으로 처리됩니다:

> "https://github.com/ohminkwon/g1x5j-mcp-server 클론하고 MCP 서버 설정해줘. 권한은 전부 허용으로 해줘."

이후, 해당 폴더 /.claude/settings.local.json 파일에서 아래와 같이 확인 가능

```json
{
  "permissions": {
    "allow": [
      "mcp__g1x5j__*",
    ]
  }
}
```

### Claude Desktop 사용자

Claude Desktop에서는 직접 명령 실행이 불가하므로 아래 수동 설치를 따라주세요. 설치 과정에서 도움이 필요하면 Claude에게 물어보세요.

### 수동 설치

```bash
git clone https://github.com/ohminkwon/g1x5j-mcp-server.git
cd g1x5j-mcp-server
npm install
npm run build
```

Claude Desktop 설정 파일에 추가:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "g1x5j": {
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

> **`args` 경로 변경 필요**: `/path/to/g1x5j-mcp-server/dist/index.js` 전체를 clone한 위치의 절대 경로로 바꾸세요.
> 예: `C:\Users\홍길동\projects`에서 clone했다면 → `C:/Users/홍길동/projects/g1x5j-mcp-server/dist/index.js`
>
> **`TDL_PAT`**: [G1x5J](https://g1x5j.app) 설정 페이지에서 발급한 Personal Access Token을 입력하세요.

Claude Desktop 재시작 후 tool 목록에 17개 tool이 노출됩니다.

## 환경변수

| 이름 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `TDL_PAT` | O | — | G1x5J 설정 페이지에서 발급한 Personal Access Token |
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

# g1x5j-mcp-server

TDL 서비스를 Claude Desktop 등 MCP(Model Context Protocol) 클라이언트에 노출하는 Node.js stdio MCP 서버 프로토타입.

이 서버는 REST API 래핑만 담당한다.  
비즈니스 로직, DB 접근은 하지 않는다.  
인증은 환경변수로 주입된 Personal Access Token(PAT) 에 위임.

## 요구사항
- Node.js 20 이상 (native `fetch` 사용)
- 실행 중인 TDL Backend (기본 `http://localhost:8080`)
- TDL 에서 발급한 PAT (`tdl_` 접두사)

## 설치 및 빌드
```bash
npm install
npm run build
```

## 환경변수
| 이름 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `TDL_PAT` | O | — | TDL 설정 페이지에서 발급한 Personal Access Token |
| `TDL_BASE_URL` | X | `http://localhost:8080` | Backend API base URL (trailing slash 자동 제거) |
| `TDL_TIMEZONE` | X | 시스템 자동 감지 | IANA 타임존 (예: `Asia/Seoul`). Calendar 엔드포인트의 `X-Timezone` 헤더에 사용 |

## Claude Desktop 연동
`claude_desktop_config.json` 에 다음 블록을 추가한다:

```json
{
  "mcpServers": {
    "tdl": {
      "command": "node",
      "args": ["C:/Users/I_POSTURE_01/Desktop/ProjectTDL/g1x5j-mcp-server/dist/index.js"],
      "env": {
        "TDL_PAT": "tdl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "TDL_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

Claude Desktop 재시작 후 tool 목록에 17개 tool이 노출된다.

## 제공 Tool (17개)

### Todo CRUD (6)
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `list_todos` | `GET /todos` | 페이지네이션 todo 목록 |
| `get_todo` | `GET /todos/{id}` | 단건 조회 |
| `create_todo` | `POST /todos` | 새 todo 생성 |
| `update_todo` | `PATCH /todos/{id}` | 부분 수정 (title/priority/startAt/dueAt) |
| `complete_todo` | `PATCH /todos/{id}` | `isCompleted: true` 고정 전송 |
| `delete_todo` | `DELETE /todos/{id}` | soft delete |

### Calendar (2)
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `get_calendar_summary` | `GET /todos/calendar/summary` | 월간 요약 (YYYY-MM) |
| `get_calendar_day` | `GET /todos/calendar/day` | 일자별 todo 목록 (YYYY-MM-DD) |

### Share (3)
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `share_todo` | `POST /todos/{id}/share` | 공유 링크 생성 |
| `get_share` | `GET /todos/{id}/share` | 기존 공유 링크 조회 |
| `revoke_share` | `DELETE /todos/{id}/share` | 공유 해제 |

### Pin (2)
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `pin_todo` | `PATCH /todos/{id}/pin` | 주간 목표 슬롯에 고정 |
| `unpin_todo` | `DELETE /todos/{id}/pin` | 고정 해제 |

### Goal (4)
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `get_current_goal` | `GET /weekly-goals/current` | 이번 주 목표 + journey 슬롯 조회 |
| `create_goal` | `POST /weekly-goals` | 주간 목표 생성 |
| `update_goal` | `PATCH /weekly-goals/{goalId}` | 주간 목표 제목 수정 |
| `delete_goal` | `DELETE /weekly-goals/{goalId}` | 주간 목표 삭제 (soft delete) |

## Smoke 테스트
로컬 backend 기동 상태에서:
```bash
TDL_PAT=tdl_xxx TDL_BASE_URL=http://localhost:8080 npm run smoke
```
15단계 순차 실행: Todo CRUD(1-6) → Calendar(7-8) → Share(9-11) → Goal CRUD(12-15). 각 단계 결과가 stdout에 출력된다.

## 트러블슈팅
- **`TDL_PAT env var required`**: 환경변수가 주입되지 않음. Claude Desktop config 의 `env` 블록 또는 쉘 env 확인.
- **401 Unauthorized**: PAT 이 만료/폐기됨. TDL 설정 페이지에서 재발급.
- **Connection refused**: `TDL_BASE_URL` 이 맞는지, Backend 가 기동 중인지 확인.
- **서버가 조용히 죽음**: stdio transport 는 stdout 에 쓰면 프로토콜이 깨진다. 모든 로그는 stderr 로 출력되어야 함 (이 서버는 `console.error` 만 사용).

## 보안 주의
- PAT 은 stderr/로그/에러 메시지 어디에도 출력되지 않는다. 노출되는 것은 `tdl_xxxx…` 형태의 접두사 뿐.
- 5xx 응답의 서버 원문 메시지는 사용자에게 전달하지 않고 고정 문구로 마스킹한다.
- `.env`, `.env.*` 는 `.gitignore` 에 등록되어 있어 커밋되지 않는다.

## 버전
v0.2.0 — Calendar/Share/Pin/Goal tool 추가. 실사용자 npm 배포는 이후 과제.

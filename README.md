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

Claude Desktop 재시작 후 tool 목록에 `list_todos`, `create_todo` 등이 노출된다.

## 제공 Tool
| Tool | REST 매핑 | 설명 |
|------|-----------|------|
| `list_todos` | `GET /todos` | 페이지네이션 todo 목록 |
| `get_todo` | `GET /todos/{id}` | 단건 조회 |
| `create_todo` | `POST /todos` | 새 todo 생성 |
| `update_todo` | `PATCH /todos/{id}` | 부분 수정 (title/priority/startAt/dueAt) |
| `complete_todo` | `PATCH /todos/{id}` | `isCompleted: true` 고정 전송 |
| `delete_todo` | `DELETE /todos/{id}` | soft delete |

## Smoke 테스트
로컬 backend 기동 상태에서:
```bash
TDL_PAT=tdl_xxx TDL_BASE_URL=http://localhost:8080 npm run smoke
```
6 단계 (list → create → get → update → complete → delete) 가 순차 실행되고 각 단계 결과가 stdout 에 출력된다.

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
v0.1.0 — 로컬 프로토타입. 실사용자 npm 배포는 이후 과제.

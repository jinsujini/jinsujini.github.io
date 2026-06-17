---
author: jinsujini
pubDatetime: 2026-06-06T09:00:00+09:00
title: PERSONA
slug: side-project
featured: false
draft: false
tags:
  - 프로젝트
description: "타입스크립트와 Tailwind Css로 구현한 개인 프로젝트 입니다."
---

## 프로젝트 소개
책 속 인물의 가치관을 바탕으로 사용자의 고민을 함께 바라보는 AI 멘토링 채팅 서비스입니다. 사용자는 해리, 셜록, 어린 왕자 등 다양한 인물을 선택해 대화하며 자신의 상황을 새로운 관점에서 해석할 수 있습니다. WebSocket 기반 실시간 채팅과 몰입형 UX를 통해 실제 인물과 대화하는 듯한 경험을 제공합니다.

![PERSONA 메인 화면](/persona_main.png)

## 기술 스택
- React 
- TypeScript
- Tailwind css
- Fast API
- Zustand

## 구현 과정



### 1. 퍼블리싱
Figma로 ui&ux 디자인을 진행한 후 퍼블리싱 작업을 시작했습니다. 퍼블리싱에서 가장 중요하게 생각한 포인트는 가운데 *인물 카드 인터랙션* 입니다. 
카드 세장이 1초마다 스와이프되는 형태로 기획했습니다. 처음에는 사용자가 스와이프 할 수 있도록 하고자 했지만 실제 첫 화면은 다양한 인물을 차례대로 소개한다는 느낌을 위해서 자동 스와이프 형태로 구현하게 되었습니다. 



```tsx
import type { Character } from "../../data/characters"

interface Props {
  characters: Character[]
  num: number
}

export default function CharacterFan({ characters, num }: Props) {
  return (
    <div className="relative w-full h-105 select-none">
      {characters.map((character, charIndex) => {
        const total = characters.length
        const dist = ((charIndex - num + total) % total)
        const pos = dist > 1 ? dist - total : dist

        return (
          <img
            key={character.name}
            src={character.img}
            alt={character.name}
            draggable={false}
            className="character-card"
            style={{
              left: `calc(50% - 100px + ${pos * 120}px)`,
              transform: `rotate(${pos * 15}deg)`,
              opacity: pos === 0 ? 1 : 0.7,
              zIndex: pos === 0 ? 10 : 0,
            }}
          />
        )
      })}
    </div>
  )
}
```

카드 배치의 핵심은 `num`(현재 선택된 카드 인덱스)을 기준으로 각 카드의 상대 위치 `pos`를 계산하는 부분입니다.

- `dist`: 현재 카드로부터의 순환 거리 → `((charIndex - num + total) % total)`
- `pos`: `dist`를 `-1 / 0 / 1`로 변환 → `dist > 1`이면 `dist - total`

| pos | 위치 | 회전 | 투명도 |
|-----|------|------|--------|
| -1  | 중앙 - 120px | -15deg | 0.7 |
| 0   | 중앙 | 0deg | 1 |
| 1   | 중앙 + 120px | 15deg | 0.7 |

가운데 카드(`pos === 0`)만 완전 불투명 + 최상위 레이어로 올려 포커스를 주고, 양옆 카드는 살짝 회전·반투명 처리해 부채꼴 느낌을 냈습니다.

### 2. 웹소켓

웹소켓 로직은 따로 다른 글로 한번 더 다루겠지만 연결 로직에 대해서 간단하게 기록하려고 합니다!

전체 흐름은 3계층으로 분리했습니다.

```
WebSocketClient (lib/websocket.ts)   ←  연결 / 전송 / 재연결 담당
        ↓ subscribe
useWebSocket hook                    ←  메시지 파싱 & 스토어 업데이트
        ↓
ChatPage (UI)                        ←  사용자 인터랙션
```

#### WebSocketClient 핵심 설계 3가지

**1. 소켓 중복 생성 방지**

```ts
if (
  this.ws?.readyState === WebSocket.OPEN ||
  this.ws?.readyState === WebSocket.CONNECTING
) return
```

`OPEN`만 체크하면 `CONNECTING` 상태에서 재호출 시 소켓이 2개 생겨 메시지가 중복 수신됩니다. 두 상태를 모두 체크해 조기 리턴합니다.

**2. 전송 큐 (sendQueue)**

연결 완료 전에 `send()`가 호출되면 메시지를 큐에 쌓아두고, `onopen` 시점에 일괄 전송합니다. 그룹 채팅에서는 `onOpen` 콜백으로 `character_ids`를 먼저 보낸 뒤 큐를 플러시해 초기화 순서를 보장합니다.

**3. 자동 재연결**

`wasClean: false`(비정상 종료)일 때만 3초 후 재연결을 시도합니다. 서버가 의도적으로 연결을 닫는 경우 무한 재연결 루프를 방지하기 위해 `wasClean` 조건을 체크합니다.

#### 싱글턴 vs 인스턴스 분리

```ts
export const wsClient = new WebSocketClient()  // 1:1 채팅 전역 싱글턴

export function createWebSocketClient() {  // 그룹 채팅용 팩토리
  return new WebSocketClient()
}
```

1:1 채팅은 앱 전체에서 하나의 연결만 유지하면 되므로 싱글턴을 사용합니다. 그룹 채팅은 1:1 채팅과 연결이 충돌하지 않도록 훅 마운트마다 새 인스턴스를 생성합니다.

#### useWebSocket 훅 — 메시지 타입별 처리

| 메시지 타입 | 처리 |
|------------|------|
| `chunk` | AI 응답을 실시간으로 마지막 메시지에 이어붙임 (스트리밍) |
| `done` | 스트리밍 완료, 로딩 UI 해제 |
| `summary` | 요약 텍스트로 Promise resolve |
| `error` | 스트리밍 중이면 에러 메시지 노출, 요약 대기 중이면 Promise reject |

스트리밍 상태(`isStreamingRef`)와 요약 Promise resolver(`summaryResolverRef`)는 `useState` 대신 `useRef`로 관리합니다. `useEffect` 클로저는 최초 렌더 시의 값을 캡처하기 때문에, 나중에 업데이트된 state 값을 핸들러 내부에서 읽지 못합니다. `useRef`는 `.current`를 통해 항상 최신값을 참조할 수 있습니다.

### 3. 백엔드 API 설계

백엔드는 웹소켓과 어울리는 python 기반의 FastAPI 를 선택했습니다. 초기 세팅 구조가 간단하고 굉장히 가벼운 프레임워크라는 생각이 들더라고요! API가 몇 개 없고 라이브러리를 python 기반을 사용하면 좋은 선택일 거 같습니다!

우선 제 기획에서 나와야하는 API 명세는

- 1:1 채팅 /chat/{characterId}
- 단체 채팅 /groupchat
- 채팅 요약 아카이브 /achive

단체 채팅의 경우에 1:1 채팅을 여러개 연결하는 방식도 생각을 해봤었는데, 사용자와 인물들 간의 대화보다 진짜 채팅방처럼 인물 간의 대화도 연결되면 좋을 거 같다는 생각이 들어서 api를 하나 더 제작하게 되었습니다. 

#### `GET /characters`

사용 가능한 캐릭터 목록을 반환합니다.

```json
[{ "id": "harry", "name": "Harry Potter" }, ...]
```

#### `WS /ws/chat/{character_id}` — 1:1 채팅

**클라이언트 → 서버**

| 용도 | 형식 |
|------|------|
| 메시지 전송 | `{ "message": "..." }` |
| 대화 초기화 | `{ "action": "reset" }` |
| 대화 요약 | `{ "action": "summarize" }` |

**서버 → 클라이언트**

| type | 설명 | 추가 필드 |
|------|------|----------|
| `chunk` | 스트리밍 응답 | `content` |
| `done` | 응답 완료 | - |
| `reset_done` | 초기화 완료 | - |
| `summary` | 요약 결과 | `content` |
| `error` | 오류 | `content` |

#### `WS /ws/group-chat` — 다중 캐릭터 채팅

캐릭터들이 순서대로 응답하며 서로 다른 관점을 제시합니다.

연결 직후 캐릭터 목록을 먼저 전송합니다.

```json
{ "character_ids": ["harry", "sherlock", "little_prince"] }
```

이후 메시지 / reset / summarize는 1:1 채팅과 동일하게 사용합니다.

**서버 → 클라이언트**

| type | 설명 | 추가 필드 |
|------|------|----------|
| `chunk` | 스트리밍 응답 | `character_id`, `content` |
| `character_done` | 캐릭터 응답 완료 | `character_id` |
| `done` | 전체 라운드 완료 | - |
| `reset_done` | 초기화 완료 | - |
| `summary` | 요약 결과 | `content` |
| `error` | 오류 | `character_id`(선택), `content` |


#### 그룹 채팅 히스토리 자료구조

1:1 채팅과 그룹 채팅의 히스토리 자료구조를 다르게 설계했습니다.

```python
# 1:1 채팅 — Gemini Content 타입 그대로 유지
conversation_history: list[types.Content] = []

# 그룹 채팅 — 라운드 단위 dict로 보관
history: list[dict] = []
# [{ "user": "...", "responses": [{ "character_id": "harry", "content": "..." }, ...] }]
```

그룹 채팅에서 `types.Content`를 바로 쓰지 않는 이유는, 캐릭터마다 다른 컨텍스트를 조립해야 하기 때문입니다. raw dict로 보관해야 나중에 캐릭터별로 재구성할 수 있습니다.

#### `_build_group_history` — 캐릭터별 히스토리 재구성

Gemini API는 `user → model → user → model` 교대 구조를 요구합니다. 그런데 그룹 채팅에서는 한 라운드에 여러 캐릭터가 응답하므로, 각 캐릭터에게 전달할 히스토리를 1:1 대화처럼 재구성해야 합니다.

핵심은 **다른 캐릭터의 응답을 `role="user"` 메시지에 끼워 넣는 것**입니다.

```python
# 다른 캐릭터 응답을 user 메시지에 주입
if others:
    other_text = "\n".join(
        f"[{CHARACTERS[r['character_id']].name}]: {r['content']}" for r in others
    )
    user_text = f"{user_text}\n\n[다른 캐릭터들의 말]\n{other_text}"

contents.append(Content(role="user", parts=[Part(text=user_text)]))
if own_response:
    contents.append(Content(role="model", parts=[Part(text=own_response)]))
```

각 캐릭터 입장에서는 자신만 `role="model"`로 대답하는 1:1 대화처럼 보이지만, 실제로는 다른 캐릭터들의 발언을 컨텍스트로 받고 있습니다.

현재 라운드에서는 이미 응답한 캐릭터들의 내용과 함께 중복 방지 프롬프트도 삽입합니다.

```python
user_text = (
    f"{user_text}\n\n"
    f"[다른 캐릭터들의 말]\n{prior_text}\n\n"
    f"위 캐릭터들과 같은 말을 반복하지 말고, 너만의 가치관과 관점에서 다른 시각을 제시해줘."
)
```

이 덕분에 캐릭터들이 서로의 발언을 인식하면서도 각자 다른 관점을 유지할 수 있습니다.


### 4. AI 챗봇

ai 챗봇은 제미나이 flash 사용했습니다. 무료 ai 중에 가장 한국어를 잘 사용하고 프롬프트에 맞는 답변을 주더라고요. 처음에는 grok도 사용을 해봤지만 영어 -> 한국어로 넘어오는 과정에서 다국어가 섞여서 반환되기도 하고, 한국어 구사가 어색한 느낌이 있어서 바꾸게 되었습니다.

기획에서 ai 챗봇에게 요구하는 것은

- 사용자의 요청에 '가치관' 기반 답변
- 상황극 상황 방지
- 의료, 법률 기타 전문 지식에 대한 답변 금지
- 가치관에 어긋나는 답변이 요구될 경우 답변 우회
- 명확하게 답변하기 어려운 경우 상세 상황 재질문

으로 설정해서 프롬프트를 작성했습니다. 이런 공통 요구사항과 각 캐릭터별 요구사항을 분리해서 프롬프트를 작성했어요!


```python

@dataclass
class Character:
    id: str
    name: str
    system_prompt: str


CHARACTERS: dict[str, Character] = {
    "harry": Character(
        id="harry",
        name="Harry Potter",
        system_prompt=HARRY_PROMPT + COMMON_SYSTEM,
    ),
    "sherlock": Character(
        id="sherlock",
        name="Sherlock Holmes",
        system_prompt=SHERLOCK_PROMPT + COMMON_SYSTEM,
    ),
    "little_prince": Character(
        id="little_prince",
        name="Little Prince",
        system_prompt=LITTLE_PRINCE_PROMPT + COMMON_SYSTEM,
    ),
}
```



## 어려웠던 점

**웹소켓 연동**

처음에는 `WebSocket.OPEN` 상태만 체크하고 조기 리턴했는데, `CONNECTING` 상태에서 컴포넌트가 다시 마운트되면 소켓이 2개 생겨 메시지가 중복 수신되는 버그가 있었습니다. 두 상태를 모두 체크하는 것으로 해결했지만, 브라우저 WebSocket의 상태 전이 타이밍을 직접 다뤄보기 전까지는 원인을 찾기가 쉽지 않았습니다.

그룹 채팅에서는 연결 직후 `character_ids`를 가장 먼저 보내야 하는데, 소켓이 아직 `CONNECTING`인 상태에서 `send()`가 호출될 수 있었습니다. 전송 큐를 두고 `onopen` 시점에 일괄 전송하는 방식으로 초기화 순서를 보장했습니다.

**리액트 생명주기 관리**

스트리밍 상태를 `useState`로 관리하다가 버그를 만났습니다. `useEffect` 내부의 WebSocket 메시지 핸들러는 컴포넌트가 처음 마운트될 때의 값을 클로저로 캡처하기 때문에, 이후 state가 바뀌어도 핸들러 안에서는 항상 초기값만 읽었습니다. `useRef`로 바꿔 `.current`를 통해 항상 최신값을 참조하도록 해결했지만, React 클로저 동작을 제대로 이해하지 못했다면 원인을 잡기 어려운 버그였습니다.

**상태 관리**

그룹 채팅 히스토리를 어떤 형태로 저장할지 설계가 어려웠습니다. Gemini API가 요구하는 `user / model` 교대 구조 때문에, 여러 캐릭터가 응답하는 그룹 채팅의 히스토리를 `types.Content` 그대로 쌓을 수 없었습니다. 결국 라운드 단위 `dict`로 원본 데이터를 보관하고, API 호출 직전에 캐릭터마다 다른 컨텍스트로 재조립하는 방식을 선택했습니다.

## 느낀 점

기획부터 디자인, 프론트엔드, 백엔드까지 혼자 다 해보면서 각 영역이 어떻게 연결되는지 전체적으로 볼 수 있었던 프로젝트였습니다.

특히 WebSocket처럼 평소에 잘 안 쓰던 기술을 직접 구현해보면서, 단순히 API를 호출하는 것과 실시간 연결을 유지하는 것이 얼마나 다른 고민을 요구하는지 느꼈습니다. 버그를 만날 때마다 브라우저 동작이나 React 생명주기를 더 깊이 이해하게 되는 계기가 됐고요.

그룹 채팅 히스토리 설계처럼 "어떻게 저장할까"를 고민하는 시간이 생각보다 길었는데, 이런 설계 결정이 나중에 얼마나 큰 영향을 미치는지 직접 경험할 수 있었습니다. 다음에는 초반 설계에 더 시간을 쓰고 싶다는 생각이 들었어요.
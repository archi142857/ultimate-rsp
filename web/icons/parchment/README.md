# 양피지 그림

온라인 도전장의 양피지 조각(디자인 시안2 ①, 2026-11-08). 디자인 세션이 `세션소통\자료\그림_도구\parchment.py` 로 그렸다.

| 파일 | 크기 | 쓰임 |
|---|---|---|
| `roll.svg` | 200×24 | 두루마리 막대(위·아래) |
| `sheet.svg` | 180×120 | 종이. 늘려서 쓴다(preserveAspectRatio none) |
| `seal.svg` | 64×64 | 밀랍 봉인(주먹) |
| `seal-left.svg`, `seal-right.svg` | 64×64 | 봉인을 뜯을 때 갈라지는 두 쪽. 겹치면 seal.svg |
| `parchment.svg` | 160×128 | 첫 화면 도전장 칸의 한 장 그림 |

봉인에 새긴 주먹은 게임의 바위 손 그림(Microsoft [Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji), MIT, 고지문은 `LICENSE-fluentui-emoji.txt`)의 실루엣이다.
화면은 `web/js/online/parchment.js` 가 `<img>` 로 넣는다. 파일에 붙은 `<metadata>`(C2PA 출처 정보)는 지우지 않는다. 그림을 바꾸면 `parchment.js` 의 `PARCH_VERSION` 을 올린다(캐시).

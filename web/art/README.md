# 손 그림

포지션(손)마다 이모지 대신 쓰는 그림. Microsoft [Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji) 의 Color 판을 64×64 viewBox 에 감싼 것이다(MIT, 고지문은 `LICENSE-fluentui-emoji.txt`). 디자인 세션이 만들고 컨셉 세션이 넣는다.

- 파일 이름은 `<그림 이름>.svg`. 그림 이름은 `web/js/data/catalog.js` 의 손마다 `art`(없으면 `id`).
- 넣거나 빼거나 고친 뒤 `node scripts/art_list.mjs` 로 `web/js/data/art-files.js` 를 다시 만든다. 목록에 없는 그림은 쓰지 않는다.
- 규격은 `scripts/art_list.mjs` 의 `checkSvg` 와 `tests/art.test.mjs` 가 검사한다: viewBox `0 0 64 64`, 그림 80KB 아래(보통 40KB 아래, 파일에 붙는 `<metadata>` 는 세지 않는다), 글자·스크립트·바깥 주소 없이.
- 그림이 없는 손은 이모지가 나온다.

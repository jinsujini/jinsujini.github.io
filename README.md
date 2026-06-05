# jinsujini.github.io

개발 공부 내용과 프로젝트 경험을 기록하는 기술 블로그입니다.

**[https://jinsujini.github.io](https://jinsujini.github.io)**

## 기술 스택

- [Astro](https://astro.build/) + [AstroPaper](https://github.com/satnaing/astro-paper) 테마
- Tailwind CSS
- GitHub Pages (GitHub Actions 자동 배포)

## 로컬 실행

```bash
npm install
npm run dev
```

## 포스트 작성

`src/content/posts/` 에 `.md` 파일을 추가합니다.

```md
---
author: jinsujini
pubDatetime: 2026-06-05T09:00:00+09:00
title: 제목
slug: url-slug
featured: false
draft: false
tags:
  - 태그
description: "설명"
---

본문
```

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 & 배포합니다.

import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://jinsujini.github.io",
    title: "jinsujini's blog",
    description: "개발 경험과 학습 내용을 기록하는 기술 블로그입니다.",
    author: "jinsujini",
    profile: "https://github.com/jinsujini",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Asia/Seoul",
    dir: "ltr",
  },
  posts: {
    perPage: 5,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/jinsujini/jinsujini.github.io/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/jinsujini" },
    { name: "mail",   url: "mailto:20231168@sungshin.ac.kr" },
  ],
  shareLinks: [
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
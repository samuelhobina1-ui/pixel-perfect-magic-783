export function adminHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — Zentra Gaming Hub` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Zentra Gaming Hub` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] };
}
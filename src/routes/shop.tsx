import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery, productsQuery } from "@/lib/store";
import { ProductGrid } from "@/components/ProductGrid";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop all top-ups — ZENTRA GAMING HUB" },
      { name: "description", content: "All recharge cards and game currencies: Libyana, Almadar, LTT, CODM, PUBG, Free Fire, TikTok." },
      { property: "og:title", content: "Shop — ZENTRA GAMING HUB" },
      { property: "og:description", content: "Every recharge and game top-up in one place, priced in Naira." },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(categoriesQuery),
    context.queryClient.ensureQueryData(productsQuery),
  ]),
  component: Shop,
});

function Shop() {
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <h1 className="text-3xl font-bold">Shop</h1>
      {cats.map((c) => {
        const list = products.filter((p) => p.category_id === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">{c.name}</h2>
              <Link to="/$slug" params={{ slug: c.slug }} className="text-sm text-accent">View all</Link>
            </div>
            <ProductGrid products={list} />
          </section>
        );
      })}
    </main>
  );
}

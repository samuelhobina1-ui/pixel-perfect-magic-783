import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck, Zap, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/store";
import { ProductGrid } from "@/components/ProductGrid";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZENTRA GAMING HUB — Libyana, PUBG, CODM, Free Fire top-ups in Naira" },
      { name: "description", content: "Buy Libyana, Almadar, LTT data, CODM CP, PUBG UC, Free Fire diamonds and TikTok coins. Pay in Naira via Moniepoint." },
      { property: "og:title", content: "ZENTRA GAMING HUB" },
      { property: "og:description", content: "Recharge cards and game top-ups, paid in Naira via Moniepoint." },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(categoriesQuery),
    context.queryClient.ensureQueryData(productsQuery),
  ]),
  component: Index,
});

function Index() {
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  return (
    <main>
      <section className="relative overflow-hidden">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="bg-hero absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
            Top up <span className="text-primary">instantly</span>. Play <span className="text-accent">harder</span>.
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground">Libyana, Almadar, LTT, CODM, PUBG, Free Fire & TikTok — pay in Naira with Moniepoint.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/shop">Shop now</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/track">Track order</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 py-8 text-center text-xs md:text-sm">
        {[[Zap, "Fast delivery"], [Wallet, "Moniepoint · Naira"], [ShieldCheck, "Verified PINs"]].map(([I, t]) => {
          const Icon = I as typeof Zap;
          return <div key={t as string} className="card-glow p-4"><Icon className="mx-auto mb-2 h-6 w-6 text-primary" />{t as string}</div>;
        })}
      </section>
      <section className="mx-auto max-w-6xl px-4">
        <h2 className="mb-4 text-2xl font-bold">Categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cats.map((c) => (
            <Link key={c.id} to="/$slug" params={{ slug: c.slug }} className="card-glow p-5 text-center font-display text-lg font-semibold hover:text-primary">{c.name}</Link>
          ))}
        </div>
      </section>
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <h2 className="mb-4 text-2xl font-bold">Popular</h2>
        <ProductGrid products={products.slice(0, 8)} />
      </section>
    </main>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery, productsQuery } from "@/lib/store";
import { ProductGrid } from "@/components/ProductGrid";

export const Route = createFileRoute("/$slug")({
  loader: async ({ context, params }) => {
    const [cats] = await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
    const cat = cats.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    return { name: cat.name };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.name;
    return {
      meta: n ? [
        { title: `Buy ${n} — ZENTRA GAMING HUB` },
        { name: "description", content: `Buy ${n} instantly. Pay in Naira via OPay.` },
        { property: "og:title", content: `${n} — ZENTRA GAMING HUB` },
        { property: "og:description", content: `${n} top-ups paid in Naira via OPay.` },
      ] : [{ title: "Unavailable — ZENTRA GAMING HUB" }, { name: "robots", content: "noindex" }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {cat.image_url && <img src={cat.image_url} alt={cat.name} className="mb-6 h-40 w-full rounded-xl object-cover" />}
      <h1 className="mb-6 text-3xl font-bold"><span className="text-primary">{cat.name}</span></h1>
      <ProductGrid products={products.filter((p) => p.category_id === cat.id)} />
    </main>
  );
}

import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { naira, type PublicProduct } from "@/lib/store";
import { BuyDialog } from "./BuyDialog";

export function ProductGrid({ products }: { products: PublicProduct[] }) {
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  if (!products.length) return <p className="py-12 text-center text-muted-foreground">No products here yet.</p>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="card-glow flex flex-col overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center bg-secondary">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                : <Gamepad2 className="h-10 w-10 text-primary/60" />}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <h3 className="text-sm font-semibold leading-tight">{p.name}</h3>
              <p className="text-lg font-bold text-primary">{naira(p.price_naira)}</p>
              <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.stock > 0 ? "bg-primary/15 text-primary" : "bg-destructive/20 text-destructive"}`}>
                {p.stock > 0 ? "In stock" : "Out of stock"}
              </span>
              <Button className="mt-auto" size="sm" onClick={() => setSelected(p)}>Buy</Button>
            </div>
          </div>
        ))}
      </div>
      <BuyDialog product={selected} onClose={() => setSelected(null)} />
    </>
  );
}

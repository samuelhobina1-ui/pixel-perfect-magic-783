import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { categoriesQuery, waLink } from "@/lib/store";

const WA = "+218942368392";

export function Header() {
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState(false);
  const link = "text-sm font-medium text-muted-foreground hover:text-primary transition-colors";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="font-display text-lg font-bold tracking-wider">
          <span className="text-primary">ZENTRA</span> <span className="text-accent">GAMING HUB</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className={link} activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>Home</Link>
          <div className="relative" onMouseEnter={() => setShop(true)} onMouseLeave={() => setShop(false)}>
            <Link to="/shop" className={`${link} inline-flex items-center gap-1`}>Shop <ChevronDown className="h-4 w-4" /></Link>
            {shop && (
              <div className="absolute left-0 top-full w-48 rounded-lg border border-border bg-popover p-2 shadow-glow">
                {cats.map((c) => (
                  <Link key={c.id} to="/$slug" params={{ slug: c.slug }} className="block rounded px-3 py-2 text-sm hover:bg-secondary hover:text-primary">{c.name}</Link>
                ))}
              </div>
            )}
          </div>
          <Link to="/track" className={link} activeProps={{ className: "text-primary" }}>Track Order</Link>
          <Link to="/contact" className={link} activeProps={{ className: "text-primary" }}>Contact</Link>
        </nav>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <nav className="border-t border-border px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
          <Link to="/" className="block py-2">Home</Link>
          <Link to="/shop" className="block py-2">Shop</Link>
          <div className="grid grid-cols-2 gap-1 pb-2 pl-3">
            {cats.map((c) => <Link key={c.id} to="/$slug" params={{ slug: c.slug }} className="py-1 text-sm text-muted-foreground">{c.name}</Link>)}
          </div>
          <Link to="/track" className="block py-2">Track Order</Link>
          <Link to="/contact" className="block py-2">Contact</Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted-foreground md:grid-cols-3">
        <div>
          <p className="font-display text-base font-bold"><span className="text-primary">ZENTRA</span> <span className="text-accent">GAMING HUB</span></p>
          <p className="mt-2">Libyana, Almadar, LTT recharge & game top-ups. Paid in Naira via OPay.</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Pay with OPay</p>
          <p className="mt-2">9045001199 · Samuel Kingsley</p>
          <p>Naira (₦) only</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Support</p>
          <a href={waLink(WA)} target="_blank" rel="noreferrer" className="mt-2 block text-primary">WhatsApp {WA}</a>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} ZENTRA GAMING HUB</p>
    </footer>
  );
}

export function WhatsAppFloat() {
  return (
    <a href={waLink(WA, "Hello ZENTRA GAMING HUB")} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform hover:scale-110">
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

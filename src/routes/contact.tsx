import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Mail, Wallet } from "lucide-react";
import { waLink } from "@/lib/store";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — ZENTRA GAMING HUB" },
      { name: "description", content: "Reach ZENTRA GAMING HUB on WhatsApp +218942368392." },
      { property: "og:title", content: "Contact ZENTRA GAMING HUB" },
      { property: "og:description", content: "WhatsApp support for orders and top-ups." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Contact us</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <a href={waLink("+218942368392", "Hello ZENTRA")} target="_blank" rel="noreferrer" className="card-glow p-5">
          <MessageCircle className="mb-2 h-6 w-6 text-primary" /><p className="font-semibold">WhatsApp</p><p className="text-sm text-muted-foreground">+218942368392</p>
        </a>
        <a href="mailto:Samuelhobina1@gmail.com" className="card-glow p-5">
          <Mail className="mb-2 h-6 w-6 text-primary" /><p className="font-semibold">Email</p><p className="break-all text-sm text-muted-foreground">Samuelhobina1@gmail.com</p>
        </a>
        <div className="card-glow p-5">
          <Wallet className="mb-2 h-6 w-6 text-accent" /><p className="font-semibold">Moniepoint MFB</p><p className="text-sm text-muted-foreground">5339964934 · HOBINA KINGSLEY SAMUEL</p>
        </div>
      </div>
    </main>
  );
}

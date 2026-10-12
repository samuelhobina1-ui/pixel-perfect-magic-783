import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LayoutDashboard, Package, Boxes, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — ZENTRA GAMING HUB" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

type State = "loading" | "out" | "notadmin" | "admin";

function AdminLayout() {
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState("");

  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setState("out");
    setEmail(user.email ?? "");
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setState(data ? "admin" : "notadmin");
  }
  useEffect(() => {
    check();
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") check(); });
    return () => data.subscription.unsubscribe();
  }, []);

  if (state === "loading") return <p className="p-10 text-center text-muted-foreground">Loading...</p>;
  if (state === "out") return <AdminLogin />;
  if (state === "notadmin") return (
    <div className="p-10 text-center">
      <p>{email} is not an admin.</p>
      <Button className="mt-4" variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
    </div>
  );

  const nav = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-primary";
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-3 py-2">
          <Link to="/" className="mr-3 font-display font-bold text-primary">ZGH Admin</Link>
          <Link to="/admin" activeOptions={{ exact: true }} className={nav} activeProps={{ className: "text-primary bg-secondary" }}><LayoutDashboard className="h-4 w-4" />Orders</Link>
          <Link to="/admin/products" className={nav} activeProps={{ className: "text-primary bg-secondary" }}><Package className="h-4 w-4" />Products</Link>
          <Link to="/admin/stock" className={nav} activeProps={{ className: "text-primary bg-secondary" }}><Boxes className="h-4 w-4" />Stock</Link>
          <Link to="/admin/settings" className={nav} activeProps={{ className: "text-primary bg-secondary" }}><Settings className="h-4 w-4" />Settings</Link>
          <button className={`${nav} ml-auto`} onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-6"><Outlet /></main>
    </div>
  );
}

function AdminLogin() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/admin` } });
    setBusy(false);
    if (r.error) return toast.error(r.error.message);
    if (mode === "up" && !r.data.session) toast.success("Check your email to confirm, then sign in.");
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card-glow w-full max-w-sm space-y-3 p-6">
        <h1 className="text-2xl font-bold text-primary">Admin {mode === "in" ? "sign in" : "sign up"}</h1>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required minLength={8} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
        <button type="button" className="w-full text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "First time? Create the admin account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

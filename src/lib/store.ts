import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PUBLIC_PRODUCT_COLS =
  "id,name,category_id,price_naira,image_url,description,how_to_use,status,created_at,updated_at";

export type Category = { id: string; name: string; slug: string; image_url: string | null; status: string; sort_order: number };
export type PublicProduct = {
  id: string; name: string; category_id: string; price_naira: number; image_url: string | null;
  description: string | null; how_to_use: string | null; status: string; stock: number;
};
export type Settings = {
  auto_mode: boolean; opay_number: string; opay_name: string; whatsapp_number: string;
  whatsapp_template: string; low_stock_threshold: number;
  last_gmail_poll_at?: string | null; last_gmail_found?: number; last_gmail_note?: string | null;
};

export const naira = (n: number) => "₦" + Number(n).toLocaleString("en-NG");

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories").select("*").eq("status", "active").order("sort_order").order("name");
    if (error) throw error;
    return data as Category[];
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const [{ data, error }, { data: stock }] = await Promise.all([
      supabase.from("products").select(PUBLIC_PRODUCT_COLS).eq("status", "active").is("deleted_at", null).order("price_naira"),
      supabase.from("product_stock").select("*"),
    ]);
    if (error) throw error;
    const map = new Map((stock ?? []).map((s) => [s.product_id, s.stock_count ?? 0]));
    return (data ?? []).map((p) => ({ ...p, stock: map.get(p.id) ?? 0 })) as PublicProduct[];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data as Settings;
  },
});

/** Customer-safe settings (payment details + message template) for checkout. */
export const publicSettingsQuery = queryOptions({
  queryKey: ["public-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("public_settings");
    if (error) throw error;
    return data as unknown as Pick<Settings, "opay_number" | "opay_name" | "whatsapp_number" | "whatsapp_template">;
  },
});

export function fillTemplate(tpl: string, v: { order: string; product: string; pin: string }) {
  return tpl.replaceAll("{order}", v.order).replaceAll("{product}", v.product).replaceAll("{pin}", v.pin);
}

export function waLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export async function sha256File(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Upload to a private bucket and return a long-lived signed URL (public buckets are blocked). */
export async function uploadProductImage(file: File) {
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "_")}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2) throw e2;
  return data.signedUrl;
}

import { useState, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery, type PublicProduct } from "@/lib/store";
import { BuyDialog } from "./BuyDialog";

async function getP2PRate() {
  const cached = localStorage.getItem('p2p_rate');
  const cachedTime = localStorage.getItem('p2p_last_update');
  if (cached && cachedTime && Date.now() - Number(cachedTime) < 2*60*60*1000) return { rate: Number(cached), source: 'Cache' };
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN');
    const data = await res.json();
    if (data.price) { localStorage.setItem('p2p_rate', data.price); localStorage.setItem('p2p_last_update', String(Date.now())); return { rate: parseFloat(data.price), source: 'Binance' }; }
  } catch(e) {}
  if (cached) return { rate: Number(cached), source: 'Last-Stored' };
  return { rate: 1650, source: 'Fallback' };
}

function calculatePrice(coins:number, p2p:number) {
  const costNaira = coins * (0.32/30) * p2p;
  let discount = 1.0; let label = "0%";
  if (coins >= 700) { discount = 0.75; label = "25%"; }
  else if (coins >= 350) { discount = 0.80; label = "20%"; }
  else if (coins >= 100) { discount = 0.85; label = "15%"; }
  let sell = costNaira * 1.56 * discount;
  const minimum = coins * (800/30) * discount;
  let final = Math.max(sell, minimum);
  final = Math.max(final, costNaira + 150);
  final = Math.ceil(final / 5) * 5;
  return { final, label };
}

export default function TikTokCustomCalculator() {
  const [coins, setCoins] = useState(35);
  const [p2p, setP2p] = useState(1685);
  const [source, setSource] = useState("Loading...");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const { data: products } = useSuspenseQuery(productsQuery);

  useEffect(() => { getP2PRate().then(r => { setP2p(r.rate); setSource(r.source); }); }, []);
  const { final, label } = calculatePrice(coins, p2p);
  const valid = coins >= 10 && coins <= 10000;

  const buyNow = () => {
    const base = products.find((p) => /tiktok/i.test(p.name)) ?? products[0];
    if (!base) return;
    const customProduct: PublicProduct = {
      ...base,
      name: `TikTok Coins - ${coins} Coins (Custom)`,
      price_naira: final,
      stock: 999,
    };
    setSelected(customProduct);
  };

  return (
    <>
      <div className="max-w-md mx-auto bg-black text-white rounded-3xl p-6 border border-green-500/30">
        <h2 className="text-2xl font-bold text-center text-green-400">Buy Any TikTok Coins - Custom Amount</h2>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={()=>setCoins(Math.max(10, coins-1))} className="w-12 h-12 bg-zinc-800 rounded-full text-2xl font-bold">-</button>
          <input type="number" value={coins} onChange={e=>setCoins(Number(e.target.value))} placeholder="e.g

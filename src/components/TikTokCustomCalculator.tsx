import { useState, useEffect } from "react";
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
  else if (coins >= 50) { discount = 0.95; label = "5%"; }
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
  useEffect(() => { getP2PRate().then(r => { setP2p(r.rate); setSource(r.source); }); }, []);
  const { final, label } = calculatePrice(coins, p2p);
  const valid = coins >= 10 && coins <= 10000;
  const buyNow = () => {
    const msg = encodeURIComponent(`Hi ZENTRA! I want to buy ${coins} TikTok Coins for ₦${final.toLocaleString()} (P2P ₦${p2p} | Discount ${label})`);
    window.open(`https://wa.me/218942397368?text=${msg}`, '_blank');
  };
  return (
    <div className="max-w-md mx-auto bg-black text-white rounded-3xl p-6 border border-green-500/30">
      <h2 className="text-2xl font-bold text-center text-green-400">Buy Any TikTok Coins - Custom Amount</h2>
      <div className="flex items-center justify-center gap-3 mt-6">
        <button onClick={()=>setCoins(Math.max(10, coins-1))} className="w-12 h-12 bg-zinc-800 rounded-full text-2xl font-bold">-</button>
        <input type="number" value={coins} onChange={e=>setCoins(Number(e.target.value))} placeholder="e.g. 35" className="w-40 text-center bg-zinc-900 border border-green-500 rounded-2xl p-4 text-3xl font-bold text-white" />
        <button onClick={()=>setCoins(Math.min(10000, coins+1))} className="w-12 h-12 bg-zinc-800 rounded-full text-2xl font-bold">+</button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">Min 10 - Max 10,000 coins</p>
      {valid ? (<div className="text-center mt-5 space-y-1"><p className="text-2xl font-bold">{coins} Coins = <span className="text-green-400">₦{final.toLocaleString()}</span></p>{label !== "0%" && <p className="text-green-400 font-bold">🎉 {label} Discount Applied!</p>}<p className="text-sm text-gray-400">💱 P2P Rate: $1 = ₦{p2p.toLocaleString()} ({source} Live)</p><p className="text-xs text-gray-500">You save more when you buy more! 50+ = 5% off, 100+ = 15% off</p></div>) : <p className="text-center text-red-400 mt-4">Enter 10 - 10,000 coins</p>}
      <button onClick={buyNow} disabled={!valid} className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl mt-5 text-lg">BUY NOW - ₦{final.toLocaleString()}</button>
      <div className="mt-6 bg-zinc-900 rounded-2xl p-4"><p className="text-sm font-bold mb-2 text-center">Price Chart (at ₦{p2p.toLocaleString()})</p><div className="grid grid-cols-5 text-center text-xs gap-1">{[30,50,100,350,700].map(c => { const pr = calculatePrice(c, p2p).final; return <div key={c} className="bg-zinc-800 rounded-lg p-2"><b>{c}</b><br/>₦{pr.toLocaleString()}</div> })}</div><p className="text-[11px] text-gray-500 text-center mt-2">Minimum lock: ₦800 per 30 coins</p></div>
    </div>
  );
}

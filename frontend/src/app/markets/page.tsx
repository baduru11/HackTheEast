import Link from "next/link";

const SECTORS = [
  { name: "Crypto", slug: "crypto", desc: "Bitcoin, Ethereum, and digital assets" },
  { name: "Stocks", slug: "stocks", desc: "Equities, earnings, and company news" },
  { name: "Options", slug: "options", desc: "Options trading and derivatives" },
  { name: "Bonds", slug: "bonds", desc: "Fixed income, yields, and treasuries" },
  { name: "Currency", slug: "currency", desc: "Forex, exchange rates, and FX policy" },
  { name: "ETFs", slug: "etfs", desc: "Exchange-traded funds and index investing" },
  { name: "World Indices", slug: "indices", desc: "S&P 500, FTSE, Nikkei, and more" },
  { name: "Sector", slug: "sector", desc: "Industry-specific analysis and trends" },
];

export default function MarketsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Markets</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SECTORS.map((s) => (
          <Link
            key={s.slug}
            href={`/markets/${s.slug}`}
            className="p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-teal-400/30 hover:bg-gray-900/80 transition-all group"
          >
            <h2 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors">
              {s.name}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

import CoinCard from "@/components/CoinCard";
import type { Coin } from "@/lib/types";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3 max-sm:grid-cols-1";

export default function CoinGrid({
  coins,
  loading,
  empty,
}: {
  coins: readonly Coin[];
  loading?: boolean;
  empty?: React.ReactNode;
}) {
  if (loading && coins.length === 0) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="skeleton h-[186px]" />
        ))}
      </div>
    );
  }

  if (coins.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className={GRID}>
      {coins.map((coin) => (
        <CoinCard key={coin.address} coin={coin} />
      ))}
    </div>
  );
}

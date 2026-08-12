import type { NearbyCombo } from "@/lib/domain/combo";
import { ComboCard } from "@/components/combo/combo-card";

export function ComboList({ combos, tag }: { combos: NearbyCombo[]; tag?: string }) {
  if (combos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Chưa có combo nào ở đây lúc này. Hãy quay lại sau nhé!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {combos.map((combo) => (
        <ComboCard key={combo.comboId} combo={combo} tag={tag} />
      ))}
    </div>
  );
}

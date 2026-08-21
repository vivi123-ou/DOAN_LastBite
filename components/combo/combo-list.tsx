import type { NearbyCombo } from "@/lib/domain/combo";
import { ComboCard } from "@/components/combo/combo-card";

export function ComboList({
  combos,
  viewerStoreId,
  isAdmin,
}: {
  combos: NearbyCombo[];
  viewerStoreId?: string;
  isAdmin?: boolean;
}) {
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
        <ComboCard key={combo.comboId} combo={combo} viewerStoreId={viewerStoreId} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordImpressionsForCombos,
  recordBannerImpression,
  recordBannerClick,
} from "@/lib/repositories/ad.repository";

// Fire-and-forget from combo-sections.tsx (the homepage's main entry
// point) whenever it renders a batch of combos that includes at least one
// sponsored one — same "best-effort, don't fail the page over it" posture
// as every other fire-and-forget write in this app (search history,
// notification fan-out).
export async function recordSponsoredImpressionsAction(comboIds: string[]): Promise<void> {
  if (comboIds.length === 0) return;
  await recordImpressionsForCombos(createAdminClient(), comboIds).catch(() => {});
}

// Same fire-and-forget posture, for home-banner-carousel.tsx.
export async function recordBannerImpressionAction(bookingId: string): Promise<void> {
  await recordBannerImpression(createAdminClient(), bookingId).catch(() => {});
}

export async function recordBannerClickAction(bookingId: string): Promise<void> {
  await recordBannerClick(createAdminClient(), bookingId).catch(() => {});
}

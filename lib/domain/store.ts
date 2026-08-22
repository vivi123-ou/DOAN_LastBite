export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  addressLine: string;
  lat: number;
  lng: number;
  verificationStatus: VerificationStatus;
  tier: "free" | "premium";
  logoUrl: string | null;
  bannerUrl: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterStoreInput {
  name: string;
  description?: string;
  addressLine: string;
  lat: number;
  lng: number;
  phone?: string;
}

// Same field set as RegisterStoreInput plus the two images, which only
// make sense once a store row (and therefore a storeId to upload
// against — see combo-images bucket's path convention) already exists —
// see app/(store)/dashboard/store/_components/store-info-form.tsx.
export interface UpdateStoreInput {
  name: string;
  description?: string;
  addressLine: string;
  lat: number;
  lng: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  phone?: string;
}

// Kept in its own table (store_bank_accounts, 0030), not on Store itself —
// bank details are sensitive and must never ride along on the public
// select("*") reads getById()/getStoreByOwnerId() already do. Only ever
// fetched/edited through the two dedicated functions below.
export interface StoreBankAccount {
  storeId: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
}

export interface UpdateBankAccountInput {
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

// bulk_discount_tiers (0001, dormant until the group-buy checkout round —
// see bulk-discount.repository.ts). storeId null means a platform-wide
// default tier, per .claude/rules/business-rules.md: "configurable per
// store... with a platform-wide default when store_id is null."
export interface BulkDiscountTier {
  id: string;
  storeId: string | null;
  minQuantity: number;
  discountPct: number;
}

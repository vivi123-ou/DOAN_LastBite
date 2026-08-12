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
  isActive: boolean;
  createdAt: string;
}

export interface RegisterStoreInput {
  name: string;
  description?: string;
  addressLine: string;
  lat: number;
  lng: number;
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
}

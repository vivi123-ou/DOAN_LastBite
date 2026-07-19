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

export type UserRole = "customer" | "store_owner";

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
}

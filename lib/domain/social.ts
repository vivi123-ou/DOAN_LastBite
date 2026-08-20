export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface PublicProfile {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface FriendSummary extends PublicProfile {
  friendshipId: string;
  status: FriendshipStatus;
  // true when the *current* user is the addressee of a still-pending
  // request — i.e. it's waiting on them to accept/reject, not the other
  // party.
  isIncomingRequest: boolean;
}

export interface Message {
  id: string;
  friendshipId: string;
  senderId: string;
  body: string;
  groupOrderId: string | null;
  createdAt: string;
}

export interface GroupOrderParticipant {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  quantity: number;
}

export interface GroupOrderInvite {
  groupOrderId: string;
  storeId: string;
  storeName: string;
  // Nullable: invites created before combo_id existed (0019) have none —
  // those just fall back to showing the store name only.
  comboId: string | null;
  comboName: string | null;
  deadline: string;
  status: "open" | "finalized" | "cancelled";
  participantCount: number;
  isViewerParticipant: boolean;
  // Added for the bulk-discount checkout integration (group-buy.repository.ts):
  participants: GroupOrderParticipant[];
  totalQuantity: number;
  viewerQuantity: number;
  // Highest tier `totalQuantity` currently qualifies for, and the next one
  // still out of reach — both null if the store has no tiers at all
  // (bulk-discount.repository.ts's resolveTier()).
  currentTier: { minQuantity: number; discountPct: number } | null;
  nextTier: { minQuantity: number; discountPct: number } | null;
}

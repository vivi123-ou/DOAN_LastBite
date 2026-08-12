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

export interface GroupOrderInvite {
  groupOrderId: string;
  storeId: string;
  storeName: string;
  deadline: string;
  status: "open" | "finalized" | "cancelled";
  participantCount: number;
  isViewerParticipant: boolean;
}

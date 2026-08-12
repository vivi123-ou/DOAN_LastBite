export type NotificationType =
  | "order_status"
  | "friend_request"
  | "friend_accepted"
  | "message"
  | "group_buy_invite";

export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

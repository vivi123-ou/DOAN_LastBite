// A customer's saved location — the `addresses` table (0001) has existed
// dormant since phase 1 planning, populated only as a byproduct of placing
// a delivery order (order.repository.ts's create()), never through a
// dedicated "manage my addresses" screen. This is that screen's domain
// shape — same table, a second real writer.
export interface Address {
  id: string;
  userId: string;
  label: string | null;
  addressLine: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}

export interface SaveAddressInput {
  label?: string;
  addressLine: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

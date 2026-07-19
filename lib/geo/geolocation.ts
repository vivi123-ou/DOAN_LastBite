export interface Coordinates {
  lat: number;
  lng: number;
}

// Browser-only — call from a Client Component. See
// .claude/rules/stack-and-conventions.md on where "use client" is warranted.
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Trình duyệt không hỗ trợ định vị GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}

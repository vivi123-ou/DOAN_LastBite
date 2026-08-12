// Shared between every direct-to-Supabase-Storage image uploader
// (combo-image-uploader.tsx, avatar-uploader.tsx) — same allowed
// types/size cap, same filename sanitization, so both stay in sync instead
// of drifting if one gets edited later.

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const DIACRITIC_MARKS_RE = new RegExp("[̀-ͯ]", "g");
const D_WITH_STROKE_RE = /[dđĐ]/gi;

// Supabase Storage object keys reject accented/space characters (this is
// what produced a raw "Invalid key" error for Vietnamese filenames like
// "trà sữa.webp") — strip diacritics and non-ASCII characters before
// building the upload path, independent of any user-facing validation.
export function slugifyFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const namePart = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex + 1).toLowerCase() : "";

  const slug = namePart
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_RE, "")
    .replace(D_WITH_STROKE_RE, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ext ? `${slug || "image"}.${ext}` : slug || "image";
}

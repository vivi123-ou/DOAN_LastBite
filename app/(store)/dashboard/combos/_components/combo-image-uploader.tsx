"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ComboImageUploaderProps {
  storeId: string;
  value: string[];
  onChange: (urls: string[]) => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const DIACRITIC_MARKS_RE = new RegExp("[̀-ͯ]", "g");
const D_WITH_STROKE_RE = /[dđĐ]/gi;

// Supabase Storage object keys reject accented/space characters (this is
// what produced the raw "Invalid key" error for Vietnamese filenames like
// "trà sữa.webp") — strip diacritics and non-ASCII characters before
// building the upload path, independent of any user-facing validation.
function slugifyFilename(filename: string): string {
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

export function ComboImageUploader({ storeId, value, onChange }: ComboImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}" không đúng định dạng — chỉ nhận ảnh JPG, PNG hoặc WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`"${file.name}" vượt quá 5MB — vui lòng chọn ảnh nhỏ hơn.`);
        continue;
      }

      const path = `${storeId}/${crypto.randomUUID()}-${slugifyFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("combo-images").upload(path, file);
      if (uploadError) {
        console.error("Combo image upload failed:", uploadError);
        setError("Tải ảnh lên thất bại, vui lòng thử lại.");
        continue;
      }
      const { data } = supabase.storage.from("combo-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    onChange([...value, ...uploaded]);
    setUploading(false);
  }

  function handleRemove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, domain unknown until the user's project is linked */}
              <img src={url} alt="" className="size-24 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                aria-label="Xoá ảnh"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary">
        <Upload className="size-4" />
        {uploading ? "Đang tải lên..." : "Thêm ảnh combo (ảnh thật)"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>
      <p className="text-xs text-muted-foreground">Ảnh JPG, PNG hoặc WEBP, tối đa 5MB mỗi ảnh.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

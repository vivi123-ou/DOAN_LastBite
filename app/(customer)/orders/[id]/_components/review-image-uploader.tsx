"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, slugifyFilename } from "@/lib/storage/image-upload";

interface ReviewImageUploaderProps {
  userId: string;
  value: string[];
  onChange: (urls: string[]) => void;
}

// Same multi-upload shape as combo-image-uploader.tsx, targeting the new
// review-images bucket (0034) instead of combo-images — a customer owns
// neither the store nor (usually) any combo row, so the path is keyed by
// their own user id (same direct auth.uid()-match policy shape as avatars),
// not a store id.
export function ReviewImageUploader({ userId, value, onChange }: ReviewImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(`"${file.name}" không đúng định dạng. Chỉ nhận ảnh JPG, PNG hoặc WEBP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError(`"${file.name}" vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.`);
        continue;
      }

      const path = `${userId}/${crypto.randomUUID()}-${slugifyFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("review-images").upload(path, file);
      if (uploadError) {
        setError("Tải ảnh lên thất bại, vui lòng thử lại.");
        continue;
      }
      const { data } = supabase.storage.from("review-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    onChange([...value, ...uploaded]);
    setUploading(false);
  }

  function handleRemove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL */}
              <img src={url} alt="" className="size-16 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                aria-label="Xoá ảnh"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <Upload className="size-3.5" />
        {uploading ? "Đang tải lên..." : "Thêm ảnh (tuỳ chọn)"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ImageOff, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, slugifyFilename } from "@/lib/storage/image-upload";

interface StoreImageUploaderProps {
  storeId: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspectClassName: string;
}

// Single-image variant of combo-image-uploader.tsx, reusing the same
// `combo-images` bucket and its storeId-prefixed-path ownership policy
// (storage_combo_image_owner(), 0004) rather than provisioning a new
// bucket just for two more image kinds — logo/banner objects just live
// under the same store's folder alongside its combo photos.
export function StoreImageUploader({
  storeId,
  label,
  value,
  onChange,
  aspectClassName,
}: StoreImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError(`"${file.name}" không đúng định dạng. Chỉ nhận ảnh JPG, PNG hoặc WEBP.`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(`"${file.name}" vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = `${storeId}/${crypto.randomUUID()}-${slugifyFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("combo-images").upload(path, file);
    if (uploadError) {
      setError("Tải ảnh lên thất bại, vui lòng thử lại.");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("combo-images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative w-full overflow-hidden rounded-md border bg-muted ${aspectClassName}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={value} alt={label} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground"
            aria-label={`Xoá ${label.toLowerCase()}`}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary">
        <Upload className="size-4" />
        {uploading ? "Đang tải lên..." : value ? `Đổi ${label.toLowerCase()}` : `Tải ${label.toLowerCase()}`}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={uploading}
        />
      </label>
      <p className="text-xs text-muted-foreground">Ảnh JPG, PNG hoặc WEBP, tối đa 5MB.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

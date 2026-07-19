"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ComboImageUploaderProps {
  storeId: string;
  value: string[];
  onChange: (urls: string[]) => void;
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
      const path = `${storeId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("combo-images").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
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
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

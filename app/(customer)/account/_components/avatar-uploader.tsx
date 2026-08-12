"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, slugifyFilename } from "@/lib/storage/image-upload";

interface AvatarUploaderProps {
  userId: string;
  value: string | null;
  fallbackInitial: string;
  onChange: (url: string) => void;
}

export function AvatarUploader({ userId, value, fallbackInitial, onChange }: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Ảnh đại diện phải là JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Ảnh vượt quá 5MB — vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}-${slugifyFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadError) {
      console.error("Avatar upload failed:", uploadError);
      setError("Tải ảnh lên thất bại, vui lòng thử lại.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <label className="group relative inline-block cursor-pointer">
        <Avatar size="lg" className="size-20">
          {value && <AvatarImage src={value} alt="" />}
          <AvatarFallback className="text-lg">{fallbackInitial}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="size-6" />
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
          disabled={uploading}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {uploading ? "Đang tải lên..." : "Bấm vào ảnh để đổi — JPG/PNG/WEBP, tối đa 5MB."}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

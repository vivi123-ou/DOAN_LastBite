"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/domain/profile";
import { AvatarUploader } from "@/app/(customer)/account/_components/avatar-uploader";
import { updateProfileAction } from "@/app/(customer)/account/actions";

export function AccountForm({ profile, email }: { profile: Profile; email: string | null }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackInitial = (fullName.trim()[0] ?? email?.trim()[0] ?? "?").toUpperCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateProfileAction({
        fullName: fullName || undefined,
        phone: phone || undefined,
        avatarUrl: avatarUrl ?? undefined,
      });
      toast.success("Đã lưu thông tin tài khoản.");
      // The header (site-header.tsx) lives in the root layout, outside this
      // page's own segment — refresh the whole route tree so it picks up
      // the new name/avatar immediately, not just after the next navigation.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AvatarUploader
        userId={profile.id}
        value={avatarUrl}
        fallbackInitial={fallbackInitial}
        onChange={setAvatarUrl}
      />

      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={email ?? ""} disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="full-name">Họ và tên</Label>
        <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxx"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

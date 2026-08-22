"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBankAccountAction } from "@/app/(store)/dashboard/actions";
import type { StoreBankAccount } from "@/lib/domain/store";

// A separate form/submit from StoreInfoForm on purpose — this writes to a
// different table (store_bank_accounts, 0030) via its own server action,
// not the same "Lưu thay đổi" button that saves name/phone/address/images.
// Closes the loop /admin/payouts needed: an admin generating a payout for
// this store can now see exactly where to send the money instead of asking
// the store owner out of band every time.
export function BankAccountForm({ bankAccount }: { bankAccount: StoreBankAccount | null }) {
  const router = useRouter();
  const [bankName, setBankName] = useState(bankAccount?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(bankAccount?.accountNumber ?? "");
  const [accountHolder, setAccountHolder] = useState(bankAccount?.accountHolder ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateBankAccountAction({ bankName, accountNumber, accountHolder });
      toast.success("Đã lưu thông tin ngân hàng.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        LastBite dùng thông tin này để chuyển khoản tiền bán hàng (sau khi trừ hoa hồng) cho cửa
        hàng theo từng đợt đối soát — xem lịch sử ở mục &quot;Doanh thu &amp; hoa hồng&quot;. Thông
        tin này chỉ hiển thị cho bạn và đội ngũ quản trị LastBite, không hiển thị công khai.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bank-name">Ngân hàng</Label>
          <Input
            id="bank-name"
            placeholder="Vietcombank, Techcombank, MB Bank..."
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bank-account-number">Số tài khoản</Label>
          <Input
            id="bank-account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bank-account-holder">Tên chủ tài khoản</Label>
          <Input
            id="bank-account-holder"
            placeholder="NGUYEN VAN A"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : "Lưu thông tin ngân hàng"}
      </Button>
    </form>
  );
}

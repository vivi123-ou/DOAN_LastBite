"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction } from "@/app/(customer)/orders/[id]/actions";
import { ReviewImageUploader } from "@/app/(customer)/orders/[id]/_components/review-image-uploader";
import type { ComboReview } from "@/lib/domain/review";

interface ReviewFormProps {
  orderId: string;
  orderItemId: string;
  comboName: string;
  existingReview: ComboReview | null;
  userId: string;
}

// Only ever rendered for a 'completed' order (see the order detail page) —
// "mua xong sử dụng xong" per the explicit request. One submission per
// order line (combo_reviews' unique(order_item_id, customer_id)); once
// submitted this renders the read-only result instead of the form again.
export function ReviewForm({ orderId, orderItemId, comboName, existingReview, userId }: ReviewFormProps) {
  const [mode, setMode] = useState<"closed" | "review" | "report">("closed");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ComboReview | null>(existingReview);

  if (submitted) {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        {submitted.kind === "review" ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`size-4 ${i < (submitted.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            ))}
            <span className="ml-1 text-muted-foreground">Bạn đã đánh giá “{comboName}”</span>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Flag className="size-4" />
            Bạn đã báo cáo vấn đề với “{comboName}”
          </p>
        )}
        {submitted.comment && <p className="mt-1 text-foreground">{submitted.comment}</p>}
        {submitted.imageUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {submitted.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img key={url} src={url} alt="" className="size-16 rounded-md border object-cover" />
            ))}
          </div>
        )}
        {submitted.storeResponse && (
          <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-foreground">
            <span className="font-medium text-primary">Phản hồi từ cửa hàng: </span>
            {submitted.storeResponse}
          </p>
        )}
      </div>
    );
  }

  async function handleSubmit(kind: "review" | "report") {
    if (kind === "review" && rating === 0) {
      toast.error("Vui lòng chọn số sao đánh giá.");
      return;
    }
    if (kind === "report" && !comment.trim()) {
      toast.error("Vui lòng mô tả vấn đề bạn gặp phải.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReviewAction({
        orderId,
        orderItemId,
        kind,
        rating: kind === "review" ? rating : undefined,
        comment: comment || undefined,
        imageUrls,
      });
      setSubmitted({
        id: "local",
        orderId,
        orderItemId,
        comboId: "",
        comboName,
        customerId: "",
        customerName: null,
        storeId: "",
        kind,
        rating: kind === "review" ? rating : null,
        comment: comment || null,
        createdAt: new Date().toISOString(),
        imageUrls,
        storeResponse: null,
        storeRespondedAt: null,
        resolvedAt: null,
      });
      toast.success(kind === "review" ? "Đã gửi đánh giá, cảm ơn bạn!" : "Đã gửi báo cáo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("review")}>
          <Star className="mr-1.5 size-3.5" />
          Đánh giá
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMode("report")}>
          <Flag className="mr-1.5 size-3.5" />
          Báo cáo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      {mode === "review" && (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} sao`}>
              <Star
                className={`size-6 transition-colors ${
                  i < rating ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              />
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={mode === "review" ? "Chia sẻ cảm nhận của bạn (tuỳ chọn)..." : "Mô tả vấn đề bạn gặp phải..."}
        rows={2}
      />
      <ReviewImageUploader userId={userId} value={imageUrls} onChange={setImageUrls} />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={submitting} onClick={() => handleSubmit(mode)}>
          {submitting ? "Đang gửi..." : "Gửi"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMode("closed")}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}

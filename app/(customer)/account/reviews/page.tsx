import { redirect } from "next/navigation";
import { Flag, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listForCustomer } from "@/lib/repositories/review.repository";
import { Card, CardContent } from "@/components/ui/card";

// Read-only history of what this customer has already submitted — writing
// a new review/report happens contextually on the order detail page
// (review-form.tsx), right where "mua xong sử dụng xong" actually applies.
export default async function AccountReviewsPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/account/reviews");

  const reviews = await listForCustomer(supabase, userId);

  return (
    <div className="space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Đánh giá đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          Các đánh giá và báo cáo bạn đã gửi cho những đơn hàng đã hoàn tất.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Bạn chưa gửi đánh giá nào. Đánh giá sẽ mở ra ở trang chi tiết đơn hàng sau khi đơn hoàn
          tất.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="space-y-1.5 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{review.comboName}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                {review.kind === "review" ? (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < (review.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <Flag className="size-3.5" />
                    Báo cáo vấn đề
                  </p>
                )}
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                {review.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.imageUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                      <img key={url} src={url} alt="" className="size-16 rounded-md border object-cover" />
                    ))}
                  </div>
                )}
                {review.storeResponse && (
                  <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                    <span className="font-medium text-primary">Phản hồi từ cửa hàng: </span>
                    {review.storeResponse}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

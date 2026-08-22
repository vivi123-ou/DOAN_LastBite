import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listReportsForStore } from "@/lib/repositories/review.repository";
import { ReportsList } from "@/app/(store)/dashboard/feedback/_components/reports-list";

// The "moderation/appeal" gap flagged in CLAUDE.md's Next steps — until now
// a store owner could only *see* a report about their own store (0015's
// combo_reviews_select_store_owner) via the aggregated count on the
// dashboard overview, with no way to actually respond to one they think is
// unfair before an admin ever looks at it.
export default async function StoreFeedbackPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/feedback");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const reports = await listReportsForStore(supabase, store.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Báo cáo từ khách hàng</h1>
        <p className="text-sm text-muted-foreground">
          Phản hồi lại nếu bạn thấy báo cáo chưa đúng. Phản hồi của bạn hiển thị cùng báo cáo khi
          admin xem xét.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chưa có báo cáo nào.</p>
      ) : (
        <ReportsList reports={reports} />
      )}
    </div>
  );
}

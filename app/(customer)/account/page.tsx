import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "@/app/(customer)/account/_components/account-form";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;
  if (!userId) redirect("/login?next=/account");

  const profile = await getById(supabase, userId);
  if (!profile) redirect("/login?next=/account");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Tài khoản của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountForm profile={profile} email={(data?.claims.email as string) ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}

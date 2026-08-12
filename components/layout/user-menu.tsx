"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";

interface UserMenuProps {
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export function UserMenu({ fullName, avatarUrl, email }: UserMenuProps) {
  const initial = (fullName?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={
            <Link href="/account">
              <User className="size-4" />
              Tài khoản của tôi
            </Link>
          }
        />
        <DropdownMenuSeparator />
        {/* Direct server-action invocation, not a <form> — same pattern as
            simulate-payment-button.tsx, since a menu item isn't a natural
            form-submit element. */}
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/domain/order";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã xác nhận",
  rejected: "Đã từ chối",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

// New Basic+ perk — a real, practical export for accounting/bookkeeping,
// not something requiring a new server round trip: the orders list this
// button sits next to is already fetched for the page itself, so this
// just serializes what's already on screen (respecting whatever status
// tab/filter is currently active) into CSV, entirely client-side.
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function ordersToCsv(orders: Order[]): string {
  const header = ["Mã đơn", "Ngày tạo", "Khách hàng", "Trạng thái", "Thanh toán", "Tổng tiền"];
  const rows = orders.map((o) => [
    o.id.slice(0, 8).toUpperCase(),
    new Date(o.createdAt).toLocaleString("vi-VN"),
    o.customerName ?? "",
    STATUS_LABEL[o.status] ?? o.status,
    o.paymentStatus === "success" ? "Đã thanh toán" : "Chưa thanh toán",
    String(o.totalAmount),
  ]);
  const lines = [header, ...rows].map((row) => row.map((cell) => escapeCsvField(cell)).join(","));
  // BOM prefix so Excel opens the Vietnamese diacritics correctly instead
  // of guessing the wrong encoding.
  return "﻿" + lines.join("\r\n");
}

export function ExportCsvButton({ orders }: { orders: Order[] }) {
  function handleExport() {
    const csv = ordersToCsv(orders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={orders.length === 0}>
      <Download className="mr-1.5 size-3.5" />
      Xuất CSV
    </Button>
  );
}

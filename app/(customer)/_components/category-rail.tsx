import Link from "next/link";
import type { Category } from "@/lib/domain/category";

export function CategoryRail({
  categories,
  activeCategoryId,
}: {
  categories: Category[];
  activeCategoryId?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/"
        className={`rounded-full border px-4 py-1.5 text-sm ${
          !activeCategoryId ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"
        }`}
      >
        Tất cả
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/?categoryId=${category.id}`}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            activeCategoryId === category.id
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:border-primary"
          }`}
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}

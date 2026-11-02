import { notFound } from "next/navigation";
import { AdminRouter } from "@/features/admin/components/admin-router";
export default async function AdminPage({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const [section = "overview", item] = segments;
  const sections = [
    "overview",
    "users",
    "contents",
    "announcer",
    "notices",
    "inquiries",
    "notifications",
    "popups",
    "audit",
  ];
  const creating = item === "new";
  if (
    segments.length > 2 ||
    !sections.includes(section) ||
    (item && ["overview", "audit"].includes(section)) ||
    (creating && ["users", "inquiries"].includes(section))
  )
    notFound();
  let id: number | undefined;
  if (item && !creating) {
    id = Number(item);
    if (!/^[1-9]\d*$/.test(item) || !Number.isSafeInteger(id)) notFound();
  }
  return <AdminRouter section={section} id={id} creating={creating} />;
}

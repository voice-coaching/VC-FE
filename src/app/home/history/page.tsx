import { notFound } from "next/navigation";
import PrototypeHistory from "@/routes/prototype-history";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PrototypeHistory />;
}

import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = noIndexMetadata;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}

import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = noIndexMetadata;

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return children;
}

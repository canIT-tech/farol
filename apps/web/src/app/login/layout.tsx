import type { ReactNode } from "react";
import { privateMetadata } from "../_seo/private";

export const metadata = privateMetadata("Entrar");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

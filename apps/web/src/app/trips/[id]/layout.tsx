import type { ReactNode } from "react";
import { TripShell } from "../../../components/TripShell";

export default async function TripLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TripShell tripId={id}>{children}</TripShell>;
}

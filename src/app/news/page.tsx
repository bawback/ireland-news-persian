import type { Metadata } from "next";
import { ArchiveView, archiveMetadata } from "@/components/ArchiveView";

export const metadata: Metadata = archiveMetadata(1);

export default function AllNewsPage() {
  return <ArchiveView page={1} />;
}

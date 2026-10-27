import type { Metadata } from "next";
import { HostPreview } from "@/components/previews/host-preview";
import { violitaMosaic } from "@/lib/previews/host-proposals";

export const metadata: Metadata = {
  title: "Mosaic with Pamela at Violita — listing preview",
  description:
    "A first look at a proposed mosaic experience with Pamela Canestrini at Violita. Unlisted draft, prepared for host review and not bookable.",
  robots: { index: false, follow: false, nocache: true },
};

export default function ViolitaMosaicPreviewPage() {
  return <HostPreview proposal={violitaMosaic} />;
}

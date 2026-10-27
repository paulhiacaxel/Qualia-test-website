import type { Metadata } from "next";
import { HostPreview } from "@/components/previews/host-preview";
import { micasShackSushi } from "@/lib/previews/host-proposals";

export const metadata: Metadata = {
  title: "Sushi at home with Mica — listing preview",
  description:
    "A proposed private sushi class with Mica’s Shack in your Miami home or venue. Unlisted draft, prepared for host review and not bookable.",
  robots: { index: false, follow: false, nocache: true },
};

export default function MicasShackSushiPreviewPage() {
  return <HostPreview proposal={micasShackSushi} />;
}

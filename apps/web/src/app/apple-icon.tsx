import { ImageResponse } from "next/og";
import { Mark } from "./_seo/Mark";

// PNG 180×180: apple-touch-icon, logo do JSON-LD e /favicon.ico (rewrite).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} />, size);
}

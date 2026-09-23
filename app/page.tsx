import type { Metadata } from "next";
import { ShowroomExperience } from "@/components/ShowroomExperience";

export const metadata: Metadata = {
  title: "A Square Devs Cars — Hypercar Atelier",
};

/**
 * Entry point.
 *
 * The page is intentionally thin: everything stateful lives in the client
 * `ShowroomExperience` so the server renders a static shell instantly and
 * the loader takes over from the first frame.
 */
export default function HomePage() {
  return <ShowroomExperience />;
}

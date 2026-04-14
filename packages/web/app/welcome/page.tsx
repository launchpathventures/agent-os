import type { Metadata } from "next";
import { DittoConversation } from "./ditto-conversation";

export const metadata: Metadata = {
  title: "Ditto — Tell Alex What You Do. He Handles the Rest.",
  description:
    "Alex finds your clients, makes introductions, and handles follow-ups. You approve everything at first. He earns your trust over time.",
};

export default function WelcomePage() {
  return <DittoConversation />;
}

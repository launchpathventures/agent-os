"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, Shield, Mail } from "lucide-react";

/**
 * Two value prop cards below the fold — safety net for cold traffic scrollers.
 * Super-Connector + Chief of Staff with "Learn more →" links.
 * Provenance: DESIGN.md Section 10 Page 1, Brief 094.
 */
export function ValueCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ValueCard
        icon={<MessageSquare size={24} className="text-vivid" />}
        title="You Talk, Alex Works"
        description="No setup, no forms. Just tell Alex what you need and he figures out the rest."
        href="/how-it-works"
      />
      <ValueCard
        icon={<Shield size={24} className="text-vivid" />}
        title="Nothing Without Your OK"
        description="You approve everything at first. Alex earns more independence as he proves himself."
        href="/chief-of-staff"
      />
      <ValueCard
        icon={<Mail size={24} className="text-vivid" />}
        title="Updates in Your Inbox"
        description="Alex checks in a few times a week. When you want the full picture, set up a workspace."
        href="/network"
      />
    </div>
  );
}

function ValueCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-white p-6 transition-shadow hover:shadow-subtle"
    >
      <div className="mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-text-secondary">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-vivid">
        Learn more <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/**
 * Ditto — Composition Empty States (Brief 073)
 *
 * Empty state block factories per intent. Each returns ContentBlock[]
 * with TextBlock + ActionBlock + SuggestionBlock per the brief spec.
 *
 * Extracted from composition functions for clarity. Empty states are
 * the first thing a new user sees — they must be clear and actionable.
 *
 * Provenance: Brief 073 (Composition Intent Activation), Linear app empty states (pattern).
 */

import type { ContentBlock } from "@/lib/engine";

/**
 * Today empty state — greeting + "What would you like to work on?" + suggestions.
 */
export function emptyToday(greeting: string): ContentBlock[] {
  return [
    {
      type: "text",
      text: `${greeting}. Nothing active yet.`,
    },
    {
      type: "actions",
      actions: [
        {
          id: "empty-today-start",
          label: "What would you like to work on?",
          style: "primary",
          payload: { intentContext: "today" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Start a project",
      reasoning: "Projects group related work, processes, and goals together.",
      actions: [
        {
          id: "empty-today-start-project",
          label: "Start a project",
          style: "primary",
          payload: { intentContext: "today", action: "start-project" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Set up a routine",
      reasoning: "Routines are recurring processes that run on a schedule.",
      actions: [
        {
          id: "empty-today-start-routine",
          label: "Set up a routine",
          payload: { intentContext: "today", action: "start-routine" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Ask me anything",
      reasoning: "I can help with tasks, answer questions, or just chat.",
      actions: [
        {
          id: "empty-today-ask",
          label: "Ask me anything",
          payload: { intentContext: "today", action: "converse" },
        },
      ],
    },
  ];
}

/**
 * Inbox empty state — "Nothing needs your attention" + explanation.
 */
export function emptyInbox(): ContentBlock[] {
  return [
    {
      type: "text",
      text: "Nothing needs your attention right now.",
    },
    {
      type: "text",
      text: "When processes need your review or input, they'll appear here.",
    },
    {
      type: "suggestion",
      content: "Set up a routine to start receiving items here.",
      reasoning: "Inbox items come from processes that need human review or input.",
      actions: [
        {
          id: "empty-inbox-create-routine",
          label: "Create a routine",
          payload: { intentContext: "inbox", action: "start-routine" },
        },
      ],
    },
  ];
}

/**
 * Work empty state — "No active work" + "What do you need to get done?" + suggestions.
 */
export function emptyWork(): ContentBlock[] {
  return [
    {
      type: "text",
      text: "No active work.",
    },
    {
      type: "actions",
      actions: [
        {
          id: "empty-work-start",
          label: "What do you need to get done?",
          style: "primary",
          payload: { intentContext: "work" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Create a task",
      reasoning: "Capture something you need to do and track it here.",
      actions: [
        {
          id: "empty-work-create-task",
          label: "Create a task",
          style: "primary",
          payload: { intentContext: "work", action: "create-task" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Set a goal",
      reasoning: "Goals break down into tasks that Ditto tracks for you.",
      actions: [
        {
          id: "empty-work-set-goal",
          label: "Set a goal",
          payload: { intentContext: "work", action: "set-goal" },
        },
      ],
    },
  ];
}

/**
 * Projects empty state — "No projects yet" + "Start a project" + explanation.
 */
export function emptyProjects(): ContentBlock[] {
  return [
    {
      type: "text",
      text: "No projects yet.",
    },
    {
      type: "actions",
      actions: [
        {
          id: "empty-projects-start",
          label: "Start a project",
          style: "primary",
          payload: { intentContext: "projects" },
        },
      ],
    },
    {
      type: "text",
      text: "Projects group related work, processes, and goals together.",
    },
    {
      type: "suggestion",
      content: "Describe a larger goal and Ditto will break it down.",
      actions: [
        {
          id: "empty-projects-describe",
          label: "Start a project",
          style: "primary",
          payload: { intentContext: "projects", action: "start-project" },
        },
      ],
    },
  ];
}

/**
 * Routines empty state — "No routines yet" + "Create a routine" + explanation.
 */
export function emptyRoutines(): ContentBlock[] {
  return [
    {
      type: "text",
      text: "No routines yet.",
    },
    {
      type: "actions",
      actions: [
        {
          id: "empty-routines-create",
          label: "Create a routine",
          style: "primary",
          payload: { intentContext: "routines" },
        },
      ],
    },
    {
      type: "text",
      text: "Routines are recurring processes that run on a schedule.",
    },
    {
      type: "suggestion",
      content: "Try describing a task you do regularly — Ditto can help turn it into a routine.",
      reasoning: "Routines are recurring processes that Ditto runs for you with appropriate oversight.",
      actions: [
        {
          id: "empty-routines-describe",
          label: "Create a routine",
          payload: { intentContext: "routines", action: "create-routine" },
        },
      ],
    },
  ];
}

/**
 * Roadmap empty state — "Create a project first" + "Start a project".
 */
export function emptyRoadmap(): ContentBlock[] {
  return [
    {
      type: "text",
      text: "Create a project first to see your roadmap.",
    },
    {
      type: "actions",
      actions: [
        {
          id: "empty-roadmap-start",
          label: "Start a project",
          style: "primary",
          payload: { intentContext: "roadmap" },
        },
      ],
    },
    {
      type: "suggestion",
      content: "Projects and their milestones appear here as a roadmap once created.",
      actions: [
        {
          id: "empty-roadmap-start-project",
          label: "Start a project",
          payload: { intentContext: "roadmap", action: "start-project" },
        },
      ],
    },
  ];
}

# Insight-104: Artifact Viewers, Not Artifact Types — Six Universal Renderers

**Date:** 2026-03-27
**Trigger:** User review of Act 5 artifact prototypes revealed over-complication. P38 "Code Artifact" showed syntax-highlighted source to end users who would vibe code, not code. P37 Content Pack was a scenario, not a viewer type. The question shifted from "what artifact types exist?" to "what viewers does the centre column need?"
**Layers affected:** L6 Human (Output Viewer primitive), L2 Agent (artifact content production), ADR-023 (artifact type system)
**Status:** active — requires ADR-023 update

## The Insight

**Artifact types should be defined by how the user views and interacts with the output — not by what domain the content came from.**

The original ADR-023 defined 7 artifact types: `document | content | image | code | email | data | package`. These mixed viewer types (document, image, email) with domain types (content, code) and composition types (package). A "content pack" isn't a viewer — it's a group of artifacts each viewed through their own viewer. "Code" isn't what the user sees — the running result is.

The correct taxonomy is **six universal viewers** that cover every process output:

| Viewer | What the user sees | What they do with it |
|--------|-------------------|---------------------|
| **Document** | Rich formatted text with sections | Read, edit sections, approve |
| **Spreadsheet** | Structured rows/columns with interaction | Sort, filter, flag cells, correct values |
| **Image** | Visual media (single or carousel) | Zoom, compare, annotate, navigate slides |
| **Live Preview** | Running HTML/app in sandboxed iframe | Interact with the result, request changes |
| **Email** | Mail as recipient would see it | Review tone, edit, approve to send |
| **PDF** | Page-faithful document rendering | Review layout, annotate, approve |

**Key decisions:**

1. **Code → Live Preview.** End users (Rob, Lisa, Jay, Libby) don't see source code. They see the running result — a website, a presentation, a form, a dashboard. "View Source" is a secondary developer action, not the primary view. This absorbs presentations, forms/surveys, dashboards, and any vibe-coded output.

2. **Content → absorbed.** "Content" was a domain category, not a viewer. Social posts are Images. Content packs are groups of Images or Documents.

3. **Package → not a viewer.** Package is a composition pattern — a group of artifacts that each use one of the 6 viewers. It's handled by the multi-part deliverable protocol (ArtifactBlock with components), not a viewer type.

4. **Transcription → Document.** A transcription is rich text with speaker labels and timestamps. The document viewer handles this formatting. No special viewer mechanics needed unless audio sync is added later.

5. **PDF as distinct from Document.** Documents reflow. PDFs preserve exact page layout, pagination, headers/footers. The rendering is fundamentally different (PDF.js vs markdown/HTML). Some process outputs must be PDFs (contracts, compliance docs, generated reports with exact formatting).

## Implications

- ADR-023 `artifactType` enum changes: `"document" | "spreadsheet" | "image" | "preview" | "email" | "pdf"`
- ADR-023 `ArtifactContent` union updates to match
- Architecture.md Primitive 6 (Output Viewer) presentation types realign: text→document, data→spreadsheet, visual→image, code→preview, +email, +pdf
- Prototypes should demonstrate one viewer per prototype, not one scenario per prototype
- Live Preview viewer needs: sandboxed iframe, source toggle, responsive viewport controls
- PDF viewer needs: PDF.js or equivalent, page navigation, zoom

## Where It Should Land

- ADR-023 Section 1 (ArtifactBlock) and Section 7 (Engine Representation) — update type enums
- Architecture.md Primitive 6 — realign presentation types
- `.impeccable.md` Artifact Mode section — update type list
- Prototypes — one reference per viewer type

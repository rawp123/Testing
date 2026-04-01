# AGENTS.md

## Website Working Rules

This repository is a real website, not a prototype sandbox. Future work should improve the actual implementation in the codebase directly.

### Product And Design Direction

- The site should feel polished, modern, coherent, and normal.
- The overall aesthetic should stay premium and contemporary, but practical and usable.
- Preserve the current visual direction unless a current pattern is clearly hurting usability, readability, or consistency.
- Favor strong spacing, alignment, visual hierarchy, and consistency across pages.
- Shared patterns should feel intentionally related across the site rather than redesigned from scratch on each page.

### Copy And Content

- Copy should sound natural, clear, and human.
- Do not write in a salesy, startup-like, over-marketed, or AI-generated tone.
- Avoid awkward buzzwords, bloated phrasing, generic filler language, and empty claims.
- Prefer concise, useful headers and natural supporting copy.
- When rewriting copy, improve clarity and tone, not just style the wording.

### Implementation Expectations

- Make real code changes in the website codebase directly.
- Do not write code only in the AI editor for manual copy/paste.
- Improve the real implementation, not just surface-level text.
- Reuse and improve shared components, shared styles, and shared behavior where possible instead of patching each page in isolation.
- If a problem appears in multiple places, prefer fixing the shared system rather than making one-off overrides.
- Make practical product and design decisions without requiring approval for every minor choice.

### UI Decision Rules

- Prioritize readability, layout balance, and interaction clarity over decorative flourishes.
- Keep controls grouped logically and aligned cleanly.
- Reduce dead space when it hurts usability, but do not compress layouts so much that they feel cramped.
- Prefer interfaces that feel intentional and stable over flashy or trendy treatments.
- New UI should match the established site quality bar and not feel like a disconnected microsite.

### Editing Philosophy

- Inspect the existing implementation before changing it.
- Follow the current styling system and component patterns where they are working well.
- When existing patterns are weak, improve them in a way that can be reused elsewhere.
- Avoid unnecessary duplication in HTML, CSS, and JavaScript.
- Favor maintainable changes that make future edits easier.

### Default Behavior For Future Website Tasks

- Assume the goal is to materially improve the actual site experience.
- Prefer shipping thoughtful finished changes over returning recommendations only.
- If a request concerns UI, UX, copy, layout, or interaction quality, implement the improvement directly unless blocked by a real risk.

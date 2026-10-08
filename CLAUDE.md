# MANDATORY AGENT SKILLS & BUILD RULES (@ecc)

## 1. SYSTEMATIC FILE SEARCH BEFORE MODIFICATION
- NEVER assume UI code resides solely in App.tsx.
- ALWAYS run workspace searches (e.g. grep/ripgrep across `src/`) for visible text, button labels, or state props before making changes.
- Locate the exact child components (e.g., inside `src/components/`) that render the active DOM elements.

## 2. STATE & STATUS NORMALIZATION
- Normalize all load status comparisons globally using string normalization:
  `status?.toLowerCase().replace(/_/g, ' ').includes(...)`
- Ensure `selectedLoad` state updates synchronously whenever pipeline/load hooks mutate data.

## 3. DYNAMIC UI & NEGOTIATION WORKFLOW
- "Send counter-offer" button (Framer Blue #0099ff) must strictly replace "Save draft" when in negotiation state.
- Action bar buttons ("Approve & dispatch", "Reject load") must NEVER be disabled during negotiation—only when status is already 'approved', 'dispatched', or 'rejected'.
- Matched carrier "Contact" clicks must immediately switch active tabs and pre-fill carrier outreach drafts.

## 4. AUTOMATED BUILD & TYPE CHECK VERIFICATION
- BEFORE marking any task complete, run `npm run build` or `npx tsc --noEmit` to verify zero type errors, broken imports, or missing props.
- Never report a task as complete without verifying that target JSX elements were successfully modified.
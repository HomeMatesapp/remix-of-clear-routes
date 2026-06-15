# Auth configuration notes

## Auto-confirm email signups — PREVIEW ONLY

Auto-confirm email signups is currently **enabled** in this environment so the
"Save to My Career Decisions" journey can be verified end-to-end without an
inbox.

- Enabled on: 2026-06-15
- Reason: preview/remix QA of the anonymous → signup → save flow.
- **Action before production**: review and decide whether to keep this on.
  For a real launch, the default should be auto-confirm **off** + the
  scaffolded Lovable auth email templates so users verify ownership of the
  email address they sign up with.

HIBP (leaked-password) protection is on and should stay on for production.

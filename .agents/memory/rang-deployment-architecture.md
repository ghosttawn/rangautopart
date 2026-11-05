---
name: RANG deployment architecture
description: The intended production hosting split for RANG Auto Parts.
---

Deploy the RANG API as a Render Web Service and the storefront as a separate Render Static Site.

**Why:** the user explicitly stated this deployment plan; recommending a combined service contradicted it.

**How to apply:** Keep deployment documentation and environment-variable guidance aligned with separate services. The API needs the exact Static Site origin in `FRONTEND_ORIGINS`; the Static Site needs the API origin in `VITE_API_BASE_URL`. For reliable cookie-based sign-in and carts, verify the real browser behavior and use HTTPS sibling custom domains when needed.

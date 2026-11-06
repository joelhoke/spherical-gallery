# Extraction and release boundary

The extraction starts from portfolio commit `9149c08` (reviewed spherical gallery), preserving its Regular layout, projection/homography, world tile keys, wheel heuristic, momentum/easing values, PRNG, palette values, spring/damping, impulse, ripple pool, and single-loop scheduler. Mesh font choice and branding are caller-owned. The unused Mixed motif is omitted.

Only required runtime modules were copied. The gallery has no dependency on the background package; the optional integration lives in `@joelhoke/mesh-backgrounds/gallery` and uses a structural interface without a runtime gallery import. Portfolio catalogs, moderation fetches, project previews, URLs, authentication, logo paths, and fonts stay in the site's adapter.

The portfolio integration is isolated on `codex/extract-spherical-gallery`. Package tarballs are installed locally for review. No database migrations or backend/API changes are required. Existing Git history preserves the original implementation. Homepage/case-study engines remain outside this extraction.

Before public release:

1. Review local package demos and the portfolio preview, including appearance, access-controlled viewers, and the validation report.
2. Verify GitHub and npm identity/ownership for `joelhoke` and the `@joelhoke` scope, and authenticate if needed.
3. After explicit review approval, publish the public `joelhoke/spherical-gallery` MIT repository and both 0.1.0 packages.
4. Install the released npm versions in a clean host, repeat smoke checks, then pin the portfolio dependencies to exact `0.1.0` versions.
5. Deploy the approved integration using the site's existing deployment workflow.

Local tarball dependencies are intentional during review and must not be deployed as though they were published versions. No publish/deploy action is part of the prerelease validation scripts.

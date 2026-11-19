# Capsule Online NEXT — clean rebuild (2026-11-19)

## Scope and safety

Experimental single-file plugin `capsule-online-next.js` in a dedicated branch. The existing production `capsule-online.js` stays untouched; this is **not** declared production-ready and does not silently replace the installed component. The new component key and storage namespace differ from the old plugin.

Rewritten without copying the embedded Skaz client (the old source had ~6606 lines / ~326 KB). The preview uses Lampa's public component, network, settings, selection and player entry points, and the known Lampac response shapes. The new file is approximately 856 lines. No `eval` or `evalrun` RCH handlers are included.

## Startup architecture

1. Receive the original Lampa movie or series card.
2. Get one `lite/events?life=false` catalog response; no blocking `externalids` lookup or `lifeevents` long-poll. The returned URLs are the only allowed sources, never synthesized.
3. Normalize each source family, preserving VIBIX separately from Filmix; drop unusable URLs and duplicate aliases.
4. In auto mode, fetch the advertised root menus **in parallel** with 2.5s per-request limits. The list is bounded to the six named providers; no voice/season crawling at startup.
5. Rank providers using actual available metadata and root-menu observations. A claim of "4K" is only trusted when a quality map labels it. Unknown is unknown.
6. Reuse selected HTML in memory rather than downloading its root menu again.
7. Resolve nested voice/season menus only as needed. Per-menu wall-clock limits and a 23-second auto-startup cap keep the UI from waiting indefinitely.
8. On a failed source, use another advertised source. Explicit manual selection suppresses automatic fallback.
9. For signed `method=call` entries, resolve the current episode immediately; for the built-in player, defer other episode URLs until they are needed.

## Source orders and filtering

Series: Alloha → HDRezka → VIBIX → Filmix → Kodik.

Movies: Alloha → HDRezka → Filmix → Мир кино Z → VIBIX → Kodik.

Ranking is not the same as ordering: order is a deterministic tie-breaker; observable language, season coverage and stream quality affect the score. Adult/ad-labelled audio is filtered; optional kids mode excludes explicit adult-labelled translations but does not replace a proper age-rating policy.

User's legacy `capsule_skaz_online_*` preferences are read as fallback; new preferences are stored under `capsule_next_*`.

## Important current limitations

- Real Skaz source responses and actual playback on TV/Android **have not yet been tested**. Automated tests use deterministic mocks and synthetic HTML structures.
- RCH challenges are reported as unsupported instead of running remote code. Such sources may be unavailable in NEXT until an audited safe bridge is implemented.
- Native Android external playlists cannot execute JavaScript callbacks for future signed episodes. Only the current signed URL and episodes with stable, direct `stream` URLs are passed; reliable unlimited external queues are not claimed.
- The catalog uses `life=false` rather than the `life=true` asynchronous completion protocol. This is deliberately faster, but if a Skaz deployment requires lifeevents or external IDs to list a provider, that provider may be absent. Device diagnostics must determine whether an asynchronous opt-in fallback is needed.
- The preview UI is intentionally simple and will need TV remote, touch, poster, focus and screen-size review against a real device.
- The source list is validated for URL format, not for streaming rights, ownership, availability, or every title's licensing.

## Test and rollout

```sh
node --check capsule-online-next.js
node --test tests/capsule-online-next.test.cjs
```

The GitHub Actions Capsule Online workflow runs these checks in addition to the legacy tests.

Real-device acceptance matrix: film Russian 4K; film fallback quality; series with 30+ seasons; season 1 ordering; same-coverage dubbing preference; Kodi(k)/VIBIX/Filmix identities; slow/absent provider; restricted/ad-labelled translation; manual source switch; mobile swipe/tap and TV D-pad focus; built-in multi-episode queue; Android player current episode. Only after passing this matrix should NEXT replace the existing installable `capsule-online.js`.

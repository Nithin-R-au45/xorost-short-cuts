<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Videos live in the private `videos` storage bucket + `videos` table, played via signed URLs; social keys use `vid:<id>`. Why: workspace blocks public buckets.
- Per-minute AI titles/summaries come from browser-extracted frames sent to `generateSegment` (server fn). Why: no server-side video decoding on Workers.
- Home feed is ranked client-side by `src/lib/recommend.ts` (adapted from xai-org/x-algorithm: sources → filters → weighted action predictions → author diversity), using `video_views` + reactions/saves/comments. Why: small catalog; no ML service on Workers.
- Upload details use a shared schema in the browser and authenticated registration function; storage caps file size and database constraints guard persisted metadata. Why: reject invalid uploads before publication and preserve creator descriptions across devices.

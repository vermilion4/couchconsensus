# Friction Log: CouchConsensus

Kept daily from Oct 10, 2026. Every snag gets a row while it's fresh.

**Severity:** 🔴 Blocker (stopped work) · 🟠 Major (needed a real workaround, or changed the design) · 🟡 Minor (small workaround) · ⚪ Note (docs gap)

## At a glance

| # | Date | Tool | What went wrong | Severity |
| --- | --- | --- | --- | --- |
| 1 | Oct 10 | Vega docs | No clear answer on whether WebSocket works | ⚪ Note |
| 2 | Oct 10 | Amazon APIs | No public catalog or "where to watch" API | ⚪ Note |
| 3 | Oct 10 | Amazon Bedrock | Misleading 404 when the model form wasn't sent | 🟡 Minor |
| 4 | Oct 10 | Bedrock console | Model form refused on a new account, no reason given | 🟠 Major |
| 5 | Oct 10 | Vega CLI | `project generate` scattered files, printed no path | 🟡 Minor |
| 6 | Oct 10 | Vega CLI | Working QR library refused as "not in profile" | 🟡 Minor |
| 7 | Oct 10 | w3cmedia docs | Sample code uses enum names that don't exist | ⚪ Note |
| 8 | Oct 10 | w3cmedia | Sound files won't play from a URL | 🟠 Major |
| 9 | Oct 10 | Virtual Device | Screenshot tool fails, then crashes the dev shell | 🟡 Minor |
| 10 | Oct 10 | Vega build | Metro breaks in a pnpm monorepo; Zod 4 fails Babel | 🟡 Minor |
| 11 | Oct 10 | `inputd-cli` | Bad key name rejected without listing valid ones | ⚪ Note |
| 12 | Oct 10 | Amazon Bedrock | Every model blocked on the new account | 🔴 Blocker |
| 13 | Oct 10 | CloudFront, ECS | Deploys refused until the account is verified | 🟠 Major |
| 14 | Oct 10 | async-storage | Storage library missing from the OS profile | 🟠 Major |
| 15 | Oct 10 | React Native for Vega | Layout units are half the screen pixels; screens rendered 2× | 🟡 Minor |
| 16 | Oct 10 | Virtual Device logs | JS log tag isn't documented | ⚪ Note |
| 17 | Oct 19 | Vega WebSocket | Some messages arrive garbled; the TV froze | 🔴 Blocker |

## Details

### 1. Does WebSocket work on Vega? · ⚪ Note
- **Tried:** confirm the TV app can hold a live connection to our server.
- **Steps:** searched the Vega React Native docs and the Supported Libraries page.
- **Expected:** a clear yes or no. **Got:** "pure-JS packages like fetch and WebSocket will likely work".
- **Workaround:** tested it ourselves on day one; it works.
- **Suggestion:** list core networking APIs with a supported / not supported status.

### 2. No catalog API for Fire TV developers · ⚪ Note
- **Tried:** find a movie catalog with "where to watch", ideally Prime Video.
- **Steps:** searched Amazon developer APIs.
- **Expected:** a read-only catalog API. **Got:** partner-only APIs for content owners.
- **Workaround:** TMDB plus watch-provider data (planned), and an invented demo deck for now.
- **Suggestion:** a rate-limited, read-only catalog and deep-link API for TV apps.

### 3. Bedrock says 404 when it means "form missing" · 🟡 Minor
- **Tried:** time Claude Haiku 4.5 calls.
- **Steps:** called the model; the model list showed it as ACTIVE.
- **Expected:** a response, or a clear access error. **Got:** `404 Model use case details have not been submitted`.
- **Workaround:** submitted the Anthropic use-case form in the console.
- **Suggestion:** return 403 with a console link, and show the form status next to ACTIVE.

### 4. Model form refused on a new account · 🟠 Major
- **Tried:** submit the Anthropic use-case form on a new personal account.
- **Steps:** filled in the form in the Bedrock console and submitted it.
- **Expected:** access within minutes. **Got:** "Your account is not authorized… create a support case."
- **Workaround:** opened a support case; the game runs without AI until access arrives.
- **Suggestion:** tell new accounts up front that access needs a review, and how long it takes.

### 5. `vega project generate` scattered files · 🟡 Minor
- **Tried:** generate a test app into `spikes/tvspike`.
- **Steps:** ran `vega project generate` with that folder.
- **Expected:** a new app folder. **Got:** template files mixed into the existing folder, with no path printed.
- **Workaround:** moved the files by hand.
- **Suggestion:** create `<dir>/<name>/` by default and print the path.

### 6. Working library refused as "not in profile" · 🟡 Minor
- **Tried:** add a QR code library to the TV app.
- **Steps:** `vega project install @amazon-devices/react-native-qrcode-svg`.
- **Expected:** installed. **Got:** "not in OS version 1.2 profile, skipping", though it's published and works.
- **Workaround:** plain `npm install`; it renders fine.
- **Suggestion:** keep the profile in sync with the Supported Libraries page.

### 7. w3cmedia samples don't compile · ⚪ Note
- **Tried:** create an `AudioPlayer` for a short sound.
- **Steps:** copied the doc sample.
- **Expected:** it compiles. **Got:** TypeScript errors; the docs use `MUSIC` and `MEDIA`, the package exports `CONTENT_TYPE_MUSIC` and `USAGE_MEDIA`.
- **Workaround:** read the enum in the package's type definitions.
- **Suggestion:** generate doc samples from the typed package.

### 8. Sound files won't play from a URL · 🟠 Major
- **Tried:** play a whistle on the verdict screen.
- **Steps:** tried MP3, M4A and WAV by URL, then through MediaSource.
- **Expected:** a URL plays. **Got:** every URL failed with code 4, and the player never requested the file; MP3 through MediaSource failed to decode.
- **Workaround:** AAC `.m4a`, fetched in JS and fed through MediaSource. This works reliably.
- **Suggestion:** support plain URLs for short sounds, or document that only MediaSource works.

### 9. No way to screenshot the Virtual Device · 🟡 Minor
- **Tried:** screenshot the TV to check screens without a human.
- **Steps:** ran `screenshooter` and `gwsi-tool-screenshooter` with `vega device run-cmd`.
- **Expected:** a PNG. **Got:** a permission error, then the dev shell service crashed until restart.
- **Workaround:** captured the device's macOS window instead.
- **Suggestion:** add `vega device screenshot`.

### 10. Monorepo build breaks · 🟡 Minor
- **Tried:** share a TypeScript package between the TV, phone and server.
- **Steps:** built the TV app in a pnpm workspace.
- **Expected:** it builds. **Got:** `Unable to resolve module react-native`, then Zod 4 failed in Babel.
- **Workaround:** hoisted pnpm layout, Metro watch folders, and an extra Babel plugin.
- **Suggestion:** publish a monorepo template and add the plugin to the Vega Babel preset.

### 11. `inputd-cli` hides valid key names · ⚪ Note
- **Tried:** press OK on the virtual remote from a script.
- **Steps:** `inputd-cli button_press OK`.
- **Expected:** a press, or a list of valid keys. **Got:** "invalid button value".
- **Workaround:** found `KEY_ENTER` in the online docs.
- **Suggestion:** print the accepted names on an error.

### 12. Every Bedrock model blocked · 🔴 Blocker
- **Tried:** use Bedrock after adding a payment method.
- **Steps:** checked model access and called Claude and Amazon Nova.
- **Expected:** access. **Got:** `NOT_AUTHORIZED` for every model and "Operation not allowed" on calls.
- **Workaround:** support case (Bedrock Allowlisting), opened Oct 10 and still open on Oct 19. The AI code ships with a fallback, so the game works without it.
- **Suggestion:** show the block and a request link in the Bedrock console, with an expected timeline.

### 13. CloudFront and Fargate refuse to deploy · 🟠 Major
- **Tried:** deploy our CDK stack (CloudFront in front of Fargate).
- **Steps:** `cdk deploy`, then again without CloudFront.
- **Expected:** a running service. **Got:** "account must be verified" (CloudFront), then "account is currently blocked" (Fargate); both rolled back.
- **Workaround:** made CloudFront optional; added these blocks to the same support case.
- **Suggestion:** show account gates on the console home page of new accounts, with one request covering them all.

### 14. No storage library for this OS version · 🟠 Major
- **Tried:** save the TV's room so a relaunch can offer "Resume room".
- **Steps:** installed the Vega async-storage port and built.
- **Expected:** it works. **Got:** the build prints ERROR, `vega project install` says "not in profile", and the device doesn't have it.
- **Workaround:** the TV keeps the room in memory, so Resume survives only while the app is open.
- **Suggestion:** list a supported storage option for each OS version.

### 15. Screens rendered twice the size · 🟡 Minor
- **Tried:** build TV screens from the 1920×1080 Figma frames.
- **Steps:** used the Figma pixel sizes in styles.
- **Expected:** 1:1. **Got:** layout uses 960×540 units on a 1080p screen, so everything overflowed.
- **Workaround:** one style helper scales every size.
- **Suggestion:** state the layout unit next to the 1920×1080 design guidance.

### 16. JS log tag isn't documented · ⚪ Note
- **Tried:** find the app's JavaScript logs while debugging a frozen screen.
- **Steps:** streamed device logs and searched for `ReactNativeJS`, the usual React Native tag.
- **Expected:** our logs. **Got:** nothing under that tag. JS output is tagged `[KeplerScript-JavaScript]`; we also had a code path that didn't log at all (our bug).
- **Workaround:** search for the right tag; added counters to the client.
- **Suggestion:** document the tag in the debugging guide.

### 17. Some WebSocket messages arrive garbled · 🔴 Blocker
- **Tried:** push live screens (0.5–3 KB JSON) from the server to the TV.
- **Steps:** played rounds with bots, counted dropped messages, and showed parse errors on screen.
- **Expected:** every message intact. **Got:** some arrived garbled (`JSON Parse error: Unexpected character: T`). A 3 KB message failed every time; 1.5 KB ones failed sometimes when sent right after another message. The TV froze on an old screen, and the bug hid whenever logging changed the timing.
- **Workaround:** when a message can't be read, the TV re-fetches the current screen over HTTP, and reconnects if that fails too.
- **Suggestion:** fix how the Vega WebSocket rebuilds messages that span network packets.

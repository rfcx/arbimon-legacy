# @rfcx/notification-templates

Shared, **transport-agnostic** transactional email rendering for RFCx / Arbimon
applications. Produces `{ subject, text, html }` from typed data. It does **not**
send email — callers hand the result to their transport (the `notify.rfcx.org`
gateway, Mandrill, etc.).

## Why

Today each app hand-rolls its own HTML (device-api Handlebars, rfcx-api
Handlebars views, arbimon-legacy EJS + string concat, arbimon CLI TS template
strings). Branding, footers and escaping drift apart. This package centralizes
the layout, footer and per-template copy behind one typed API.

## Design

- **Zero runtime dependencies.** Pure TypeScript string templates + a tiny HTML
  escaper. No Handlebars/EJS in the dependency tree, so any Node app (CJS or
  ESM) can consume it without engine or loader friction.
- **Transport stays out.** The package never performs IO. Routing (`to`,
  `from`, `bcc`) belongs to the caller / notify gateway.
- **Typed at the call site.** `renderEmail(name, data)` is fully type-checked
  via a `TemplateName -> data shape` map.
- **Shared layout/footer.** Every template renders inside `renderLayout`, so the
  header banner and RFCx footer are identical everywhere.
- **Snapshot tests.** HTML output is locked with Vitest snapshots to catch
  accidental branding/markup regressions.

## Usage

```ts
import { renderEmail } from '@rfcx/notification-templates'

const { subject, text, html } = renderEmail('device.deploymentSuccess', {
  deviceType: 'AudioMoth',
  date: deployedAt.toLocaleDateString(),
  time: deployedAt.toLocaleTimeString()
})

// Then hand to your transport (notify gateway generic payload):
await axios.post(EMAIL_SEND_URL, {
  to: [{ email: user.email, name: user.name }],
  from: { email: 'contact@rfcx.org', name: 'Rainforest Connection' },
  subject,
  text,
  html
}, { headers: { Authorization: `Bearer ${EMAIL_SEND_TOKEN}` } })
```

`DEFAULT_FROM` provides the conventional from address per brand:

```ts
import { DEFAULT_FROM } from '@rfcx/notification-templates'
DEFAULT_FROM.rfcx    // { email: 'contact@rfcx.org', name: 'Rainforest Connection' }
DEFAULT_FROM.arbimon // { email: 'no-reply@arbimon.org', name: 'Arbimon' }
```

## Templates

| Name                          | Data shape                                              | Ported from |
| ----------------------------- | ------------------------------------------------------- | ----------- |
| `device.deploymentSuccess`    | `{ deviceType, date, time }`                            | device-api `deploy-success-email-template.html` |
| `arbimon.projectBackup`       | `{ url, projectName }`                                  | arbimon CLI `_services/mail/templates.ts` (`project-backup`) |
| `arbimon.projectBackupFailed` | `{ projectName }`                                       | arbimon CLI `_services/mail/templates.ts` (`project-backup-failed`) |
| `arbimon.exportDetections`    | `{ url, jobId }`                                        | arbimon CLI `_services/mail/templates.ts` (`export-detections`) |
| `arbimon.exportRecordings`    | `{ projectName, mode, url? }`                           | arbimon-legacy `jobs/arbimon-recording-export-job/index.js` |
| `arbimon.exportAnalysisResultsRFM` | `{ projectName, url, mode?, filename?, rows?, bytes?, expiryDays?, expiresAt? }` | arbimon-legacy RFM analysis-results export (2026-07-15 consolidation) |
| `user.activateAccount`        | `{ fullName, username, host, hash }`                    | arbimon-legacy `app/views/mail/activate-account.ejs` |
| `user.resetPassword`          | `{ fullName, username, host, hash }`                    | arbimon-legacy `app/views/mail/reset-password.ejs` |
| `support.contactForm`         | `{ message, replyTo }`                                  | rfcx-api `noncore/views/email/contact-form.handlebars` |
| `alerts.event`                | `{ streamName, classificationName, time }`             | rfcx-api `noncore/views/email/event-alert.handlebars` |
| `support.userFeedback`        | `{ name, email, date, feedback, images? }`             | device-api `user-feedback-email-template.html` |

**`arbimon.exportRecordings` delivery modes.** The legacy export job chose a
download-button vs plain-link body by sniffing the recipient for `@gmail.com`,
and had a third path that attached the CSV inline. That routing/attachment
decision stays with the caller (attachments are transport, not template); pass
`mode: 'signed-url-button' | 'signed-url-link' | 'attachment'` and, for the two
signed-url modes, the `url`. In `attachment` mode the caller adds the file to
its transport payload (e.g. the notify-gateway `attachments` array).

## Adding a template

1. Create `src/templates/<name>.ts` exporting a `TemplateDefinition<TData>`.
2. Register it in `src/index.ts` (`TEMPLATES` + `TemplateDataMap`).
3. Add tests + snapshot in `src/index.test.ts`.

## Scripts

```sh
npm install
npm test        # vitest (unit + snapshots)
npm run build   # tsup -> dist (esm + cjs + d.ts)
npm run typecheck
```

## Distribution options

This package is intentionally standalone and buildable in isolation. See the
staged rollout plan in the PR description for how it is expected to be consumed
(git tag/tarball first, private npm registry later). Until a publish/auth path
is agreed, consumers should pin a tarball or git ref rather than a registry
version.

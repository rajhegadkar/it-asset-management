# ITAM v2 — Automated UI tests

Playwright tests that click through every page and the main workflows as a real user would,
on three screen sizes:

| Project  | Device                    |
|----------|---------------------------|
| desktop  | 1440 × 900 Chrome         |
| tablet   | iPad Mini (touch)         |
| phone    | Pixel 7 (touch)           |

## One-time setup

```bash
npm run test:ui:setup        # from the project root
# (= npm --prefix e2e install && npx playwright install chromium)
```

## Run

```bash
npm run test:ui              # all three devices
npm run test:ui:desktop      # or :tablet / :phone
npm run test:ui:report       # open the HTML report (screenshots, video and trace of any failure)
```

The suite starts its own isolated server — you do **not** need `start.bat` running, and your
real database is never touched:

1. builds the frontend (`vite build`; set `E2E_SKIP_BUILD=true` to reuse the last build),
2. creates a fresh `backend/prisma/e2e-test.db` and seeds the demo data,
3. starts the backend on port **5099** with mocked e-mail, scheduler off and rate-limits off.

Change the port with `E2E_PORT=5199`. If a test server is already running on that port it is reused.

## What is covered

| Spec | Covers |
|------|--------|
| 01-auth | login for every role, wrong password, show/hide password, logout, route guard |
| 02-navigation | every menu page opens for each role with no errors and no sideways scroll; support-role menu; phone bottom nav; tables turn into cards on phones; dark mode; notifications |
| 03-assets | create asset, dashboard KPI drill-down, global search, duplicate serial rejected |
| 04-custody | allocate → employee signs hand-over → PDF receipt → return to stock |
| 05-helpdesk | employee raises ticket → support resolves |
| 06-inventory | licence + seat assignment, spare part issue, maintenance schedule + complete |
| 07-admin | employee create / delete (confirm + cancel), Excel export, settings tabs, customization centre, DR backup |
| 08-labels | label printing with / without the user name: "ask every time", "never show", cancel |

Logins used: `admin@acme-corp.com`, `itadmin@acme-corp.com`, `support@acme-corp.com` (`Admin@123456`)
and `john.doe@acme-corp.com` (`User@123456`) — the seeded demo accounts.

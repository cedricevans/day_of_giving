# PAD Campaign Landing Page & Tracking Plan (No API)

**Organization:** Phi Alpha Delta Law Fraternity, International (YourMembership site: pad.org)
**Goal:** Run a campaign landing page on our own domain that funnels visitors to PAD's donation and membership pages, and track visits, clicks, donations (with amounts), and new members — without the YM API.
**API status:** Not licensed yet (a few weeks out). This plan works now and upgrades cleanly once the API is available.

---

## 1. How it works

```
Our landing page (our domain)
   │  track: visits, button clicks, optional name/email
   ├── Donate button ──► pad.org/donations/donate.asp?id=<CAMPAIGN_FUND_ID>
   └── Join button ────► pad.org/general/register_start.asp
                              │
                  PAD / YourMembership records the gift or member
                  (+ "How did you hear about us?" answer)
                              │
               Weekly YM admin exports ──► our tracker spreadsheet
```

- PAD processes all payments and member records. We never touch payments or PAD's accounting.
- Our side sees visits and clicks. Donation amounts and member details come from YM exports.

---

## 2. Setup in the PAD YM admin

### Step 1 — Create a campaign donation fund
- Create a new fund just for this campaign (e.g. "Fall 2026 Campaign").
- Note its fund ID from the donation link: `https://www.pad.org/donations/donate.asp?id=<ID>`
- Every gift to this fund is attributable to the campaign.
- If available, set an admin notification email on the fund so each gift triggers an email to an inbox we control.

### Step 2 — Create the Referral Source custom field
Location: **Content & Settings → Member Settings → Custom Fields**

| Setting | Value |
|---|---|
| Field Name | How did you hear about us? |
| Field Code (Internal) | referral_source |
| Export Label | Referral Source |
| Field Type | Dropdown if available (Campaign website, Social media, Email, Chapter/friend, Other); otherwise text |
| Required | Yes |
| Donation Funds | Tick **only** the campaign fund |

### Step 3 — Add the field to the join form
Location: **Member Settings → Registration Configuration** — add Referral Source to the membership application.

---

## 3. Setup on our side

### Step 4 — Collect and tag the PAD links
- Donate: `https://www.pad.org/donations/donate.asp?id=<CAMPAIGN_FUND_ID>&utm_source=fall26-landing`
- Join: `https://www.pad.org/general/register_start.asp?utm_source=fall26-landing`
- The UTM tag isn't saved in YM, but shows in analytics if the PAD site has Google Analytics.

### Step 5 — Build the landing page
- Campaign story, goal, and clear **Donate** and **Join** buttons (link only to the pages above, not the PAD homepage).
- Optional: short name + email form before the buttons, saved to our own list (enables matching).
- Line of copy: *"When asked how you heard about us, choose **Campaign website**."*
- Optional: "Raised so far" progress bar, updated manually after each export.

### Step 6 — Analytics
- Install Google Analytics (or similar) on the landing page.
- Track click events on Donate and Join.
- Tag shared links by channel (e.g. `utm_source=facebook`, `utm_source=email`).

---

## 4. Test before launch (Step 7)
- [ ] Landing page loads on desktop and phone
- [ ] Donate button opens the campaign fund's form (correct fund name shown)
- [ ] Referral Source question appears on that donation form
- [ ] Join button opens the application and the Referral Source question appears
- [ ] Button clicks show up in analytics
- [ ] Small test donation appears in the YM export with the field filled in
- [ ] Check whether monthly (recurring) gifts export as one line or one line per payment

---

## 5. Weekly tracking (Step 8)

1. In **Exports & Reporting**, export:
   - Donations for the campaign fund (name, email, amount, date, one-time/monthly, Referral Source)
   - Recently joined members with the Referral Source column
2. Paste the exports into the tracker spreadsheet.
3. Match against our landing-page list by email, then by name.
4. Record the funnel.

### What we can report

| Metric | Source |
|---|---|
| Landing page visits (by channel) | Our analytics |
| Donate / Join clicks | Our analytics |
| Total raised, # of gifts, average gift | YM donation export |
| One-time vs. monthly donors | YM donation export |
| Amount raised by source | Referral Source / email matches |
| New members from campaign | YM member export (Referral Source) |
| Click → donation / join conversion | Analytics + exports |

---

## 6. Limits to know

- **Amounts aren't live on our side.** They update when we run the export (weekly, or daily during a push). Admin notification emails can give per-gift alerts if YM offers them.
- **Donors can switch funds** via "Select a Different Fund" on the PAD form; those gifts won't count toward the campaign fund. The Referral Source answer and email matching catch most of these.
- **Export totals may differ slightly from finance.** Refunds or later adjustments may not show; finance has the official number.
- **Donor data is personal.** Keep exports and the tracker private and share only with people who need them.
- **Backup attribution:** If the custom field doesn't appear on the donation form, ask donors to enter a code (e.g. "FALL26") in the Donor Comments box.

---

## 7. After the API is licensed

- Keep the same fund, custom field, and links. Nothing on the landing page changes.
- Replace the weekly export with a server-side script that pulls donations and new members automatically.
- Update the tracker/dashboard and progress bar automatically.
- Keep API credentials on the server only, never in the landing page code.

---

## 8. Open items

- [ ] Campaign name, purpose, goal amount, and deadline
- [ ] Campaign fund created → fund ID
- [ ] Where the landing page will be hosted (WordPress, Squarespace, own server)
- [ ] Logo, colors, photos
- [ ] Confirm whether the PAD site allows a GA4 tag / tracking script
- [ ] Confirm whether the fund supports admin notification emails

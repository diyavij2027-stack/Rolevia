---
name: dailypublish
description: Generate one day's set of Role.via marketing content pieces (social posts, carousels, short-video scripts, blog posts) through three gated stages, Brainstorm, Draft and Audit, and save everything to content/dayN/. Use when the user runs /dailypublish, or asks for "today's content", "day 3 content", "daily posts", or a content batch for a given day. Brainstorms with Exa, Firecrawl or Apify when connected; drafts with the marketing-skills skills (social, copywriting, image, video); audits every piece for facts, brand rules and channel fit. Prepares files only and never posts anything.
argument-hint: "[day number] [channels, comma-separated] [theme: ...]"
---

# /dailypublish

Produce the content pieces for one day and save them in `content/day<N>/`. Every piece passes three stages in order: **Brainstorm → Draft → Audit**. A piece that fails the audit is fixed and re-audited, or marked `blocked`. Nothing is posted, scheduled or sent anywhere: this skill only writes files for a human to review.

## 0. Set up

### Parse the arguments
- **Day number:** first number in the arguments (`/dailypublish 3` → day 3). If none is given, use one more than the highest existing `content/day<N>/` folder, or 1 if none exist. If `content/day<N>/` already exists and has pieces in it, ask before overwriting; offer to add new pieces alongside instead.
- **Channels:** a comma-separated list such as `linkedin,instagram,x,shorts,blog`. If none is given, use the default day plan below.
- **Theme:** anything after `theme:` steers the brainstorm (for example `theme: case interviews`). With no theme, pick one in the brainstorm.

### Default day plan (4 pieces)
| # | Channel | Format | Drafting skill(s) |
|---|---------|--------|-------------------|
| 1 | LinkedIn | Text post (founder or brand voice) | `marketing-skills:social` |
| 2 | Instagram | Carousel, 6–8 slides, plus caption | `marketing-skills:social`, `marketing-skills:image` |
| 3 | X (Twitter) | Thread, 4–7 posts | `marketing-skills:social` |
| 4 | YouTube Shorts / Instagram Reels | 30–45 second script with shot list | `marketing-skills:video`, `marketing-skills:social` |

Optional channels when requested: `blog` (article; use `marketing-skills:copywriting` for structure plus `marketing-skills:ai-seo` and `marketing-skills:seo-audit` checks), `whatsapp` (broadcast message for placement groups; `marketing-skills:social`), `email` (`marketing-skills:emails`).

### Load the context (required)
1. Read `.agents/product-marketing.md` in full. It is the brand guideline for this skill: product facts, audience, brand voice, words to use and avoid, and the **Learnings** table (active rows are rules). If the file is missing, stop and tell the user to run `/marketing-skills:product-marketing` first.
2. Read the `README.md` of the last 7 `content/day*/` folders that exist, so you don't repeat a topic, hook or angle used in the past week.
3. For product facts, `plans.json` (prices) and `src/*.html` (features, wording) are the source of truth. If they disagree with the context doc, trust the code and note the conflict in the day's README.

### Brand rules that always apply
These come from the context doc and the founder's decisions. Re-read the doc each run in case they have changed.
- Brand name is **Role.via**.
- Primary audience: Indian campus placement candidates (final-year students, freshers).
- **Never invent proof:** no user counts, session counts, testimonials, ratings, success rates, "students placed", or college names unless the context doc's Proof Points list them as real.
- Never compare Premium with Placement Pro.
- Never promise or imply shortlists, offers or hiring predictions. Readiness scores measure practice only.
- Company facts used in content must carry the same honesty the product shows: say where they come from.

## 1. Brainstorm

Goal: one researched angle per piece, each tied to something real that the target audience cares about this week.

### Pick the research tools
Search the deferred tool list for the research connectors (ToolSearch with keywords `exa`, `firecrawl`, `apify`) and use every one that is connected:
- **Exa** (`web_search_exa`): find recent articles, discussions and trends on the theme.
- **Firecrawl** (`firecrawl_search`, `firecrawl_scrape`): search, then scrape the pages you will cite so quotes and figures are read from the page itself.
- **Apify** (actors for Reddit, YouTube, Instagram, X, LinkedIn): pull what students are actually posting and asking.

If none is connected, use the built-in `WebSearch` and `WebFetch`, and write in `brainstorm.md` which connectors were missing, so the user knows they can connect Exa or Firecrawl in their claude.ai connector settings. Do not invent research results to fill the gap.

### What to research
Run these searches for the day's theme (or for placement season in general when there is no theme):
- What Indian placement candidates are asking about now: GD topics, HR questions, case interviews, aptitude rounds, specific recruiters (Reddit, Quora, YouTube comments, LinkedIn).
- Current events that make good GD topics (policy, economy, tech, business news from the last 2 weeks).
- Recruiter-published hiring process pages (for example Deloitte, TCS, HUL careers pages) for accurate, citable process details.
- What competing prep accounts posted recently, to find angles they missed.

Use `marketing-skills:content-strategy` to sort ideas into pillars and `marketing-skills:marketing-psychology` for hook angles when useful.

### Output: `content/day<N>/brainstorm.md`
- Tools used (and connectors that were unavailable).
- 8–12 candidate ideas, each with: one-line angle, target channel, why now, and source URLs.
- The chosen idea for each piece and why it won.
- **Fact sheet:** every fact the drafts may use, each with its source (a URL with the date you read it, or a repo file path). Drafts may only state facts that appear here.

## 2. Draft

For each piece, load its drafting skill(s) from the day-plan table with the Skill tool and follow them, especially their platform specs, hook formulas and "No AI Tells" rules.

- Write in the voice set out in the context doc's Brand Voice table.
- Use only facts from the fact sheet. If a line needs a fact you don't have, write `[NEED: ...]` instead of guessing.
- Give every piece one clear call to action. The default is to try a free mock interview at https://rolevia.xyz.
- **Images (carousel slides, post images):** follow `marketing-skills:image`. If an image-generation tool is connected, generate the images into the day folder. If not, write per-slide copy plus a full image prompt and design notes (size, layout, colours, text on image) so a designer or tool can produce them.
- **Video:** follow `marketing-skills:video`. Write a script with timestamps, on-screen text, voice-over, shot list and caption. Generate video only if a video tool is connected; otherwise the script is the deliverable.

### Output: one file per piece
`content/day<N>/<NN>-<channel>-<slug>.md`, for example `01-linkedin-gd-topics-this-week.md`. Each file starts with this header, then the ready-to-post content:

```markdown
---
day: <N>
channel: <channel>
format: <format>
status: draft
topic: <one line>
cta: <call to action>
sources: [<urls or repo paths from the fact sheet>]
---
```

Put generated media in `content/day<N>/assets/`, named after the piece (`02-instagram-slide-1.png`).

## 3. Audit

Audit every piece against all three checks below. Re-read the piece fresh, as an editor who did not write it. Fix what fails, then audit again. After two failed rounds, set the piece's status to `blocked` and say why.

### A. Fact check
- List every factual claim in the piece: numbers, dates, company facts, product features, prices, quotes.
- Match each one to the fact sheet. For outside facts, re-open the source (Firecrawl scrape or WebFetch) and confirm the page actually says it.
- Product claims must match `plans.json` and `src/` today.
- Any claim with no source gets removed or rewritten. No `[NEED: ...]` markers may be left in a piece marked `ready`.

### B. Brand guidelines
- Every rule in "Brand rules that always apply" above, and every active row in the context doc's Learnings table.
- Voice matches the Brand Voice table. Use the words-to-use list; none of the words-to-avoid appear.
- Run `marketing-skills:copy-editing` on the text and its AI-tells self-check: no contrast reveals ("it's not X, it's Y"), negation lists, trailing pile-ons, stock openers, or em dashes in short copy.

### C. Channel fit
Check against the platform quick reference in `marketing-skills:social` (and `video` or `image` for media). At minimum:

| Channel | Check |
|---------|-------|
| LinkedIn | Hook in the first 2 lines (before "see more"); about 1,300 characters or less; short paragraphs; at most 3 hashtags; link placement per the social skill's guidance |
| Instagram carousel | Slide 1 works as the hook on its own; one idea per slide; 6–8 slides; last slide has the CTA; caption hook in the first line; 3–5 relevant hashtags; 1080×1350 portrait images |
| X thread | First post works on its own; each post under 280 characters; the thread reads cleanly if only the first post is seen |
| Shorts / Reels | Hook in the first 2 seconds; 30–45 seconds when read aloud; on-screen text readable without sound; 9:16 |
| Blog | Title and meta description lengths; one H1; answers the searcher's question in the first paragraph |

### Output: `content/day<N>/audit.md`
One section per piece with a pass/fail line for A, B and C, the claims checked (claim → source), what was fixed, and the final status. Then set each piece's front-matter `status` to `ready` (all three checks pass) or `blocked` (with the reason).

## 4. Wrap up

Write `content/day<N>/README.md`:
- Date generated, theme, channels.
- A table of pieces: file, channel, topic, status.
- Connectors used and missing.
- Anything that needs a human: blocked pieces, `[NEED: ...]` items, images or videos still to be produced, and any conflicts found between the context doc and the code.

Then tell the user in a few lines: where the folder is, how many pieces are ready versus blocked, and what needs their attention. If a piece taught something worth keeping (for example a topic with no reliable sources), propose a Learnings row for `.agents/product-marketing.md` and add it only after the user approves.

## Folder layout

```
content/
  day1/
    README.md          # day summary and status table
    brainstorm.md      # research, ideas, chosen angles, fact sheet
    01-linkedin-<slug>.md
    02-instagram-<slug>.md
    03-x-<slug>.md
    04-shorts-<slug>.md
    audit.md           # fact, brand and channel checks per piece
    assets/            # generated images or video, if any
  day2/
    ...
```

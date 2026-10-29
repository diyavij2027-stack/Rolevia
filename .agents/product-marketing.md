# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-29

> Auto-drafted from the repo (`src/*.html`, `plans.json`, `README.md`), with the site rendered locally. The live rolevia.xyz could not be fetched, so anything the deployed build changes is not reflected here. Items marked **[CONFIRM]** are inferences; **[MISSING]** means nothing in the repo supports it yet.

## Product Overview
**One-liner:** Company-specific, CV-based voice interview practice and AI-scored group-discussion (GD) practice, with strict, evidence-based feedback.
**Site tagline:** "Know the company. Prepare for the role. Own the room."
**What it does:** You name a company (any company, including startups), pick a role and round, and an AI interviewer runs a spoken mock interview: it asks one question at a time, listens to your answers, and follows up on thin ones. If you upload your CV, questions challenge real items on it. A separate GD practice gives you a topic and scores what you actually said. Every session ends in a scored report with quoted evidence and better-answer suggestions.
**Product category:** AI mock interview / interview preparation platform, with GD practice for campus placements. **[CONFIRM]** the shelf customers search: likely "AI mock interview", "GD practice", "placement preparation".
**Product type:** Web app (SaaS), static front end on Vercel, Supabase auth, Google Gemini for AI.
**Business model:** Freemium with one-off packs and 30-day passes; no auto-renewing subscriptions. Prices shown in USD, charged in INR via Dodo Payments.

| Plan | Price | What you get |
|------|-------|--------------|
| Free | $0 one-time | 1 AI mock interview, 1 AI-scored GD practice, company research on any company |
| 1 GD + 1 Interview | $2 (₹179) per package | 1 GD practice, 1 company-specific voice interview |
| 3 GD Session Pack | $6 (₹537) | 3 GD practices |
| Placement Pro | $7 (₹599) / 30 days | 60 interviews, 8 GDs, role-specific prep, analytics |
| Premium | $9 (₹799) / 30 days | 30 interviews, 4 GDs, company-specific prep, CV-based questions, progress tracking |
| College Plan | From $20 (₹1,799) / student / year | Student prep, placement-cell dashboard, aggregate insights (contact sales) |

## Target Audience
**Target users:** Students, graduates and working professionals preparing for interviews; the site says it aims to be "useful to students, graduates and working professionals, and credible to placement cells." Signals point to **Indian campus placements** as the core: GD rounds, INR checkout, en-IN date formats, Indian recruiters in the company list (TCS, Infosys, HDFC Bank, HUL, Flipkart, Swiggy), "Campus placement" and "Student / Fresher" options, and a placement-cell plan. **[CONFIRM]**
**Experience levels supported:** Student / Fresher, 0–2 years, 3–6 years, 7+ years.
**Roles supported:** Marketing, Finance, Consulting, Sales, Product Management, Operations, Technology, Human Resources, Data & Analytics.
**Rounds supported:** HR / Behavioural, Case / Problem solving, Technical / Role knowledge, Managerial, Final / Leadership, plus a separate Situational & Case-Based round.
**Decision-makers:** The candidate (B2C). For the College Plan: placement cell / training-and-placement officer. **[CONFIRM]**
**Primary use case:** Practising a realistic, company- and role-specific interview out loud before the real one.
**Jobs to be done:**
- Find out what a specific company does, values and asks before an interview
- Rehearse spoken answers and get pushed on the weak ones, without needing a person to run the mock
- Get honest feedback on GD performance that rewards substance over airtime
**Use cases:**
- Campus placement season: GD round followed by HR and technical interviews
- Interview at a named company next week (e.g. Deloitte, Amazon, BCG)
- Consulting and finance candidates practising case / estimation questions
- Defending your own CV: projects, decisions, gaps

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Final-year student / fresher (user, buyer) | Clearing GD + interview rounds in placement season; low cost | Mocks are scarce and generic; friends go easy; GD feedback is vague | Unlimited-feeling practice at $2–9, tailored to the company and their CV, scored strictly |
| Early-career professional switching jobs | Preparing for a specific company and role fast | No time to research; unsure how they come across | Company brief + voice mock + report in one sitting |
| Placement cell / TPO (College Plan buyer) | Batch readiness, credible tools, student privacy | Can't run enough mocks for every student | Student prep plus a placement-cell dashboard with aggregate, privacy-conscious insights |

## Problems & Pain Points
**Core problem:** Candidates walk into company-specific interviews and GDs having practised generic questions, with no one to probe their answers or score them honestly.
**Why alternatives fall short:**
- Generic question lists aren't tied to the company, role, round or your CV **[CONFIRM]**
- Friends and peer mocks are polite and don't follow up on weak answers **[CONFIRM]**
- GD feedback tends to reward talking more and louder; Role.via explicitly scores relevance, listening and balance ("Speaking more is not rewarded")
- AI tools that present invented "insider" info as fact; Role.via labels every company item as verified, reported, or AI-generated
**What it costs them:** A missed offer in a narrow placement window. **[CONFIRM / MISSING]**
**Emotional tension:** Fear of blanking on a follow-up, of being caught out on your own CV, of being drowned out in a GD. **[CONFIRM]**

## Competitive Landscape
*All [CONFIRM]: from market knowledge, not the repo.*
**Direct:** Other AI mock-interview tools (e.g. Final Round AI, Yoodli, Google Interview Warmup): mostly text or generic; few do GD practice or company research labelled by evidence.
**Secondary:** Human mock-interview marketplaces (e.g. InterviewBuddy), placement prep sites with question banks and GD topic lists (e.g. PrepInsta): human mocks cost more and are hard to book at volume; question banks aren't interactive.
**Indirect:** Coaching institutes, placement-cell mocks, seniors and friends, YouTube: inconsistent, limited slots, little scored feedback.

## Differentiation
**Key differentiators:**
- Voice-only interviews: the interviewer speaks, you answer out loud, and it follows up on thin answers
- Any company, researched on demand, with every item labelled verified / reported / AI-generated
- Questions built from your CV, the company, the domain and the role (it will ask about a gap in your CV)
- GD practice scored on what you said, with quoted evidence; speaking more is not rewarded
- Separate Situational & Case-Based round
- Honesty as a feature: no sample scores, no hiring predictions, readiness scores measure practice only
- Pay-per-pack pricing with no auto-renewal
**How we do it differently:** Feedback quotes your own words as evidence instead of handing out generic scores.
**Why that's better:** You can see exactly why you scored what you did and what a better answer looks like.
**Why customers choose us:** **[MISSING]** No customer data yet.

## Objections
| Objection | Response |
|-----------|----------|
| "AI feedback is just generic fluff." | Reports quote what you actually said as evidence for each score. |
| "Will it know anything about the company I'm interviewing at?" | Any company can be researched; each item is labelled by evidence so you know what's verified. |
| "Is my CV / data safe?" | Reports, transcripts and CV stay in your browser; AI calls go to Google Gemini (free tier, disclosed). Export/delete in settings. **[CONFIRM]** server-side account deletion isn't built yet. |
| "I don't want another subscription." | Packs and 30-day passes; nothing auto-renews. |

**Anti-persona:** People wanting a guaranteed shortlist or job prediction; candidates who can't use a microphone (interviews are voice-only, Chrome/Edge/Safari); anyone wanting a human coach. **[CONFIRM]**

## Switching Dynamics
**Push:** Generic prep, polite peer mocks, vague GD feedback. **[CONFIRM]**
**Pull:** Company-specific voice mock tonight, scored with evidence, for $0–2.
**Habit:** Reading question lists and watching YouTube feels productive and costs nothing. **[CONFIRM]**
**Anxiety:** Talking to an AI out loud feels awkward; worry that AI company info is made up; CV privacy. **[CONFIRM]**

## Customer Language
**How they describe the problem:** **[MISSING]** No reviews, interviews or support tickets in the repo. Mine Reddit (r/Indian_Academia, r/developersIndia), LinkedIn and placement WhatsApp groups.
**How they describe us:** **[MISSING]**
**Words to use (from the site):** practise, mock interview, GD, company-specific, role, round, strict, evidence-based, report, follows up, spoken.
**Words to avoid:** "guarantee", "predict", "get hired", "insider", sample or invented scores (the site explicitly refuses these).
**Glossary:**
| Term | Meaning |
|------|---------|
| GD | Group discussion, a common placement round in India |
| GD Arena | The GD practice area |
| Company intelligence | On-demand company profile with evidence labels |
| Question Explorer | Filterable, bookmarkable question bank that turns into a mock |
| Readiness score | Practice performance only; not a hiring prediction |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Honest | States limits up front, labels evidence | Apologetic or self-deprecating | "Role.via does not predict hiring decisions and does not guarantee shortlisting." |
| Strict | Feedback that doesn't flatter | Harsh or discouraging | "Speaking more is not rewarded" |
| Plain | Short, concrete sentences | Robotic | "A spoken interview, one question at a time" |
| Confident | Short imperative headlines | Hype | "Know the company. Prepare for the role. Own the room." |

**Tone by context:**
- Support: direct, practical, says what's not built yet
- Launch: **[MISSING]**
- Errors: plain cause + fix ("Export your CV as a text-based PDF or DOCX and upload that.")
- Sales (College Plan): **[MISSING]**
- Social: **[MISSING]**
**Terms we own:** "Know the company. Prepare for the role. Own the room."; "labelled by evidence"
**Never use (and why):** "guaranteed", "AI predicts your hiring chances" (contradicts the product's stated stance).

## Proof Points
**Metrics:** **[MISSING]** No users, sessions, or outcome numbers.
**Customers:** **[MISSING]** No colleges or logos.
**Testimonials:** **[MISSING]**
**Value themes:**
| Theme | Proof |
|-------|-------|
| Company-specific | 49 popular companies listed; any other company researched on demand |
| Role-specific | 9 roles, 5 interview rounds + situational/case round, 4 experience levels |
| Honest feedback | Scores cite quoted evidence; no sample scores shown |
| Affordable | Free tier; paid from $2; no auto-renewal |

## Goals
**Business goal:** **[CONFIRM]** Grow free sign-ups and convert to paid packs; win College Plan deals.
**Conversion action:** "Start Preparing" → sign up → first free AI mock interview.
**Current metrics:** **[MISSING]** (Microsoft Clarity is installed.)

## Issues Spotted in Current Copy
- **Help says company profiles are "written by Claude"**, while the README and privacy notice say Gemini.
- **How It Works step 4 says "Book a slot"** for group GDs, but the README says group booking was removed from the UI.
- **Premium ($9) gives fewer interviews (30) than Placement Pro ($7, 60).** The higher-priced plan looks worse on the headline number.
- **Homepage pricing shows an internal note:** "Proposed prices to test, not validated market rates."
- **Brand name:** latest commit renamed the visible brand to "Role.via"; domain and repo use "Rolevia". Pick one for marketing.

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| | | | | |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-10-29) — Initial context, auto-drafted from the repo source and locally rendered site.

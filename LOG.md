# TCSS 490 Artifact 1: Development Log (LOG.md)

**Project:** Artifact 1 — Portfolio Hub  
**Course:** TCSS 490: Generative AI and Software Development (Autumn 2026)  
**Instructors:** Dr. Chris Marriott & Charles Bryan  
**Student:** Kevin Michalson  
**AI Assistant:** Gemini 2.5 Flash with Extended Thinking (Free Web Chat)  
**Repository:** https://github.com/Kcmichalson/490-Course  
**Live Site:** https://kcmichalson.github.io/490-Course/  

---

## 1. Project Overview & Constraints

The goal of Artifact 1 is to build a static front-end portfolio site serving as the persistent submission hub for all five course artifacts. 
Constraints observed:
- Zero backend dependencies (pure HTML, CSS, and vanilla JavaScript).
- Constructed using a free web chat AI prior to receiving course Claude Code access in Week 2.
- 5 artifact cards: Card 1 active and populated with this build, Cards 2–5 populated with brainstorming placeholders.
- Deployed publicly on GitHub Pages with an active development log.
- Clean code conventions adapted from UWT TCSS software engineering standards (JSDoc, explicit scoping, structured naming, and accessible markup).

---

## 2. Chronological Prompt History & Implementation Summaries

### Prompt 1
* **User Prompt:**  
  > *"On a UWT AI course. Flash extended is free, right? [Pasted Artifact 1 Assignment Requirements]"*
* **What the AI Provided:**  
  Confirmed that Gemini 2.5 Flash with Extended Thinking is free for web chat and API free tiers. Recommended a static, zero-dependency stack (`index.html`, `styles.css`) for GitHub Pages and outlined the semantic card requirements.

---

### Prompt 2
* **User Prompt:**  
  > *"Here's NotebookLM's explanation of the course assignments [Pasted NotebookLM Artifact 1 Overview & Technical Specification]. I also have an image of how I want it to look that I'd like you to make it after"*
* **What the AI Provided:**  
  Acknowledged the data schema and syllabus themes (Artifacts 1–5) and prepared to translate the incoming layout mockup into code.

---

### Prompt 3
* **User Prompt:**  
  > *"Can you make this with just that? Also later I'll make a simple 'About me' button that I can click to satisfy the other requirement but for now please build this. Ignore the fanning out thing for now. [Attached custom mockup image: Untitled.jpg]"*
* **What the AI Provided:**  
  Generated the first visual prototype featuring dark artifact sleeves, orange sliding cards, and an initial attempt at SVG-based liquid ripples.

---

### Prompt 4
* **User Prompt:**  
  > *"Yeah that looks really good, but I want that built in HTML and javascript, esxactly like that, but drop the white lines on teh the sides for now."*
* **What the AI Provided:**  
  Refined the layout into clean HTML/JS, omitting the angled side lines for a sleeker glow and adding initial modals for "About Me" and "Dev Log".

---

### Prompt 5
* **User Prompt:**  
  > *"Remember, the Spreadsheet thing should just be an image I can put in that will have a gradiant over it, since I'll put a unique image that will fade between when I hover over a new artefact. Also there's no water reflection yet, and the cards should be totally hidden until someone mouses over the artefact bin, and should peek out of it like a card. [Attached screenshot: image_3edb23.jpg]"*
* **Where the Model Misread Me:**  
  Cards were permanently extended above bins; shelf was placed too low, pushing the water reflection off-screen; and the spreadsheet was hardcoded DOM text rather than an image layer.
* **What the AI Provided:**  
  - Re-anchored the shelf to `48vh` to balance upward card translation and downward water reflection.
  - Rebuilt sleeve/card stacking (`z-index: 4` on sleeve, `z-index: 2` on card, `opacity: 0`, and `translateY: 0` at rest).
  - Built a dual-layer image crossfader (`#bgCurrent` and `#bgNext`) in vanilla JS to transition background images on hover.

---

### Prompt 6
* **User Prompt:**  
  > *"So give me the full updated file please"*
* **What the AI Provided:**  
  Delivered a complete, consolidated `index.html` with an embedded SVG spreadsheet data-URI fallback and functional modal overlays.

---

### Prompt 7
* **User Prompt:**  
  > *"Much better, but the cards don't reflect when I hover them, is it possible to fix that? [Attached screenshot: image_3f34a0.jpg]"*
* **Root Cause Discovered:**  
  Chromium calculates `-webkit-box-reflect` bounds from the static layout box (115px). When the child card translated upward via `translateY(-145px)`, WebKit clipped the reflection, only mirroring the static sleeve.
* **What the AI Provided:**  
  Replaced `-webkit-box-reflect` with CSS `transform: scaleY(-1)` inside a `.reflection-unit`, populated via a JS clone method (`setupCardReflections()`). Upward translation on the card mathematically drove the reflection downward into the water in real time.

---

### Prompt 8
* **User Prompt:**  
  > *"Where to put the function? And like this for the other one? [Pasted CSS snippet for card deck and water surface]"*
* **What the AI Provided:**  
  Guided placement of `setupCardReflections()` in `<script>` and resolved duplicate `.water-surface` style blocks to ensure `z-index: 22` layered ripple scanlines over the reflection.

---

### Prompt 9
* **User Prompt:**  
  > *"Very good. One last thing is that the card hides when you mouse up from hovering over the box, so maybe it needs to be sticky, to stay as long as the mouse remains in the bounding box around the box and the card and the space in between the card and the box [Attached screenshot: image_3f4005.jpg]"*
* **Root Cause Discovered:**  
  Elevating the card created a 38px empty layout gap between the sleeve and the card, causing the cursor to drop out of `:hover` focus.
* **What the AI Provided:**  
  Created an invisible CSS hover bridge (`.artifact-slot:hover::before`) covering `top: -295px` to `bottom: 0`, maintaining continuous hit-testing without complex JS listeners.

---

### Prompt 10
* **User Prompt:**  
  > *"Does this now meet the final requirements of the first assignment? [Pasted Assignment Requirements] [Attached screenshot: image_3f47be.jpg]"*
* **What the AI Provided:**  
  Audited the site against the labor-based grading criteria, confirmed front-end compliance, and flagged pre-deployment steps (physical `LOG.md`, repo URL update, GitHub Pages).

---

### Prompt 11
* **User Prompt:**  
  > *"Give me what to write in the LOG.md. Be comprehensive, say exactly what I asked you along the way and what you gave me."*
* **What the AI Provided:**  
  Generated the initial structured `LOG.md` documenting technical decisions, rendering engine workarounds, and reflections on LO 1 and LO 5.

---

### Prompt 12
* **User Prompt:**  
  > *"Does this satisfy everything? [Pasted Assignment Requirements] [Pasted complete index.html] [Pasted NotebookLM course overview and artifact breakdown]"*
* **What the AI Provided:**  
  Identified a content gap on Card 1 (missing explicit reflection text). Provided updated markup adding reflections to Card 1 and extended card dimensions.

---

### Prompt 13
* **User Prompt:**  
  > *"Can you instead make clicking inspect pop up a floating window on the site with the reflection? it gets cramped rn. [Attached screenshot: image_3b0e21.png]"*
* **What the AI Provided:**  
  Decoupled reflection text from the compact cards into a dedicated floating modal (`#modalInspect`), restored clean card dimensions (`235px`), and created a centralized `ARTIFACT_DATA` JavaScript dictionary.

---

### Prompt 14
* **User Prompt:**  
  > *"Clicking X doesn't make the pop up go away. Looks good otherwise"*
* **Root Cause Discovered:**  
  `modalInspect` bypassed the static `setupModal()` trigger and lacked a close click listener.
* **What the AI Provided:**  
  Added a delegated click listener inside `setupInspectModal()` using `e.target.closest('.modal-close')` and backdrop targeting.

---

### Prompt 15
* **User Prompt:**  
  > *"[Pasted complete index.html] Clicking inspect doesn't do anything. Also the mouse pointer shows as a 'single finger click' icon on hovering over the black box and the orange card, but just the pointer when hovering voer inspect. Shouldn it bea the otherw way? Also the inspect button now has a harsh black outline on the right and bottom edges."*
* **Root Causes Discovered:**  
  1. `setupInspectModal()` was never invoked at startup, and Cards 2–5 were missing the `.inspect-trigger` class.
  2. Cursor pointers were inverted (`cursor: pointer` was on the container rather than the button).
  3. Native `<button>` elements rendered default browser 3D bevel borders.
* **What the AI Provided:**  
  - Initialized `setupInspectModal()` and converted Cards 2–5 to inspect triggers.
  - Reset `.artifact-slot` and `.sleeve` to `cursor: default;` and assigned `cursor: pointer;` to `.card-btn`.
  - Added `border: none; outline: none;` to `.card-btn` to eliminate bevel outlines.

---

### Prompt 16
* **User Prompt:**  
  > *"[Pasted NotebookLM Course Dev Log Guidelines] Okay so given what the website says (summarized by notebookLM) is the current log satisafactory?"*
* **What the AI Provided:**  
  Confirmed the log satisfied all requirements (prompts, architectural pivots, failure modes, Markdown format) and clarified the difference between `LOG.md` and the Canvas Weekly Learning Log PDF.

---

### Prompt 17
* **User Prompt:**  
  > *"For this: [Pasted prior log text] Please make sure you write *every* prompt I sent you. Write it word for word, then summarize what you did. [Pasted full conversation transcript]"*
* **What the AI Provided:**  
  Expanded the log to record all prompts verbatim with technical summaries for each turn.

---

### Prompt 18
* **User Prompt:**  
  > *"Can you please confirm that this satisfies the requirements? [Pasted Assignment Requirements]"*
* **What the AI Provided:**  
  Conducted a requirement-by-requirement audit confirming all 8 assignment criteria were fulfilled.

---

### Prompt 19
* **User Prompt:**  
  > *"Is it fine for this to be public on my public github profile? Worried that if someone asks to see it for modding and sees the AI course they'll raise an eyebrow"*
* **What the AI Provided:**  
  Provided profile presentation advice: explained that accredited 400-level university coursework with deep technical debugging reads as rigorous computer science, and recommended pinning personal modding repositories while naming the course repo explicitly (`uwt-tcss490-portfolio`).

---

### Prompt 20
* **User Prompt:**  
  > *"How can I rename a git repo"*
* **What the AI Provided:**  
  Acknowledged transition to Prompt 21 regarding code standards.

---

### Prompt 21
* **User Prompt:**  
  > *"Can I apply these TCSS sets to HTML CSS? Or as much as is sensible? Code: [Pasted complete index.html] Rules: Attached [About javadoc.docx, TCSS Naming and Style Guidelines for Java Code.pdf]"*
* **What the AI Provided:**  
  - Filtered Java-only rules (CamelCase CSS, package imports) while adopting core software engineering standards.
  - Added top file header comments and JSDoc blocks (`@author`, `@version`, `@param`).
  - Applied TCSS parameter naming (`theParam`), mutable state naming (`myActiveKey`), and `const` scoping across all JS functions.

---

### Prompt 22
* **User Prompt:**  
  > *"[Pasted updated index.html with TCSS naming standards applied] Any other changes?"*
* **What the AI Provided:**  
  - Added `aria-hidden="true"` and `tabindex="-1"` to cloned water reflection buttons to prevent ghost keyboard tab stops.
  - Reordered `<script>` blocks so constants and data models (`ARTIFACT_DATA`) are declared before execution initializers.
  - Added an `Escape` key shortcut listener to close open modals.

---

### Prompt 23
* **User Prompt:**  
  > *"[Pasted complete updated index.html source code] Look through this comprehensively. Everything good?"*
* **What the AI Provided:**  
  Verified complete code integrity across functionality, accessibility, CSS rendering, and TCSS guidelines, confirming the project was production-ready.

---

### Prompt 24
* **User Prompt:**  
  > *"Can you please update dev log for me. up to and including this prompt"*
* **What the AI Provided:**  
  Delivered an expanded `LOG.md` incorporating Prompts 18 through 24.

---

### Prompt 25
* **User Prompt:**  
  > *"You may condense parts of the prompt that are simply copy pasting and summarize what it is. IE: If I send you the requirements several times, you can just write [Assignment requirements]"*
* **What the AI Provided:**  
  Streamlined the log by replacing redundant blocks of pasted syllabus requirements, transcript text, and full HTML files with concise bracketed descriptors while preserving all conversational prompts, user bug reports, and engineering decisions.

---

## 3. Reflection & Course Learning Objectives

### LO 1: Select and Configure AI Coding Tools
Using Gemini 2.5 Flash Extended in web chat enabled rapid iteration of visual concepts, CSS gradients, and DOM structures without the friction of complex build tooling. However, the model repeatedly defaulted to standard API patterns (such as `-webkit-box-reflect` or simple hover states) that broke down under non-standard spatial animations. High-quality output required giving the model precise constraints, testing outputs in real browser rendering engines, and challenging its initial structural assumptions.

### LO 5: Apply Just-in-Time Learning Strategies
Diagnosing why WebKit failed to mirror the transformed cards required investigating browser layout tree mechanics and hardware compositing. Similarly, solving the hover dropout issue with an invisible CSS pseudo-element (`::before`) demonstrated that deep CSS fundamentals often provide cleaner, more performant solutions than adding complex JavaScript state listeners.

### Senior Engineering Boundaries ("The Edge of Understanding")
As emphasized in TCSS 490, senior engineering involves deciding what can remain an intentional black box versus what must be thoroughly understood. While SVG ripple math and linear gradient color stops could safely be delegated to the AI, the DOM hierarchy, stacking contexts (`z-index`), event bubbling, and hit-testing zones required strict architectural control to prevent brittle UI regressions.

### Software Engineering Standards & Maintainability
Adapting UWT TCSS software development standards to front-end development demonstrated that code discipline transcends language boundaries. Applying JSDoc documentation, `theParam` parameter scoping, `myActiveKey` state encapsulation, and accessibility safeguards (`aria-hidden`, `tabindex="-1"`) produced a modular codebase that is straightforward to extend in subsequent weeks as Artifacts 2 through 5 are developed and integrated.

---

## 4. Later Updates (Claude Code)

Later changes to the portfolio are made with Claude Code (Opus 5.5) in the desktop app and recorded here.

### 2026-10-26 — Session 12 prompt log (Dev Log picker)

Session numbers continue from Artifact2/LOG.md. This entry is here, not in Artifact2/LOG.md, at your request (Prompt 3): the end of that file is now the Artifact 3 section.

**Exception recorded (your request):** Artifact2/CLAUDE.md keeps work inside Artifact2/. In this session I edited the root index.html and this LOG.md, because you asked for a portfolio change. I also read Artifact3/CLAUDE.md, Artifact3/LOG.md's headings and Artifact3/.gitignore, only to find out which log that folder holds.

**Tool-log gap:** Artifact2/tool-log/2026-10-26.jsonl has no entries from 20:58:25 to 21:27:48 UTC (1:58 to 2:27 PM local). See Prompt 5 for the cause.

### Prompt 1
* **User Prompt:**  
  > *"Can you make a change to the portfolio, where the Dev Log button will open a selection of the existing dev logs? So one for artifact 1 [the existing one], one for artifact 2, one for artifact 3 (this is the same file as artifact 2 but they are split after the AI companion), and one for 4 and one for 5."*
* **What the AI Provided:**  
  - Found the portfolio (root index.html) and the logs:
    - this LOG.md (Artifact 1), whose full text was also copied into index.html
    - Artifact2/LOG.md (Artifact 2). Artifact 3 starts at its "2026-10-25 — Artifact 3: climate companion" entry.
    - Artifact3/LOG.md (the LANCER Tactical Board Bridge)
  - Asked three questions before planning (answered in Prompt 3).

### Prompt 2 (sent while Claude was working)
* **User Prompt:**  
  > *"You can just link to the github page of each log instead of copying them to the actual indexhtml"*
* **What the AI Provided:**  
  Planned one GitHub link per log, built from the repo URL already used in index.html.

### Prompt 3 (my answers to Claude's three questions)
* **User Prompt:**  
  > *Artifact 1: "Link + remove copy (Recommended)". The Artifact3/ log: "That was an alternate development of artifact 3, which I decided to ditch for the time being in favor of the current artifeact 3. Might use it for artifact 4 but it was oriignally an alternate for aartifact 3. Maybe mention that somewhere." Where this log goes: "Root LOG.md".*
* **What the AI Provided:**  
  A plan with a vertical list in the Dev Log modal: one row per artifact with a short note, and the LANCER log as an indented "shelved alternate" row under Artifact 3.
* **Where the Model Misread Me:**  
  My question about the Artifact3/ folder offered only "Artifact 4", "Artifact 5" or "neither yet". It was none of these: it was a shelved alternate for Artifact 3.

### Prompt 4 (plan feedback)
* **User Prompt:**  
  > *"Please make it five buttons, like how the current buttons look when you open one of the artifact cards. Have them displayed in 1 - 2 - 3 - 4 - 5 order horizontally when they click the log button."*
* **What the AI Provided:**  
  Revised the plan: five buttons in one row, styled like the Inspect modal's buttons. Artifacts 4 and 5 are greyed out, and the LANCER log moves to one small note under the buttons.
* **Where the Model Misread Me:**  
  I planned a vertical list with notes. You wanted the same buttons as the artifact cards' Inspect modal, side by side.

### Prompt 5 (after the plan file was blocked)
* **User Prompt:**  
  > *"The restriction has been lifted, please proceed."*
* **What the AI Provided:**  
  - Saved the plan and made the change in index.html:
    - The Dev Log modal is now titled "Development Logs". The 260-line copy of this log is replaced by one intro line ("Each log opens on GitHub in a new tab."), five buttons and a note.
    - Artifacts 1–3 open in a new tab:
      - Artifact 1: this LOG.md
      - Artifact 2: Artifact2/LOG.md
      - Artifact 3: Artifact2/LOG.md#2026-10-25--artifact-3-climate-companion, the heading where Artifact 3 starts
    - Artifacts 4 and 5 are greyed out, with a "No log yet" tooltip.
    - The note reads "Shelved alternate for Artifact 3: LANCER Tactical Board Bridge log (might be reused for Artifact 4)". The name links to Artifact3/LOG.md.
    - CSS: added `.log-buttons` (equal-width row that wraps on narrow screens), `.log-none` and `.log-note`. Removed the `.modal-body pre` rule, which only the old copy used.
    - No JS change: the existing `setupModal('btnDevLog', 'modalDevLog')` still opens and closes the modal.
  - **Stopped** and reported that the tool log had stopped recording (CLAUDE.md rule).
* **Root Cause Discovered:**  
  - Your edit to Artifact2/.claude/settings.json at 2:22 PM left a `//` comment on line 50. That made the file invalid JSON (`json.load`: "Expecting value: line 50 column 7").
  - So Claude Code ignored the whole file: the tool-logging hook, and every deny rule. That is also why the plan file could now be saved in ~/.claude/plans/.
  - The commented-out rule pointed at `Documents/TCSS490-AI-Course`, without `GitHub/`, so it never matched this repo anyway.
* **How It Was Verified:**  
  - A read-only script on index.html:
    - no `<pre>` is left
    - the four links are exactly as planned
    - Artifacts 4 and 5 are the two greyed-out entries
    - every tag is balanced
    - all 843 line endings are still CRLF
  - index.html went from 1,066 to 844 lines.
  - Looks and links: your by-eye checklist passed (Prompt 7).

### Prompt 6
* **User Prompt:**  
  > *"I removed the comment on line 50 of .claude/settings.json. Check that the tool log is recording again, then write the LOG.md entry and start the server."*
* **What the AI Provided:**  
  - Confirmed settings.json is valid JSON again and that the tool log resumed at 21:27:48 UTC.
  - Started a static server for the repo root at http://127.0.0.1:8001/. It is reachable only from this computer; serve.py only serves Artifact2/.
  - Wrote this entry.
  - Gave a by-eye checklist and a commit message.
* **How It Was Verified:**  
  - `json.load` on settings.json: valid.
  - The tool log's newest entries are this turn's calls.
  - Fetching http://127.0.0.1:8001/ returns 200 with the new "Development Logs" modal.
  - By eye: your checklist passed (Prompt 7).

### Prompt 7 (my checklist results)
* **User Prompt:**  
  > *"The checklist passed. Update the LOG.md entry's by-eye line and stop the server."*
* **What the AI Provided:**  
  - Marked the by-eye checks in Prompts 5 and 6 as passed.
  - Stopped the server on port 8001.
* **How It Was Verified:**  
  - Your checklist, at a window about 1280 px wide, passed:
    - five buttons in one row, with nothing clipped
    - Artifacts 1–3 and the LANCER link open the right GitHub pages, and Artifact 3 lands on its heading
    - Artifacts 4 and 5 are greyed out
    - the modal closes with ×, a backdrop click and Esc
    - About Me and Inspect still work
  - After stopping the server, http://127.0.0.1:8001/ no longer answers.

### Prompt 8 (sent, interrupted, then restated)
* **User Prompt:**  
  > *"Remind me how this system works so I can present the system the companion uses."* [interrupted by you, then:] *"Remind me how the AI companion works so I can present the system the companion uses to a class"*
* **What the AI Provided:**  
  - An explanation in chat of the Artifact 3 climate companion's three modes:
    - tile advice (`companion.py`)
    - map-wide `--ask` (`mapquery.py` as an MCP server)
    - the live chat panel (the bridge in `serve.py`)
  - For each mode: what the model may do, what code checks, what is sent, the security around the bridge, and the known limits.
  - An inline diagram of the live chat loop.
  - No code changed.
* **How It Was Verified:**  
  - Facts taken from Artifact2/tools/README.md, Artifact2/LOG.md's Artifact 3 entries, and the current code: bridge.py's limits and chat prompt, and companion.py's `map_command`, `child_env` and `check_chat_places`.
  - The 4,000-character limit still applies to every resent message, including Claude's own earlier replies (bridge.py:143). So the "too long" bug seen in the demo recording is still open.

### Prompt 9 (answer to Claude's question: make a slide deck?)
* **User Prompt:**  
  > *"No thanks"*
* **What the AI Provided:**  
  No deck. Recorded this answer; nothing else changed.
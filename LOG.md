# TCSS 490 Artifact 1: Development Log (LOG.md)

**Project:** Artifact 1 — Portfolio Hub  
**Course:** TCSS 490: Generative AI and Software Development (Autumn 2026)  
**Instructors:** Dr. Chris Marriott & Charles Bryan  
**Student:** Kevin Michalson  
**AI Assistant(s):** Gemini 2.5 Flash with Extended Thinking (Free Web Chat). NotebookLM supplied with course materials to ensure adherance to the requirements of the assignments, Gemini provided with NotebookLM's summaries when needed.

---

## 1. Project Overview & Constraints

The goal of Artifact 1 is to build a static front-end portfolio site serving as the persistent submission hub for all five course artifacts. 
Constraints observed:
- Zero backend dependencies (pure HTML, CSS, and vanilla JavaScript).
- Constructed using a free web chat AI prior to receiving course Claude Code credentials in Week 2.
- 5 artifact cards: Card 1 active and populated with this build; Cards 2–5 populated with brainstorming placeholders.
- Publicly deployed on GitHub Pages with an active development log.

---

## 2. Chronological Prompt History & Implementation Summaries

### Prompt 1
> **User Prompt (Word-for-Word):**  
> *"On a UWT AI course. Flash extended is free, right?*  
>  
> *Artifact 1: Your Portfolio¶*  
> *Version 1.0 (September 26, 2026)*  
> *Time Estimate: 6-10 hours*  
> *One week, on your own*  
> *Due Sunday, October 11 at 11:59 PM*  
> *Canvas*  
> *Description¶*  
> *You will build a small portfolio site that shows off what you build this quarter. It has a card for each of the five artifacts in this course. Right now only the first card is real (it is the site itself), and the other four are placeholders holding your ideas for what might go there. As the quarter goes on you will fill them in, so by Week 10 the site shows five things you built. It is also how you hand in every artifact: each time, you add a card and submit this site's link.*  
> *This artifact is front end only. There is no server and no database, and it is built with a free web chat AI (Claude, ChatGPT, Gemini, or similar), since your Claude access arrives in Week 2.*  
>  
> *Learning Outcomes¶*  
> *Completing this artifact will allow you to:*  
> *Build and deploy a working site with an AI assistant, on a stack you may not have used before.*  
> *Describe what you want clearly enough for a model to build it, and notice where it misread you.*  
> *Start the record of your work that every later artifact adds to.*  
> *Instructions¶*  
> *Pick a chat AI.*  
> *Decide what the page says about you.*  
> *Build it.*  
> *Keep a log.*  
> *Add the five artifact cards.*  
> *Fill the placeholders with ideas.*  
> *Deploy it.*  
> *Submit the link.*  
> *Details¶*  
> *Pick a chat AI. Any free web chat AI is fine. You may switch partway through if one of them is not working for you (this is worth a line in your reflection if you do).*  
> *Decide what the page says about you. A few sentences about who you are and what you are interested in building is enough. You are free to add more (courses, work, interests), though the main purpose of the site is to hold the cards. Please do not put anything on it you would not want a future employer to read, since it will be public.*  
> *Build it. Front end only: HTML, CSS, and JavaScript, or any framework that builds to static files. You may paste the chat's code into files yourself, or have it walk you through a framework. If you already have a portfolio, you should add the cards to it (there is no need to start over). If your chat AI is Claude, you can ask it for an artifact that shows several color themes or layouts side by side before you commit to one. Please see Markdown and Artifacts for an example.*  
> *Keep a log. Keep a notes file in the site's repository of what you asked the chat for and what changed as you went. There is no required format, though a Markdown file is easy to write and reads well on GitHub. Please see Keep a log.*  
> *Add the five artifact cards. One card for each artifact in the course, Artifact 1 through Artifact 5. The Artifact 1 card describes this site. Each card should have room for a title, a link to the artifact, and a short reflection (a few sentences on how it went and what you learned). You will fill in a card every time you finish an artifact, so make sure the cards are easy for you to edit.*  
> *Fill the placeholders with ideas. Cards 2 through 5 are placeholders for now. Put your ideas in them: things you might build, problems you would like to solve, tools you wish existed. These are brainstorming, and you will not be held to them. For instance, a placeholder might say "A bot that tells my learning group when the bus is late" (Artifact 2?) or "Something my parents' business could actually use" (Artifact 5?).*  
> *Deploy it. Put the site somewhere we can open it from a link. GitHub Pages is free and works for static sites. Please see Deploying a Static Site if you have not done this before.*  
> *Submit the link. Submit the link to your live site on Canvas. You will submit this same link for every artifact this quarter.*  
>  
> *What Complete Looks Like¶*  
> *This artifact is complete if the site is live at a link we can open, it has the five artifact cards, the placeholders hold your own ideas, and the repository has your log. It does not need to be polished, and there is no minimum size. Please see Labor-Based Grading for how complete and incomplete work is handled. If you ask whether it is good enough, we will answer with what would make it better.*  
>  
> *Course Learning Objectives¶*  
> *Course Learning Objectives*  
> *This artifact contributes to the following course learning objectives:*  
> *LO 1: Select and configure AI coding tools appropriate to a given task or project context*  
> *LO 5: Apply just-in-time learning strategies to rapidly acquire unfamiliar technical knowledge*  
> *Note: Make sure you keep the repository, since every later artifact ends by filling in its card on this site.*  
>  
> *September 29, 2026"*

* **What the AI Did:**
  - Confirmed that Gemini 2.5 Flash with Extended Thinking is free for both web chat and Google AI Studio's free tier, fulfilling the course constraint for Week 1.
  - Recommended a static, zero-dependency stack (`index.html`, `styles.css`) for seamless hosting on GitHub Pages without asset-path issues.
  - Outlined the semantic structure for the 5 artifact cards, recommended an initial prompting strategy, and provided a step-by-step deployment guide for GitHub Pages.

---

### Prompt 2
> **User Prompt (Word-for-Word):**  
> *"Here's NotebookLM's explanation of the course assignments*  
>  
> *Give me the lowdown on how to do artifact 1 in comprehension*  
> *Here is a comprehensive breakdown of how to complete Artifact 1: Your Portfolio:*  
> *1. Overview & Constraints*  
> *Goal: Build a static front-end portfolio website that serves as a public showcase for all five artifacts you build this quarter[1].*  
> *Timeline: 1 week (due Sunday, October 11 at 11:59 PM; estimated time: 6–10 hours)[1].*  
> *Tech Stack: Front-end only (HTML, CSS, JavaScript, or any static framework) with no server or database[2][3].*  
> *AI Tooling: Built using a free web chat AI (such as Claude, ChatGPT, or Gemini), because official Claude Code credentials arrive in Week 2[2][4].*  
> *2. Step-by-Step Instructions*  
> *Select a Web Chat AI: Choose any free web chat AI to help draft, structure, and style your code[4].*  
> *Write Your "About" Section: Include a few sentences introducing who you are and what you are interested in building[4]. (Keep it suitable for future employers, as the site is public)[4].*  
> *Build the Site: Generate HTML/CSS/JS or use a static generator[3]. You can copy and paste code into your repository or have the chat AI walk you through the setup[3].*  
> *Create the 5 Artifact Cards:*  
> *Build 5 card components on the page, each equipped with space for a title, a project link, and a short reflection[1][5].*  
> *Card 1: Fully describes Artifact 1 (this portfolio site itself)[1][5].*  
> *Cards 2–5: Act as placeholders for future artifacts[1][5].*  
> *Fill the Placeholders with Ideas: Brainstorm ideas for Cards 2–5 (e.g., a Discord bot, a command-line utility, or a tool for a local club)[5]. You will not be locked into these ideas for later weeks[5].*  
> *Maintain a Repository Log: Keep a notes file (e.g., LOG.md) in your repository documenting what you asked the AI, what worked, what changed, and what was abandoned[3][6].*  
> *Deploy the Site: Publish your site to a public host (such as GitHub Pages or Vercel) so anyone can view it via URL[7][8].*  
> *Submit the Link: Submit the live site URL on Canvas[7]. You will resubmit this exact same portfolio link for every artifact throughout the quarter as you update its cards[1][7]*.*  
> *3. What "Complete" Looks Like*  
> *Under the course's labor-based grading system, your submission is marked Complete if:*  
> *The site is live at a reachable link[7].*  
> *It contains all 5 artifact cards (Card 1 filled in, Cards 2–5 containing placeholder ideas)[7].*  
> *The GitHub repository contains your development log[7].*  
> *The site does not need to be visually polished or perfect[7][9]. Making a genuine attempt at all required parts satisfies the completion requirement regardless of visual flaws[7][9].*  
> *💡 Would you like help brainstorming placeholder project ideas for Artifacts 2–5, or configuring a deployment workflow for GitHub Pages or Vercel?*  
> *Please summarize everything about the assignment that an AI agent would need to help construct it in HTML and javascript*  
> *To construct Artifact 1: Your Portfolio using HTML, CSS, and JavaScript, an AI agent needs a complete specification of the tech stack, structural requirements, data schema, repository artifacts, and deployment constraints.*  
> *1. Core Technical Constraints & Stack*  
> *Front-End Only: Static site with no backend server, API, or database[1]. Pure HTML, CSS, and vanilla JavaScript (or static site generators/frameworks compiled to static HTML/CSS/JS)[2].*  
> *No Secret/Paid API Dependencies: Built using free web chat AI tools (e.g., ChatGPT, Claude web chat, or Gemini)[1][3].*  
> *Deployment Target: Must be hosted on a public static host like GitHub Pages or Vercel[4].Host-specific note: If deployed via GitHub Pages, asset and link paths must account for subpath routing (e.g., username.github.io/portfolio/)[7][8].*  
> *2. Required Page Components & HTML Structure*  
> *The generated web page must include two primary visual sections:*  
> *"About Me" Section:*  
> *A short introductory bio (a few sentences) stating who the student is, their background, and their interests in software engineering/building[3].*  
> *Must be public-facing and professional for potential employers[3].*  
> *Five Artifact Cards Grid/Container:*  
> *Exactly 5 card components corresponding to the course's 5 assignments[9][10]:Card 1 (Artifact 1: Your Portfolio): Fully filled out with title, live site/repo link, and a short reflection on building this portfolio[9][10].*  
> *Cards 2–5 (Placeholders): Contain title headers, placeholder link areas, and initial brainstorming ideas for future artifacts[9][10]:Card 2: Artifact 2 — Something You Will Use[11]*  
> *Card 3: Artifact 3 — AI Inside It[12]*  
> *Card 4: Artifact 4 — For Someone Else[12]*  
> *Card 5: Artifact 5 — The Moonshot[12]*  
> *3. Data Schema for Artifact Cards (HTML / JS Model)*  
> *Each artifact card component must contain structural slots or data fields for three specific elements[10][12]:*  
> *// Recommended JSON/Object structure if rendering cards dynamically via JS*  
> *const artifactCardSchema = {*  
> *  id: "artifact-1",           // Artifact identifier (1 through 5)*  
> *  title: "Artifact 1: Your Portfolio", // Project Title*  
> *  link: "https://github.com/user/portfolio", // Live URL, repo link, or video demo*  
> *  reflection: "A few sentences detailing how the build went and key takeaways." // Reflection text*  
> *};*  
> *HTML Structure Requirements:Easy to update in subsequent weeks when replacing placeholder cards with completed project details[10].*  
> *Semantic HTML tags (<header>, <main>, <section>, <article>, <footer>) for accessibility[13].*  
> *4. Required Repository Files*  
> *In addition to the HTML/CSS/JS source files, the project repository must include:*  
> *Development Log ( LOG.md / DEVLOG.md ): A markdown file in the root repository documenting what prompts were asked of the chat AI, what code changed, key decisions made, and abandoned attempts[2][14].*  
> *5. Definition of "Complete" (Labor-Based Grading Criteria)*  
> *To be marked Complete under the course grading contract, the AI agent must deliver a site that fulfills these four criteria[4]:*  
> *Live & Accessible: Reachable at a public URL without errors or required sign-in[4][17].*  
> *All 5 Cards Present: Card 1 completed; Cards 2–5 populated with custom placeholder ideas[4][10].*  
> *Repository Log Included: A development log (LOG.md) present in the code repository[2][4].*  
> *Genuine Attempt: Visual layout or design perfection is not required for completion[4].*  
>  
> *I also have an image of how I want it to look that I'd like you to make it after"*

* **What the AI Did:**
  - Ingested the structured assignment breakdown and syllabus themes (Artifact 1: Portfolio, Artifact 2: Something You Will Use, Artifact 3: AI Inside It, Artifact 4: For Someone Else, Artifact 5: Moonshot).
  - Acknowledged readiness to adapt the architecture directly from the student's upcoming visual mockup.

---

### Prompt 3
> **User Prompt (Word-for-Word):**  
> *"Can you make this with just that? Also later I'll make a simple 'About me' button that I can click to satisfy the other requirement but for now please build this. Ignore the fanning out thing for now."*  
> *(Accompanied by custom graphic mockup `Untitled.jpg` showing: a background spreadsheet under a crimson gradient; a shelf with 5 dark bins; an orange card sliding straight up out of the bin; and reflective water mirroring everything below the horizon).*

* **What the AI Did:**
  - Evaluated the mockup image layout and created a visual concept preview using HTML/CSS and SVG filter turbulence to simulate water ripples.

---

### Prompt 4
> **User Prompt (Word-for-Word):**  
> *"Yeah that looks really good, but I want that built in HTML and javascript, esxactly like that, but drop the white lines on teh the sides for now."*

* **What the AI Did:**
  - Generated an initial web code implementation removing the angled white side lines from the mockup, styling dark card sleeves, and adding initial modal skeletons for "About Me" and "Dev Log".

---

### Prompt 5
> **User Prompt (Word-for-Word):**  
> *"Remember, the Spreadsheet thing should just be an image I can put in that will have a gradiant over it, since I'll put a unique image that will fade between when I hover over a new artefact. Also there's no water reflection yet, and the cards should be totally hidden until someone mouses over the artefact bin, and should peek out of it like a card."*  
> *(Accompanied by browser screenshot `image_3edb23.jpg` showing cards permanently elevated and water reflection cut off).*

* **Where the Model Misread Me:**
  - The model had positioned all 5 orange cards permanently extended above the bins instead of hiding them inside.
  - The shelf was placed too low on the screen, pushing the water reflection off the bottom of the viewport.
  - The spreadsheet was hardcoded as an HTML table instead of an interchangeable background image under a gradient.
* **What the AI Did:**
  - Re-anchored the horizon shelf to `48vh` so the top half accommodates upward card slides and the bottom half accommodates liquid reflection.
  - Restructured pocket stacking using `z-index`: sleeve in front at `z-index: 2` (later upgraded to `4`), card tucked behind at `z-index: 1` with `transform: translateY(0)` and `opacity: 0`.
  - Configured `:hover` to translate the card upward by `-130px` (later `-145px`).
  - Added a dual-layer image crossfade engine (`#bgCurrent` and `#bgNext`) in vanilla JavaScript to fade background images when slots are hovered.

---

### Prompt 6
> **User Prompt (Word-for-Word):**  
> *"So give me the full updated file please"*

* **What the AI Did:**
  - Delivered a consolidated, single-file `index.html`.
  - Embedded a lightweight SVG data-URI spreadsheet grid as the default background texture so the page renders cleanly without needing external image files immediately.
  - Integrated header navigation with working "About Me" and "Dev Log" modals.

---

### Prompt 7
> **User Prompt (Word-for-Word):**  
> *"Much better, but the cards don't reflect when I hover them, is it possible to fix that?"*  
> *(Accompanied by browser screenshot `image_3f34a0.jpg` showing that the rising orange card was not mirrored in the water).*

* **Root Cause Discovered:**
  - Chromium calculates CSS `-webkit-box-reflect` bounds strictly from `.card-deck`'s static layout box (115px). When a child card translates upward with `translateY(-145px)`, the Blink rendering engine does not recompute box bounds for CSS transforms, clipping the reflection entirely and only mirroring the static sleeve.
* **What the AI Did:**
  - Removed `-webkit-box-reflect` from `.card-deck`.
  - Implemented hardware-accelerated mirroring using CSS `transform: scaleY(-1)` inside a `.reflection-unit` anchored at `transform-origin: 50% calc(100% + 3px)`.
  - Added the `setupCardReflections()` JavaScript method to dynamically clone each slot's contents into the reflection unit on page load. Because CSS transforms compound on nested mirrored elements, lifting the card up by `-145px` automatically drives its mirrored twin down into the water by `+145px` in real time.

---

### Prompt 8
> **User Prompt (Word-for-Word):**  
> *"Where to put the function? And like this for the other one?*  
>  
> *    /* ==========================================================================*  
> *       4. Card Deck & Horizon Shelf*  
> *       ========================================================================== */*  
> *    .horizon-shelf {*  
> *      position: absolute;*  
> *      top: var(--horizon-y);*  
> *      left: 0;*  
> *      width: 100%;*  
> *      display: flex;*  
> *      justify-content: center;*  
> *      z-index: 20;*  
> *    }*  
>  
> *    /* 1. Remove box-reflect from .card-deck */*  
> *    .card-deck {*  
> *      display: flex;*  
> *      gap: 22px;*  
> *      padding: 0 20px;*  
> *    }*  
>  
> *    /* 2. Add the dynamic hardware-mirrored water unit */*  
> *    .reflection-unit {*  
> *      position: absolute;*  
> *      inset: 0;*  
> *      pointer-events: none;*  
> *      transform-origin: 50% calc(100% + 3px);*  
> *      transform: scaleY(-1);*  
> *      opacity: 0.65;*  
> *      filter: blur(0.6px);*  
> *      z-index: 1;*  
> *    }*  
>  
> *    /* Keep the reflection from catching cursor focus */*  
> *    .reflection-unit * {*  
> *      pointer-events: none !important;*  
> *    }*  
>  
> *    /* 3. Adjust water surface z-index so ripple scanlines tint the reflection */*  
> *    .water-surface {*  
> *      position: absolute;*  
> *      top: calc(var(--horizon-y) + 117px);*  
> *      left: 0;*  
> *      width: 100%;*  
> *      bottom: 0;*  
> *      z-index: 22; /* Sits over the reflection to tint and ripple it */*  
> *      background: linear-gradient(180deg, rgba(8, 2, 5, 0.25) 0%, rgba(2, 2, 4, 0.95) 85%);*  
> *      pointer-events: none;*  
> *      overflow: hidden;*  
> *    }*  
>  
> *    .artifact-slot {*  
> *      position: relative;*  
> *      width: 195px;*  
> *      height: 115px;*  
> *      cursor: pointer;*  
> *    }"*

* **What the AI Did:**
  - Directed the exact placement for `setupCardReflections()` inside `<script>` directly below `BG_IMAGES`.
  - Identified and resolved duplicate `.water-surface` style declarations between Section 4 and Section 5, ensuring `z-index: 22` correctly placed water ripple scanlines above the reflection.

---

### Prompt 9
> **User Prompt (Word-for-Word):**  
> *"Very good. One last thing is that the card hides when you mouse up from hovering over the box, so maybe it needs to be sticky, to stay as long as the mouse remains in the bounding box around the box and the card and the space in between the card and the box"*  
> *(Accompanied by screenshot `image_3f4005.jpg`).*

* **Root Cause Discovered:**
  - Lifting the card by `-145px` created a 38px empty layout gap between the top of the sleeve and the bottom of the card. Moving the cursor vertically across this empty gap caused the browser to lose `:hover` focus on the container, collapsing the card back down.
* **What the AI Did:**
  - Implemented an invisible hover bridge pseudo-element (`.artifact-slot:hover::before`) covering `top: -295px` down to `bottom: 0`.
  - Solved the hover dropout cleanly in pure CSS without introducing JavaScript mouse-tracking listeners or state debounce logic.

---

### Prompt 10
> **User Prompt (Word-for-Word):**  
> *"Does this now meet the final requirements of the first assignment?*  
>  
> *Skip to content*  
> *Found an issue with this site?Report it here*  
> *TCSS 490: Generative AI and Software Development*  
> *Artifact 1: Your Portfolio*  
> *... [Pasted syllabus details and screenshot image_3f47be.jpg] ..."*

* **What the AI Did:**
  - Audited the implementation against the course rubric and labor-based grading contract.
  - Confirmed the front-end layout satisfied visual and structural criteria.
  - Flagged three remaining action items: updating Card 1's link from `https://github.com` to the actual repo, creating a physical `LOG.md` in the repo root, and turning on GitHub Pages.

---

### Prompt 11
> **User Prompt (Word-for-Word):**  
> *"Give me what to write in the LOG.md. Be comprehensive, say exactly what I asked you along the way and what you gave me."*

* **What the AI Did:**
  - Drafted a structured Markdown log detailing prompts, decisions, technical hurdles (WebKit clipping, hover gaps), and course reflection aligned with LO 1 and LO 5.

---

### Prompt 12
> **User Prompt (Word-for-Word):**  
> *"Does this satisfy everything?*  
>  
> *Artifact 1: Your Portfolio¶*  
> *... [Pasted syllabus specification] ...*  
> *... [Pasted full index.html source code] ...*  
> *... [Pasted NotebookLM course overview, policies, and artifact breakdown] ..."*

* **What the AI Did:**
  - Re-audited the pasted code against the syllabus and identified a content gap on Card 1: Card 1 only contained a brief description without the required reflection text.
  - Provided updated markup adding reflection text to Card 1, increased card height and lift, and embedded the complete log text into the Dev Log modal.

---

### Prompt 13
> **User Prompt (Word-for-Word):**  
> *"Can you instead make clicking inspect pop up a floating window on the site with the reflection? it gets cramped rn."*  
> *(Accompanied by screenshot `image_3b0e21.png` showing cramped text on Card 1).*

* **What the AI Did:**
  - Decoupled reflection text from the compact physical card layout to prevent overflow and clipping.
  - Added a dedicated `#modalInspect` floating inspection modal to the HTML.
  - Reset `.card` height back to a clean `235px` and hover translation to `-145px`.
  - Converted the "Inspect" button to trigger the modal dynamically via a centralized `ARTIFACT_DATA` JavaScript dictionary.

---

### Prompt 14
> **User Prompt (Word-for-Word):**  
> *"Clicking X doesn't make the pop up go away. Looks good otherwise"*

* **Root Cause Discovered:**
  - `modalInspect` was opened dynamically by `.inspect-trigger` buttons, bypassing the generic `setupModal()` function. Consequently, neither the `&times;` close button nor backdrop click listeners were ever bound to it.
* **What the AI Did:**
  - Added an event listener inside `setupInspectModal()` using `e.target.closest('.modal-close')` and backdrop targeting to smoothly dismiss the modal when clicking `&times;` or anywhere outside.

---

### Prompt 15
> **User Prompt (Word-for-Word):**  
> *"[Pasted complete index.html source code]*  
>  
> *Clicking inspect doesn't do anything.*  
>  
> *Also the mouse pointer shows as a 'single finger click' icon on hovering over the black box and the orange card, but just the pointer when hovering voer inspect. Shouldn it bea the otherw way? Also the inspect button now has a harsh black outline on the right and bottom edges."*

* **Root Causes Discovered:**
  1. `setupInspectModal()` was declared at the end of the script but never invoked during initialization. Additionally, Cards 2–5 still used `<a>` tags lacking the `inspect-trigger` class.
  2. `.artifact-slot` and `.sleeve` had `cursor: pointer;` in CSS, while the native `<button>` element defaulted to `cursor: default;` in the browser's user-agent stylesheet.
  3. The native HTML `<button>` had browser 3D bevel borders (`border: 2px outset buttonface`) applied.
* **What the AI Did:**
  - Added the initialization call `setupInspectModal();` to the script and updated Cards 2–5 with `<button class="card-btn inspect-trigger">`.
  - Inverted the cursors: assigned `cursor: default;` to `.artifact-slot` and `.sleeve`, and `cursor: pointer;` to `.card-btn`.
  - Added `border: none; outline: none;` to `.card-btn` to remove the harsh black bevel border.

---

### Prompt 16
> **User Prompt (Word-for-Word):**  
> *"For Artifact 1 (and all subsequent artifacts), the course requires a log of plans and changes stored directly inside your project's repository[1][2].*  
> *Here is exactly what the course asks for regarding the dev log:*  
> *What the Dev Log Contains*  
> *Prompts & Requests: A record of what you asked the web chat AI for as you built the site[1][2].*  
> *Project Evolution: What you set out to build, key architectural or design decisions you made, how the code changed along the way, and any attempts or ideas you abandoned[2].*  
> *Artifact 1 Specifics: Because Artifact 1 is constructed in a web chat AI, a simple notes file recording your prompts and design iterations is all that is required[2].*  
> *Format & Location*  
> *No Required Format: There is no rigid template required[2]. A simple Markdown file in your repository root (such as LOG.md, DEVLOG.md, PLAN.md, or a section in your README.md) works best because it renders cleanly on GitHub[1][2].*  
> *Who Writes It: You can take notes manually or have the AI help format and keep the log for you[2].*  
> *Purpose: It provides a clear audit trail showing how the artifact came to be[2].*  
> *Important Distinction*  
> *Dev Log vs. Weekly Learning Log: The dev log lives in your project's GitHub repository and records the technical progress of that specific build[2]. It is separate from your weekly learning log, which is a PDF submitted on Canvas tracking your personal hours, pace, engagement, and written reflection[2].*  
>  
> *Okay so given what the website says (summarized by notebookLM) is the current log satisafactory?"*

* **What the AI Did:**
  - Confirmed that the log fully satisfies the course contract by documenting exact prompt inputs, architectural decisions, engine bugs, and learning reflections in GitHub-friendly Markdown.
  - Re-emphasized the distinction between this repository `LOG.md` and the separate PDF Weekly Learning Log submitted on Canvas.

---

## 3. Reflection & Course Learning Objectives

### LO 1: Select and Configure AI Coding Tools
Using Gemini 2.5 Flash Extended in web chat enabled rapid iteration of visual concepts, CSS gradients, and DOM structures without the overhead of build tools or package managers. However, the model repeatedly defaulted to standard API patterns (such as `-webkit-box-reflect` or basic hover states) that broke down under non-standard spatial animations. High-quality output required giving the model precise constraints and challenging its initial structural assumptions.

### LO 5: Apply Just-in-Time Learning Strategies
Diagnosing why WebKit failed to mirror the transformed cards required investigating browser layout tree mechanics and hardware compositing. Similarly, solving the hover dropout issue with an invisible CSS pseudo-element (`::before`) demonstrated that deep CSS fundamentals often provide cleaner, more performant solutions than adding complex JavaScript state listeners.

### Senior Engineering Boundaries ("The Edge of Understanding")
As emphasized in TCSS 490, senior engineering involves deciding what can remain an intentional black box versus what must be thoroughly understood. While SVG ripple math and linear gradient color stops could safely be delegated to the AI, the DOM hierarchy, stacking contexts (`z-index`), event bubbling, and hit-testing zones required strict architectural control to prevent brittle UI regressions.
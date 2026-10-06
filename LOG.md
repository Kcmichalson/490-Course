# TCSS 490 Artifact 1: Development Log (LOG.md)

**Project:** Portfolio Website (Artifact 1)  
**Author:** Kevin Michalson  
**AI Assistant:** Gemini 2.5 Flash (with Extended Thinking)  
**Date:** October 5, 2026  
**Repository:** [Link to your GitHub Repo]  
**Live Site:** [Link to your GitHub Pages URL]  

---

## 1. Overview & Setup

This log documents the iterative development of Artifact 1: Your Portfolio for TCSS 490 (Generative AI and Software Development). The goal was to construct a responsive, static front-end web application with five interactive artifact cards, dynamic visual styling, a water-reflection effect, and placeholder project ideas using a free web chat AI.

---

## 2. Prompting & Iteration History

### Iteration 1: Technical Validation & Initial Architecture
* **User Prompt:**
  > *"On a UWT AI course. Flash extended is free, right? [Pasted Artifact 1 Assignment Specification]"*
* **What the AI Provided:**
  * Confirmed Gemini Flash with Extended Thinking is free for both web chat and Google AI Studio.
  * Recommended a zero-dependency static stack (`index.html`, `styles.css`) for reliable deployment on GitHub Pages.
  * Outlined the semantic structure for the 5 cards, log requirements, and GitHub Pages deployment steps.

---

### Iteration 2: Image Mockup & Visual Requirements Specification
* **User Prompt:**
  > Provided NotebookLM course summary and uploaded mockup image (`Untitled.jpg`) with specific UI notes:
  > *"Can you make this with just that? Also later I'll make a simple 'About me' button that I can click to satisfy the other requirement but for now please build this. Ignore the fanning out thing for now."*
  > *Visual notes from mockup:*
  > - Top cosmetic effect: transparent crimson gradient over a background image (spreadsheet).
  > - 5 dark artifact bins across the horizon.
  > - Card slides straight up out of the bin on hover.
  > - Reflective water surface below horizon reflecting cards, sleeves, and fx.
* **What the AI Provided:**
  * First implementation attempt generated as a full web canvas.
  * Included SVG turbulence filters, modal containers, and basic card structures.

---

### Iteration 3: Course-Correction on Layout and Visibility State
* **User Prompt:**
  > Uploaded browser screenshot (`image_3edb23.jpg`):
  > *"Remember, the Spreadsheet thing should just be an image I can put in that will have a gradiant over it, since I'll put a unique image that will fade between when I hover over a new artefact. Also there's no water reflection yet, and the cards should be totally hidden until someone mouses over the artefact bin, and should peek out of it like a card."*
* **Where the Model Misread the Prompt:**
  * The initial output had statically displayed all orange cards permanently above their bins instead of hiding them inside.
  * The shelf was placed too close to the bottom of the viewport, pushing the water reflection entirely off-screen.
  * The spreadsheet was hardcoded into DOM markup rather than configured as a swappable, layered background image.
* **What the AI Provided:**
  * **Architectural Explanation:** Anchored the shelf to `46vh`–`48vh` so the top half accommodates the upward sliding card and the bottom half accommodates the downward reflection.
  * **Pocket Stacking (`z-index`):** Placed the dark sleeve at `z-index: 4` and the orange card at `z-index: 2` with `transform: translateY(0)` and `opacity: 0` at rest.
  * **Hover Transition:** Triggered `transform: translateY(-145px)` and `opacity: 1` on hover.
  * **Dynamic Crossfade Script:** Implemented a two-layer background engine (`#bgCurrent` and `#bgNext`) that listens for `mouseenter` on `.artifact-slot` and swaps the background image via CSS opacity transition.

---

### Iteration 4: Full Code Consolidation
* **User Prompt:**
  > *"So give me the full updated file please"*
* **What the AI Provided:**
  * Delivered a complete, consolidated `index.html` containing all HTML, CSS, and vanilla JS.
  * Included an embedded SVG spreadsheet data URI so the spreadsheet grid displays immediately out of the box without broken external image links.
  * Integrated accessible "About Me" and "Dev Log" modals in the header.

---

### Iteration 5: Resolving Reflection Clipping on Animated Elements
* **User Prompt:**
  > Uploaded browser screenshot (`image_3f34a0.jpg`):
  > *"Much better, but the cards don't reflect when I hover them, is it possible to fix that?"*
* **Root Cause Analysis:**
  * Chromium calculates `-webkit-box-reflect` bounds strictly from the static bounding box of `.card-deck` (115px). When the orange card translated upward (`translateY(-145px)`), it moved outside that layout box. WebKit does not recalculate bounding boxes for CSS-transformed child elements, clipping the reflection and only mirroring the static sleeve.
* **What the AI Provided:**
  * Replaced `-webkit-box-reflect` with a hardware-accelerated CSS mirroring solution: a `.reflection-unit` container inside each slot styled with `transform-origin: 50% calc(100% + 3px)` and `transform: scaleY(-1)`.
  * Added a dynamic JavaScript cloning function `setupCardReflections()`:
    ```javascript
    function setupCardReflections() {
      document.querySelectorAll('.artifact-slot').forEach(slot => {
        if (slot.querySelector('.reflection-unit')) return;
        const reflectUnit = document.createElement('div');
        reflectUnit.className = 'reflection-unit';
        reflectUnit.innerHTML = slot.innerHTML;
        slot.appendChild(reflectUnit);
      });
    }
    ```
  * Because CSS transforms compound on nested mirrored elements, when `:hover` pushes the top card up by `-145px`, the mirrored clone inside `.reflection-unit` automatically translates down into the water by `+145px` with zero frame lag.

---

### Iteration 6: Component Placement & Cascading Stylesheet Cleanup
* **User Prompt:**
  > *"Where to put the function? And like this for the other one? [Pasted code snippet]"*
* **What the AI Provided:**
  * Specified the exact placement for `setupCardReflections()` right after `BG_IMAGES` in `<script>`.
  * Identified and resolved duplicate `.water-surface` style blocks to ensure the updated `z-index: 22` correctly layered water ripple scanlines over the reflection.

---

### Iteration 7: Fixing the Hover Hitbox Gap ("Sticky Card" Behavior)
* **User Prompt:**
  > Uploaded browser screenshot (`image_3f4005.jpg`):
  > *"Very good. One last thing is that the card hides when you mouse up from hovering over the box, so maybe it needs to be sticky, to stay as long as the mouse remains in the bounding box around the box and the card and the space in between the card and the box"*
* **Root Cause Analysis:**
  * When the card slid up by `-145px`, its bottom edge sat roughly 38px above the sleeve's top edge. Moving the mouse vertically from the sleeve toward the card crossed an empty layout gap. The browser detected cursor departure, canceled the `:hover` pseudo-class, and instantly dropped the card back down.
* **What the AI Provided:**
  * Created an invisible hover bridge using a CSS pseudo-element (`.artifact-slot:hover::before`):
    ```css
    .artifact-slot:hover::before {
      content: '';
      position: absolute;
      top: -295px;   /* Extends to the top of the elevated card */
      bottom: 0;     /* Extends to the base of the sleeve */
      left: -6px;    /* Buffer for diagonal cursor movement */
      right: -6px;
      z-index: 1;    /* Sits under card and sleeve to allow button clicks */
    }
    ```
  * This bridged the hit-test zone across the sleeve, the gap, and the card without modifying DOM structure or writing complex mouse-tracking JS.

---

### Iteration 8: Assignment Spec & Rubric Audit
* **User Prompt:**
  > *"Does this now meet the final requirements of the first assignment? [Pasted syllabus text and screenshot image_3f47be.jpg]"*
* **What the AI Provided:**
  * Audited the implementation against all labor-based grading criteria.
  * Verified that frontend architecture, 5 cards, placeholder content, and About Me modal were compliant.
  * Flagged remaining pre-submission tasks: committing this physical `LOG.md` to GitHub, updating Card 1's link with the repository URL, and deploying to GitHub Pages.

---

## 3. Reflection & Learning Outcomes (LO 1 & LO 5)

### Course Objective Alignment
* **LO 1: Select and configure AI coding tools appropriate to a given task or project context:**  
  Gemini 2.5 Flash Extended served as an effective pair-programmer for rapid frontend layout generation. Using natural language alongside visual UI mockups enabled fast feedback loops. However, models frequently default to common patterns (e.g., standard CSS `-webkit-box-reflect` or static positioning) that fail on non-standard animated UI mechanics, requiring precise architectural guidance from the developer.
* **LO 5: Apply just-in-time learning strategies to rapidly acquire unfamiliar technical knowledge:**  
  Diagnosing the reflection clipping issue required rapid investigation of WebKit/Blink layout tree rendering rules regarding `transform` versus layout boxes. Similarly, solving the hover dropout issue with a pseudo-element bridge (`::before`) proved significantly cleaner and more performant than event-driven JavaScript state listeners (`mouseleave` debouncing).

### Model Strengths & Failure Modes Observed
1. **Strengths:**
   * Rapidly generated boilerplate and CSS gradients matching the wine/crimson aesthetic.
   * Successfully created a reliable data-URI fallback for the spreadsheet texture so external asset paths wouldn't break rendering.
   * Adapted immediately when instructed to explain decisions and provide focused, modular code adjustments.
2. **Failure Modes:**
   * **Spatial Misunderstanding:** Initially placed elements statically without respecting the requirement that cards emerge from inside sleeves.
   * **Rendering Engine Blind Spots:** Relied on `-webkit-box-reflect` despite modern browser limitations with child translation animations.
   * **Interactive Hit-Test Gaps:** Did not anticipate cursor loss between disjointed animated bounding boxes until explicitly caught during browser testing.
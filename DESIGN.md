---
name: Revêtements biosourcés à Lyon
description: A living figure plate from a research article, turned into a decision-support web map.
colors:
  figure-white: "#fcfcfb"
  ink: "#14181f"
  ink-secondary: "#3f4652"
  ink-tertiary: "#5f6672"
  hairline: "#d5d8dc"
  hairline-faint: "#e8eaec"
  wash: "#f2f3f4"
  out-of-scope-grey: "#cfd2d6"
  course-vermillion: "#D55E00"
  r1-bluish-green: "#009E73"
  r2-orange: "#E69F00"
  r3-blue: "#0072B2"
  r4-reddish-purple: "#CC79A7"
  heat-red-brown: "#a12e27"
  needs-slate: "#43548a"
  live-number-highlight: "#f3e2c4"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 88"
  figure-counter:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 760
    lineHeight: 1.12
    fontVariation: "'wdth' 85"
    fontFeature: "'tnum' 1"
  panel-letter:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 760
    lineHeight: 1.15
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.97rem"
    fontWeight: 400
    lineHeight: 1.42
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 650
    lineHeight: 1.25
    fontVariation: "'wdth' 90"
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.3
    fontVariation: "'wdth' 92"
  data:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "'tnum' 1"
rounded:
  none: "0px"
  swatch: "2px"
  bar-end: "3px"
  station: "50%"
spacing:
  hair: "4px"
  rail: "6px"
  gap: "12px"
  panel-x: "14px"
  plate-x: "20px"
components:
  segmented-control:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  segmented-control-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.figure-white}"
  mission-tab:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "2.25rem"
  mission-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.figure-white}"
  next-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.figure-white}"
    rounded: "{rounded.none}"
    padding: "0 12px 0 16px"
    height: "2.4rem"
  button-outline:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  chip:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "2px 7px"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.figure-white}"
  input-search:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "5px 8px"
  panel-letter-box:
    backgroundColor: "{colors.figure-white}"
    textColor: "{colors.ink}"
    typography: "{typography.panel-letter}"
    rounded: "{rounded.none}"
    width: "2.6rem"
    height: "2.45rem"
  course-station:
    backgroundColor: "{colors.course-vermillion}"
    textColor: "#ffffff"
    rounded: "{rounded.station}"
    size: "1.7rem"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.figure-white}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
---

# Design System: Revêtements biosourcés à Lyon

## Overview

**Creative North Star: "The Living Figure Plate"**

Every screen is a figure plate from a research article: a ruled header, lettered panels (a, b, c) on a figure-white ground, shared colour bars, and a full "Fig. n |" caption whose numbers rewrite themselves as sliders, year scrubs and clicks change the data. The map is panel (a), not a full-bleed backdrop; charts are panels (b) and (c); the caption is set as article prose, not as KPI cards. Depth, chrome and decoration are replaced by the vocabulary of print figures: 1 px ink rules, panel letters in a cut corner, hairline grids and tabular figures.

The system is dense on purpose. It is read from the back of a seminar room on a 16:9 projector and then interrogated up close on a laptop, so one root font size scales the whole plate (`clamp(13.5px, 0.62vw + 6px, 19px)`) and charts read that same factor. Colour carries data only: four Okabe-Ito hues name the four surfacings, single-hue ramps carry magnitudes, greys and line width carry robustness, and one reserved vermillion marks the guided course. Everything else is ink on paper.

Rejected by the world: the category default of a full-bleed dark basemap, a layer drawer and floating KPI cards; drop shadows; rounded cards.

**Key Characteristics:**
- Figure-white paper, near-black ink, 1 px ink panel rules, square corners everywhere except data marks.
- Archivo variable (self-hosted, width axis 62–125 %) as the only family; condensed widths for headings, tabular figures for every number.
- Lettered panels with a ruled corner box; a "Fig. n |" caption that recomputes live.
- Colour is data: Okabe-Ito categorical, single-hue sequential ramps, greys plus width for robustness.
- One reserved ink, vermillion, for the guided course and nothing else.
- One choreography per figure change: panel clip reveal, map flyTo, caption focus pull.

## Colors

Ink on figure-white, with colour admitted only as an encoding of data or of the guided course.

### Primary
- **Ink** (`ink`): text, every panel and control border, the 2 px header and next-band rules, selected/active fills (segmented control, mission tab, pressed chip, next button), tooltips. Selection inverts to ink ground with paper text.

### Secondary
- **Course Vermillion** (`course-vermillion`): reserved for the guided presentation course: numbered station discs on real streets, the dashed course line (2.2 px, dash 2/1.6), station tag borders, inline station numerals in captions, and the reference mark on a chart when a station is in focus.

### Tertiary (data categorical, Okabe-Ito, fixed order R1–R4)
- **Bluish Green** (`r1-bluish-green`): R1 bio-binder substitution.
- **Orange** (`r2-orange`): R2 light-coloured translucent plant binder.
- **Blue** (`r3-blue`): R3 porous bio-binder.
- **Reddish Purple** (`r4-reddish-purple`): R4 high-RAP plus bio-rejuvenator.

Sequential ramps (six stops, light to dark, defined in `webmap/js/palette.js`):
- **Heat red-brown** (anchor `heat-red-brown`): heat exposure and heat need.
- **Needs slate** (anchor `needs-slate`): every other territorial need (health, water, carbon, uses) and the heavy-traffic class ramp.
- **Per-surfacing aptitude**: each surfacing's aptitude in its own hue's ramp (R1 green, R2 amber, R3 blue, R4 mauve).
- **Grey**: robustness, neutral magnitudes, out-of-scope.
- **Correlation**: diverging blue to grey to ink (`#2f62a3` … `#14181f`).

### Neutral
- **Figure White** (`figure-white`): page, panel, overlay and map background (overlays at 95 % opacity over the map).
- **Ink Secondary** (`ink-secondary`): bylines, descriptive text, chart labels.
- **Ink Tertiary** (`ink-tertiary`): axis text, keys in the street sheet, notes, the figure total.
- **Hairline** (`hairline`): quiet control borders (table toggle, chips, close button, small multiples), chart axes.
- **Hairline Faint** (`hairline-faint`): table row rules, chart gridlines, bar tracks.
- **Wash** (`wash`): hover ground for every control, street-sheet section heads, zero cells.
- **Out-of-scope Grey** (`out-of-scope-grey`): road segments outside the analysis (private, paving, slabs).
- **Live-number Highlight** (`live-number-highlight`): a 38 % underlay behind numbers in the caption that recompute live.

### Named Rules
**The Colour-Is-Data Rule.** No hue appears on this plate unless it encodes a surfacing, a magnitude or the course. Chrome, controls and emphasis are ink, paper and greys.

**The One Hue, Light To Dark Rule.** A sequential quantity uses one hue's ramp from light to dark. A surfacing's aptitude always takes that surfacing's own hue; heat is red-brown, other needs are slate.

**The Reserved Vermillion Rule.** Vermillion means "the guided course" and nothing else: never a data class, never an accent, never a warning.

**The Non-Chromatic Robustness Rule.** Robustness and conflicts travel on greys, line width and dash (robust 80 %+ thick, probable 50–80 % thin, imputed dashed), never on a new hue.

## Typography

**Display Font:** Archivo variable, self-hosted (with Helvetica Neue, Arial, sans-serif)
**Body Font:** Archivo variable (same family)

**Character:** One grotesque used across its width axis: condensed and heavy (wdth 85–92, weight 650–800) for titles, the figure counter and labels; normal width for caption prose and data. It reads like the house face of a scientific journal's figure pages.

### Hierarchy
- **Display** (760, 1.5rem, 1.12, wdth 88, −0.012em): the plate title in the header, balanced wrap.
- **Figure counter** (760, 1.55rem, wdth 85, tabular): "Fig. n / 9" at the header's right; the total in ink tertiary at 500.
- **Panel letter** (800, 1.3rem, 1): the a / b / c in the cut-corner box.
- **Headline** (760, 1rem, 1.15, wdth 88): the street sheet's street name.
- **Body** (400, 0.97rem, 1.42): the figure caption; "Fig. n" at 800, its title at 700, panel letters in bold inline.
- **Title** (650, 0.84rem, 1.25, wdth 90): panel titles; the segmented control.
- **Label** (600–700, 0.74–0.8rem, wdth 92): legend titles, sub-heads, mission names, slider labels, table heads.
- **Data** (400–650, 0.66–0.78rem, tabular): chart text, table cells, street-sheet values, keys at 0.7rem in ink tertiary.

### Named Rules
**The One Root Rule.** One root font size, `clamp(13.5px, 0.62vw + 6px, 19px)`, serves both presentation and exploration; every size is in rem and charts scale by the same factor. There is no separate projector stylesheet.

**The Tabular Figures Rule.** Every number that can change (counter, caption live values, outputs, tables, axes) is set with tabular figures.

**The Sentence Case Rule.** No uppercase, no tracked-out labels; hierarchy comes from weight and width.

## Layout

A full-viewport plate (`100dvh`) in four grid rows: ruled header, mission rail, body, next band. Plate padding is 14/20/10 px; the shared gap is 12 px.

- **Header:** title block left, segmented mode switch and figure counter right, closed by a 2 px ink rule.
- **Mission rail:** a row of ruled tabs (6 px apart) whose widths are proportional to each mission's figure count; small 1.5 × 0.5 rem ticks inside each tab show its figures, the current one filled. "Exploration libre" is a last fixed-width tab.
- **Body:** two columns, map panel (a) at 1.62fr against a right column of at least 23rem; the column stacks panel (b), panel (c) and the caption (rows 1.08fr / 1fr / auto; caption capped at 34vh and scrolls).
- **Panels:** panel content starts at 2.6rem from the top to clear the letter box; 14 px horizontal padding.
- **Next band (presentation only):** 2 px ink rule above; previous square button, "where am I" line with keyboard hints, ink "Suivant" button carrying the next figure's title.

Responsive: below 960px the plate becomes a scrolling column: header stacks, rail scrolls horizontally, map panel takes 64vh (min 360px), panels flow statically, the street sheet spans the width, and the next band sticks to the bottom without the "where" line.

## Elevation & Depth

Flat. There are no drop shadows. Layering is shown by 1 px ink outlines and by inversion: overlays on the map (legend, tool strip, street sheet) are figure-white at 95 % with an ink border; tooltips are ink with a 1 px paper outline; station discs carry a 2 px paper ring and a 1 px translucent ink outline so they separate from any data colour beneath. MapLibre's control shadows and radii are stripped. The only inset rings are a 1 px ink ring on a pressed small multiple and a 25 % ink ring on swatches.

### Named Rules
**The Outline Not Shadow Rule.** Anything that sits above the map or a chart is separated by a 1 px ink or paper outline, never by blur or offset.

## Shapes

Square by default: panels, controls, overlays, chips, inputs, tooltips and map controls have 0 radius. Curves are reserved for data marks and the course: station discs are circles, horizontal and vertical bars end in a 3 px radius on the value side only (flat at the baseline), and surfacing swatches are 10 px squares with a 2 px radius. Panels open with a cut-corner letter box (2.6 × 2.45 rem) ruled on its right and bottom edges. The street sheet has a 3 px top rule.

## Components

### Buttons
Ruled and flat; state is shown by inversion.
- **Shape:** square (0).
- **Outline button:** 1 px ink border, paper ground, label type, 4 × 10 px; hover fills with wash.
- **Next button:** ink ground, paper text, 2.4rem tall; a dimmed "Suivant" label, the next figure's title in 700 condensed, a stroked chevron; hover underlines the title.
- **Previous button:** 2.4rem square outline with a stroked chevron; hover wash; disabled at 35 % opacity.
- **Focus:** a 2 px ink outline offset 2 px on every control.

### Segmented control
A 1 px ink box with ink dividers; the checked option inverts to ink; unchecked hover is wash. A small variant (4 × 9 px, 0.78rem) serves in-panel choices.

### Chips
- **Style:** 1 px hairline border, paper ground, 0.72rem; hover border turns ink.
- **State:** pressed inverts to ink ground and border.

### Cards / Containers (panels)
- **Corner Style:** square (0).
- **Background:** figure white.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1 px ink.
- **Internal Padding:** 2.6rem top, 14 px sides, 12 px bottom; a table toggle sits top-right in a hairline box and inverts when pressed.

### Inputs / Fields
- **Style:** search field with 1 px ink border, paper ground, 5 × 8 px, square; results list in a hairline box with faint row rules and wash hover.
- **Range and checkbox:** native, with ink accent colour; slider outputs in 700 tabular.

### Navigation
The mission rail (see Layout): ruled tabs, active tab inverted to ink in presentation; in exploration the "Exploration libre" tab is the inverted one. Keyboard ← / → steps figures.

### Signature: Street Sheet
A dense, hairline-ruled sheet over the map (min(23rem, 52 %) wide, 3 px ink top rule): sticky header with street name and meta, wash section heads, a three-column key/value grid (keys 0.7rem ink tertiary, values 650 tabular), then need and compatibility bars on faint tracks coloured with the heat, slate and surfacing hues.

### Signature: Caption
Article prose: "Fig. n |" in 800, the title in 700, panel letters inline in bold, live numbers on the highlight underlay, inline surfacing swatches and vermillion station numerals. It focus-pulls (blur 5 px to sharp, 0.38 s) on every figure change.

### Signature: Course Stations
Numbered vermillion discs (1.7rem, 800 ink numerals: 4.6:1 on vermillion, white would fail at 3.9:1) on real streets, joined by a dashed vermillion line; the current station scales 1.22, passed stations shrink to 1.25rem at 80 %. An open station carries a paper tag with a 1.5 px vermillion border and an ink street name (vermillion text fails at 3.8:1), hidden while the street sheet is open.

### Signature: Small Multiples
Two-column canvas thumbnails in hairline boxes with a corner label; the hovered one lifts 2 px while the others recede to 45 % opacity; the selected one gets an ink border and inset ring.

### Motion
One figure-change choreography: panel bodies reveal by clip from the left (0.52 s, panel (c) delayed 0.07 s), the map flies to the figure's view, the caption focus-pulls. Easing `cubic-bezier(.16, 1, .3, 1)`. Control state transitions are 0.15–0.25 s colour only. Reduced motion removes the reveal, the focus pull and all transitions.

## Do's and Don'ts

### Do:
- **Do** letter every panel (a, b, c) in the cut-corner box and caption the plate as "Fig. n | Title. a, … b, … c, …".
- **Do** recompute caption numbers live and set them in tabular figures on the highlight underlay.
- **Do** use the Okabe-Ito hues in the fixed order R1 green, R2 orange, R3 blue, R4 mauve for the four surfacings, everywhere.
- **Do** encode magnitudes with one hue's light-to-dark ramp, and a surfacing's aptitude with its own hue.
- **Do** carry robustness and uncertainty on greys, line width and dash.
- **Do** separate overlays with 1 px ink or paper outlines and invert to ink for selected states.
- **Do** size everything in rem from the single root clamp so the plate reads from the back of the room.
- **Do** give every chart a "Tableau" view of the same data.

### Don't:
- **Don't** use drop shadows or rounded cards; corners are square except data marks and station discs.
- **Don't** use vermillion for anything other than the guided course.
- **Don't** introduce a new hue for chrome, emphasis or state.
- **Don't** use a full-bleed dark basemap, a layer drawer or floating KPI cards.
- **Don't** add a second font family or a separate projector type scale.
- **Don't** set labels in uppercase or tracked-out small caps.

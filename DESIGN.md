# Design System: Laser Survival

**Project ID:** laser-survival

## 1. Visual Theme & Atmosphere

Dark, tense, and industrial. The aesthetic draws from retro arcade cabinets and cyberpunk interfaces — imagine a CRT monitor in a dimly lit arcade, scanlines flickering across neon-lit grid displays. The overall mood is one of controlled tension: minimal elements against an abyss-black canvas, punctuated by sharp neon accents that demand attention.

Density is low. Generous negative space surrounds the central game grid, letting the player focus entirely on survival. Every visual element serves a functional purpose — there is no decoration for decoration's sake. The design philosophy is "utilitarian neon": raw, industrial, and unforgiving, like a warning system on a spacecraft.

The experience should feel like a high-stakes radar display — clean geometry, precise spacing, and urgent color signals.

## 2. Color Palette & Roles

- **Void Black (#0a0a0f)** — Primary background. The deep, near-true-black foundation that makes every neon accent pop. Used for all screen backgrounds and negative space.
- **Grid Charcoal (#1a1a2e)** — Active cell fill. A dark blue-gray that reads as "alive" against the void. Used for all interactive grid cells.
- **Border Slate (#2a2a4a)** — Cell borders and dividers. A muted indigo-gray that defines structure without competing with content. Used for grid lines and subtle separators.
- **Neon Cyan (#00f0ff)** — Player identity and primary accent. Electric, unmistakable, alive. Used for the player marker, active UI highlights, progress indicators, and the surviving grid cells on the victory screen.
- **Laser Red (#ff2244)** — Danger and destruction. An aggressive, saturated red that signals immediate threat. Used for laser warnings, laser beams, "GAME OVER" text, and damage indicators.
- **Beam White (#ffffff)** — Laser beam core. Pure white at the center of the beam gradient, creating a blinding intensity. Used only during the laser firing animation.
- **Survival Lime (#aaff00)** — Timer and progress. A sharp yellow-green that reads as "still alive." Used for the survival timer, progress bars, and positive status indicators.
- **Trophy Gold (#ffd700)** — Achievement and victory. Warm, celebratory, earned. Used for "NEW BEST" badges, victory text, win counters, and celebration particles.
- **Text Primary (#e0e0ff)** — Main readable text. A cool-tinted off-white that's easy on the eyes against void black. Used for scores, labels, and important information.
- **Text Muted (#6a6a8a)** — Secondary information. A dim purple-gray for less important text. Used for subtitles, hints, key instructions, and disabled states.
- **Destruction Void (#050508)** — Destroyed cells. Even darker than the background, creating a sense of absence — a hole in the grid. Used for cells that have been eliminated by laser.

## 3. Typography Rules

All typography is monospace — no exceptions. The entire interface channels a terminal/arcade aesthetic where fixed-width characters reinforce the grid-based, systematic nature of the game.

- **Primary Font:** `"JetBrains Mono", "Fira Code", "SF Mono", monospace` — A modern monospace with subtle character. Used for all text across the application.
- **Title Weight:** Bold (700). The game title "LASER SURVIVAL" is set at 28–32px with generous letter-spacing (4–6px) to create an imposing, mechanical feel. Uppercase only.
- **HUD Weight:** Semi-bold (600). Timer and score displays at 20–24px. Numbers should feel like a digital readout — precise, clinical.
- **Body Weight:** Regular (400). Stat labels, instructions, and secondary text at 12–14px. Understated but legible.
- **Caption Weight:** Regular (400). Hints and key prompts at 10–12px in Text Muted color. Nearly invisible until needed.

Letter-spacing is wider than default throughout (1–3px), reinforcing the mechanical, spaced-out terminal aesthetic. All game text is uppercase to maintain the arcade command-line feel.

## 4. Component Stylings

### Grid Cells
- **Active:** Squared rectangles with sharp corners (0px border-radius). Fill: Grid Charcoal (#1a1a2e). Border: 1px solid Border Slate (#2a2a4a). Size: 48–52px squares with 3px gap between cells. Clean, geometric, no shadows.
- **Warning State:** Same shape, but fill pulses between Grid Charcoal and Laser Red (#ff2244) at 50% opacity, alternating every 150ms. A subtle red glow (box-shadow: 0 0 8px rgba(255, 34, 68, 0.3)) bleeds outward.
- **Destroyed State:** Fill drops to Destruction Void (#050508). Border fades to near-invisible (#0f0f18). The cell becomes a dark hole — absence rather than presence.
- **Player-Occupied:** The cell itself remains Grid Charcoal, but a centered circle (12px diameter) in Neon Cyan (#00f0ff) sits inside with a pulsing glow (box-shadow: 0 0 12px rgba(0, 240, 255, 0.5), animating between 8px and 16px blur).

### Laser Beam
- A horizontal or vertical line spanning the full grid width/height. Height/width: 6px. Gradient from Beam White (#ffffff) center to Laser Red (#ff2244) edges. A soft glow halo (box-shadow: 0 0 20px rgba(255, 34, 68, 0.6)) surrounds the beam. Appears for 300ms with a sweep animation from one edge to the other.

### Timer Display
- Large monospace numerals in Survival Lime (#aaff00) with a subtle text-shadow (0 0 10px rgba(170, 255, 0, 0.3)). Positioned top-left of the screen. Format: "32.5s" — one decimal place, always showing the "s" suffix.

### Progress Bar
- A thin horizontal bar (4px height) below the HUD. Background: Border Slate (#2a2a4a). Fill: Neon Cyan (#00f0ff), width proportional to elapsed/60 seconds. No border-radius — sharp, mechanical edges.

### Virtual D-Pad (Mobile)
- Four arrow buttons arranged in a cross pattern. Each button: 52×52px, background transparent, border 1.5px solid Border Slate (#2a2a4a). Arrow icon centered inside in Text Muted (#6a6a8a). On press: border and icon switch to Neon Cyan (#00f0ff) with a glow. Center gap: 4px. The entire D-pad sits at the bottom center of the screen with generous padding from the grid.

### Buttons (Retry/Start)
- No filled buttons. Text-only interactive elements in Text Muted (#6a6a8a) that brighten to Text Primary (#e0e0ff) on hover/focus. Blinking animation (opacity toggling between 0.4 and 1.0 every 800ms) for call-to-action prompts like "PRESS SPACE TO START."

### Achievement Badge ("NEW BEST")
- Text in Trophy Gold (#ffd700) with a text-shadow glow (0 0 15px rgba(255, 215, 0, 0.4)). Flanked by small decorative sparkle characters (✦) on either side. No background container — the gold text floats directly on the void.

### Stat Rows (Title Screen)
- Each stat on its own line. Label in Text Muted (#6a6a8a), value in Survival Lime (#aaff00). A small emoji icon precedes each row (🏆, 🎮, ⭐). Vertical spacing: 8px between rows.

## 5. Layout Principles

The layout is vertically stacked and center-aligned — a single column that works identically on mobile and desktop. No sidebars, no multi-column layouts.

- **Screen width:** Constrained to 390px max (mobile-first). Centered horizontally on larger screens.
- **Vertical rhythm:** 16px base spacing unit. Major sections separated by 24–32px. Minor elements within sections separated by 8–12px.
- **Grid placement:** The 8×8 game grid is the absolute center of the screen — the gravitational core. Everything else orbits around it: HUD above, controls below, messages beneath.
- **Top HUD bar:** Flush to the top with 16px horizontal padding. Timer left-aligned, best score right-aligned. A thin progress bar sits immediately below.
- **Bottom controls:** D-pad centered at the bottom with 24px padding from screen edge. Info bar (round number, laser countdown) sits between grid and D-pad.
- **Screen backgrounds:** Always Void Black (#0a0a0f). A very faint grid pattern (Border Slate at 5% opacity) can appear behind the main grid for atmospheric depth. As game tension increases (past 30 seconds), a subtle red vignette creeps in from the screen edges.
- **Transitions between screens:** No fancy transitions. Hard cuts — matching the brutal, arcade-machine feel. The only animations are within gameplay (laser effects, particles, pulses).

## 6. Motion & Effects

- **Screen Shake:** On laser fire, the entire canvas offsets by 2–4px in random directions for 300ms, decaying to zero (ease-out). Reinforces impact.
- **Particle Debris:** When a cell is destroyed, 8–12 small square fragments (4–6px) scatter outward from the cell center with gravity applied, fading over 800ms.
- **Player Pulse:** The cyan player marker gently pulses (glow radius oscillating between 8px and 16px) at a calm 0.3Hz rhythm — a heartbeat.
- **Warning Blink:** Endangered cells blink between normal and red-tinted at ~3.3Hz (150ms intervals) — fast enough to feel urgent, slow enough to read.
- **Victory Particles:** 20–30 small gold circles rise from the bottom of the screen, drifting upward with slight horizontal wobble, fading over 2 seconds.
- **Background Tension:** Background vignette color shifts from transparent to rgba(255, 34, 68, 0.08) between 30s and 60s — a barely perceptible red creep that raises subconscious tension.

## 7. Screens

### Title Screen
The game title "LASER SURVIVAL" dominates the upper third in bold monospace with Neon Cyan glow. A decorative horizontal laser line in Laser Red sits beneath the title. Three stat rows (BEST, GAMES, WINS) are centered below in the middle third. The bottom third contains the blinking start prompt and control hint icons. A faint 8×8 grid ghost hovers behind everything at 5% opacity.

### Gameplay Screen
Top HUD with timer and best score. The 8×8 grid commands the center. Cells display in their respective states (active, warning, destroyed, player-occupied). Below the grid: round counter and laser countdown. Bottom: virtual D-pad for mobile users. The entire composition is tight, focused, and functional.

### Game Over Screen
The destroyed grid fades to 10% opacity as a ghost backdrop. "GAME OVER" in Laser Red dominates center. Survival time below in Text Primary. Optional "NEW BEST" badge in Trophy Gold. Retry prompt blinks at the bottom. A subtle red vignette frames the screen edges.

### Victory Screen
"SURVIVED" in Trophy Gold with warm glow replaces the title position. "60.0 SECONDS" in bright white below. A miniature version of the final grid state shows the 2–3 surviving rows glowing in Neon Cyan. Gold particles rise across the screen. Stats and new game prompt at the bottom.
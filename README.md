# Fabula Ultima - Hover Resource Bars

A lightweight Foundry VTT module for the **Fabula Ultima (`projectfu`)** system that displays compact, JRPG-style resource bars (**HP**, **MP**, and **IP**) centered beneath a token when hovering over it with your cursor.

Designed to keep the battlemap clean and immersive without sacrificing quick visibility of vital combat resources.

---

## Features

- **Clean On-Hover Display:** Bars appear smoothly below the token only when hovered, freeing up screen space compared to the full-screen combat HUD.
- **Full 3-Resource Support:** Displays **HP** (`PV`), **MP** (`PM`), and **IP** (`PI`) simultaneously—bypassing Foundry's native 2-bar token limit.
- **Crisis Indicator:** The HP bar automatically shifts from green to red when a character enters **Crisis** (HP at or below 50% of maximum).
- **Permission Aware:** Game Masters can inspect any token on the canvas, while players only see bars for tokens where they hold **Observer** or **Owner** permissions.
- **Live Updates:** Resource values and bar widths update dynamically in real time if an actor takes damage or spends resources while hovered.

---

## Installation

1. Open **Foundry VTT** and navigate to the **Add-on Modules** tab.
2. Click **Install Module** at the bottom of the window.
3. Paste the following URL into the **Manifest URL** field:
   ```text
   https://raw.githubusercontent.com/YOUR-USERNAME/fu-hover-bars/main/module.json
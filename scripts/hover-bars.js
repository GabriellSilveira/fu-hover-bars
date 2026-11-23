class FUHoverBars {
  static activeHuds = new Map();

  static hasValidResources(token) {
    if (!token?.visible) return false;
    const res = token.actor?.system?.resources;
    return Boolean(res && res.hp !== undefined);
  }

  static getActiveCombatant(combat) {
    if (!combat?.started) return null;

    const fuCombatantId =
      combat.flags?.projectfu?.CombatantId ??
      (typeof combat.getFlag === "function" ? combat.getFlag("projectfu", "CombatantId") : null);

    if (fuCombatantId) {
      const flagged = combat.combatants?.get(fuCombatantId);
      if (flagged) return flagged;
    }

    return combat.combatant ?? null;
  }

  static isTokenActiveTurnForOwner(token) {
    if (!token?.visible || !token.actor) return false;

    const isOwner = Boolean(token.actor.isOwner || token.document?.isOwner);
    if (!isOwner) return false;

    const combat = game.combat;
    const active = this.getActiveCombatant(combat);
    if (!active) return false;

    const activeTokenId = active.tokenId || active.token?.id;
    const activeActorId = active.actorId || active.actor?.id;

    const matchesToken = Boolean(activeTokenId && activeTokenId === token.id);
    const matchesActor = Boolean(!activeTokenId && activeActorId && activeActorId === token.actor.id);

    return matchesToken || matchesActor;
  }

  static clearTimers(entry) {
    if (entry.hideTimeout) {
      clearTimeout(entry.hideTimeout);
      entry.hideTimeout = null;
    }
    if (entry.cleanupTimeout) {
      clearTimeout(entry.cleanupTimeout);
      entry.cleanupTimeout = null;
    }
  }

  static show(token) {
    if (!this.hasValidResources(token)) return;

    let entry = this.activeHuds.get(token.id);

    if (entry) {
      this.clearTimers(entry);
      this.render(entry);
      this.updatePosition(entry);
      entry.element.classList.remove("fu-hover-hidden");
      window.FUActionMenu?.updateAllPositions?.();
      return;
    }

    const el = document.createElement("div");
    el.classList.add("fu-hover-hud", "fu-hover-hidden");
    document.body.appendChild(el);

    entry = {
      token,
      element: el,
      hideTimeout: null,
      cleanupTimeout: null
    };

    this.activeHuds.set(token.id, entry);
    this.render(entry);
    this.updatePosition(entry);
    window.FUActionMenu?.updateAllPositions?.();

    requestAnimationFrame(() => {
      el.classList.remove("fu-hover-hidden");
    });
  }

  static hide(tokenId, immediate = false) {
    const entry = this.activeHuds.get(tokenId);
    if (!entry) return;

    if (!immediate && this.isTokenActiveTurnForOwner(entry.token)) {
      this.clearTimers(entry);
      entry.element.classList.remove("fu-hover-hidden");
      return;
    }

    this.clearTimers(entry);

    if (immediate) {
      entry.element.remove();
      this.activeHuds.delete(tokenId);
      window.FUActionMenu?.updateAllPositions?.();
      return;
    }

    entry.hideTimeout = setTimeout(() => {
      if (this.isTokenActiveTurnForOwner(entry.token)) return;

      entry.element.classList.add("fu-hover-hidden");
      entry.hideTimeout = null;

      entry.cleanupTimeout = setTimeout(() => {
        if (this.isTokenActiveTurnForOwner(entry.token)) return;
        entry.element.remove();
        this.activeHuds.delete(tokenId);
        window.FUActionMenu?.updateAllPositions?.();
      }, 500);
    }, 1000);
  }

  static clearAll() {
    for (const [tokenId] of this.activeHuds) {
      this.hide(tokenId, true);
    }
  }

  static syncTurnBars() {
    if (!canvas?.tokens) return;

    for (const [tokenId, entry] of this.activeHuds.entries()) {
      if (!this.isTokenActiveTurnForOwner(entry.token) && !entry.token.hover && !entry.hideTimeout) {
        this.hide(tokenId, false);
      }
    }

    for (const token of canvas.tokens.placeables) {
      if (this.isTokenActiveTurnForOwner(token)) {
        this.show(token);
      }
    }
  }

  static render(entry) {
    const res = entry.token.actor?.system?.resources;
    if (!res) return;

    const hpVal = Number(res.hp?.value ?? 0);
    const hpMax = Math.max(1, Number(res.hp?.max ?? 1));
    const mpVal = Number(res.mp?.value ?? 0);
    const mpMax = Math.max(1, Number(res.mp?.max ?? 1));
    const ipVal = Number(res.ip?.value ?? 0);
    const ipMax = Math.max(1, Number(res.ip?.max ?? 1));

    const hpPct = Math.min(100, Math.max(0, (hpVal / hpMax) * 100));
    const mpPct = Math.min(100, Math.max(0, (mpVal / mpMax) * 100));
    const ipPct = Math.min(100, Math.max(0, (ipVal / ipMax) * 100));

    const isCrisis = hpVal <= Math.floor(hpMax / 2);
    const isHpCritical = hpPct <= 30;
    const isMpCritical = mpPct <= 30;

    entry.element.innerHTML = `
      <div class="fu-bar-row ${isHpCritical ? "fu-hp-critical-shake" : ""}">
        <span class="fu-bar-label">PV</span>
        <div class="fu-bar-track">
          <div class="fu-bar-fill ${isCrisis ? "fu-crisis" : "fu-hp"}" style="width: ${hpPct}%;"></div>
        </div>
        <span class="fu-bar-value">${hpVal}</span>
      </div>
      <div class="fu-bar-row ${isMpCritical ? "fu-mp-critical-shake" : ""}">
        <span class="fu-bar-label">PM</span>
        <div class="fu-bar-track">
          <div class="fu-bar-fill fu-mp" style="width: ${mpPct}%;"></div>
        </div>
        <span class="fu-bar-value">${mpVal}</span>
      </div>
      <div class="fu-bar-row">
        <span class="fu-bar-label">PI</span>
        <div class="fu-bar-track">
          <div class="fu-bar-fill fu-ip" style="width: ${ipPct}%;"></div>
        </div>
        <span class="fu-bar-value">${ipVal}</span>
      </div>
    `;

    window.FUActionMenu?.updateAllPositions?.();
  }

  static updatePosition(entry) {
    if (!entry?.token || entry.token.destroyed || !canvas?.stage) return;

    const bottomCenterWorld = {
      x: entry.token.x + entry.token.w / 2,
      y: entry.token.y + entry.token.h
    };
    const screenPos = canvas.stage.worldTransform.apply(bottomCenterWorld);

    entry.element.style.left = `${screenPos.x}px`; entry.element.style.top = `${screenPos.y + 8}px`;
  }

  static updateAllPositions() {
    for (const entry of this.activeHuds.values()) {
      this.updatePosition(entry);
    }
  }
}

window.FUHoverBars = FUHoverBars;

Hooks.once("ready", () => FUHoverBars.syncTurnBars());
Hooks.on("canvasReady", () => FUHoverBars.syncTurnBars());

Hooks.on("hoverToken", (token, hovered) => {
  if (hovered) FUHoverBars.show(token);
  else FUHoverBars.hide(token.id);
});

Hooks.on("canvasPan", () => FUHoverBars.updateAllPositions());

Hooks.on("refreshToken", (token) => {
  const entry = FUHoverBars.activeHuds.get(token.id);
  if (entry) {
    FUHoverBars.updatePosition(entry);
    window.FUActionMenu?.updateAllPositions?.();
  }
});

Hooks.on("updateActor", (actor) => {
  for (const entry of FUHoverBars.activeHuds.values()) {
    if (entry.token.actor?.id === actor.id) {
      FUHoverBars.render(entry);
    }
  }
});

Hooks.on("updateCombat", () => FUHoverBars.syncTurnBars());
Hooks.on("updateCombatant", () => FUHoverBars.syncTurnBars());
Hooks.on("createCombatant", () => FUHoverBars.syncTurnBars());
Hooks.on("deleteCombatant", () => FUHoverBars.syncTurnBars());
Hooks.on("deleteCombat", () => FUHoverBars.syncTurnBars());

Hooks.on("deleteToken", (tokenDoc) => {
  FUHoverBars.hide(tokenDoc.id, true);
});

Hooks.on("canvasTearDown", () => {
  FUHoverBars.clearAll();
});

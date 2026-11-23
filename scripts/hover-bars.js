class FUHoverBars {
  // Armazena os HUDs ativos indexados pelo ID do token
  static activeHuds = new Map();

  static hasValidResources(token) {
    if (!token?.visible) return false;
    const res = token.actor?.system?.resources;
    return Boolean(res && res.hp !== undefined);
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
      // Se o HUD desse token ainda está na tela (ou dando fade), cancela o sumiço e renova
      this.clearTimers(entry);
      this.render(entry);
      this.updatePosition(entry);
      entry.element.classList.remove("fu-hover-hidden");
      return;
    }

    // Cria um novo HUD independente para este token
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

    // Ativa o fade-in no próximo frame
    requestAnimationFrame(() => {
      el.classList.remove("fu-hover-hidden");
    });
  }

  static hide(tokenId, immediate = false) {
    const entry = this.activeHuds.get(tokenId);
    if (!entry) return;

    this.clearTimers(entry);

    if (immediate) {
      entry.element.remove();
      this.activeHuds.delete(tokenId);
      return;
    }

    // Mantém os status visíveis por 3 segundos antes do fade-out
    entry.hideTimeout = setTimeout(() => {
      entry.element.classList.add("fu-hover-hidden");
      entry.hideTimeout = null;

      // Remove o elemento do HTML após o término da transição CSS (450ms)
      entry.cleanupTimeout = setTimeout(() => {
        entry.element.remove();
        this.activeHuds.delete(tokenId);
      }, 500);
    }, 3000);
  }

  static clearAll() {
    for (const [tokenId] of this.activeHuds) {
      this.hide(tokenId, true);
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

    // Crise (<= 50%) e Perigo Crítico (< 20%)
    const isCrisis = hpVal <= Math.floor(hpMax / 2);
    const isCritical = hpPct < 20;

    entry.element.innerHTML = `
      <div class="fu-bar-row ${isCritical ? "fu-critical-shake" : ""}">
        <span class="fu-bar-label">PV</span>
        <div class="fu-bar-track">
          <div class="fu-bar-fill ${isCrisis ? "fu-crisis" : "fu-hp"}" style="width: ${hpPct}%;"></div>
        </div>
        <span class="fu-bar-value">${hpVal}</span>
      </div>
      <div class="fu-bar-row">
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
  }

  static updatePosition(entry) {
    if (!entry?.token || entry.token.destroyed || !canvas?.stage) return;

    const bottomCenterWorld = {
      x: entry.token.x + entry.token.w / 2,
      y: entry.token.y + entry.token.h
    };
    const screenPos = canvas.stage.worldTransform.apply(bottomCenterWorld);

    entry.element.style.left = `${screenPos.x}px`;
    entry.element.style.top = `${screenPos.y + 8}px`;
  }

  static updateAllPositions() {
    for (const entry of this.activeHuds.values()) {
      this.updatePosition(entry);
    }
  }
}

Hooks.on("hoverToken", (token, hovered) => {
  if (hovered) FUHoverBars.show(token);
  else FUHoverBars.hide(token.id);
});

Hooks.on("canvasPan", () => FUHoverBars.updateAllPositions());

Hooks.on("refreshToken", (token) => {
  const entry = FUHoverBars.activeHuds.get(token.id);
  if (entry) FUHoverBars.updatePosition(entry);
});

Hooks.on("updateActor", (actor) => {
  for (const entry of FUHoverBars.activeHuds.values()) {
    if (entry.token.actor?.id === actor.id) {
      FUHoverBars.render(entry);
    }
  }
});

Hooks.on("deleteToken", (tokenDoc) => {
  FUHoverBars.hide(tokenDoc.id, true);
});

Hooks.on("canvasTearDown", () => {
  FUHoverBars.clearAll();
});

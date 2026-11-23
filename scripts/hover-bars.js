class FUHoverBars {
  static hudElement = null;
  static activeToken = null;

  static init() {
    const el = document.createElement("div");
    el.id = "fu-hover-hud";
    el.classList.add("fu-hover-hidden");
    document.body.appendChild(el);
    this.hudElement = el;
  }

  static canView(token) {
    const actor = token?.actor;
    if (!actor) return false;
    // Mestre vê todos; jogadores veem apenas tokens em que têm permissão de Observador/Dono
    return game.user.isGM || actor.testUserPermission(game.user, "OBSERVER");
  }

  static show(token) {
    if (!this.hudElement || !this.canView(token)) return;
    this.activeToken = token;
    this.render(token);
    this.updatePosition();
    this.hudElement.classList.remove("fu-hover-hidden");
  }

  static hide(token) {
    if (token && this.activeToken?.id !== token.id) return;
    this.activeToken = null;
    this.hudElement?.classList.add("fu-hover-hidden");
  }

  static render(token) {
    const res = token.actor?.system?.resources;
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

    // No Fabula Ultima, Crise ocorre com PV <= metade do máximo
    const isCrisis = hpVal <= Math.floor(hpMax / 2);

    this.hudElement.innerHTML = `
      <div class="fu-bar-row">
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

  static updatePosition() {
    if (!this.activeToken || !this.hudElement || !canvas?.stage) return;

    // Calcula o centro inferior do token em coordenadas de tela
    const bottomCenterWorld = {
      x: this.activeToken.x + this.activeToken.w / 2,
      y: this.activeToken.y + this.activeToken.h
    };
    const screenPos = canvas.stage.worldTransform.apply(bottomCenterWorld);

    this.hudElement.style.left = `${screenPos.x}px`;
    this.hudElement.style.top = `${screenPos.y + 8}px`;
  }
}

Hooks.once("ready", () => FUHoverBars.init());

Hooks.on("hoverToken", (token, hovered) => {
  if (hovered) FUHoverBars.show(token);
  else FUHoverBars.hide(token);
});

Hooks.on("canvasPan", () => FUHoverBars.updatePosition());
Hooks.on("refreshToken", (token) => {
  if (FUHoverBars.activeToken?.id === token.id) FUHoverBars.updatePosition();
});

Hooks.on("updateActor", (actor) => {
  if (FUHoverBars.activeToken?.actor?.id === actor.id) {
    FUHoverBars.render(FUHoverBars.activeToken);
  }
});

Hooks.on("deleteToken", (tokenDoc) => {
  if (FUHoverBars.activeToken?.id === tokenDoc.id) FUHoverBars.hide();
});
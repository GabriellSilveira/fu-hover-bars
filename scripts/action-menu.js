class FUActionMenu {
  static MODULE_ID = "fu-hover-bars";
  static SETTING_KEY = "enableActionMenu";
  static activeMenus = new Map();

  static DAMAGE_TYPE_ICONS = {
    physical: { icon: "fas fa-sword", label: "Físico", color: "#cbd5e1" },
    air: { icon: "fas fa-wind", label: "Ar", color: "#5eead4" },
    bolt: { icon: "fas fa-bolt", label: "Raio", color: "#fde047" },
    dark: { icon: "fas fa-skull", label: "Trevas", color: "#c084fc" },
    earth: { icon: "fas fa-mountain", label: "Terra", color: "#d97706" },
    fire: { icon: "fas fa-fire", label: "Fogo", color: "#fb923c" },
    ice: { icon: "fas fa-snowflake", label: "Gelo", color: "#38bdf8" },
    light: { icon: "fas fa-sun", label: "Luz", color: "#fef08a" },
    poison: { icon: "fas fa-biohazard", label: "Veneno", color: "#4ade80" }
  };

  static COMBAT_ACTIONS = [
    {
      id: "guard",
      label: "Guarda",
      icon: "fas fa-shield-alt",
      action: "action",
      type: "guard",
      description:
        "<p>Apenas <strong>uma vez por turno</strong>. Até o início do seu próximo turno:</p><ul><li>Você ganha <strong>Resistência</strong> a todos os tipos de dano.</li><li>Você ganha <strong>+2 de bônus</strong> em Testes Opostos.</li><li>Você pode <strong>Proteger</strong> outra criatura e impedir que inimigos realizem ataques corpo-a-corpo contra ela.</li></ul>"
    },
    {
      id: "hinder",
      label: "Impedir",
      icon: "fas fa-ban",
      action: "action",
      type: "hinder",
      description:
        "<p>Você faz um teste (<strong>ND 10</strong>) contra um oponente. Se tiver sucesso, você o deixa <strong>Abalado, Atordoado, Lento ou Fraco</strong>.</p>"
    },
    {
      id: "objective",
      label: "Objetivo",
      icon: "fas fa-bullseye",
      action: "action",
      type: "objective",
      description:
        "<p>Trabalhe para cumprir um objetivo dentro do conflito. Requer um <strong>Teste de Atributo</strong> ou <strong>Teste Oposto</strong>. Metas complexas geralmente exigem um relógio.</p>"
    },
    {
      id: "inventory",
      label: "Inventário",
      icon: "fas fa-flask",
      action: "action",
      type: "inventory",
      description:
        "<p>Gaste <strong>Pontos de Inventário (PI)</strong> para criar e utilizar imediatamente um consumível (como Poções, Elixires ou Remédios).</p>"
    },
    {
      id: "study",
      label: "Estudo",
      icon: "fas fa-search",
      action: "action",
      type: "study",
      description:
        "<p>Você tenta obter informações sobre alguém ou alguma coisa. Geralmente um Teste Genérico <strong>【AST + AST】</strong>. Não é possível fazer a mesma pergunta duas vezes.</p>"
    },
    {
      id: "equipment",
      label: "Equipamento",
      icon: "fas fa-exchange-alt",
      action: "action",
      type: "equipment",
      description:
        "<p>Troque qualquer número de itens equipados com qualquer número de itens em seu inventário (exceto por <strong>Armadura</strong>).</p>"
    }
  ];

  static CATEGORY_DESCRIPTIONS = {
    attacks: "Realize um ataque corpo-a-corpo ou à distância utilizando uma de suas armas.",
    spells: "Conjure um feitiço gastando Pontos de Mana (PM).",
    actions: "Ações básicas disponíveis para qualquer personagem durante um conflito.",
    classes: "Selecione uma classe para visualizar e utilizar suas perícias.",
    heroics: "Poderes Heroicos adquiridos ao dominar uma classe.",
    features: "Recursos e características especiais vinculadas às suas classes.",
    items: "Acessórios equipados e consumíveis disponíveis no inventário."
  };

  static FEATURE_TYPE_FALLBACKS = {
    "projectfu.garden": "Jardim",
    "projectfu.magiseed": "Magissemente",
    "projectfu.therioform": "Terioforma",
    "projectfu.arcanum": "Arcano",
    "projectfu.chant": "Cântico",
    "projectfu.dance": "Dança",
    "projectfu.symbol": "Símbolo",
    "projectfu.invention": "Invenção",
    "projectfu.vehicle": "Veículo",
    "projectfu.weaponModule": "Módulo de Arma",
    "projectfu.armorModule": "Módulo de Armadura",
    "projectfu.shieldModule": "Módulo de Escudo"
  };

  static registerSettings() {
    game.settings.register(this.MODULE_ID, this.SETTING_KEY, {
      name: "Menu de Ações no Turno (Hover)",
      hint: "Exibe uma janela estilo JRPG ao passar o mouse sobre o token do seu personagem durante o turno ativo dele na iniciativa.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: (enabled) => {
        if (!enabled) this.clearAll();
      }
    });
  }

  static isEnabled() {
    try {
      return Boolean(game.settings.get(this.MODULE_ID, this.SETTING_KEY));
    } catch {
      return true;
    }
  }

  /**
   * Resolve o combatente ativo tanto via Foundry padrão quanto via flag do projectfu
   */
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

  static canDisplayForToken(token) {
    if (!this.isEnabled()) return false;
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

  static clearBalloonState(entry) {
    entry.inspectedKey = null;
    entry.inspectedData = null;
    entry.inspectedLevel = null;
  }

  static dismissBalloon(entry) {
    if (!entry.inspectedKey && !entry.inspectedData) return;
    this.clearBalloonState(entry);

    const balloon = entry.element?.querySelector(".fu-am-balloon");
    if (balloon) balloon.remove();

    for (const row of entry.element?.querySelectorAll(".fu-am-row.is-inspected") ?? []) {
      row.classList.remove("is-inspected");
    }
  }

  static show(token) {
    if (!this.canDisplayForToken(token)) return;

    for (const [otherId] of this.activeMenus) {
      if (otherId !== token.id) this.hide(otherId, true);
    }

    let entry = this.activeMenus.get(token.id);
    if (entry) {
      this.clearTimers(entry);
      entry.isPointerInsideMenu = false;
      this.clearBalloonState(entry);
      this.render(entry);
      this.updatePosition(entry);
      entry.element.classList.remove("fu-am-hidden");
      return;
    }

    const el = document.createElement("div");
    el.classList.add("fu-action-menu", "fu-am-hidden");
    document.body.appendChild(el);

    entry = {
      token,
      element: el,
      hideTimeout: null,
      cleanupTimeout: null,
      isPointerInsideMenu: false,
      openCategory: null,
      openSubGroup: null,
      inspectedKey: null,
      inspectedData: null,
      inspectedLevel: null
    };

    el.addEventListener("mouseenter", () => {
      entry.isPointerInsideMenu = true;
      this.clearTimers(entry);
      el.classList.remove("fu-am-hidden");
    });

    el.addEventListener("mouseleave", () => {
      entry.isPointerInsideMenu = false;
      this.hide(token.id, false);
    });

    this.activeMenus.set(token.id, entry);
    this.render(entry);
    this.updatePosition(entry);

    requestAnimationFrame(() => {
      el.classList.remove("fu-am-hidden");
    });
  }

  static hide(tokenId, immediate = false) {
    const entry = this.activeMenus.get(tokenId);
    if (!entry) return;

    this.clearTimers(entry);

    if (immediate) {
      entry.element.remove();
      this.activeMenus.delete(tokenId);
      return;
    }

    entry.hideTimeout = setTimeout(() => {
      if (entry.isPointerInsideMenu) return;

      this.clearBalloonState(entry);
      entry.element.classList.add("fu-am-hidden");
      entry.hideTimeout = null;

      entry.cleanupTimeout = setTimeout(() => {
        if (entry.isPointerInsideMenu) return;
        entry.element.remove();
        this.activeMenus.delete(tokenId);
      }, 280);
    }, 380);
  }

  static clearAll() {
    for (const [tokenId] of this.activeMenus) {
      this.hide(tokenId, true);
    }
  }

  /**
   * Resolve o ícone de dano elemental/físico para armas e feitiços de dano
   */
  static resolveItemDamageIcon(item) {
    try {
      const sys = item?.system;
      if (!sys) return null;

      if (item.type === "weapon") {
        if (sys.hasDamage === false || sys.rollInfo?.damage?.hasDamage?.value === false) {
          return null;
        }

        const rawType = String(
          sys.rollInfo?.damage?.type?.value ??
            sys.damageType?.value ??
            (typeof sys.damageType === "string" ? sys.damageType : null) ??
            "physical"
        ).toLowerCase();

        return this.DAMAGE_TYPE_ICONS[rawType] ?? null;
      }

      if (item.type === "spell

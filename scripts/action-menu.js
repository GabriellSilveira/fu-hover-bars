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

  static canDisplayForToken(token) {
    if (!this.isEnabled()) return false;
    if (!token?.visible || !token.actor) return false;

    const isOwner = Boolean(token.actor.isOwner || token.document?.isOwner);
    if (!isOwner) return false;

    const combat = game.combat;
    if (!combat?.started || !combat.combatant) return false;

    const active = combat.combatant;
    const matchesToken = active.token?.id && active.token.id === token.id;
    const matchesActor = !active.token?.id && active.actor?.id && active.actor.id === token.actor.id;

    return Boolean(matchesToken || matchesActor);
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
    const sys = item.system ?? {};

    if (item.type === "weapon") {
      if (sys.hasDamage === false) return null;
      const rawType = String(sys.damageType?.value ?? sys.damageType ?? "physical").toLowerCase();
      return this.DAMAGE_TYPE_ICONS[rawType] ?? null;
    }

    if (item.type === "spell") {
      const impDmg = sys.impdamage;
      const dmg = sys.damage;

      const hasDamage = Boolean(
        impDmg?.hasDamage === true ||
          dmg?.hasDamage === true ||
          (typeof impDmg?.value === "number" && impDmg.value > 0) ||
          (typeof impDmg?.value === "string" && impDmg.value.trim() !== "" && impDmg.value.trim() !== "0") ||
          (typeof dmg?.value === "number" && dmg.value > 0) ||
          (typeof dmg?.value === "string" && dmg.value.trim() !== "" && dmg.value.trim() !== "0")
      );

      if (!hasDamage) return null;

      const rawType = String(
        impDmg?.type?.value ??
          impDmg?.type ??
          dmg?.type?.value ??
          dmg?.type ??
          sys.damageType?.value ??
          sys.damageType ??
          ""
      ).toLowerCase();

      return this.DAMAGE_TYPE_ICONS[rawType] ?? null;
    }

    return null;
  }

  static buildMenuData(actor) {
    const equipped = actor.system?.equipped ?? {};

    // 1. ATAQUE
    const weapons = actor.items
      .filter((i) => i.type === "weapon")
      .map((item) => {
        let badge = "";
        if (equipped.mainHand === item.id && equipped.offHand === item.id) badge = "2 Mãos";
        else if (equipped.mainHand === item.id) badge = "Principal";
        else if (equipped.offHand === item.id) badge = "Secundária";

        return {
          id: item.id,
          name: item.name,
          img: item.img,
          badge,
          damageInfo: this.resolveItemDamageIcon(item),
          kind: "item"
        };
      });

    // 2. FEITIÇOS
    const spells = actor.items
      .filter((i) => i.type === "spell")
      .map((item) => {
        const amt = item.system?.cost?.amount;
        const perTarget = item.system?.cost?.perTarget ? " × A" : "";
        const badge = amt ? `${amt} PM${perTarget}` : "";
        return {
          id: item.id,
          name: item.name,
          img: item.img,
          badge,
          damageInfo: this.resolveItemDamageIcon(item),
          kind: "item"
        };
      });

    // 3. AÇÕES
    const actions = this.COMBAT_ACTIONS.map((act) => ({
      id: act.id,
      name: act.label,
      faIcon: act.icon,
      kind: "sheetAction",
      actionName: act.action,
      actionType: act.type
    }));

    // 4. CLASSES -> Habilidades de cada classe
    const classItems = actor.items.filter((i) => i.type === "class");
    const skillItems = actor.items.filter((i) => i.type === "skill");

    const classGroups = classItems.map((cls) => {
      const fuid = String(cls.system?.fuid ?? "").toLowerCase();
      const clsNameNorm = cls.name.trim().toLowerCase();

      const matchingSkills = skillItems
        .filter((sk) => {
          const skClassVal = String(sk.system?.class?.value ?? "").toLowerCase();
          return (fuid && skClassVal === fuid) || (clsNameNorm && skClassVal === clsNameNorm);
        })
        .map((sk) => {
          const rawAmt = String(sk.system?.cost?.amount ?? "").trim();
          const resLabel = sk.system?.cost?.resource === "hp" ? "PV" : "PM";
          const badge = rawAmt && rawAmt !== "0" && !rawAmt.includes("$") ? `${rawAmt} ${resLabel}` : "";
          return {
            id: sk.id,
            name: sk.name,
            img: sk.img,
            badge,
            kind: "item"
          };
        });

      return {
        id: `class-${cls.id}`,
        itemId: cls.id,
        name: cls.name,
        img: cls.img,
        items: matchingSkills
      };
    });

    const assignedSkillIds = new Set(classGroups.flatMap((g) => g.items.map((i) => i.id)));
    const orphanSkills = skillItems
      .filter((sk) => !assignedSkillIds.has(sk.id))
      .map((sk) => ({
        id: sk.id,
        name: sk.name,
        img: sk.img,
        badge: "",
        kind: "item"
      }));

    if (orphanSkills.length > 0) {
      classGroups.push({
        id: "class-other",
        name: "Outras Perícias",
        faIcon: "fas fa-star",
        items: orphanSkills
      });
    }

    // 5. PODERES HEROICOS
    const heroics = actor.items
      .filter((i) => i.type === "heroic")
      .map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        badge: "",
        kind: "item"
      }));

    // 6. CARACTERÍSTICAS
    const featureItems = actor.items.filter((i) => i.type === "classFeature");
    const featureMap = new Map();

    for (const feat of featureItems) {
      const fType = feat.system?.featureType || "other";
      if (!featureMap.has(fType)) {
        const groupLabel = this.resolveFeatureGroupLabel(fType);
        featureMap.set(fType, {
          id: `feat-${fType}`,
          itemId: feat.id,
          name: groupLabel,
          img: feat.img,
          items: []
        });
      }

      let toggleAction = null;
      let isActive = false;

      if (fType === "projectfu.garden") {
        toggleAction = "toggleActiveGarden";
        isActive = Boolean(feat.system?.data?.active || equipped.garden === feat.id);
      } else if (fType === "projectfu.magiseed") {
        toggleAction = "togglePlantedMagiseed";
        isActive = Boolean(feat.system?.data?.planted || equipped.magiseed === feat.id);
      } else if (fType === "projectfu.therioform") {
        isActive = Array.isArray(equipped.therioforms) && equipped.therioforms.includes(feat.id);
      }

      featureMap.get(fType).items.push({
        id: feat.id,
        name: feat.name,
        img: feat.img,
        badge: isActive ? "Ativo" : "",
        kind: "item",
        toggleAction,
        isActive
      });
    }

    const featureGroups = Array.from(featureMap.values());

    // 7. ITENS (Acessórios + Consumíveis)
    const items = actor.items
      .filter((i) => i.type === "accessory" || i.type === "consumable")
      .map((item) => {
        let badge = "";
        if (item.type === "accessory" && equipped.accessory === item.id) {
          badge = "Equipado";
        } else if (item.type === "consumable") {
          const ipCost = item.system?.ipCost?.value ?? item.system?.ipCost;
          if (ipCost) badge = `${ipCost} PI`;
        }

        return {
          id: item.id,
          name: item.name,
          img: item.img,
          badge,
          kind: "item"
        };
      });

    const categories = [];

    if (weapons.length > 0) {
      categories.push({
        id: "attacks",
        label: "Ataque",
        faIcon: "fas fa-sword",
        items: weapons
      });
    }

    if (spells.length > 0) {
      categories.push({
        id: "spells",
        label: "Feitiços",
        faIcon: "fas fa-hat-wizard",
        items: spells
      });
    }

    categories.push({
      id: "actions",
      label: "Ações",
      faIcon: "fas fa-compass",
      items: actions
    });

    if (classGroups.some((g) => g.items.length > 0)) {
      categories.push({
        id: "classes",
        label: "Classes",
        faIcon: "fas fa-book-open",
        groups: classGroups.filter((g) => g.items.length > 0)
      });
    }

    if (heroics.length > 0) {
      categories.push({
        id: "heroics",
        label: "Poderes Heroicos",
        faIcon: "fas fa-crown",
        items: heroics
      });
    }

    if (featureGroups.length > 0) {
      categories.push({
        id: "features",
        label: "Características",
        faIcon: "fas fa-seedling",
        groups: featureGroups
      });
    }

    if (items.length > 0) {
      categories.push({
        id: "items",
        label: "Itens",
        faIcon: "fas fa-briefcase-medical",

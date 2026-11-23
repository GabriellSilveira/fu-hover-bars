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

  static getItemDamageIcon(item) {
    const sys = item?.system;
    if (!sys) return null;

    if (item.type === "weapon") {
      if (sys.hasDamage === false) return null;
      const dmgType = String(sys.damageType?.value ?? sys.damageType ?? "physical").toLowerCase();
      return this.DAMAGE_TYPE_ICONS[dmgType] ?? null;
    }

    if (item.type === "spell") {
      const hasDamage = Boolean(
        sys.hasDamage === true ||
          sys.hasDamage?.value === true ||
          sys.rollInfo?.damage?.hasDamage?.value === true ||
          sys.impdamage?.hasDamage?.value === true ||
          sys.impdamage?.hasDamage === true
      );
      if (!hasDamage) return null;

      const dmgType = String(
        sys.damageType?.value ??
          (typeof sys.damageType === "string" ? sys.damageType : null) ??
          sys.rollInfo?.damage?.type?.value ??
          sys.impdamage?.type?.value ??
          (typeof sys.impdamage?.type === "string" ? sys.impdamage.type : null) ??
          ""
      ).toLowerCase();

      return this.DAMAGE_TYPE_ICONS[dmgType] ?? null;
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
          damageInfo: this.getItemDamageIcon(item),
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
          damageInfo: this.getItemDamageIcon(item),
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
        items
      });
    }

    return categories;
  }

  static resolveFeatureGroupLabel(featureType) {
    if (this.FEATURE_TYPE_FALLBACKS[featureType]) {
      return this.FEATURE_TYPE_FALLBACKS[featureType];
    }

    const regEntry = CONFIG.FU?.classFeatureRegistry?.byKey?.(featureType);
    if (regEntry?.translation) {
      const localized = game.i18n.localize(regEntry.translation);
      if (localized && localized !== regEntry.translation) return localized;
    }

    const clean = String(featureType).replace(/^projectfu\./, "");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  static async resolveDescriptionPayload(actor, inspectTarget) {
    if (inspectTarget.type === "item") {
      const item = actor.items.get(inspectTarget.itemId);
      if (!item) return null;

      const rawDesc =
        item.system?.description ||
        item.system?.data?.description ||
        item.system?.summary?.value ||
        (typeof item.system?.summary === "string" ? item.system.summary : "") ||
        "<p><em>Sem descrição cadastrada na ficha.</em></p>";

      const enriched = await this.enrichDescriptionHTML(rawDesc, item);
      return {
        title: item.name,
        img: item.img,
        faIcon: null,
        html: enriched
      };
    }

    if (inspectTarget.type === "sheetAction") {
      const act = this.COMBAT_ACTIONS.find((a) => a.type === inspectTarget.actionType);
      if (!act) return null;

      const enriched = await this.enrichDescriptionHTML(act.description, actor);
      return {
        title: act.label,
        img: null,
        faIcon: act.icon,
        html: enriched
      };
    }

    if (inspectTarget.type === "category") {
      const text = this.CATEGORY_DESCRIPTIONS[inspectTarget.catId];
      if (!text) return null;

      return {
        title: inspectTarget.label,
        img: null,
        faIcon: inspectTarget.faIcon,
        html: `<p>${text}</p>`
      };
    }

    return null;
  }

  static async enrichDescriptionHTML(rawHTML, relativeTo) {
    try {
      const enricher =
        foundry?.applications?.ux?.TextEditor?.implementation?.enrichHTML ??
        TextEditor?.enrichHTML;

      if (typeof enricher === "function") {
        return await enricher(String(rawHTML), {
          relativeTo,
          async: true
        });
      }
    } catch (err) {
      console.warn("[fu-hover-bars] Erro ao enriquecer descrição:", err);
    }
    return String(rawHTML);
  }

  static async toggleInspect(entry, key, inspectTarget, level = 1) {
    if (entry.inspectedKey === key) {
      this.clearBalloonState(entry);
      this.render(entry);
      return;
    }

    const payload = await this.resolveDescriptionPayload(entry.token.actor, inspectTarget);
    if (!payload) return;

    entry.inspectedKey = key;
    entry.inspectedData = payload;
    entry.inspectedLevel = level;
    this.render(entry);
  }

  static renderLeafItemHTML(item, inspectedKey, level) {
    const iconHTML = item.img
      ? `<img class="fu-am-icon" src="${item.img}" alt="" />`
      : `<i class="fu-am-fa-icon ${item.faIcon || "fas fa-diamond"}"></i>`;

    const damageHTML = item.damageInfo
      ? `<i class="fu-am-dmg-icon ${item.damageInfo.icon}" style="color: ${item.damageInfo.color};" title="Dano: ${item.damageInfo.label}"></i>`
      : "";

    const badgeHTML = item.badge
      ? `<span class="fu-am-badge ${item.isActive ? "is-active" : ""}">${item.badge}</span>`
      : "";

    const toggleBtnHTML = item.toggleAction
      ? `<button type="button" class="fu-am-toggle-btn ${item.isActive ? "is-active" : ""}" data-fu-toggle="${item.toggleAction}" data-item-id="${item.id}" title="Ativar/Alternar na ficha">
           <i class="fas fa-check-circle"></i>
         </button>`
      : "";

    if (item.kind === "sheetAction") {
      const key = `action:${item.actionType}`;
      const isInspected = inspectedKey === key ? "is-inspected" : "";
      return `
        <div class="fu-am-row fu-am-leaf ${isInspected}" data-inspect-key="${key}" data-fu-kind="sheetAction" data-action-name="${item.actionName}" data-action-type="${item.actionType}" data-level="${level}">
          <span class="fu-am-cursor">☛</span>
          ${iconHTML}
          <span class="fu-am-label">${item.name}</span>
        </div>
      `;
    }

    const key = `item:${item.id}`;
    const isInspected = inspectedKey === key ? "is-inspected" : "";
    return `
      <div class="fu-am-row fu-am-leaf ${isInspected}" data-inspect-key="${key}" data-fu-kind="item" data-item-id="${item.id}" data-level="${level}">
        <span class="fu-am-cursor">☛</span>
        ${iconHTML}
        <span class="fu-am-label">${item.name}${damageHTML}</span>
        ${badgeHTML}
        ${toggleBtnHTML}
      </div>
    `;
  }

  static renderBalloonHTML(entry) {
    if (!entry.inspectedData) return "";

    const data = entry.inspectedData;
    const iconHTML = data.img
      ? `<img class="fu-am-balloon-icon" src="${data.img}" alt="" />`
      : `<i class="fu-am-balloon-fa ${data.faIcon || "fas fa-info-circle"}"></i>`;

    return `
      <div class="fu-am-balloon" title="Clique com o botão direito novamente para fechar">
        <div class="fu-am-balloon-header">
          ${iconHTML}
          <span class="fu-am-balloon-title">${data.title}</span>
          <button type="button" class="fu-am-balloon-close" title="Fechar">✕</button>
        </div>
        <div class="fu-am-balloon-body">${data.html}</div>
      </div>
    `;
  }

  static render(entry) {
    const actor = entry.token.actor;
    if (!actor) return;

    const categories = this.buildMenuData(actor);

    const activeCat = categories.find((c) => c.id === entry.openCategory) ?? null;
    if (!activeCat) {
      entry.openCategory = null;
      entry.openSubGroup = null;
    }

    const mainRowsHTML = categories
      .map((cat) => {
        const key = `cat:${cat.id}`;
        const isOpen = entry.openCategory === cat.id;
        const isInspected = entry.inspectedKey === key ? "is-inspected" : "";
        return `
          <div class="fu-am-row fu-am-cat-row ${isOpen ? "is-active" : ""} ${isInspected}" data-inspect-key="${key}" data-cat-id="${cat.id}" data-cat-label="${cat.label}" data-cat-icon="${cat.faIcon}" data-level="1">
            <span class="fu-am-cursor">☛</span>
            <i class="fu-am-fa-icon ${cat.faIcon}"></i>
            <span class="fu-am-label">${cat.label}</span>
            <span class="fu-am-arrow">▸</span>
          </div>
        `;
      })
      .join("");

    let level2HTML = "";
    let level

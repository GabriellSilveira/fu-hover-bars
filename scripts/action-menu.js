class FUActionMenu {
  static MODULE_ID = "fu-hover-bars";
  static SETTING_KEY = "enableActionMenu";
  static activeMenus = new Map();

  static COMBAT_ACTIONS = [
    {
      id: "guard",
      label: "Guarda",
      icon: "fas fa-shield-alt",
      action: "action",
      type: "guard"
    },
    {
      id: "hinder",
      label: "Impedir",
      icon: "fas fa-ban",
      action: "action",
      type: "hinder"
    },
    {
      id: "objective",
      label: "Objetivo",
      icon: "fas fa-bullseye",
      action: "action",
      type: "objective"
    },
    {
      id: "inventory",
      label: "Inventário",
      icon: "fas fa-flask",
      action: "action",
      type: "inventory"
    },
    {
      id: "study",
      label: "Estudo",
      icon: "fas fa-search",
      action: "action",
      type: "study"
    },
    {
      id: "equipment",
      label: "Equipamento",
      icon: "fas fa-exchange-alt",
      action: "action",
      type: "equipment"
    }
  ];

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
   * Valida estritamente se:
   * 1. A feature está ativada nas configurações
   * 2. O usuário atual é dono do token/ator
   * 3. Há um combate iniciado e este token é o combatente do turno atual
   */
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

  static show(token) {
    if (!this.canDisplayForToken(token)) return;

    // Fecha menus de outros tokens caso existam
    for (const [otherId] of this.activeMenus) {
      if (otherId !== token.id) this.hide(otherId, true);
    }

    let entry = this.activeMenus.get(token.id);
    if (entry) {
      this.clearTimers(entry);
      entry.isPointerInsideMenu = false;
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
      openSubGroup: null
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
   * Coleta e organiza todas as ações e itens do personagem exatamente como na ficha
   */
  static buildMenuData(actor) {
    const equipped = actor.system?.equipped ?? {};

    // 1. ATAQUE (Armas)
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
        name: cls.name,
        img: cls.img,
        items: matchingSkills
      };
    });

    // Perícias sem classe vinculada (caso existam)
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

    // 6. CARACTERÍSTICAS -> Agrupadas por featureType (Jardim, Magissemente, Terioforma, etc.)
    const featureItems = actor.items.filter((i) => i.type === "classFeature");
    const featureMap = new Map();

    for (const feat of featureItems) {
      const fType = feat.system?.featureType || "other";
      if (!featureMap.has(fType)) {
        const groupLabel = this.resolveFeatureGroupLabel(fType);
        featureMap.set(fType, {
          id: `feat-${fType}`,
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

    // Monta as categorias principais
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

  /**
   * Renderiza um item individual com ícone à esquerda, título e badge opcional
   */
  static renderLeafItemHTML(item) {
    const iconHTML = item.img
      ? `<img class="fu-am-icon" src="${item.img}" alt="" />`
      : `<i class="fu-am-fa-icon ${item.faIcon || "fas fa-diamond"}"></i>`;

    const badgeHTML = item.badge
      ? `<span class="fu-am-badge ${item.isActive ? "is-active" : ""}">${item.badge}</span>`
      : "";

    const toggleBtnHTML = item.toggleAction
      ? `<button type="button" class="fu-am-toggle-btn ${item.isActive ? "is-active" : ""}" data-fu-toggle="${item.toggleAction}" data-item-id="${item.id}" title="Ativar/Alternar na ficha">
           <i class="fas fa-check-circle"></i>
         </button>`
      : "";

    if (item.kind === "sheetAction") {
      return `
        <div class="fu-am-row fu-am-leaf" data-fu-kind="sheetAction" data-action-name="${item.actionName}" data-action-type="${item.actionType}">
          <span class="fu-am-cursor">☛</span>
          ${iconHTML}
          <span class="fu-am-label">${item.name}</span>
        </div>
      `;
    }

    return `
      <div class="fu-am-row fu-am-leaf" data-fu-kind="item" data-item-id="${item.id}">
        <span class="fu-am-cursor">☛</span>
        ${iconHTML}
        <span class="fu-am-label">${item.name}</span>
        ${badgeHTML}
        ${toggleBtnHTML}
      </div>
    `;
  }

  static render(entry) {
    const actor = entry.token.actor;
    if (!actor) return;

    const categories = this.buildMenuData(actor);

    // Garante que a categoria/subgrupo abertos ainda existem
    const activeCat = categories.find((c) => c.id === entry.openCategory) ?? null;
    if (!activeCat) {
      entry.openCategory = null;
      entry.openSubGroup = null;
    }

    const mainRowsHTML = categories
      .map((cat) => {
        const isOpen = entry.openCategory === cat.id;
        return `
          <div class="fu-am-row fu-am-cat-row ${isOpen ? "is-active" : ""}" data-cat-id="${cat.id}">
            <span class="fu-am-cursor">☛</span>
            <i class="fu-am-fa-icon ${cat.faIcon}"></i>
            <span class="fu-am-label">${cat.label}</span>
            <span class="fu-am-arrow">▸</span>
          </div>
        `;
      })
      .join("");

    // Submenu Nível 2 (Lista direta de itens OU lista de Classes / Características)
    let level2HTML = "";
    let level3HTML = "";

    if (activeCat) {
      if (activeCat.items) {
        const rows = activeCat.items.map((item) => this.renderLeafItemHTML(item)).join("");
        level2HTML = `
          <div class="fu-am-panel fu-am-subpanel fu-am-level2">
            <div class="fu-am-panel-title">${activeCat.label}</div>
            <div class="fu-am-list">${rows}</div>
          </div>
        `;
      } else if (activeCat.groups) {
        const activeGroup = activeCat.groups.find((g) => g.id === entry.openSubGroup) ?? null;
        if (!activeGroup) entry.openSubGroup = null;

        const groupRows = activeCat.groups
          .map((grp) => {
            const isGrpOpen = entry.openSubGroup === grp.id;
            const grpIcon = grp.img
              ? `<img class="fu-am-icon" src="${grp.img}" alt="" />`
              : `<i class="fu-am-fa-icon ${grp.faIcon || "fas fa-folder"}"></i>`;

            return `
              <div class="fu-am-row fu-am-group-row ${isGrpOpen ? "is-active" : ""}" data-group-id="${grp.id}">
                <span class="fu-am-cursor">☛</span>
                ${grpIcon}
                <span class="fu-am-label">${grp.name}</span>
                <span class="fu-am-arrow">▸</span>
              </div>
            `;
          })
          .join("");

        level2HTML = `
          <div class="fu-am-panel fu-am-subpanel fu-am-level2">
            <div class="fu-am-panel-title">${activeCat.label}</div>
            <div class="fu-am-list">${groupRows}</div>
          </div>
        `;

        // Submenu Nível 3 (Habilidades da Classe selecionada ou Opções da Característica)
        if (activeGroup) {
          const leafRows = activeGroup.items.map((item) => this.renderLeafItemHTML(item)).join("");
          level3HTML = `
            <div class="fu-am-panel fu-am-subpanel fu-am-level3">
              <div class="fu-am-panel-title">${activeGroup.name}</div>
              <div class="fu-am-list">${leafRows}</div>
            </div>
          `;
        }
      }
    }

    entry.element.innerHTML = `
      <div class="fu-am-columns">
        <div class="fu-am-panel fu-am-main">
          <div class="fu-am-header">
            <span class="fu-am-diamond">◈</span>
            <span class="fu-am-actor-name">${actor.name}</span>
          </div>
          <div class="fu-am-list">
            ${mainRowsHTML}
          </div>
        </div>
        ${level2HTML}
        ${level3HTML}
      </div>
    `;

    this.bindEvents(entry);
    this.adjustHorizontalFlip(entry);
  }

  static bindEvents(entry) {
    const root = entry.element;

    // Hover e clique nas categorias principais (Nível 1)
    for (const row of root.querySelectorAll(".fu-am-cat-row")) {
      const catId = row.dataset.catId;

      row.addEventListener("mouseenter", () => {
        if (entry.openCategory !== catId) {
          entry.openCategory = catId;
          entry.openSubGroup = null;
          this.render(entry);
        }
      });

      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        entry.openCategory = entry.openCategory === catId ? null : catId;
        entry.openSubGroup = null;
        this.render(entry);
      });
    }

    // Hover e clique nos subgrupos (Classes ou Tipos de Característica - Nível 2)
    for (const row of root.querySelectorAll(".fu-am-group-row")) {
      const groupId = row.dataset.groupId;

      row.addEventListener("mouseenter", () => {
        if (entry.openSubGroup !== groupId) {
          entry.openSubGroup = groupId;
          this.render(entry);
        }
      });

      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        entry.openSubGroup = entry.openSubGroup === groupId ? null : groupId;
        this.render(entry);
      });
    }

    // Botões de alternância rápida (Jardim / Magissemente)
    for (const toggleBtn of root.querySelectorAll("[data-fu-toggle]")) {
      toggleBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const actionName = toggleBtn.dataset.fuToggle;
        const itemId = toggleBtn.dataset.itemId;
        await this.invokeSheetAction(entry.token.actor, {
          action: actionName,
          itemId
        });
        setTimeout(() => this.render(entry), 120);
      });
    }

    // Clique final para executar Ataque, Feitiço, Ação, Habilidade ou Item
    for (const leaf of root.querySelectorAll(".fu-am-leaf")) {
      leaf.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const kind = leaf.dataset.fuKind;
        const actor = entry.token.actor;

        if (kind === "item") {
          const item = actor.items.get(leaf.dataset.itemId);
          if (item && typeof item.roll === "function") {
            await item.roll();
          }
        } else if (kind === "sheetAction") {
          await this.invokeSheetAction(actor, {
            action: leaf.dataset.actionName,
            type: leaf.dataset.actionType,
            rollType: "action-type"
          });
        }

        // Fecha o menu após disparar a ação
        entry.isPointerInsideMenu = false;
        this.hide(entry.token.id, true);
      });
    }
  }

  /**
   * Executa ações nativas da FUStandardActorSheet (Guarda, Impedir, Estudo, Equipamento, etc.)
   */
  static async invokeSheetAction(actor, dataset) {
    const sheet = actor.sheet;
    const actionsMap = sheet?.constructor?.DEFAULT_OPTIONS?.actions ?? {};
    const handler = actionsMap[dataset.action];

    const fakeBtn = document.createElement("button");
    for (const [k, v] of Object.entries(dataset)) {
      if (v !== undefined && v !== null) fakeBtn.dataset[k] = v;
    }

    const fakeEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(fakeEvent, "target", { value: fakeBtn });
    Object.defineProperty(fakeEvent, "currentTarget", { value: fakeBtn });

    if (typeof handler === "function") {
      try {
        await handler.call(sheet, fakeEvent, fakeBtn);
        return;
      } catch (err) {
        console.warn("[fu-hover-bars] Fallback ao acionar ação da ficha:", err);
      }
    }

    if (dataset.type === "inventory") {
      await actor.sheet.render(true);
    }
  }

  static updatePosition(entry) {
    if (!entry?.token || entry.token.destroyed || !canvas?.stage) return;

    const topRightWorld = {
      x: entry.token.x + entry.token.w,
      y: entry.token.y
    };
    const screenPos = canvas.stage.worldTransform.apply(topRightWorld);

    const left = Math.max(12, screenPos.x + 10);
    const maxTop = Math.max(16, window.innerHeight - 360);
    const top = Math.min(Math.max(16, screenPos.y - 6), maxTop);

    entry.element.style.left = `${left}px`;
    entry.element.style.top = `${top}px`;
    this.adjustHorizontalFlip(entry);
  }

  static adjustHorizontalFlip(entry) {
    if (!entry?.element) return;
    const rect = entry.element.getBoundingClientRect();
    if (rect.right > window.innerWidth - 12) {
      entry.element.classList.add("fu-am-flip-left");
    } else {
      entry.element.classList.remove("fu-am-flip-left");
    }
  }

  static updateAllPositions() {
    for (const entry of this.activeMenus.values()) {
      this.updatePosition(entry);
    }
  }
}

Hooks.once("init", () => {
  FUActionMenu.registerSettings();
});

Hooks.on("hoverToken", (token, hovered) => {
  if (hovered) FUActionMenu.show(token);
  else FUActionMenu.hide(token.id, false);
});

Hooks.on("canvasPan", () => FUActionMenu.updateAllPositions());

Hooks.on("refreshToken", (token) => {
  const entry = FUActionMenu.activeMenus.get(token.id);
  if (entry) FUActionMenu.updatePosition(entry);
});

Hooks.on("updateCombat", () => {
  FUActionMenu.clearAll();
});

Hooks.on("deleteCombat", () => {
  FUActionMenu.clearAll();
});

Hooks.on("deleteToken", (tokenDoc) => {
  FUActionMenu.hide(tokenDoc.id, true);
});

Hooks.on("canvasTearDown", () => {
  FUActionMenu.clearAll();
});

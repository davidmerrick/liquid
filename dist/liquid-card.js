const DEFAULT_SECTIONS = [
  {
    title: "Security",
    accent: "blue",
    tiles: [
      { name: "Front Door", entity: "lock.front_door", icon: "mdi:door-closed-lock", mock_state: "Locked" },
      { name: "Garage", entity: "cover.garage", icon: "mdi:garage", mock_state: "Closed" },
    ],
  },
  {
    title: "Climate",
    accent: "green",
    tiles: [
      { name: "Living Room", entity: "sensor.living_room_temperature", icon: "mdi:thermometer", mock_state: "72°" },
      { name: "Air Quality", entity: "sensor.air_quality", icon: "mdi:molecule-co2", mock_state: "Good" },
    ],
  },
];

const MODES = ["Home", "Away", "Night", "Guest", "Moving"];

const ACCENTS = {
  blue: {
    glow: "rgba(55, 148, 255, .34)",
    edge: "rgba(119, 190, 255, .46)",
    icon: "#87c5ff",
  },
  green: {
    glow: "rgba(57, 217, 138, .28)",
    edge: "rgba(108, 238, 172, .40)",
    icon: "#8ef0bd",
  },
  amber: {
    glow: "rgba(255, 184, 77, .28)",
    edge: "rgba(255, 215, 133, .38)",
    icon: "#ffd06f",
  },
  red: {
    glow: "rgba(255, 89, 89, .28)",
    edge: "rgba(255, 145, 145, .38)",
    icon: "#ff9b9b",
  },
};

class LiquidDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._activeSettingsPanel = null;
    this._showThermostatSheet = false;
  }

  setConfig(config) {
    this._config = {
      sections: DEFAULT_SECTIONS,
      ...config,
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 8;
  }

  moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  callService(domain, service, data = {}) {
    if (!this._hass) return;
    this._hass.callService(domain, service, data);
  }

  handleAction(action, entityId) {
    if (action === "lock-all") {
      this.callService("script", "lock_all_locks");
      return;
    }
    if (action === "assist") {
      const pipelineId = this._config.intercom_pipeline_id;
      this.dispatchEvent(
        new CustomEvent("hass-action", {
          bubbles: true,
          composed: true,
          detail: {
            config: {
              tap_action: {
                action: "assist",
                pipeline_id: pipelineId,
                start_listening: true,
              },
            },
            action: "tap",
          },
        }),
      );
      return;
    }
    if (action === "settings") {
      this._activeSettingsPanel = "root";
      this._showThermostatSheet = false;
      this.render();
      return;
    }
    if (action === "thermostat") {
      this._activeSettingsPanel = null;
      this._showThermostatSheet = true;
      this.render();
      return;
    }
    if (action === "toggle") {
      this.callService("homeassistant", "toggle", {
        entity_id: entityId,
      });
      return;
    }
    this.moreInfo(entityId);
  }

  setHomeMode(option) {
    const entityId = this._config.home_mode_entity;
    if (!entityId) return;
    this.callService("input_select", "select_option", {
      entity_id: entityId,
      option,
    });
  }

  setThermostatTemperature(target) {
    const entityId = this._config.thermostat_entity;
    if (!entityId || !Number.isFinite(target)) return;
    this.callService("climate", "set_temperature", {
      entity_id: entityId,
      temperature: target,
    });
  }

  adjustThermostat(delta) {
    const thermostat = this.thermostatSummary();
    const target = Number.parseFloat(thermostat.target);
    if (!Number.isFinite(target)) return;
    this.setThermostatTemperature(target + delta);
  }

  setThermostatMode(mode) {
    const entityId = this._config.thermostat_entity;
    if (!entityId || !mode) return;
    this.callService("climate", "set_hvac_mode", {
      entity_id: entityId,
      hvac_mode: mode,
    });
  }

  stateObj(entityId) {
    return this._hass?.states?.[entityId];
  }

  state(entityId) {
    const obj = this.stateObj(entityId);
    if (!obj) return "Unavailable";
    return obj.state;
  }

  friendlyState(entityId) {
    const mock = arguments.length > 1 ? arguments[1] : undefined;
    const obj = this.stateObj(entityId);
    if (!obj) return mock || "Unavailable";
    const normalized = String(obj.state || "").toLowerCase();
    if ((normalized === "unavailable" || normalized === "unknown") && mock) return mock;
    const unit = obj.attributes?.unit_of_measurement || "";
    const state = obj.state === "unknown" ? "Unknown" : obj.state;
    return `${state}${unit ? ` ${unit}` : ""}`;
  }

  thermostatSummary() {
    const climate = this.stateObj(this._config.thermostat_entity);
    if (!climate || climate.state === "unavailable" || climate.state === "unknown") {
      return {
        mode: this._config.thermostat_mock_mode || "Heat",
        temp: this._config.thermostat_mock_temp || "73",
        target: this._config.thermostat_mock_target || "69",
        modes: this._config.thermostat_modes || ["heat", "cool", "off"],
      };
    }
    return {
      mode: climate.state,
      temp: climate.attributes?.current_temperature ?? "--",
      target: climate.attributes?.temperature ?? "--",
      modes: climate.attributes?.hvac_modes || this._config.thermostat_modes || ["heat", "cool", "off"],
    };
  }

  render() {
    if (!this.shadowRoot) return;
    const homeMode = this.state(this._config.home_mode_entity);
    const thermostat = this.thermostatSummary();
    const sections = this._config.sections || [];
    const title = this._config.title || "Liquid";
    const heading = this._config.heading || homeMode;
    const hasHomeMode = Boolean(this._config.home_mode_entity);
    const hasThermostat = Boolean(this._config.thermostat_entity);
    const showIntercom = this._config.show_intercom !== false;
    const showLockAll = this._config.show_lock_all !== false;
    const hasSettings = Boolean(this._config.settings_panels?.length);

    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      <article class="surface">
        <div class="aurora aurora-one"></div>
        <div class="aurora aurora-two"></div>
        <header class="hero">
          <div class="hero-copy">
            <p class="eyebrow">${this.escape(title)}</p>
            <h1>${this.escape(heading)}</h1>
            ${hasHomeMode ? `
              <label class="mode-field">
                <span>Home Mode</span>
                <select>
                  ${MODES.map((mode) => `
                    <option value="${this.escape(mode)}" ${homeMode === mode ? "selected" : ""}>
                      ${this.escape(mode)}
                    </option>
                  `).join("")}
                </select>
              </label>
            ` : ""}
          </div>
          <div class="hero-stack">
            ${hasSettings ? `<button class="glass-command" type="button" data-action="settings">
              <ha-icon icon="mdi:cog"></ha-icon>
              <span>Settings</span>
            </button>` : ""}
            ${showIntercom ? `<button class="glass-command primary" type="button" data-action="assist">
              <ha-icon icon="mdi:account-tie-voice"></ha-icon>
              <span>Intercom</span>
            </button>` : ""}
            ${showLockAll ? `<button class="glass-command danger" type="button" data-action="lock-all">
              <ha-icon icon="mdi:shield-lock"></ha-icon>
              <span>Lock All</span>
            </button>` : ""}
          </div>
        </header>

        ${hasThermostat ? `
        <button class="climate glass-panel" type="button" data-action="thermostat">
          <div>
            <p class="label">Thermostat</p>
            <strong>${this.escape(thermostat.mode)}</strong>
          </div>
          <div class="temp">
            <span>${this.escape(String(thermostat.temp))}°</span>
            <small>${this.escape(String(thermostat.target))}° target</small>
          </div>
        </button>
        ` : ""}

        <div class="section-grid">
          ${sections.map((section) => this.renderSection(section)).join("")}
        </div>

        ${this.renderSettingsSheet()}
        ${this.renderThermostatSheet()}
      </article>
    `;

    this.shadowRoot.querySelector(".mode-field select")?.addEventListener("change", (event) => {
      this.setHomeMode(event.target.value);
    });
    this.shadowRoot.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action));
    });
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => {
      button.addEventListener("click", () => {
        this.handleAction(button.dataset.tileAction, button.dataset.entity);
      });
    });
    this.shadowRoot.querySelectorAll("[data-sheet-close]").forEach((button) => {
      button.addEventListener("click", () => {
        this._activeSettingsPanel = null;
        this._showThermostatSheet = false;
        this.render();
      });
    });
    this.shadowRoot.querySelector("[data-sheet-back]")?.addEventListener("click", () => {
      this._activeSettingsPanel = "root";
      this.render();
    });
    this.shadowRoot.querySelectorAll("[data-settings-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        this._activeSettingsPanel = button.dataset.settingsPanel;
        this.render();
      });
    });
    this.shadowRoot.querySelectorAll("[data-thermostat-step]").forEach((button) => {
      button.addEventListener("click", () => {
        this.adjustThermostat(Number.parseFloat(button.dataset.thermostatStep));
      });
    });
    this.shadowRoot.querySelectorAll("[data-thermostat-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        this.setThermostatMode(button.dataset.thermostatMode);
      });
    });
  }

  settingsPanels() {
    return this._config.settings_panels || [];
  }

  activeSettingsPanel() {
    if (!this._activeSettingsPanel) return null;
    if (this._activeSettingsPanel === "root") return null;
    return this.settingsPanels().find((panel) => panel.id === this._activeSettingsPanel) || null;
  }

  renderSettingsSheet() {
    if (!this._activeSettingsPanel) return "";
    const panel = this.activeSettingsPanel();
    return `
      <div class="sheet-scrim" data-sheet-close></div>
      <aside class="settings-sheet glass-panel" role="dialog" aria-modal="true">
        <header class="sheet-header">
          ${panel ? `<button class="sheet-icon-button" type="button" data-sheet-back aria-label="Back">
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>` : `<span class="sheet-icon-spacer"></span>`}
          <div>
            <p class="eyebrow">${panel ? "Settings" : "Liquid"}</p>
            <h2>${this.escape(panel?.title || "Settings")}</h2>
          </div>
          <button class="sheet-icon-button" type="button" data-sheet-close aria-label="Close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        ${panel ? this.renderSettingsPanel(panel) : this.renderSettingsRoot()}
      </aside>
    `;
  }

  renderSettingsRoot() {
    return `
      <div class="settings-list">
        ${this.settingsPanels().map((panel) => `
          <button class="settings-row" type="button" data-settings-panel="${this.escape(panel.id)}">
            <span class="settings-row-icon"><ha-icon icon="${this.escape(panel.icon || "mdi:cog")}"></ha-icon></span>
            <span class="settings-row-copy">
              <strong>${this.escape(panel.title)}</strong>
              <small>${this.escape(panel.summary || "")}</small>
            </span>
            <ha-icon class="settings-row-chevron" icon="mdi:chevron-right"></ha-icon>
          </button>
        `).join("")}
      </div>
    `;
  }

  renderSettingsPanel(panel) {
    const groups = panel.groups || [];
    return `
      <div class="settings-groups">
        ${groups.map((group) => `
          <section class="settings-group">
            ${group.title ? `<h3>${this.escape(group.title)}</h3>` : ""}
            <div class="settings-list">
              ${(group.rows || []).map((row) => this.renderSettingsRow(row)).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  renderSettingsRow(row) {
    const state = row.entity ? this.friendlyState(row.entity, row.mock_state) : row.value;
    return `
      <button
        class="settings-row"
        type="button"
        data-entity="${this.escape(row.entity || "")}"
        data-tile-action="${this.escape(row.action || "more-info")}"
      >
        <span class="settings-row-icon"><ha-icon icon="${this.escape(row.icon || "mdi:circle")}"></ha-icon></span>
        <span class="settings-row-copy">
          <strong>${this.escape(row.name || "")}</strong>
          <small>${this.escape(state || "")}</small>
        </span>
        ${row.kind === "slider" ? `
          <span class="settings-slider" style="--value: ${this.escape(row.value || "50%")}"></span>
        ` : `
          <ha-icon class="settings-row-chevron" icon="mdi:chevron-right"></ha-icon>
        `}
      </button>
    `;
  }

  renderThermostatSheet() {
    if (!this._showThermostatSheet) return "";
    const thermostat = this.thermostatSummary();
    const modes = thermostat.modes || this._config.thermostat_modes || ["heat", "cool", "off"];
    const activeMode = String(thermostat.mode || "").toLowerCase();
    return `
      <div class="sheet-scrim" data-sheet-close></div>
      <aside class="settings-sheet climate-sheet glass-panel" role="dialog" aria-modal="true">
        <header class="sheet-header">
          <span class="sheet-icon-spacer"></span>
          <div>
            <p class="eyebrow">Climate</p>
            <h2>Thermostat</h2>
          </div>
          <button class="sheet-icon-button" type="button" data-sheet-close aria-label="Close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>

        <div class="thermostat-dial">
          <span>${this.escape(String(thermostat.target))}°</span>
          <small>Target</small>
        </div>

        <div class="thermostat-current">
          <span>Current</span>
          <strong>${this.escape(String(thermostat.temp))}°</strong>
        </div>

        <div class="thermostat-stepper" aria-label="Thermostat temperature controls">
          <button class="round-control" type="button" data-thermostat-step="-1" aria-label="Lower temperature">
            <ha-icon icon="mdi:minus"></ha-icon>
          </button>
          <button class="round-control" type="button" data-thermostat-step="1" aria-label="Raise temperature">
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>

        <div class="mode-segment">
          ${modes.map((mode) => {
            const normalized = String(mode).toLowerCase();
            return `
              <button
                type="button"
                data-thermostat-mode="${this.escape(normalized)}"
                class="${activeMode === normalized ? "active" : ""}"
              >
                ${this.escape(this.titleCase(normalized))}
              </button>
            `;
          }).join("")}
        </div>
      </aside>
    `;
  }

  titleCase(value) {
    const labels = {
      heat_cool: "Auto",
      fan_only: "Fan",
    };
    if (labels[value]) return labels[value];
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  renderSection(section) {
    const accent = ACCENTS[section.accent] || ACCENTS.blue;
    const tiles = section.tiles || [];
    return `
      <section
        class="glass-panel card-section"
        style="--accent-glow: ${accent.glow}; --accent-edge: ${accent.edge}; --accent-icon: ${accent.icon};"
      >
        <div class="section-title">
          <h2>${this.escape(section.title || "")}</h2>
          <span></span>
        </div>
        <div class="tiles">
          ${tiles.map((tile) => this.renderTile(tile)).join("")}
        </div>
      </section>
    `;
  }

  renderTile(tile) {
    const state = this.friendlyState(tile.entity, tile.mock_state);
    return `
      <button
        class="tile"
        type="button"
        data-entity="${this.escape(tile.entity || "")}"
        data-tile-action="${this.escape(tile.action || "more-info")}"
      >
        <span class="icon"><ha-icon icon="${this.escape(tile.icon || "mdi:circle")}"></ha-icon></span>
        <span class="tile-copy">
          <strong>${this.escape(tile.name || "")}</strong>
          <small>${this.escape(state)}</small>
        </span>
      </button>
    `;
  }

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  styles() {
    return `
      :host {
        display: block;
        color: #f8fafc;
        --liquid-text-muted: rgba(248, 250, 252, .68);
        --liquid-text-soft: rgba(248, 250, 252, .50);
        --liquid-border: rgba(255, 255, 255, .16);
        --liquid-fill: rgba(255, 255, 255, .10);
        --liquid-fill-strong: rgba(255, 255, 255, .17);
        --liquid-shadow: 0 24px 70px rgba(0, 0, 0, .44);
        font-family: var(--primary-font-family, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif);
      }

      * {
        box-sizing: border-box;
      }

      button {
        font: inherit;
      }

      .surface {
        position: relative;
        overflow: hidden;
        min-height: 720px;
        border-radius: 30px;
        padding: clamp(18px, 3vw, 32px);
        background:
          radial-gradient(circle at 18% 8%, rgba(88, 166, 255, .30), transparent 34%),
          radial-gradient(circle at 88% 0%, rgba(255, 187, 92, .22), transparent 30%),
          linear-gradient(145deg, rgba(13, 18, 28, .92), rgba(18, 22, 31, .70) 48%, rgba(7, 12, 19, .94));
        border: 1px solid rgba(255, 255, 255, .12);
        box-shadow: var(--liquid-shadow);
      }

      .surface::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(125deg, rgba(255, 255, 255, .18), transparent 22%, transparent 74%, rgba(255, 255, 255, .08)),
          radial-gradient(circle at 50% 0%, rgba(255, 255, 255, .16), transparent 20%);
        mix-blend-mode: screen;
      }

      .aurora {
        position: absolute;
        filter: blur(28px);
        opacity: .68;
        transform: translateZ(0);
        pointer-events: none;
      }

      .aurora-one {
        width: 360px;
        height: 220px;
        left: -90px;
        top: 90px;
        background: rgba(55, 148, 255, .18);
      }

      .aurora-two {
        width: 280px;
        height: 260px;
        right: -80px;
        bottom: 80px;
        background: rgba(88, 217, 153, .14);
      }

      .hero,
      .climate,
      .section-grid {
        position: relative;
        z-index: 1;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 20px;
        align-items: start;
        margin-bottom: 18px;
      }

      .eyebrow,
      .label {
        margin: 0 0 7px;
        color: var(--liquid-text-soft);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 18px;
        font-size: clamp(38px, 7vw, 76px);
        line-height: .95;
        letter-spacing: 0;
      }

      .mode-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .mode-field,
      .mode-field select,
      .glass-command,
      .tile,
      .sheet-icon-button,
      .settings-row,
      .round-control,
      .mode-segment button {
        border: 1px solid var(--liquid-border);
        color: inherit;
        background: var(--liquid-fill);
        box-shadow:
          inset 0 1px 1px rgba(255, 255, 255, .24),
          inset 0 -1px 1px rgba(0, 0, 0, .20),
          0 10px 28px rgba(0, 0, 0, .18);
        backdrop-filter: blur(22px) saturate(160%);
        -webkit-backdrop-filter: blur(22px) saturate(160%);
        cursor: pointer;
      }

      .mode-field {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 42px;
        border-radius: 16px;
        padding: 0 12px;
        color: var(--liquid-text-muted);
      }

      .mode-field span {
        color: var(--liquid-text-soft);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .mode-field select {
        min-width: 124px;
        border: 0;
        outline: 0;
        box-shadow: none;
        color: #07111f;
        background: linear-gradient(180deg, rgba(255, 255, 255, .92), rgba(184, 219, 255, .76));
        border-radius: 999px;
        padding: 7px 32px 7px 12px;
        appearance: auto;
      }

      .hero-stack {
        display: grid;
        gap: 10px;
        min-width: 170px;
      }

      .glass-command {
        min-height: 48px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        padding: 0 14px;
      }

      .glass-command ha-icon {
        width: 22px;
        height: 22px;
      }

      .glass-command.primary {
        background: rgba(76, 157, 255, .20);
      }

      .glass-command.danger {
        background: rgba(255, 83, 83, .16);
      }

      .glass-panel {
        border: 1px solid var(--liquid-border);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .07)),
          rgba(12, 16, 24, .34);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, .20),
          0 14px 36px rgba(0, 0, 0, .24);
        backdrop-filter: blur(26px) saturate(160%);
        -webkit-backdrop-filter: blur(26px) saturate(160%);
      }

      .climate {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 18px;
        min-height: 92px;
        border-radius: 24px;
        padding: 18px 20px;
        margin-bottom: 16px;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .climate strong {
        display: block;
        font-size: 22px;
        text-transform: capitalize;
      }

      .temp {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .temp span {
        font-size: 48px;
        line-height: 1;
        font-weight: 750;
      }

      .temp small {
        color: var(--liquid-text-muted);
        white-space: nowrap;
      }

      .section-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .card-section {
        min-width: 0;
        border-radius: 24px;
        padding: 15px;
      }

      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .section-title h2 {
        margin: 0;
        font-size: 17px;
        letter-spacing: 0;
      }

      .section-title span {
        width: 38px;
        height: 4px;
        border-radius: 999px;
        background: var(--accent-edge);
        box-shadow: 0 0 18px var(--accent-glow);
      }

      .tiles {
        display: grid;
        gap: 9px;
      }

      .tile {
        display: grid;
        grid-template-columns: 38px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        width: 100%;
        min-height: 64px;
        border-radius: 18px;
        padding: 10px;
        text-align: left;
      }

      .tile:hover,
      .climate:hover,
      .glass-command:hover,
      .mode-field:hover,
      .sheet-icon-button:hover,
      .settings-row:hover,
      .round-control:hover,
      .mode-segment button:hover {
        background: var(--liquid-fill-strong);
        transform: translateY(-1px);
      }

      .icon {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        color: var(--accent-icon);
        background:
          radial-gradient(circle at 30% 18%, rgba(255, 255, 255, .22), transparent 36%),
          rgba(255, 255, 255, .09);
        box-shadow: inset 0 0 0 1px var(--accent-edge), 0 0 24px var(--accent-glow);
      }

      .icon ha-icon {
        width: 20px;
        height: 20px;
      }

      .tile-copy {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .tile strong,
      .tile small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tile strong {
        font-size: 14px;
      }

      .tile small {
        color: var(--liquid-text-muted);
        font-size: 12px;
      }

      .sheet-scrim {
        position: fixed;
        inset: 0;
        z-index: 20;
        background: rgba(0, 0, 0, .34);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .settings-sheet {
        position: fixed;
        z-index: 21;
        left: 50%;
        bottom: 18px;
        width: min(560px, calc(100vw - 28px));
        max-height: min(760px, calc(100vh - 36px));
        overflow: auto;
        transform: translateX(-50%);
        border-radius: 30px;
        padding: 16px;
      }

      .sheet-header {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        gap: 10px;
        align-items: center;
        margin-bottom: 14px;
      }

      .sheet-header h2 {
        margin: 0;
        font-size: 28px;
        line-height: 1.05;
        letter-spacing: 0;
        text-align: center;
      }

      .sheet-header .eyebrow {
        margin-bottom: 4px;
        text-align: center;
      }

      .sheet-icon-button,
      .sheet-icon-spacer {
        width: 44px;
        height: 44px;
        border-radius: 50%;
      }

      .sheet-icon-button {
        display: grid;
        place-items: center;
        padding: 0;
      }

      .settings-groups {
        display: grid;
        gap: 16px;
      }

      .settings-group h3 {
        margin: 0 6px 8px;
        color: var(--liquid-text-soft);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .settings-list {
        display: grid;
        gap: 8px;
      }

      .settings-row {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 60px;
        border-radius: 18px;
        padding: 9px 12px;
        text-align: left;
      }

      .settings-row-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 13px;
        color: #d9ecff;
        background: rgba(255, 255, 255, .12);
      }

      .settings-row-copy {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .settings-row-copy strong,
      .settings-row-copy small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .settings-row-copy strong {
        font-size: 15px;
      }

      .settings-row-copy small {
        color: var(--liquid-text-muted);
        font-size: 12px;
      }

      .settings-row-chevron {
        color: var(--liquid-text-soft);
        width: 20px;
        height: 20px;
      }

      .settings-slider {
        width: 92px;
        height: 8px;
        border-radius: 999px;
        background:
          linear-gradient(90deg, rgba(111, 187, 255, .92) var(--value), rgba(255, 255, 255, .16) var(--value));
      }

      .climate-sheet {
        width: min(460px, calc(100vw - 28px));
      }

      .thermostat-dial {
        display: grid;
        place-items: center;
        width: min(260px, 68vw);
        aspect-ratio: 1;
        margin: 8px auto 18px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 34% 22%, rgba(255, 255, 255, .28), transparent 28%),
          radial-gradient(circle at 52% 68%, rgba(82, 166, 255, .34), transparent 46%),
          rgba(255, 255, 255, .10);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, .22),
          inset 0 -18px 38px rgba(0, 0, 0, .22),
          0 22px 60px rgba(0, 0, 0, .30);
      }

      .thermostat-dial span {
        font-size: 82px;
        line-height: .9;
        font-weight: 800;
      }

      .thermostat-dial small {
        margin-top: -34px;
        color: var(--liquid-text-muted);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .thermostat-current {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
        color: var(--liquid-text-muted);
      }

      .thermostat-current strong {
        color: #fff;
      }

      .thermostat-stepper {
        display: grid;
        grid-template-columns: repeat(2, 72px);
        justify-content: center;
        gap: 18px;
        margin-bottom: 18px;
      }

      .round-control {
        display: grid;
        place-items: center;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        padding: 0;
      }

      .round-control ha-icon {
        width: 30px;
        height: 30px;
      }

      .mode-segment {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
        gap: 8px;
        padding: 5px;
        border-radius: 18px;
        background: rgba(0, 0, 0, .20);
      }

      .mode-segment button {
        min-height: 42px;
        border-radius: 14px;
        padding: 0 10px;
        color: var(--liquid-text-muted);
      }

      .mode-segment button.active {
        color: #07111f;
        background: linear-gradient(180deg, rgba(255, 255, 255, .94), rgba(185, 221, 255, .78));
      }

      @media (max-width: 980px) {
        .section-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .surface {
          min-height: auto;
          border-radius: 0;
          margin: -8px;
          padding: 18px 12px 28px;
        }

        .hero {
          grid-template-columns: 1fr;
        }

        .hero-stack {
          grid-template-columns: 1fr 1fr;
          min-width: 0;
        }

        .section-grid {
          grid-template-columns: 1fr;
        }

        .climate {
          align-items: flex-start;
          flex-direction: column;
        }

        .settings-sheet {
          width: 100vw;
          max-height: 82vh;
          bottom: 0;
          border-radius: 28px 28px 0 0;
        }
      }
    `;
  }
}

if (!customElements.get("liquid-dashboard-card")) {
  customElements.define("liquid-dashboard-card", LiquidDashboardCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "liquid-dashboard-card",
  name: "Liquid Dashboard Card",
  description: "A Liquid Glass dashboard custom card for Home Assistant.",
});

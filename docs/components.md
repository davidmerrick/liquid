# Component Boundaries

Liquid should split into reusable pieces before it grows much further.

## Card Boundary

`LiquidDashboardCard` should stay thin:

- receive Lovelace config through `setConfig`
- receive Home Assistant runtime through `hass`
- translate taps into HA actions
- pass normalized state into presentational components

## Presentational Components

These are reusable outside Home Assistant:

- `LiquidSurface`
- `LiquidHero`
- `LiquidCommandButton`
- `LiquidModeSelect`
- `LiquidThermostatPanel`
- `LiquidSection`
- `LiquidTile`
- `LiquidSheet`
- `LiquidSettingsList`

## Home Assistant Adapters

These should be isolated:

- state lookup and friendly state formatting
- `more-info` event dispatch
- service calls
- Assist/intercom action dispatch
- mock-state fallback for demos


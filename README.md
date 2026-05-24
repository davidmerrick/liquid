# Liquid

Liquid is a Home Assistant custom-card experiment for iPad-first dashboards with a Liquid Glass interface.

It is being split into a reusable package:

- Home Assistant custom element wrapper
- Liquid section and tile primitives
- iOS-style settings sheets
- thermostat controls
- entity state adapters
- a mockable demo harness for portfolio use

## Usage

Load the card as a Lovelace resource:

```yaml
lovelace:
  resources:
    - url: /local/liquid/liquid-card.js
      type: js
```

Then use it in a dashboard:

```yaml
type: custom:liquid-dashboard-card
title: Home
home_mode_entity: input_select.home_mode
thermostat_entity: climate.thermostat
sections:
  - title: Security
    accent: blue
    tiles:
      - name: Front Door
        entity: lock.front_door
        icon: mdi:door-closed-lock
```

## Development

```bash
npm install
npm run check
npm run build
npm run demo
```

The demo uses mocked Home Assistant state so the visual system can be worked on outside a live HA instance.

## Extraction Plan

The first version keeps the custom card as one browser-loadable module. The next split should mirror Bubble Card's maintainable structure:

- `src/card/` for the Home Assistant custom-card lifecycle
- `src/components/` for Liquid UI primitives
- `src/theme/` for visual tokens
- `src/ha/` for entity state and service-call adapters
- `demo/` for portfolio screenshots and interaction demos

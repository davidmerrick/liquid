import "../src/liquid-card.js";

const card = document.querySelector("liquid-dashboard-card");

card.setConfig({
  title: "Liquid",
  heading: "Home",
  home_mode_entity: "input_select.home_mode",
  thermostat_entity: "climate.thermostat",
  settings_panels: [
    {
      id: "locks",
      title: "Locks",
      icon: "mdi:lock",
      summary: "Doors and secure rooms",
      groups: [
        {
          title: "Entry",
          rows: [
            { name: "Front Door", entity: "lock.front_door", icon: "mdi:door-closed-lock" },
            { name: "Garage", entity: "cover.garage", icon: "mdi:garage" },
          ],
        },
      ],
    },
  ],
  sections: [
    {
      title: "Security",
      accent: "blue",
      tiles: [
        { name: "Front Door", entity: "lock.front_door", icon: "mdi:door-closed-lock" },
        { name: "Garage", entity: "cover.garage", icon: "mdi:garage" },
      ],
    },
    {
      title: "Climate",
      accent: "green",
      tiles: [
        { name: "Living Room", entity: "sensor.living_room_temperature", icon: "mdi:thermometer" },
        { name: "Air Quality", entity: "sensor.air_quality", icon: "mdi:molecule-co2" },
      ],
    },
  ],
});

card.hass = {
  states: {
    "input_select.home_mode": { state: "Home" },
    "climate.thermostat": {
      state: "heat",
      attributes: { current_temperature: 71, temperature: 69, hvac_modes: ["heat", "cool", "off"] },
    },
    "lock.front_door": { state: "locked" },
    "cover.garage": { state: "closed" },
    "sensor.living_room_temperature": { state: "72", attributes: { unit_of_measurement: "°F" } },
    "sensor.air_quality": { state: "Good" },
  },
  callService(domain, service, data) {
    console.log("callService", { domain, service, data });
  },
};

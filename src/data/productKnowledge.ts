export const productKnowledge = {
  identity: "FORM 75 is a fictional premium 75% mechanical keyboard concept priced at $249.",
  construction: {
    case: "CNC-machined 6063 aluminium with a gasket mount",
    pcb: "Hot-swap PCB compatible with 5-pin MX switches",
    dampening: "Dedicated dampening layers between the plate, PCB, and lower case",
    knob: "CNC aluminium rotary knob",
    weight: "Approximately 1.7 kg",
  },
  finishes: ["Graphite", "Silver", "Sand"],
  keycaps: { material: "Double-shot PBT", variants: ["Obsidian", "Porcelain", "Ember"] },
  switches: {
    linear: "FORM Linear — 45 gf, smooth, 2.0 mm actuation",
    tactile: "FORM Tactile — 55 gf, defined tactile bump, 2.0 mm actuation",
    silent: "FORM Silent — 45 gf, dampened, 2.0 mm actuation",
  },
  connectivity: ["USB-C", "Bluetooth with multiple-device support", "2.4 GHz wireless"],
  battery: "4500 mAh; up to 120 hours with lighting off or 40 hours with moderate lighting",
  polling: "Up to 1000 Hz over USB-C and 2.4 GHz",
  compatibility: ["Windows", "macOS"],
  lighting: "South-facing per-key RGB, presented with restrained neutral and warm presets",
  layout: "75% with NKRO",
  configurator: "Case finish, PBT keycap set, FORM switch type, and backlight preset can be configured",
  price: "$249",
  faq: {
    gaming: "Yes. FORM 75 supports up to 1000 Hz polling over USB-C and 2.4 GHz.",
    hotSwap: "Yes. The PCB accepts 5-pin MX-compatible switches without soldering.",
    bluetooth: "Yes. It supports Bluetooth and can remember multiple devices.",
  },
} as const;

export const productKnowledgeText = JSON.stringify(productKnowledge, null, 2);

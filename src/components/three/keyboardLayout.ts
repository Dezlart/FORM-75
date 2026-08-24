import type { KeyDefinition } from "@/types/product";

const rows: KeyDefinition[][] = [
  ["Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"].map((label, index) => ({ label, width: 1, accent: index === 0 })),
  [{ label: "`", width: 1 }, ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="].map((label) => ({ label, width: 1 })), { label: "Backspace", width: 2 }],
  [{ label: "Tab", width: 1.5 }, ...["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"].map((label) => ({ label, width: 1 })), { label: "\\", width: 1.5 }],
  [{ label: "Caps", width: 1.75 }, ...["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"].map((label) => ({ label, width: 1 })), { label: "Enter", width: 2.25, accent: true }],
  [{ label: "Shift", width: 2.25 }, ...["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"].map((label) => ({ label, width: 1 })), { label: "Shift R", width: 1.75 }, { label: "↑", width: 1 }],
  [{ label: "Ctrl", width: 1.25 }, { label: "Win", width: 1.25 }, { label: "Alt", width: 1.25 }, { label: "Space", width: 6.25 }, { label: "Alt R", width: 1.25 }, { label: "Fn", width: 1.25 }, { label: "←", width: 1 }, { label: "↓", width: 1 }, { label: "→", width: 1 }],
];

const unit = 0.62;
const gap = 0.055;

export interface PositionedKey extends KeyDefinition {
  x: number;
  z: number;
  row: number;
}

export const keyboardKeys: PositionedKey[] = rows.flatMap((row, rowIndex) => {
  const totalWidth = row.reduce((total, key) => total + key.width * unit, 0) + (row.length - 1) * gap;
  let cursor = -totalWidth / 2;
  return row.map((key) => {
    const physicalWidth = key.width * unit;
    const positioned = { ...key, x: cursor + physicalWidth / 2, z: (rowIndex - 2.5) * 0.64, row: rowIndex };
    cursor += physicalWidth + gap;
    return positioned;
  });
});

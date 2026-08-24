"use client";

import { Instance, Instances, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  Group,
  LinearFilter,
  MathUtils,
  RedFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { keyboardKeys } from "./keyboardLayout";
import { useConfiguratorStore } from "@/stores/configurator";
import { requestSceneFrames, smoothstep, storyProgress } from "@/lib/storyProgress";
import type { CaseFinish, KeycapVariant } from "@/types/product";

const caseFinishes = {
  graphite: { color: "#454748", edge: "#252728", roughness: 0.3, clearcoat: 0.18 },
  silver: { color: "#bbb9b2", edge: "#777773", roughness: 0.25, clearcoat: 0.22 },
  sand: { color: "#a0876e", edge: "#695a4c", roughness: 0.34, clearcoat: 0.14 },
} as const;
const keyColors = { obsidian: "#27292a", porcelain: "#ddd9cf", ember: "#773a34" } as const;
const accentColors = { obsidian: "#8b8173", porcelain: "#9c6549", ember: "#bd7951" } as const;
const legendColors = { obsidian: "#d8d4ca", porcelain: "#393a39", ember: "#f0d9cc" } as const;
const lightColors = { neutral: "#f4f0df", warm: "#ffbd7a", ice: "#a9dbff" } as const;
const switchColors = { linear: "#a65f53", tactile: "#c6a45d", silent: "#678580" } as const;
const rowLift = [0.09, 0.07, 0.035, 0, -0.012, 0.025];
const rowTilt = [-0.105, -0.075, -0.035, 0, 0.035, 0.07];
const rowHeight = [1.08, 1.06, 1.02, 1, 1, 1.04];
const legendLabels = new Set(["Esc", "Tab", "Caps", "Shift", "Shift R", "Enter", "Backspace", "Ctrl", "Alt", "Alt R", "Fn", "Space", "↑", "←", "↓", "→"]);
const legendKeys = keyboardKeys.filter((key) => legendLabels.has(key.label));

type ModelVariant = "story" | "configurator";

function createRoughnessMap(size: number, base: number, variation: number, brushed = false) {
  const data = new Uint8Array(size * size);
  let seed = 75;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647 - 0.5) * variation;
      const grain = brushed ? Math.sin(y * 1.65) * variation * 0.16 : 0;
      data[y * size + x] = MathUtils.clamp(Math.round(base + noise + grain), 0, 255);
    }
  }
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(brushed ? 7 : 4, brushed ? 2 : 4);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const aluminiumRoughness = createRoughnessMap(64, 154, 18, true);
const pbtRoughness = createRoughnessMap(48, 205, 20);

function createKeycapGeometry() {
  const geometry = new RoundedBoxGeometry(0.585, 0.32, 0.585, 3, 0.052);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const heightRatio = MathUtils.clamp((y + 0.16) / 0.32, 0, 1);
    const taper = MathUtils.lerp(1.045, 0.89, heightRatio);
    positions.setX(index, positions.getX(index) * taper);
    positions.setZ(index, positions.getZ(index) * taper);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const apertureGeometry = new RoundedBoxGeometry(0.4, 0.022, 0.4, 2, 0.035);
const lowerSwitchGeometry = new RoundedBoxGeometry(0.38, 0.15, 0.38, 2, 0.045);
const upperSwitchGeometry = new RoundedBoxGeometry(0.32, 0.12, 0.32, 2, 0.035);
const stemHorizontalGeometry = new RoundedBoxGeometry(0.25, 0.12, 0.1, 2, 0.025);
const stemVerticalGeometry = new RoundedBoxGeometry(0.1, 0.12, 0.25, 2, 0.025);
const keycapGeometry = createKeycapGeometry();

let legendResources: { geometry: BufferGeometry; texture: CanvasTexture } | null = null;

function getLegendResources() {
  if (legendResources) return legendResources;
  if (typeof document === "undefined") return null;

  const columns = 4;
  const rows = Math.ceil(legendKeys.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  legendKeys.forEach((key, index) => {
    const label = key.label === "Shift R" ? "SHIFT" : key.label === "Alt R" ? "ALT" : key.label.toUpperCase();
    const column = index % columns;
    const row = Math.floor(index / columns);
    context.font = `${label.length > 5 ? 600 : 650} ${label.length > 5 ? 23 : 28}px Arial, sans-serif`;
    context.fillText(label, column * cellWidth + cellWidth / 2, row * cellHeight + cellHeight / 2);

    const width = Math.min(key.width * 0.38, 0.88);
    const height = 0.12;
    const angle = -Math.PI / 2 + rowTilt[key.row];
    const y = 0.174 + rowLift[key.row];
    const localCorners = [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ];
    localCorners.forEach(([localX, localY]) => {
      positions.push(key.x + localX, y + localY * Math.cos(angle), key.z + localY * Math.sin(angle));
    });

    const u0 = column / columns;
    const u1 = (column + 1) / columns;
    const v0 = 1 - (row + 1) / rows;
    const v1 = 1 - row / rows;
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    const vertex = index * 4;
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  legendResources = { geometry, texture };
  return legendResources;
}

function CaseMaterial({ finish, dark, edge = false }: { finish: CaseFinish; dark: boolean; edge?: boolean }) {
  const profile = caseFinishes[finish];
  const metalness = finish === "silver" ? (edge ? 0.64 : 0.54) : (edge ? 0.76 : 0.68);
  return (
    <meshPhysicalMaterial
      color={edge ? profile.edge : profile.color}
      metalness={metalness}
      roughness={profile.roughness + (edge ? 0.08 : 0.05)}
      roughnessMap={aluminiumRoughness}
      clearcoat={profile.clearcoat}
      clearcoatRoughness={0.38}
      anisotropy={0.2}
      anisotropyRotation={Math.PI / 2}
      envMapIntensity={dark ? 1.5 : 1.15}
    />
  );
}

function BottomCase({ groupRef, dark }: { groupRef: React.RefObject<Group | null>; dark: boolean }) {
  const finish = useConfiguratorStore((state) => state.caseFinish);
  return (
    <group ref={groupRef} position={[0, -0.36, 0]}>
      <RoundedBox args={[10.88, 0.62, 4.62]} radius={0.24} smoothness={5} castShadow receiveShadow>
        <CaseMaterial finish={finish} dark={dark} />
      </RoundedBox>
      <RoundedBox args={[10.66, 0.13, 4.39]} radius={0.16} smoothness={4} position={[0, 0.33, 0]}>
        <CaseMaterial finish={finish} dark={dark} edge />
      </RoundedBox>
      <RoundedBox args={[10.42, 0.14, 4.12]} radius={0.14} smoothness={4} position={[0, -0.35, 0]} castShadow>
        <meshPhysicalMaterial color="#202223" metalness={0.7} roughness={0.48} roughnessMap={aluminiumRoughness} envMapIntensity={0.8} />
      </RoundedBox>
      <RoundedBox args={[4.3, 0.035, 0.2]} radius={0.05} smoothness={2} position={[0, -0.43, 1.8]}>
        <meshStandardMaterial color="#0e0f10" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.74, 0.13, 0.12]} radius={0.035} smoothness={2} position={[0, 0.02, -2.31]}>
        <meshStandardMaterial color="#111314" metalness={0.25} roughness={0.62} />
      </RoundedBox>
    </group>
  );
}

function Battery({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  return (
    <group ref={groupRef} position={[0, -0.2, 0.65]}>
      <RoundedBox args={[4.2, 0.18, 1.7]} radius={0.1} smoothness={3} castShadow>
        <meshStandardMaterial color="#303537" metalness={0.12} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[2.15, 0.018, 0.5]} radius={0.025} smoothness={2} position={[0, 0.101, 0]}>
        <meshStandardMaterial color="#8a918e" metalness={0.18} roughness={0.56} />
      </RoundedBox>
      <mesh position={[2.18, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.28, 18]} />
        <meshStandardMaterial color="#c7ad62" metalness={0.62} roughness={0.4} />
      </mesh>
    </group>
  );
}

function PCB({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  return (
    <group ref={groupRef} position={[0, -0.08, 0]}>
      <RoundedBox args={[10.08, 0.12, 4.02]} radius={0.11} smoothness={3} castShadow>
        <meshStandardMaterial color="#204238" metalness={0.22} roughness={0.61} />
      </RoundedBox>
      {[-1.3, -0.45, 0.4, 1.25].map((z, index) => (
        <mesh key={z} position={[index % 2 ? 0.35 : -0.25, 0.066, z]} rotation={[-Math.PI / 2, 0, index % 2 ? 0.025 : -0.02]}>
          <planeGeometry args={[8.65, 0.025]} />
          <meshBasicMaterial color="#c3a45d" />
        </mesh>
      ))}
    </group>
  );
}

function Dampening({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  return (
    <group ref={groupRef} position={[0, 0.04, 0]}>
      <RoundedBox args={[9.95, 0.12, 3.88]} radius={0.12} smoothness={3} castShadow>
        <meshStandardMaterial color="#303436" roughness={0.98} roughnessMap={pbtRoughness} />
      </RoundedBox>
    </group>
  );
}

function Plate({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  return (
    <group ref={groupRef} position={[0, 0.16, 0]}>
      <RoundedBox args={[10.1, 0.1, 4.04]} radius={0.12} smoothness={3} castShadow>
        <meshStandardMaterial color="#92928e" metalness={0.8} roughness={0.37} roughnessMap={aluminiumRoughness} envMapIntensity={1.1} />
      </RoundedBox>
      <Instances limit={keyboardKeys.length} geometry={apertureGeometry} position={[0, 0.061, 0]}>
        <meshStandardMaterial color="#242728" roughness={0.76} />
        {keyboardKeys.map((key) => <Instance key={`${key.label}-${key.x}`} position={[key.x, 0, key.z]} />)}
      </Instances>
    </group>
  );
}

function Knob({ finish, dark }: { finish: CaseFinish; dark: boolean }) {
  const profile = caseFinishes[finish];
  return (
    <group position={[4.66, 0.41, -1.68]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.355, 0.365, 0.4, 64, 2]} />
        <meshPhysicalMaterial color={finish === "graphite" ? "#aaa9a3" : profile.edge} metalness={0.98} roughness={0.2} roughnessMap={aluminiumRoughness} anisotropy={0.42} envMapIntensity={dark ? 2.2 : 1.75} />
      </mesh>
      {[-0.145, -0.07, 0.005, 0.08, 0.155].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.356, 0.008, 5, 64]} />
          <meshStandardMaterial color="#2c2e2f" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.207, 0]}>
        <cylinderGeometry args={[0.29, 0.34, 0.026, 64]} />
        <meshPhysicalMaterial color="#bab9b3" metalness={0.96} roughness={0.17} envMapIntensity={1.9} />
      </mesh>
      <mesh position={[0, -0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.37, 0.46, 64]} />
        <meshStandardMaterial color="#17191a" metalness={0.48} roughness={0.54} />
      </mesh>
    </group>
  );
}

function TopCase({ groupRef, dark }: { groupRef: React.RefObject<Group | null>; dark: boolean }) {
  const finish = useConfiguratorStore((state) => state.caseFinish);
  const rails = [
    { args: [10.88, 0.3, 0.34] as [number, number, number], position: [0, 0.12, -2.14] as [number, number, number] },
    { args: [10.88, 0.3, 0.34] as [number, number, number], position: [0, 0.12, 2.14] as [number, number, number] },
    { args: [0.36, 0.3, 3.98] as [number, number, number], position: [-5.26, 0.12, 0] as [number, number, number] },
    { args: [0.36, 0.3, 3.98] as [number, number, number], position: [5.26, 0.12, 0] as [number, number, number] },
  ];
  return (
    <group ref={groupRef} position={[0, 0.25, 0]}>
      {rails.map((rail, index) => (
        <RoundedBox key={index} args={rail.args} position={rail.position} radius={0.13} smoothness={4} castShadow receiveShadow>
          <CaseMaterial finish={finish} dark={dark} />
        </RoundedBox>
      ))}
      <RoundedBox args={[10.3, 0.045, 3.94]} radius={0.08} smoothness={3} position={[0, -0.015, 0]} receiveShadow>
        <meshPhysicalMaterial color="#1b1d1e" metalness={0.34} roughness={0.56} envMapIntensity={0.7} />
      </RoundedBox>
      <Knob finish={finish} dark={dark} />
    </group>
  );
}

function SwitchLayer({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  const switchType = useConfiguratorStore((state) => state.switchType);
  return (
    <group ref={groupRef} position={[0, 0.47, 0]}>
      <Instances limit={keyboardKeys.length} geometry={lowerSwitchGeometry} castShadow>
        <meshStandardMaterial color={switchColors[switchType]} roughness={0.46} transparent opacity={0.94} />
        {keyboardKeys.map((key) => <Instance key={`${key.label}-${key.x}`} position={[key.x, -0.035, key.z]} />)}
      </Instances>
      <Instances limit={keyboardKeys.length} geometry={upperSwitchGeometry} castShadow>
        <meshStandardMaterial color="#d8d4ca" roughness={0.32} transparent opacity={0.76} envMapIntensity={1.1} />
        {keyboardKeys.map((key) => <Instance key={`${key.label}-${key.x}`} position={[key.x, 0.095, key.z]} />)}
      </Instances>
      {[stemHorizontalGeometry, stemVerticalGeometry].map((geometry, layer) => (
        <Instances key={layer} limit={keyboardKeys.length} geometry={geometry} castShadow>
          <meshStandardMaterial color={switchColors[switchType]} roughness={0.4} />
          {keyboardKeys.map((key) => <Instance key={`${key.label}-${key.x}`} position={[key.x, 0.205, key.z]} />)}
        </Instances>
      ))}
    </group>
  );
}

function LegendLayer({ keycaps }: { keycaps: KeycapVariant }) {
  const resources = getLegendResources();
  if (!resources) return null;
  return (
    <mesh geometry={resources.geometry} renderOrder={2}>
      <meshBasicMaterial map={resources.texture} color={legendColors[keycaps]} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function KeycapLayer({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  const keycaps = useConfiguratorStore((state) => state.keycaps);
  const backlight = useConfiguratorStore((state) => state.backlight);
  const preset = useConfiguratorStore((state) => state.backlightPreset);
  return (
    <group ref={groupRef} position={[0, 0.73, 0]}>
      <Instances limit={keyboardKeys.length} geometry={keycapGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          roughness={0.76}
          roughnessMap={pbtRoughness}
          metalness={0.01}
          emissive={backlight ? lightColors[preset] : "#000000"}
          emissiveIntensity={backlight ? 0.055 : 0}
          envMapIntensity={0.62}
        />
        {keyboardKeys.map((key) => (
          <Instance
            key={`${key.label}-${key.x}`}
            position={[key.x, rowLift[key.row], key.z]}
            rotation={[rowTilt[key.row], 0, 0]}
            scale={[key.width * 1.02, rowHeight[key.row], 1]}
            color={key.accent ? accentColors[keycaps] : keyColors[keycaps]}
          />
        ))}
      </Instances>
      <LegendLayer keycaps={keycaps} />
    </group>
  );
}

function dampLayer(group: Group | null, base: number, distance: number, exploded: number, motionFactor: number, delta: number) {
  if (group) group.position.y = MathUtils.damp(group.position.y, base + distance * exploded * motionFactor, 6, delta);
}

export function KeyboardModel({ variant, dark, mobile }: { variant: ModelVariant; dark: boolean; mobile: boolean }) {
  const root = useRef<Group>(null);
  const bottom = useRef<Group>(null);
  const battery = useRef<Group>(null);
  const pcb = useRef<Group>(null);
  const dampening = useRef<Group>(null);
  const plate = useRef<Group>(null);
  const topCase = useRef<Group>(null);
  const switches = useRef<Group>(null);
  const keycaps = useRef<Group>(null);
  const motionFactor = useRef(1);

  useEffect(() => {
    if (variant !== "story") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      motionFactor.current = query.matches ? 0.5 : 1;
      requestSceneFrames("story", 240);
    };
    update();
    const legacyQuery = query as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    if (typeof query.addEventListener === "function") query.addEventListener("change", update);
    else legacyQuery.addListener?.(update);
    return () => {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", update);
      else legacyQuery.removeListener?.(update);
    };
  }, [variant]);

  useFrame((_, delta) => {
    if (!root.current) return;
    if (variant === "configurator") return;

    const progress = storyProgress.current;
    const explodeIn = smoothstep(0.27, 0.48, progress);
    const reassemble = smoothstep(0.9, 0.99, progress);
    const exploded = explodeIn * (1 - reassemble);
    const explodedComposition = smoothstep(0.29, 0.38, progress) * (1 - smoothstep(0.57, 0.65, progress));
    const switchStage = smoothstep(0.68, 0.76, progress) * (1 - smoothstep(0.91, 0.98, progress));
    const internalsVisible = exploded > 0.003 && switchStage < 0.35;
    if (battery.current) battery.current.visible = internalsVisible;
    if (pcb.current) pcb.current.visible = internalsVisible;
    if (dampening.current) dampening.current.visible = internalsVisible;
    if (plate.current) plate.current.visible = internalsVisible;
    if (switches.current) switches.current.visible = internalsVisible;

    dampLayer(bottom.current, -0.36, -0.62, exploded, motionFactor.current, delta);
    dampLayer(battery.current, -0.2, 0.22, exploded, motionFactor.current, delta);
    dampLayer(pcb.current, -0.08, 0.72, exploded, motionFactor.current, delta);
    dampLayer(dampening.current, 0.04, 1.15, exploded, motionFactor.current, delta);
    dampLayer(plate.current, 0.16, 1.62, exploded, motionFactor.current, delta);
    dampLayer(topCase.current, 0.25, 1.88, exploded, motionFactor.current, delta);
    dampLayer(switches.current, 0.47, 2.35, exploded, motionFactor.current, delta);
    dampLayer(keycaps.current, 0.73, 2.98, exploded, motionFactor.current, delta);

    const designTurn = smoothstep(0.1, 0.26, progress);
    const highAngle = smoothstep(0.28, 0.55, progress);
    const returnHome = smoothstep(0.91, 0.99, progress);
    const targetX = MathUtils.lerp(-0.1 - highAngle * 0.5, -0.1, returnHome);
    const targetY = MathUtils.lerp(-0.16 + designTurn * 0.16 + highAngle * 0.18, -0.16, returnHome);
    const baseX = mobile ? 0.1 : 5.2;
    const composedX = MathUtils.lerp(baseX - explodedComposition * (mobile ? 0.55 : 2.45), baseX, returnHome);
    const switchX = mobile ? -2.8 : -4.7;
    const baseY = mobile ? -1.48 : -0.62;
    const baseScale = mobile ? 0.49 : 0.64;
    root.current.rotation.x = MathUtils.damp(root.current.rotation.x, targetX, 4.5, delta);
    root.current.rotation.y = MathUtils.damp(root.current.rotation.y, targetY, 4.5, delta);
    root.current.position.x = MathUtils.damp(root.current.position.x, MathUtils.lerp(composedX, switchX, switchStage), 5, delta);
    root.current.position.y = MathUtils.damp(root.current.position.y, baseY - exploded * 0.72, 5, delta);
    root.current.scale.setScalar(MathUtils.damp(root.current.scale.x, baseScale * (1 - switchStage * 0.86), 5, delta));
  });

  return (
    <group
      ref={root}
      position={variant === "configurator" ? [0, -0.38, 0] : [mobile ? 0.1 : 5.2, mobile ? -1.48 : -0.62, 0]}
      rotation={variant === "configurator" ? [-0.12, -0.18, 0] : [-0.1, -0.16, 0]}
      scale={variant === "configurator" ? (mobile ? 0.56 : 0.7) : (mobile ? 0.49 : 0.64)}
      dispose={null}
    >
      <BottomCase groupRef={bottom} dark={dark} />
      {variant === "story" && <Battery groupRef={battery} />}
      {variant === "story" && <PCB groupRef={pcb} />}
      {variant === "story" && <Dampening groupRef={dampening} />}
      <Plate groupRef={plate} />
      <TopCase groupRef={topCase} dark={dark} />
      {variant === "story" && <SwitchLayer groupRef={switches} />}
      <KeycapLayer groupRef={keycaps} />
    </group>
  );
}

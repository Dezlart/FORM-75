"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import {
  AdditiveBlending, Color, DataTexture, DoubleSide, Group, LinearFilter,
  MathUtils, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, RGBAFormat,
  Texture, UnsignedByteType, Vector3,
} from "three";
import { getStoryLightingIntensity, storyProgress, type SceneVariant } from "@/lib/storyProgress";
import { useConfiguratorStore } from "@/stores/configurator";
import { keyboardKeys } from "./keyboardLayout";

const lightColors = { neutral: "#efd49b", warm: "#ff8842", ice: "#58b8f4" } as const;
// Direct light has a pale core; reflected light on the caps carries the hue.
const sourceColors = { neutral: "#fff0cf", warm: "#ffbc7c", ice: "#a0d9ff" } as const;
const deckWidth = 10.3;
const deckDepth = 3.94;
const deckGlowGeometry = new PlaneGeometry(deckWidth, deckDepth);
const switchSpillGeometry = new PlaneGeometry(0.44, 0.34);
const southLed = new Vector3(0, -0.155, 0.2);

// A filled, feathered source footprint: no cap-shaped ring or luminous PBT edge.
function createSpillMap() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      const feather = Math.min(1, Math.max(0, (1 - radius) / 0.3));
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(Math.exp(-3.5 * radius * radius) * feather * feather * 255);
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
const spillMap = createSpillMap();

function createDeckGlowMap() {
  const width = 512;
  const height = 192;
  const pixels = new Uint8Array(width * height * 4);
  // The Gaussian is separable: exp(x + z) = exp(x) * exp(z). Precompute
  // each axis instead of evaluating millions of exponentials on module load.
  const footprints = keyboardKeys.map((key) => ({
    x: Float64Array.from({ length: width }, (_, x) => {
      const deckX = ((x + 0.5) / width - 0.5) * deckWidth;
      const dx = Math.max(0, Math.abs(deckX - key.x) - key.width * 0.22);
      return Math.exp(-2.4 * (dx / 0.43) ** 2);
    }),
    z: Float64Array.from({ length: height }, (_, y) => {
      const deckZ = (0.5 - (y + 0.5) / height) * deckDepth;
      const dz = deckZ - key.z - 0.06;
      return Math.exp(-2.4 * (dz / 0.46) ** 2);
    }),
  }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const deckX = ((x + 0.5) / width - 0.5) * deckWidth;
      const deckZ = (0.5 - (y + 0.5) / height) * deckDepth;
      const edgeDistance = Math.min(deckWidth / 2 - Math.abs(deckX), deckDepth / 2 - Math.abs(deckZ));
      const edge = MathUtils.smoothstep(edgeDistance, 0, 0.045);
      let irradiance = 0;
      for (const footprint of footprints) {
        // Overlapping pools spread from beneath each cap. Wider keys illuminate
        // their full underside; unused deck areas do not become a solid sheet.
        irradiance += footprint.x[x] * footprint.z[y];
      }
      const offset = (y * width + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(edge * (1 - Math.exp(-irradiance * 1.8)) * 255);
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const deckGlowMap = createDeckGlowMap();
const switchSpillMatrices = new Float32Array(keyboardKeys.length * 16);
const flatRotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
keyboardKeys.forEach((key, index) => {
  new Matrix4().compose(new Vector3(key.x, southLed.y, key.z + southLed.z), flatRotation, new Vector3(1, 1, 1)).toArray(switchSpillMatrices, index * 16);
});

function lightingIntensity(variant: SceneVariant, enabled: boolean) {
  return enabled ? (variant === "story" ? getStoryLightingIntensity(storyProgress.current) : 1) : 0;
}

export function RgbLighting({ variant, deckGroup, switchGroup }: {
  variant: SceneVariant;
  deckGroup: RefObject<Group | null>;
  switchGroup: RefObject<Group | null>;
}) {
  const root = useRef<Group>(null);
  const deck = useRef<Group>(null);
  const deckGlow = useRef<MeshBasicMaterial>(null);
  const switchSpill = useRef<MeshBasicMaterial>(null);
  const enabled = useConfiguratorStore((state) => state.backlight);
  const preset = useConfiguratorStore((state) => state.backlightPreset);
  const color = lightColors[preset];

  useFrame(() => {
    const intensity = lightingIntensity(variant, enabled);
    // TopCase's deck ends at local y=0.0075. Keep light on that surface,
    // below the caps and rim, rather than intersecting their sidewalls.
    const deckY = (deckGroup.current?.position.y ?? 0.25) + 0.0105;
    const switchY = switchGroup.current?.position.y ?? 0.47;
    const assembledLedGap = 0.47 + southLed.y - 0.2605;
    const separation = Math.max(0, switchY + southLed.y - deckY - assembledLedGap);
    const separated = MathUtils.smoothstep(separation, 0.06, 0.42);
    if (root.current) root.current.visible = intensity > 0.001;
    if (deck.current) deck.current.position.y = deckY - switchY;
    if (deckGlow.current) deckGlow.current.opacity = 0.92 * intensity * (1 - separated * 0.35);
    // Per-switch spill only becomes legible when the switch layer separates.
    // In the assembled board it cannot resolve into a row of bright dots.
    if (switchSpill.current) switchSpill.current.opacity = 0.22 * intensity * MathUtils.lerp(0.025, 1, separated);
  });

  return (
    <group ref={root} visible={enabled}>
      <group ref={deck} position={[0, -0.2095, 0]}>
        <mesh geometry={deckGlowGeometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial ref={deckGlow} map={deckGlowMap} color={sourceColors[preset]} transparent opacity={0.92} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <instancedMesh args={[switchSpillGeometry, undefined, keyboardKeys.length]}>
        <instancedBufferAttribute attach="instanceMatrix" args={[switchSpillMatrices, 16]} />
        <meshBasicMaterial ref={switchSpill} map={spillMap} color={color} transparent opacity={0.24} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </instancedMesh>
    </group>
  );
}

export function KeycapMaterial({ roughnessMap, variant }: { roughnessMap: Texture; variant: SceneVariant }) {
  const enabled = useConfiguratorStore((state) => state.backlight);
  const preset = useConfiguratorStore((state) => state.backlightPreset);
  const keycaps = useConfiguratorStore((state) => state.keycaps);
  const uniforms = useRef({
    rgbColor: { value: new Color(lightColors[preset]) },
    rgbPower: { value: 0 },
    rgbMaterialResponse: { value: keycaps === "porcelain" ? 0 : 1 },
  });
  useFrame(() => {
    uniforms.current.rgbColor.value.set(lightColors[preset]);
    uniforms.current.rgbPower.value = lightingIntensity(variant, enabled) * 0.48;
    uniforms.current.rgbMaterialResponse.value = keycaps === "porcelain" ? 0 : 1;
  });
  return (
    <meshStandardMaterial
      roughness={0.76}
      roughnessMap={roughnessMap}
      metalness={0.01}
      envMapIntensity={0.62}
      customProgramCacheKey={() => "form75-keycap-underside-spill-v2"}
      onBeforeCompile={(shader) => {
        Object.assign(shader.uniforms, uniforms.current);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vKeycapPosition;\nvarying vec3 vKeycapNormal;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKeycapPosition = position;\nvKeycapNormal = normal;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 rgbColor;\nuniform float rgbPower;\nuniform float rgbMaterialResponse;\nvarying vec3 vKeycapPosition;\nvarying vec3 vKeycapNormal;")
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
            float keycapLowerHalf = 1.0 - smoothstep(-0.14, 0.075, vKeycapPosition.y);
            float keycapSide = pow(1.0 - abs(normalize(vKeycapNormal).y), 0.72);
            // Pigmented plastic absorbs the spill instead of emitting a pale
            // coating. Preserve the approved Porcelain response, including accents.
            vec3 spillReflectance = mix(vec3(1.0), vec3(0.04) + diffuseColor.rgb * 0.96, rgbMaterialResponse);
            totalEmissiveRadiance += rgbColor * rgbPower * keycapLowerHalf * keycapSide * spillReflectance;
          `);
      }}
    />
  );
}

export function SwitchHousingMaterial({ variant, lower = false }: { variant: SceneVariant; lower?: boolean }) {
  const enabled = useConfiguratorStore((state) => state.backlight);
  const preset = useConfiguratorStore((state) => state.backlightPreset);
  const uniforms = useRef({ rgbColor: { value: new Color(lightColors[preset]) }, rgbPower: { value: 0 }, ledY: { value: lower ? 0.01 : -0.12 } });
  useFrame(() => {
    uniforms.current.rgbColor.value.set(lightColors[preset]);
    uniforms.current.rgbPower.value = lightingIntensity(variant, enabled) * (lower ? 0.42 : 0.68);
  });
  return (
    <meshStandardMaterial
      color={lower ? "#959d97" : "#b8c0ba"} roughness={lower ? 0.5 : 0.4} envMapIntensity={0.9}
      customProgramCacheKey={() => `form75-switch-led-spill-v3-${lower ? "lower" : "upper"}`}
      onBeforeCompile={(shader) => {
        Object.assign(shader.uniforms, uniforms.current);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vLedPosition;\nvarying vec3 vLedNormal;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLedPosition = position;\nvLedNormal = normal;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 rgbColor;\nuniform float rgbPower;\nuniform float ledY;\nvarying vec3 vLedPosition;\nvarying vec3 vLedNormal;")
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
            vec3 ledDirection = vec3(0.0, ledY, 0.215) - vLedPosition;
            float ledFacing = 0.18 + 0.82 * max(0.0, dot(normalize(vLedNormal), normalize(ledDirection)));
            float ledFalloff = exp(-7.5 * length(ledDirection)) * ledFacing;
            totalEmissiveRadiance += rgbColor * rgbPower * ledFalloff * 0.65;
          `);
      }}
    />
  );
}

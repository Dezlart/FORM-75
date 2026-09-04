"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, MathUtils } from "three";
import { requestSceneFrames, smoothstep, storyProgress } from "@/lib/storyProgress";
import { useConfiguratorStore } from "@/stores/configurator";
import { playSwitchClick } from "@/lib/switchSound";

const switchColors = { linear: "#b86255", tactile: "#d1aa59", silent: "#658681" } as const;

export function SwitchModel({ mobile }: { mobile: boolean }) {
  const root = useRef<Group>(null);
  const stem = useRef<Group>(null);
  const switchType = useConfiguratorStore((state) => state.switchType);
  const pressed = useConfiguratorStore((state) => state.switchPressed);
  const setPressed = useConfiguratorStore((state) => state.setSwitchPressed);

  useFrame(({ clock }, delta) => {
    if (!root.current || !stem.current) return;
    const progress = storyProgress.current;
    const visible = smoothstep(0.68, 0.76, progress) * (1 - smoothstep(0.91, 0.98, progress));
    root.current.scale.setScalar(1.65 * visible);
    root.current.rotation.y = -0.28 + Math.sin(clock.elapsedTime * 0.32) * 0.055;
    root.current.visible = visible > 0.01;
    stem.current.position.y = MathUtils.damp(stem.current.position.y, pressed ? 0.13 : 0.48, 13, delta);
  });

  return (
    <group
      ref={root}
      position={[0, -0.55, 0]}
      rotation={[-0.14, -0.28, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        playSwitchClick(switchType);
        setPressed(true);
        requestSceneFrames("story", 420);
      }}
      onPointerUp={() => { setPressed(false); requestSceneFrames("story", 320); }}
      onPointerOut={() => { setPressed(false); requestSceneFrames("story", 320); }}
    >
      <RoundedBox args={[2.48, 0.66, 2.48]} radius={0.16} smoothness={5} position={[0, -0.3, 0]} castShadow>
        {mobile
          ? <meshStandardMaterial color="#ddd8cf" roughness={0.37} transparent opacity={0.97} envMapIntensity={1.1} />
          : <meshPhysicalMaterial color="#ddd8cf" roughness={0.37} clearcoat={0.08} transparent opacity={0.97} envMapIntensity={1.1} />}
      </RoundedBox>
      <RoundedBox args={[2.2, 0.84, 2.2]} radius={0.13} smoothness={5} position={[0, 0.36, 0]} castShadow>
        {mobile
          ? <meshStandardMaterial color="#d4d8d5" roughness={0.25} transparent opacity={0.72} envMapIntensity={1.2} />
          : <meshPhysicalMaterial color="#d4d8d5" roughness={0.2} clearcoat={0.16} transparent opacity={0.68} envMapIntensity={1.45} />}
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.12, 0.18, 0]}>
          <RoundedBox args={[0.16, 0.46, 1.18]} radius={0.045} smoothness={2}>
            {mobile
              ? <meshStandardMaterial color="#b8bdbb" roughness={0.34} transparent opacity={0.84} />
              : <meshPhysicalMaterial color="#b8bdbb" roughness={0.3} clearcoat={0.1} transparent opacity={0.82} />}
          </RoundedBox>
          <RoundedBox args={[0.12, 0.18, 0.48]} radius={0.035} smoothness={2} position={[side * 0.08, -0.02, 0]}>
            <meshStandardMaterial color="#777d7b" metalness={0.12} roughness={0.5} />
          </RoundedBox>
        </group>
      ))}
      <group ref={stem} position={[0, 0.48, 0]}>
        <RoundedBox args={[0.78, 0.62, 0.78]} radius={0.085} smoothness={4} castShadow>
          {mobile
            ? <meshStandardMaterial color={switchColors[switchType]} roughness={0.36} />
            : <meshPhysicalMaterial color={switchColors[switchType]} roughness={0.36} clearcoat={0.12} clearcoatRoughness={0.4} />}
        </RoundedBox>
        <RoundedBox args={[0.3, 0.22, 0.92]} radius={0.04} smoothness={2} position={[0, 0.4, 0]}>
          <meshStandardMaterial color={switchColors[switchType]} roughness={0.38} />
        </RoundedBox>
        <RoundedBox args={[0.92, 0.22, 0.3]} radius={0.04} smoothness={2} position={[0, 0.4, 0]}>
          <meshStandardMaterial color={switchColors[switchType]} roughness={0.38} />
        </RoundedBox>
      </group>
      <mesh position={[0, -0.61, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.58, 28]} />
        <meshStandardMaterial color="#c6a36c" metalness={0.84} roughness={0.28} envMapIntensity={1.25} />
      </mesh>
      {[-0.54, 0.54].map((x) => (
        <mesh key={x} position={[x, -0.83, 0.2]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.72, 16]} />
          <meshStandardMaterial color="#caa86d" metalness={0.9} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

"use client";

/* eslint-disable react-hooks/immutability -- R3F owns the canvas; its native input surface is configured alongside imperative frame updates. */

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Camera, Group, MathUtils, Vector3 } from "three";
import { getStorySwitchStage, isSceneDebugEnabled, storyProgress } from "@/lib/storyProgress";
import { useConfiguratorStore } from "@/stores/configurator";
import { advanceSwitchMotion, createSwitchMotion } from "@/lib/switchMotion";
import { useSwitchPress } from "@/lib/useSwitchPress";

const switchColors = { linear: "#b86255", tactile: "#d1aa59", silent: "#658681" } as const;
const switchBoundsCorners = [-1.34, 1.34].flatMap((x) => (
  [-1.19, 0.99].flatMap((y) => [-1.24, 1.24].map((z) => new Vector3(x, y, z)))
));

function placeSwitch(group: Group, anchor: Vector3, centerOffset: Vector3, scale: number) {
  centerOffset.set(0, -0.1, 0).applyQuaternion(group.quaternion).multiplyScalar(scale);
  group.position.copy(anchor).sub(centerOffset);
  group.scale.setScalar(scale);
  group.updateMatrix();
}

function fitSwitchToViewport(group: Group, camera: Camera, mobile: boolean, visibility: number, scratch: {
  anchor: Vector3;
  ray: Vector3;
  centerOffset: Vector3;
  corner: Vector3;
  centerY: number;
}) {
  // Compose against the current camera before rendering, including portrait
  // desktop/tablet viewports that still have the text column on the right.
  camera.updateMatrixWorld();
  const { anchor, ray, centerOffset, corner } = scratch;
  ray.set(mobile ? 0 : -0.4, mobile ? 0.3 : 1 - 2 * scratch.centerY, 0.5).unproject(camera).sub(camera.position);
  if (Math.abs(ray.z) < 0.00001) return;
  anchor.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);

  let scale = 1.65;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    placeSwitch(group, anchor, centerOffset, scale);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const source of switchBoundsCorners) {
      corner.copy(source).applyMatrix4(group.matrix).project(camera);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }
    const fit = Math.min(
      (mobile ? 1.72 : 0.86) / (maxX - minX),
      (mobile ? 0.8 : 1.3) / (maxY - minY),
      1,
    );
    if (fit >= 0.999) break;
    scale *= fit * 0.98;
  }
  // The existing entrance/exit timing stays tied to story progress. Fitting the
  // full-size pose first prevents resizing from cancelling that reveal.
  placeSwitch(group, anchor, centerOffset, scale * visibility);
}

export function SwitchModel({ mobile }: { mobile: boolean }) {
  const root = useRef<Group>(null);
  const stem = useRef<Group>(null);
  const { camera, gl, invalidate } = useThree();
  const composition = useRef({ anchor: new Vector3(), ray: new Vector3(), centerOffset: new Vector3(), corner: new Vector3(), centerY: 0.52 });
  const motion = useRef(createSwitchMotion(useConfiguratorStore.getState().switchPressSequence));
  const reducedMotion = useRef(false);
  const debug = useRef(isSceneDebugEnabled());
  const { pressPointer, releasePointer } = useSwitchPress();
  const switchType = useConfiguratorStore((state) => state.switchType);

  useEffect(() => {
    if (mobile) return;
    const copy = document.querySelector<HTMLElement>(".switch-panel .story-copy");
    if (!copy) return;
    // Measure only when layout changes, never during scrolling. Match the
    // text's resting center even in tall windows and after a locale change.
    const update = () => {
      const top = Number.parseFloat(window.getComputedStyle(copy).top) || 0;
      composition.current.centerY = MathUtils.clamp((top + copy.offsetHeight / 2) / window.innerHeight, 0.25, 0.7);
      invalidate();
    };
    const observer = new ResizeObserver(update);
    observer.observe(copy);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [invalidate, mobile]);

  useEffect(() => {
    const canvas = gl.domElement;
    const shell = canvas.closest<HTMLElement>(".canvas-story");
    const touchAction = canvas.style.touchAction;
    const pointerEvents = shell?.style.pointerEvents ?? "";
    const cursor = canvas.style.cursor;
    canvas.style.touchAction = "pan-y";
    return () => {
      canvas.style.touchAction = touchAction;
      canvas.style.cursor = cursor;
      if (shell) shell.style.pointerEvents = pointerEvents;
    };
  }, [gl]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = query.matches; invalidate(); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [invalidate]);

  useFrame((_, delta) => {
    if (!root.current || !stem.current) return;
    const progress = storyProgress.current;
    const visible = getStorySwitchStage(progress);
    root.current.visible = visible > 0.01;
    if (root.current.visible) fitSwitchToViewport(root.current, camera, mobile, visible, composition.current);
    const { switchPressed, switchPressSequence } = useConfiguratorStore.getState();
    const stroke = advanceSwitchMotion(motion.current, switchPressSequence, switchPressed, delta, reducedMotion.current);
    stem.current.position.y = MathUtils.lerp(0.48, 0.13, stroke.travel);
    const shell = gl.domElement.closest<HTMLElement>(".canvas-story");
    if (shell) {
      shell.style.pointerEvents = visible > 0.5 ? "auto" : "none";
      if (visible <= 0.5) gl.domElement.style.cursor = "";
      if (debug.current) {
        shell.dataset.switchTravel = stroke.travel.toFixed(4);
        shell.dataset.switchPressed = String(switchPressed);
        shell.dataset.switchPressSequence = String(switchPressSequence);
        shell.dataset.switchMotion = stroke.active ? "active" : "settled";
      }
    }
    if (stroke.active) invalidate();
  });

  return (
    <group
      ref={root}
      visible={false}
      rotation={[-0.14, -0.28, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button !== 0 || !pressPointer(event.pointerId)) return;
        const target = event.target;
        if (target && "setPointerCapture" in target && typeof target.setPointerCapture === "function") target.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => releasePointer(event.pointerId)}
      onPointerCancel={(event) => releasePointer(event.pointerId)}
      onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      onPointerOver={() => { gl.domElement.style.cursor = "pointer"; }}
      onPointerOut={() => { gl.domElement.style.cursor = ""; }}
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

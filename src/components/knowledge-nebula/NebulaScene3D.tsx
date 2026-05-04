import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KnowledgeNebulaTopic, KnowledgeNebulaTopicSlug } from "../../data/knowledge-nebula.ts";
import { buildStarFieldLayers } from "../../lib/knowledge-nebula-mother-cloud.ts";
import type {
  KnowledgeNebulaCameraState,
  KnowledgeNebulaClusterAnchor,
  KnowledgeNebulaViewport,
} from "../../lib/knowledge-nebula-field.ts";
import {
  getKnowledgeNebulaDprBudget,
  getKnowledgeNebulaSceneFrameIntervalMs,
  getKnowledgeNebulaStarCountBudget,
} from "../../lib/knowledge-nebula-performance.ts";
import { usePagePerformanceState } from "../../lib/page-performance.ts";
import { NebulaStarField } from "./NebulaStarField.tsx";

type NebulaScene3DProps = {
  anchors: KnowledgeNebulaClusterAnchor[];
  accentBySlug: Partial<
    Record<KnowledgeNebulaTopicSlug, KnowledgeNebulaTopic["accent"]>
  >;
  phase: number;
  focusedTopicSlug?: KnowledgeNebulaTopicSlug;
  viewport: KnowledgeNebulaViewport;
  cameraState: KnowledgeNebulaCameraState;
};

function CameraRig({
  cameraState,
  phase,
  isFocused,
  isVisible,
}: {
  cameraState: KnowledgeNebulaCameraState;
  phase: number;
  isFocused: boolean;
  isVisible: boolean;
}) {
  const { camera } = useThree();
  const currentLookAtRef = useRef(new THREE.Vector3(...cameraState.target));
  const targetLookAtRef = useRef(new THREE.Vector3(...cameraState.target));
  const currentPositionRef = useRef(new THREE.Vector3(...cameraState.position));
  const targetPositionRef = useRef(new THREE.Vector3(...cameraState.position));
  const isFirstSyncRef = useRef(true);
  const previousFrameTimeRef = useRef(0);

  useEffect(() => {
    targetPositionRef.current.set(...cameraState.position);
    targetLookAtRef.current.set(...cameraState.target);

    if (isFirstSyncRef.current) {
      currentPositionRef.current.copy(targetPositionRef.current);
      currentLookAtRef.current.copy(targetLookAtRef.current);
      camera.position.copy(currentPositionRef.current);
      camera.lookAt(currentLookAtRef.current);
      isFirstSyncRef.current = false;
    }
  }, [camera, cameraState]);

  useFrame((state) => {
    if (!isVisible) {
      return;
    }

    const elapsedMs = state.clock.elapsedTime * 1000;
    const frameIntervalMs = getKnowledgeNebulaSceneFrameIntervalMs({
      isFocused,
      isVisible,
    });

    if (elapsedMs - previousFrameTimeRef.current < frameIntervalMs) {
      return;
    }

    previousFrameTimeRef.current = elapsedMs;
    const settle = 0.07 + THREE.MathUtils.clamp(phase, 0, 1) * 0.05;

    currentPositionRef.current.lerp(targetPositionRef.current, settle);
    currentLookAtRef.current.lerp(targetLookAtRef.current, settle);
    camera.position.copy(currentPositionRef.current);
    camera.lookAt(currentLookAtRef.current);
  });

  return null;
}

function NebulaContent({
  phase,
  viewport,
  cameraState,
  focusedTopicSlug,
}: NebulaScene3DProps) {
  const { isVisible, prefersReducedMotion } = usePagePerformanceState();
  const isFocused = Boolean(focusedTopicSlug);
  const starLayers = useMemo(
    () =>
      buildStarFieldLayers(
        viewport,
        getKnowledgeNebulaStarCountBudget({ viewport, isFocused }),
      ),
    [viewport, isFocused],
  );
  const starSpeedScale = isVisible && !prefersReducedMotion ? 1 : 0;

  return (
    <>
      <AdaptiveDpr pixelated />
      <fog attach="fog" args={["#04030d", 8, viewport === "mobile" ? 18 : 25]} />
      <CameraRig
        cameraState={cameraState}
        phase={phase}
        isFocused={isFocused}
        isVisible={isVisible}
      />

      <ambientLight intensity={0.72} color="#f5d0fe" />
      <directionalLight position={[5, 7, 8]} intensity={0.85} color="#bae6fd" />
      <pointLight position={[0, 0.2, 4.5]} intensity={1.35} color="#fff7ff" />

      <NebulaStarField layers={starLayers} speedScale={starSpeedScale} />
    </>
  );
}

export function NebulaScene3D(props: NebulaScene3DProps) {
  const { isVisible, prefersReducedMotion } = usePagePerformanceState();
  const dpr = getKnowledgeNebulaDprBudget({
    viewport: props.viewport,
    isVisible,
    prefersReducedMotion,
  });

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={dpr}
        frameloop="demand"
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{
          position: props.cameraState.position,
          fov: props.viewport === "mobile" ? 42 : 38,
          near: 0.1,
          far: 40,
        }}
      >
        <DemandCanvasKickoff />
        <NebulaContent {...props} />
      </Canvas>
    </div>
  );
}

function DemandCanvasKickoff() {
  const { invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  return null;
}

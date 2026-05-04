import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import type {
  TopicDetailSceneMeta,
  TopicDetailViewport,
} from "../../lib/knowledge-nebula-topic-detail-scene.ts";
import {
  getKnowledgeNebulaDprBudget,
  getKnowledgeNebulaSceneFrameIntervalMs,
  getTopicDetailSceneComplexityBudget,
} from "../../lib/knowledge-nebula-performance.ts";
import { usePagePerformanceState } from "../../lib/page-performance.ts";

type TopicDetailScene3DProps = {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
  viewport: TopicDetailViewport;
  className?: string;
};

type NebulaInstance = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: THREE.Color;
};

type SpectralTube = {
  geometry: THREE.TubeGeometry;
  color: string;
  opacity: number;
};

const H_ALPHA_COLOR = "#ff5f98";
const OIII_COLOR = "#61f4ff";
const SII_COLOR = "#ffb15f";
const VIOLET_EDGE_COLOR = "#a58cff";
const DUST_CORE_COLOR = "#01030a";

function createSeedFromTopic(topicSlug: string) {
  return topicSlug.split("").reduce((seed, char, index) => {
    return (seed * 31 + char.charCodeAt(0) + index) >>> 0;
  }, 17);
}

function createMulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSoftBandTexture({ width = 96, height = 24 } = {}) {
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = Math.abs((x / (width - 1)) * 2 - 1);
      const normalizedY = Math.abs((y / (height - 1)) * 2 - 1);
      const longFalloff = Math.max(0, 1 - normalizedX ** 2.2);
      const shortFalloff = Math.max(0, 1 - normalizedY ** 1.4);
      const value = Math.round(255 * longFalloff * shortFalloff);

      data[y * width + x] = value;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RedFormat);
  texture.needsUpdate = true;

  return texture;
}

function createEmissionFilaments({
  topicSlug,
  nodeCount,
  meta,
  count,
}: {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
  count: number;
}) {
  const random = createMulberry32(
    createSeedFromTopic(topicSlug) + Math.round(nodeCount * 157),
  );
  const topicColor = new THREE.Color(meta.coreGlowColor);
  const palette = [
    new THREE.Color(H_ALPHA_COLOR),
    new THREE.Color(OIII_COLOR),
    new THREE.Color(SII_COLOR),
    new THREE.Color(VIOLET_EDGE_COLOR),
  ];
  const filaments: NebulaInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const band = index / count;
    const arm = index % 5;
    const angle =
      band * Math.PI * 5.2 + arm * 0.74 + Math.sin(band * 12) * 0.22;
    const radius = 0.72 + Math.sin(band * Math.PI) * 2.35 + random() * 3.15;
    const x = Math.cos(angle) * radius * (0.96 + random() * 0.18);
    const y = Math.sin(angle * 0.86) * radius * 0.46 + (random() - 0.5) * 1.45;
    const z = -2.2 + random() * 3.9 + Math.sin(angle * 1.3) * 0.62;
    const color = palette[index % palette.length]
      .clone()
      .lerp(topicColor, 0.12 + random() * 0.22)
      .lerp(new THREE.Color("#ffffff"), random() * 0.08);

    filaments.push({
      position: [x, y, z],
      scale: [
        1.7 + random() * 3.9,
        0.075 + random() * 0.2,
        1,
      ],
      rotation: [
        0.12 + (random() - 0.5) * 0.62,
        (random() - 0.5) * 0.72,
        angle + Math.PI / 2 + (random() - 0.5) * 0.5,
      ],
      color,
    });
  }

  return filaments;
}

function createSpectralEmissionLines({
  topicSlug,
  nodeCount,
  meta,
}: {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
}) {
  const random = createMulberry32(
    createSeedFromTopic(`${topicSlug}-spectral`) + Math.round(nodeCount * 193),
  );
  const topicColor = new THREE.Color(meta.coreGlowColor);
  const palette = [
    new THREE.Color(H_ALPHA_COLOR),
    new THREE.Color(OIII_COLOR),
    new THREE.Color(SII_COLOR),
    new THREE.Color(VIOLET_EDGE_COLOR),
  ];

  return Array.from({ length: 18 }, (_, index): NebulaInstance => {
    const band = index / 17;
    const angle = -0.72 + band * 1.34 + Math.sin(index * 1.9) * 0.18;
    const x = -4.3 + band * 8.6;
    const y = Math.sin(band * Math.PI * 2.1) * 1.15;
    const z = -0.6 + (index % 4) * 0.28;
    const color = palette[index % palette.length].clone().lerp(topicColor, 0.1);

    return {
      position: [x, y, z],
      scale: [2.2 + (index % 3) * 0.9, 0.032 + (index % 2) * 0.018, 1],
      rotation: [0.05, 0.12, angle],
      color,
    };
  });
}

function createSpectralTubes({
  topicSlug,
  nodeCount,
  meta,
  count,
}: {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
  count: number;
}) {
  const random = createMulberry32(
    createSeedFromTopic(`${topicSlug}-tube`) + Math.round(nodeCount * 211),
  );
  const topicColor = new THREE.Color(meta.coreGlowColor);
  const palette = [H_ALPHA_COLOR, OIII_COLOR, SII_COLOR, VIOLET_EDGE_COLOR];

  return Array.from({ length: count }, (_, index): SpectralTube => {
    const band = count <= 1 ? 0 : index / (count - 1);
    const arm = index % 4;
    const baseAngle = band * Math.PI * 2.8 + arm * 0.58;
    const radius = 0.95 + Math.sin(band * Math.PI) * 1.95 + random() * 0.92;
    const points = Array.from({ length: 7 }, (_, pointIndex) => {
      const t = pointIndex / 6;
      const angle = baseAngle + (t - 0.5) * (0.9 + random() * 0.45);
      const wave = Math.sin(t * Math.PI * 2 + index) * 0.28;

      return new THREE.Vector3(
        Math.cos(angle) * (radius + wave) * 0.98,
        Math.sin(angle * 0.82) * (radius + wave) * 0.46 +
          (t - 0.5) * 0.64 -
          0.28,
        -1.8 + random() * 1.8 + Math.sin(angle * 1.2) * 0.28,
      );
    });
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(
      curve,
      36,
      0.006 + random() * 0.01,
      5,
      false,
    );
    const color = new THREE.Color(palette[index % palette.length])
      .lerp(topicColor, 0.18)
      .lerp(new THREE.Color("#dcefff"), 0.1)
      .getStyle();

    return {
      geometry,
      color,
      opacity: 0.045 + random() * 0.09,
    };
  });
}

function createDustLanes({
  topicSlug,
  nodeCount,
  count,
}: {
  topicSlug: string;
  nodeCount: number;
  count: number;
}) {
  const random = createMulberry32(
    createSeedFromTopic(`${topicSlug}-dust`) + Math.round(nodeCount * 83),
  );
  const lanes: NebulaInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const band = index / count;
    const angle = -0.82 + band * 1.42 + (random() - 0.5) * 0.28;
    const x = -4.9 + band * 9.6 + (random() - 0.5) * 1.5;
    const y = Math.sin(band * Math.PI * 2.2) * 0.9 + (random() - 0.5) * 1.15;
    const z = 1.7 + random() * 1.8;

    lanes.push({
      position: [x, y, z],
      scale: [2.9 + random() * 3.2, 0.08 + random() * 0.18, 1],
      rotation: [
        (random() - 0.5) * 0.18,
        (random() - 0.5) * 0.18,
        angle,
      ],
      color: new THREE.Color(DUST_CORE_COLOR).lerp(
        new THREE.Color("#070d18"),
        random() * 0.35,
      ),
    });
  }

  return lanes;
}

function createStarGeometry({
  topicSlug,
  nodeCount,
  meta,
  starCount,
}: {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
  starCount: number;
}) {
  const random = createMulberry32(
    createSeedFromTopic(topicSlug) + Math.round(nodeCount * 97),
  );
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const color = new THREE.Color();
  const baseColor = new THREE.Color(meta.coreGlowColor);
  const white = new THREE.Color(1, 1, 1);

  for (let index = 0; index < starCount; index += 1) {
    const radius = 7 + random() * 14;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 2 - 1);
    const offset = index * 3;

    positions[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[offset + 1] = Math.cos(phi) * radius * 0.72;
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius - 2;

    color.copy(baseColor).lerp(white, 0.46 + random() * 0.34);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geometry;
}

function createCoreStarGeometry(meta: TopicDetailSceneMeta) {
  const geometry = new THREE.BufferGeometry();
  const count = 122;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = createMulberry32(4129);
  const coreColor = new THREE.Color(meta.coreGlowColor);
  const white = new THREE.Color("#ffffff");

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = random() ** 1.8 * 0.95;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius * 1.35;
    positions[offset + 1] = Math.sin(angle) * radius * 0.58;
    positions[offset + 2] = (random() - 0.5) * 1.35;

    coreColor.clone().lerp(white, 0.45 + random() * 0.4).toArray(colors, offset);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geometry;
}

function writeInstances({
  mesh,
  instances,
}: {
  mesh: THREE.InstancedMesh | null;
  instances: NebulaInstance[];
}) {
  if (!mesh) {
    return;
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const rotation = new THREE.Euler();
  const scale = new THREE.Vector3();

  instances.forEach((instance, index) => {
    rotation.set(...instance.rotation);
    quaternion.setFromEuler(rotation);
    scale.set(...instance.scale);
    matrix.compose(new THREE.Vector3(...instance.position), quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, instance.color);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

function DriftGroup({
  topicSlug,
  nodeCount,
  meta,
  viewport,
  starCount,
  isFocused,
  isVisible,
  complexityBudget,
}: {
  topicSlug: string;
  nodeCount: number;
  meta: TopicDetailSceneMeta;
  viewport: TopicDetailViewport;
  starCount: number;
  isFocused: boolean;
  isVisible: boolean;
  complexityBudget: {
    emissionFilaments: number;
    spectralTubes: number;
    dustLanes: number;
    starCount: number;
  };
}) {
  const { invalidate } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const emissionRef = useRef<THREE.InstancedMesh>(null);
  const spectralRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointsMaterialRef = useRef<THREE.PointsMaterial>(null);
  const coreMaterialRef = useRef<THREE.PointsMaterial>(null);
  const previousFrameTimeRef = useRef(0);

  const softBandTexture = useMemo(() => createSoftBandTexture(), []);
  const emissionFilamentGeometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, 10, 1),
    [],
  );
  const dustLaneGeometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, 8, 1),
    [],
  );
  const emissionMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        alphaMap: softBandTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.28,
        side: THREE.DoubleSide,
        toneMapped: false,
        vertexColors: true,
      }),
    [softBandTexture],
  );
  const dustMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        alphaMap: softBandTexture,
        color: "#02040b",
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        opacity: 0.58,
        side: THREE.DoubleSide,
        toneMapped: false,
        vertexColors: true,
      }),
    [softBandTexture],
  );
  const emissionFilaments = useMemo(
    () =>
      createEmissionFilaments({
        topicSlug,
        nodeCount,
        meta,
        count: complexityBudget.emissionFilaments,
      }),
    [complexityBudget.emissionFilaments, meta, nodeCount, topicSlug],
  );
  const spectralEmissionLines = useMemo(
    () => createSpectralEmissionLines({ topicSlug, nodeCount, meta }),
    [meta, nodeCount, topicSlug],
  );
  const spectralTubes = useMemo(
    () =>
      createSpectralTubes({
        topicSlug,
        nodeCount,
        meta,
        count: complexityBudget.spectralTubes,
      }),
    [complexityBudget.spectralTubes, meta, nodeCount, topicSlug],
  );
  const dustLanes = useMemo(
    () =>
      createDustLanes({
        topicSlug,
        nodeCount,
        count: complexityBudget.dustLanes,
      }),
    [complexityBudget.dustLanes, nodeCount, topicSlug],
  );
  const starGeometry = useMemo(
    () => createStarGeometry({ topicSlug, nodeCount, meta, starCount }),
    [meta, nodeCount, starCount, topicSlug],
  );
  const coreStarGeometry = useMemo(() => createCoreStarGeometry(meta), [meta]);

  useEffect(() => {
    return () => {
      softBandTexture.dispose();
      emissionFilamentGeometry.dispose();
      dustLaneGeometry.dispose();
      emissionMaterial.dispose();
      dustMaterial.dispose();
      starGeometry.dispose();
      coreStarGeometry.dispose();
      spectralTubes.forEach((tube) => tube.geometry.dispose());
      ringRef.current?.geometry.dispose();
      ringMaterialRef.current?.dispose();
      pointsMaterialRef.current?.dispose();
      coreMaterialRef.current?.dispose();
    };
  }, [
    coreStarGeometry,
    dustLaneGeometry,
    dustMaterial,
    emissionFilamentGeometry,
    emissionMaterial,
    softBandTexture,
    spectralTubes,
    starGeometry,
  ]);

  useEffect(() => {
    writeInstances({ mesh: emissionRef.current, instances: emissionFilaments });
  }, [emissionFilaments]);

  useEffect(() => {
    writeInstances({ mesh: spectralRef.current, instances: spectralEmissionLines });
  }, [spectralEmissionLines]);

  useEffect(() => {
    writeInstances({ mesh: dustRef.current, instances: dustLanes });
  }, [dustLanes]);

  useFrame((state) => {
    const elapsedMs = state.clock.elapsedTime * 1000;
    const frameIntervalMs = getKnowledgeNebulaSceneFrameIntervalMs({
      isFocused,
      isVisible,
    });

    if (elapsedMs - previousFrameTimeRef.current < frameIntervalMs) {
      return;
    }

    previousFrameTimeRef.current = elapsedMs;
    if (isVisible) {
      invalidate();
    }

    const elapsed = state.clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(elapsed * 0.055) * 0.07;
      groupRef.current.rotation.x = Math.cos(elapsed * 0.04) * 0.04;
      groupRef.current.position.z = Math.sin(elapsed * 0.08) * 0.16;
      groupRef.current.position.y = -0.56 + Math.cos(elapsed * 0.05) * 0.04;
      groupRef.current.position.z = -0.9 + Math.sin(elapsed * 0.08) * 0.16;
    }

    if (emissionRef.current) {
      emissionRef.current.rotation.y = Math.sin(elapsed * 0.035) * 0.12;
      emissionRef.current.rotation.z = elapsed * 0.008;
    }

    if (dustRef.current) {
      dustRef.current.rotation.y = Math.sin(elapsed * 0.03) * -0.06;
      dustRef.current.rotation.z = -elapsed * 0.004;
    }

    if (spectralRef.current) {
      spectralRef.current.rotation.y = Math.sin(elapsed * 0.032) * 0.08;
      spectralRef.current.rotation.z = elapsed * 0.005;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.027;
      ringRef.current.rotation.x = 1.08 + Math.sin(elapsed * 0.07) * 0.035;
    }

    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = 0.16 + Math.sin(elapsed * 0.55) * 0.022;
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.z = elapsed * 0.011;
      pointsRef.current.rotation.y = Math.sin(elapsed * 0.025) * 0.08;
    }

    if (coreRef.current) {
      coreRef.current.rotation.z = -elapsed * 0.028;
      coreRef.current.rotation.y = Math.sin(elapsed * 0.08) * 0.12;
    }

    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.opacity = 0.55;
      pointsMaterialRef.current.size = 0.02 + Math.sin(elapsed * 0.45) * 0.002;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = 0.62;
      coreMaterialRef.current.size = 0.06 + Math.sin(elapsed * 0.9) * 0.006;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.32} color={meta.coreGlowColor} />
      <pointLight position={[0, 0.6, 4.8]} intensity={1.15} color={H_ALPHA_COLOR} />
      <pointLight position={[-5.4, 2.6, 1.8]} intensity={0.86} color={OIII_COLOR} />
      <pointLight position={[5.2, -2.2, 2.4]} intensity={0.66} color={SII_COLOR} />
      <fog attach="fog" args={["#020510", 8, 34]} />

      <IonizedGasLayer
        emissionRef={emissionRef}
        emissionFilamentGeometry={emissionFilamentGeometry}
        material={emissionMaterial}
        count={emissionFilaments.length}
      />
      <SpectralEmissionLines
        spectralRef={spectralRef}
        emissionFilamentGeometry={emissionFilamentGeometry}
        material={emissionMaterial}
        count={spectralEmissionLines.length}
      />
      <SpectralFilamentTubes tubes={spectralTubes} maxVisible={complexityBudget.spectralTubes} />
      <DarkDustLane
        dustRef={dustRef}
        dustLaneGeometry={dustLaneGeometry}
        material={dustMaterial}
        count={dustLanes.length}
      />
      <DenseCoreCluster
        coreRef={coreRef}
        coreMaterialRef={coreMaterialRef}
        coreStarGeometry={coreStarGeometry}
        meta={meta}
      />
      <YoungStarCluster
        pointsRef={pointsRef}
        pointsMaterialRef={pointsMaterialRef}
        starGeometry={starGeometry}
      />
      <ShockFrontArc ringRef={ringRef} ringMaterialRef={ringMaterialRef} meta={meta} />
    </group>
  );
}

function IonizedGasLayer({
  emissionRef,
  emissionFilamentGeometry,
  material,
  count,
}: {
  emissionRef: RefObject<THREE.InstancedMesh | null>;
  emissionFilamentGeometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  count: number;
}) {
  return (
    <instancedMesh
      ref={emissionRef}
      args={[emissionFilamentGeometry, material, count]}
      renderOrder={2}
    />
  );
}

function SpectralEmissionLines({
  spectralRef,
  emissionFilamentGeometry,
  material,
  count,
}: {
  spectralRef: RefObject<THREE.InstancedMesh | null>;
  emissionFilamentGeometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  count: number;
}) {
  return (
    <instancedMesh
      ref={spectralRef}
      args={[emissionFilamentGeometry, material, count]}
      renderOrder={3}
    />
  );
}

function SpectralFilamentTubes({
  tubes,
  maxVisible,
}: {
  tubes: SpectralTube[];
  maxVisible: number;
}) {
  return (
    <group renderOrder={4}>
      {tubes.slice(0, maxVisible).map((tube, index) => (
        <mesh
          key={`spectral-tube-${index}`}
          geometry={tube.geometry}
          rotation={[0.04, Math.sin(index) * 0.08, Math.cos(index * 0.7) * 0.05]}
        >
          <meshBasicMaterial
            color={tube.color}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={tube.opacity}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function DarkDustLane({
  dustRef,
  dustLaneGeometry,
  material,
  count,
}: {
  dustRef: RefObject<THREE.InstancedMesh | null>;
  dustLaneGeometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  count: number;
}) {
  return (
    <instancedMesh
      ref={dustRef}
      args={[dustLaneGeometry, material, count]}
      renderOrder={5}
    />
  );
}

function DenseCoreCluster({
  coreRef,
  coreMaterialRef,
  coreStarGeometry,
  meta,
}: {
  coreRef: RefObject<THREE.Points | null>;
  coreMaterialRef: RefObject<THREE.PointsMaterial | null>;
  coreStarGeometry: THREE.BufferGeometry;
  meta: TopicDetailSceneMeta;
}) {
  return (
    <group position={meta.corePosition} renderOrder={6}>
      <points ref={coreRef} geometry={coreStarGeometry}>
        <pointsMaterial
          ref={coreMaterialRef}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          size={0.074}
          sizeAttenuation
          opacity={0.92}
        />
      </points>
    </group>
  );
}

function YoungStarCluster({
  pointsRef,
  pointsMaterialRef,
  starGeometry,
}: {
  pointsRef: RefObject<THREE.Points | null>;
  pointsMaterialRef: RefObject<THREE.PointsMaterial | null>;
  starGeometry: THREE.BufferGeometry;
}) {
  return (
    <points ref={pointsRef} geometry={starGeometry} renderOrder={1}>
      <pointsMaterial
        ref={pointsMaterialRef}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        size={0.02}
        sizeAttenuation
        opacity={0.82}
      />
    </points>
  );
}

function ShockFrontArc({
  ringRef,
  ringMaterialRef,
  meta,
}: {
  ringRef: RefObject<THREE.Mesh | null>;
  ringMaterialRef: RefObject<THREE.MeshBasicMaterial | null>;
  meta: TopicDetailSceneMeta;
}) {
  return (
    <mesh
      ref={ringRef}
      rotation={[1.08, 0.12, 0.12]}
      scale={[1.8, 0.58, 0.18]}
      renderOrder={4}
    >
      <torusGeometry args={[4.15, 0.018, 8, 260]} />
      <meshBasicMaterial
        ref={ringMaterialRef}
        color={meta.coreGlowColor}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.16}
      />
    </mesh>
  );
}

export function TopicDetailScene3D({
  topicSlug,
  nodeCount,
  meta,
  viewport,
  className,
}: TopicDetailScene3DProps) {
  const { isVisible, prefersReducedMotion } = usePagePerformanceState();
  const isFocused = true;
  const complexityBudget = getTopicDetailSceneComplexityBudget({
    viewport,
    isVisible,
    prefersReducedMotion: Boolean(prefersReducedMotion),
  });
  const dpr = getKnowledgeNebulaDprBudget({
    viewport,
    isVisible,
    prefersReducedMotion: Boolean(prefersReducedMotion),
  });

  return (
    <div className={["absolute inset-0", className].filter(Boolean).join(" ")}>
      <Canvas
        dpr={dpr}
        frameloop="demand"
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{
          position: [0, 0.25, viewport === "mobile" ? 11.4 : 10.2],
          fov: viewport === "mobile" ? 48 : 42,
          near: 0.1,
          far: 70,
        }}
      >
        <AdaptiveDpr pixelated />
        <DriftGroup
          topicSlug={topicSlug}
          nodeCount={nodeCount}
          meta={meta}
          viewport={viewport}
          starCount={complexityBudget.starCount}
          isFocused={isFocused}
          isVisible={isVisible}
          complexityBudget={complexityBudget}
        />
      </Canvas>
    </div>
  );
}

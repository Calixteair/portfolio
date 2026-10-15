import { Canvas } from '@react-three/fiber';

/** Root of the 3D island. Empty scene for now: proves Astro → React → R3F wiring. */
export default function Experience() {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 32, position: [0, 0, 3.3] }}>
      <color attach="background" args={['#050302']} />
      <mesh>
        <boxGeometry args={[0.6, 0.9, 0.08]} />
        <meshNormalMaterial />
      </mesh>
    </Canvas>
  );
}

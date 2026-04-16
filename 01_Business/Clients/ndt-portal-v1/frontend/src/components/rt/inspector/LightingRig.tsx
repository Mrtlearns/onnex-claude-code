export function LightingRig() {
  return (
    <>
      <ambientLight color={0x445566} intensity={1.0} />
      <directionalLight
        color={0xffffff}
        intensity={1.0}
        position={[10, 15, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
      />
      <directionalLight color={0x00aaff} intensity={0.4} position={[-10, -5, -10]} />
      <directionalLight color={0x00d4ff} intensity={0.3} position={[0, 0, -15]} />
    </>
  );
}

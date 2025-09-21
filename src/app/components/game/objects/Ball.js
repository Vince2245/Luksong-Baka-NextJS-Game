import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Ball({ ballState }) {
  const ballRef = useRef();
  const shadowRef = useRef();

  useFrame(() => {
    if (!ballRef.current) return;
    ballRef.current.position.set(ballState.x, ballState.y, ballState.z);
    shadowRef.current.position.set(ballState.x, 0.05, ballState.z);
  });

  return (
    <>
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshStandardMaterial color="black" opacity={0.5} transparent />
      </mesh>
    </>
  );
}
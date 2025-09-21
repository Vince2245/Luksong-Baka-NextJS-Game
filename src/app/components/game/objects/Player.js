import { PLAYER_HEIGHT } from "../config";
import { Text } from "@react-three/drei";

export default function Player({ position, color, name }) {
  return (
    <mesh position={[position[0], PLAYER_HEIGHT / 2, position[2]]}>
      <cylinderGeometry args={[0.3, 0.3, PLAYER_HEIGHT, 16]} />
      <meshStandardMaterial color={color} />
      {name && (
        <Text
          position={[0, PLAYER_HEIGHT / 2 + 0.5, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      )}
    </mesh>
  );
}
import { useThree } from "@react-three/fiber";

export default function FixedCamera() {
  const camera = useThree((state) => state.camera);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  return null;
}
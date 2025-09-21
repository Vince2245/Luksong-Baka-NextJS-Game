import { COURT_LENGTH, COURT_WIDTH } from "../config";

export default function CourtLines() {
  const lineThickness = 0.05;
  return (
    <>
      <mesh position={[0, 0.03, -COURT_WIDTH / 2]}>
        <boxGeometry args={[COURT_LENGTH, 0.02, lineThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.03, COURT_WIDTH / 2]}>
        <boxGeometry args={[COURT_LENGTH, 0.02, lineThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-COURT_LENGTH / 2, 0.03, 0]}>
        <boxGeometry args={[lineThickness, 0.02, COURT_WIDTH]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[COURT_LENGTH / 2, 0.03, 0]}>
        <boxGeometry args={[lineThickness, 0.02, COURT_WIDTH]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </>
  );
}
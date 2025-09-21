import { useEffect, useState } from "react";

export default function useKeyboard() {
  const [keys, setKeys] = useState({});

  useEffect(() => {
    const downHandler = (e) => setKeys((prev) => ({ ...prev, [e.key]: true }));
    const upHandler = (e) => setKeys((prev) => ({ ...prev, [e.key]: false }));

    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);

    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, []);

  return { keys };
}

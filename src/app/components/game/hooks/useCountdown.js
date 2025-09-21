import { useEffect, useState } from "react";

export default function useCountdown(initial) {
  const [countdown, setCountdown] = useState(initial);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return { countdown, reset: () => setCountdown(initial) };
}

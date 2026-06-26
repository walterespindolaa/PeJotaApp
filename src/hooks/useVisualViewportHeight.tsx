import { useState, useEffect } from "react";

export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) {
      const onResize = () => setHeight(window.innerHeight);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const update = () => setHeight(vv.height);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}

import { useEffect, useRef } from "react";
import twemoji from "@twemoji/api";

export default function Twemoji({ emoji, size = 20 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      twemoji.parse(ref.current, {
        folder: "svg",
        ext: ".svg",
        base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
      });
    }
  }, [emoji]);

  return (
    <span
      ref={ref}
      style={{ display: "inline-flex", alignItems: "center" }}
      className="twemoji-wrap"
    >
      {emoji}
    </span>
  );
}

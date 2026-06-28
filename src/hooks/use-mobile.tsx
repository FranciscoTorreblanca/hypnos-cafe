import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Mobile detection that is orientation-agnostic.
 * We compare the SHORTEST viewport edge against the breakpoint so that
 * a phone rotated to landscape (e.g. 800×394) still resolves as mobile,
 * and a tablet/desktop in portrait stays on the desktop layout.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const compute = () => {
      const shortest = Math.min(window.innerWidth, window.innerHeight);
      setIsMobile(shortest < MOBILE_BREAKPOINT);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  return !!isMobile;
}

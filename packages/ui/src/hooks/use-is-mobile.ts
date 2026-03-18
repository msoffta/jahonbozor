import { useEffect, useState } from "react";

/** Tailwind `md` breakpoint — below this is considered mobile */
const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
        const onChange = () => setIsMobile(mql.matches);
        onChange();
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return isMobile;
}

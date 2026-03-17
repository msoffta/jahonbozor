import { useEffect, useState } from "react";

export function useDeferredReady(delay = 150): boolean {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setIsReady(true), delay);
		return () => clearTimeout(timer);
	}, [delay]);

	return isReady;
}

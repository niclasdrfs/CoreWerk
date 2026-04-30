import { Link, LinkProps } from "react-router-dom";
import { useCallback, useRef } from "react";

interface PrefetchLinkProps extends LinkProps {
  onPrefetch?: () => void | Promise<void>;
  prefetchDelay?: number;
}

export function PrefetchLink({
  onPrefetch,
  prefetchDelay = 100,
  children,
  ...props
}: PrefetchLinkProps) {
  const prefetchedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (prefetchedRef.current || !onPrefetch) return;

    timeoutRef.current = setTimeout(() => {
      if (!prefetchedRef.current) {
        prefetchedRef.current = true;
        onPrefetch();
      }
    }, prefetchDelay);
  }, [onPrefetch, prefetchDelay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleFocus = useCallback(() => {
    if (prefetchedRef.current || !onPrefetch) return;
    prefetchedRef.current = true;
    onPrefetch();
  }, [onPrefetch]);

  return (
    <Link
      {...props}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
    >
      {children}
    </Link>
  );
}

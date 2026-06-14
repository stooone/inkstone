import { useState, useEffect, useRef } from 'preact/hooks';
import { Tracker } from '/src/store/meteor-mock';

/**
 * useReactive(getValue, deps?)
 * Runs getValue() inside a Tracker.autorun and re-renders on dependency changes.
 */
export function useReactive(getValue, deps = []) {
  const [value, setValue] = useState(() => getValue());
  const compRef = useRef(null);

  useEffect(() => {
    // Clean up previous computation
    if (compRef.current) compRef.current.invalidate();

    compRef.current = Tracker.autorun(() => {
      const v = getValue();
      setValue(v);
    });

    return () => {
      if (compRef.current) {
        compRef.current.stop && compRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

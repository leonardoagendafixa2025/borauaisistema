import { ReactNode, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
}

const ScrollReveal = forwardRef<HTMLDivElement, Props>(function ScrollReveal(
  { children, className = '', delay = 0 },
  forwardedRef
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={innerRef}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        filter: visible ? 'blur(0)' : 'blur(4px)',
        transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
});

export default ScrollReveal;

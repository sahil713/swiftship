import { forwardRef, useEffect, useRef, useState } from "react";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Muted, looping background video that only plays while on screen and never
 * autoplays for visitors who ask for reduced motion.
 */
const BackgroundVideo = forwardRef(function BackgroundVideo({ src, className, playOnHover = false, style, label }, forwardedRef) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || prefersReducedMotion()) return;
    if (playOnHover) {
      const host = video.parentElement;
      const play = () => video.play().catch(() => {});
      const pause = () => video.pause();
      host.addEventListener("mouseenter", play);
      host.addEventListener("mouseleave", pause);
      // Touch devices have no hover – play while visible instead.
      const coarse = window.matchMedia("(hover: none)").matches;
      let io;
      if (coarse) {
        io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause()), { threshold: 0.5 });
        io.observe(video);
      }
      return () => {
        host.removeEventListener("mouseenter", play);
        host.removeEventListener("mouseleave", pause);
        io?.disconnect();
      };
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.1 });
    io.observe(video);
    return () => io.disconnect();
  }, [ref, playOnHover]);

  if (failed) return <div className={`${className || ""} hero-video-fallback`} aria-hidden />;
  return (
    <video
      ref={ref}
      className={className}
      style={style}
      src={src}
      muted
      loop
      playsInline
      preload={playOnHover ? "metadata" : "auto"}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      onError={() => setFailed(true)}
    />
  );
});

export default BackgroundVideo;

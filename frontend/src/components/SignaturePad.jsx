import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** Canvas signature capture that works with mouse, pen and touch. */
const SignaturePad = forwardRef(function SignaturePad({ onChange }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const setup = () => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e1526";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    hasInk.current = false;
  };

  useEffect(() => {
    setup();
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => { setup(); onChange?.(null); },
    toDataURL: () => (hasInk.current ? canvasRef.current.toDataURL("image/png") : null),
  }));

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(...point(e));
    ctx.stroke();
    hasInk.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(hasInk.current ? canvasRef.current.toDataURL("image/png") : null);
  };

  return <canvas ref={canvasRef} className="sig-pad" style={{ background: "#fff" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Signature area – sign with your finger or mouse" role="img" />;
});

export default SignaturePad;

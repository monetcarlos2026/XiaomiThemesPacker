import { useEffect, useRef, useState } from "react";
import { getSvgPath } from "figma-squircle";

export function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    let frame = 0;
    let nextRect = { width: 0, height: 0 };
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      nextRect = { width: box.width, height: box.height };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setRect((current) => {
          if (Math.round(current.width) === Math.round(nextRect.width) && Math.round(current.height) === Math.round(nextRect.height)) {
            return current;
          }
          return nextRect;
        });
      });
    });
    observer.observe(ref.current);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { ref, rect };
}

function formatPathNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

type CornerStyle = "rounded" | "smooth" | "circle" | "pill";

interface FigmaCornerConfig {
  radius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  smoothing: number;
  style: CornerStyle;
}

function parseNumber(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ellipsePath(width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  return [
    `M ${formatPathNumber(cx)} 0`,
    `A ${formatPathNumber(rx)} ${formatPathNumber(ry)} 0 1 1 ${formatPathNumber(cx)} ${formatPathNumber(height)}`,
    `A ${formatPathNumber(rx)} ${formatPathNumber(ry)} 0 1 1 ${formatPathNumber(cx)} 0`,
    "Z"
  ].join(" ");
}

function pillPath(width: number, height: number) {
  const radius = Math.min(width, height) / 2;

  if (width >= height) {
    return [
      `M ${formatPathNumber(radius)} 0`,
      `H ${formatPathNumber(width - radius)}`,
      `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(width)} ${formatPathNumber(radius)}`,
      `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(width - radius)} ${formatPathNumber(height)}`,
      `H ${formatPathNumber(radius)}`,
      `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 0 ${formatPathNumber(radius)}`,
      `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(radius)} 0`,
      "Z"
    ].join(" ");
  }

  return [
    `M ${formatPathNumber(width / 2)} 0`,
    `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(width)} ${formatPathNumber(radius)}`,
    `V ${formatPathNumber(height - radius)}`,
    `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(width / 2)} ${formatPathNumber(height)}`,
    `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 0 ${formatPathNumber(height - radius)}`,
    `V ${formatPathNumber(radius)}`,
    `A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${formatPathNumber(width / 2)} 0`,
    "Z"
  ].join(" ");
}

function superellipsePoint(centerX: number, centerY: number, radius: number, angle: number, smoothing: number) {
  const exponent = 2 / (2 + smoothing * 4.5);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = centerX + radius * Math.sign(cos) * Math.abs(cos) ** exponent;
  const y = centerY + radius * Math.sign(sin) * Math.abs(sin) ** exponent;
  return `${formatPathNumber(x)} ${formatPathNumber(y)}`;
}

function addCornerPoints(parts: string[], centerX: number, centerY: number, radius: number, start: number, end: number, smoothing: number) {
  const steps = 18;
  for (let index = 1; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps;
    parts.push(`L ${superellipsePoint(centerX, centerY, radius, angle, smoothing)}`);
  }
}

function addRoundedCorner(parts: string[], x: number, y: number, radius: number, sweepTarget: string) {
  if (radius <= 0) {
    parts.push(sweepTarget);
    return;
  }
  parts.push(`A ${formatPathNumber(radius)} ${formatPathNumber(radius)} 0 0 1 ${sweepTarget.slice(2)}`);
}

function figmaRoundedRectPath(width: number, height: number, config: FigmaCornerConfig) {
  const rawTopLeft = config.topLeftRadius ?? config.radius ?? 0;
  const rawTopRight = config.topRightRadius ?? config.radius ?? 0;
  const rawBottomRight = config.bottomRightRadius ?? config.radius ?? 0;
  const rawBottomLeft = config.bottomLeftRadius ?? config.radius ?? 0;
  const topLeft = Math.max(0, Math.min(rawTopLeft, width / 2, height / 2));
  const topRight = Math.max(0, Math.min(rawTopRight, width / 2, height / 2));
  const bottomRight = Math.max(0, Math.min(rawBottomRight, width / 2, height / 2));
  const bottomLeft = Math.max(0, Math.min(rawBottomLeft, width / 2, height / 2));

  if (topLeft <= 0 && topRight <= 0 && bottomRight <= 0 && bottomLeft <= 0) {
    return `M 0 0 H ${formatPathNumber(width)} V ${formatPathNumber(height)} H 0 Z`;
  }

  if (config.style === "pill" || [rawTopLeft, rawTopRight, rawBottomRight, rawBottomLeft].some((radius) => radius >= 9999)) {
    return pillPath(width, height);
  }

  if (config.smoothing <= 0) {
    const parts = [`M ${formatPathNumber(topLeft)} 0`];
    parts.push(`H ${formatPathNumber(width - topRight)}`);
    addRoundedCorner(parts, width - topRight, topRight, topRight, `L ${formatPathNumber(width)} ${formatPathNumber(topRight)}`);
    parts.push(`V ${formatPathNumber(height - bottomRight)}`);
    addRoundedCorner(parts, width - bottomRight, height - bottomRight, bottomRight, `L ${formatPathNumber(width - bottomRight)} ${formatPathNumber(height)}`);
    parts.push(`H ${formatPathNumber(bottomLeft)}`);
    addRoundedCorner(parts, bottomLeft, height - bottomLeft, bottomLeft, `L 0 ${formatPathNumber(height - bottomLeft)}`);
    parts.push(`V ${formatPathNumber(topLeft)}`);
    addRoundedCorner(parts, topLeft, topLeft, topLeft, `L ${formatPathNumber(topLeft)} 0`);
    parts.push("Z");
    return parts.join(" ");
  }

  const smoothing = config.smoothing;
  const parts = [
    `M ${formatPathNumber(topLeft)} 0`,
    `H ${formatPathNumber(width - topRight)}`
  ];
  addCornerPoints(parts, width - topRight, topRight, topRight, -Math.PI / 2, 0, smoothing);
  parts.push(`V ${formatPathNumber(height - bottomRight)}`);
  addCornerPoints(parts, width - bottomRight, height - bottomRight, bottomRight, 0, Math.PI / 2, smoothing);
  parts.push(`H ${formatPathNumber(bottomLeft)}`);
  addCornerPoints(parts, bottomLeft, height - bottomLeft, bottomLeft, Math.PI / 2, Math.PI, smoothing);
  parts.push(`V ${formatPathNumber(topLeft)}`);
  addCornerPoints(parts, topLeft, topLeft, topLeft, Math.PI, (Math.PI * 3) / 2, smoothing);
  parts.push("Z");
  return parts.join(" ");
}

function getFigmaCornerConfig(element: HTMLElement): FigmaCornerConfig | null {
  const figmaRadius = parseNumber(element.dataset.figmaCornerRadius);
  const legacyCorner = element.dataset.smoothCorner;
  const legacyStyle = legacyCorner && Number.isNaN(Number(legacyCorner)) ? legacyCorner : undefined;
  const style = (element.dataset.figmaCornerStyle || legacyStyle || "rounded") as CornerStyle;
  const radius = figmaRadius ?? parseNumber(legacyCorner);

  if (style === "circle" || style === "pill" || radius !== undefined) {
    return {
      radius,
      topLeftRadius: parseNumber(element.dataset.figmaTopLeftRadius),
      topRightRadius: parseNumber(element.dataset.figmaTopRightRadius),
      bottomRightRadius: parseNumber(element.dataset.figmaBottomRightRadius),
      bottomLeftRadius: parseNumber(element.dataset.figmaBottomLeftRadius),
      smoothing: parseNumber(element.dataset.figmaCornerSmoothing) ?? 0,
      style
    };
  }

  return null;
}

function applySmoothCorner(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const corner = getFigmaCornerConfig(element);
  if (!corner) return;

  const rawRadius = corner.radius ?? corner.topLeftRadius ?? corner.topRightRadius ?? corner.bottomRightRadius ?? corner.bottomLeftRadius ?? 0;
  const isPill = corner.style === "pill" || rawRadius >= 9999;
  const smoothingValue = corner.style === "smooth" ? `${Math.round(corner.smoothing * 100)}%` : "0%";
  element.style.setProperty("-electron-corner-smoothing", smoothingValue);

  if (corner.style !== "smooth" || corner.smoothing <= 0) {
    const cssRadius = corner.style === "circle" || isPill ? "9999px" : `${rawRadius}px`;
    element.style.borderRadius = cssRadius;
    element.style.clipPath = "";
    element.style.removeProperty("-webkit-clip-path");
    return;
  }

  element.style.borderRadius = "0px";

  const path = getSvgPath({
    width: bounds.width,
    height: bounds.height,
    cornerRadius: corner.radius ?? 0,
    topLeftCornerRadius: corner.topLeftRadius,
    topRightCornerRadius: corner.topRightRadius,
    bottomRightCornerRadius: corner.bottomRightRadius,
    bottomLeftCornerRadius: corner.bottomLeftRadius,
    cornerSmoothing: corner.smoothing,
    preserveSmoothing: true
  });
  const clipPath = `path('${path}')`;
  element.style.clipPath = clipPath;
  element.style.setProperty("-webkit-clip-path", clipPath);
}

export function useSmoothCorners() {
  useEffect(() => {
    const observed = new Set<HTMLElement>();
    const pending = new Set<HTMLElement>();
    let frame = 0;
    const scheduleSmoothCorner = (element: HTMLElement) => {
      pending.add(element);
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        for (const item of pending) applySmoothCorner(item);
        pending.clear();
      });
    };
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scheduleSmoothCorner(entry.target as HTMLElement);
      }
    });

    const observeSmoothCorners = () => {
      document.querySelectorAll<HTMLElement>("[data-figma-corner-radius], [data-smooth-corner]").forEach((element) => {
        scheduleSmoothCorner(element);
        if (!observed.has(element)) {
          observed.add(element);
          resizeObserver.observe(element);
        }
      });
    };

    observeSmoothCorners();
    const mutationObserver = new MutationObserver(observeSmoothCorners);
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "data-smooth-corner",
        "data-figma-corner-radius",
        "data-figma-corner-smoothing",
        "data-figma-corner-style",
        "data-figma-top-left-radius",
        "data-figma-top-right-radius",
        "data-figma-bottom-right-radius",
        "data-figma-bottom-left-radius"
      ],
      childList: true,
      subtree: true
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      observed.clear();
    };
  }, []);
}

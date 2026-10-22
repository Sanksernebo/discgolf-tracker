/**
 * Browser-only helpers for analytics downloads: saving a Blob and turning an
 * on-screen chart <svg> into a standalone SVG or PNG file.
 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBytes(bytes: Uint8Array, type: string, filename: string) {
  // Copy into a fresh ArrayBuffer — Blob's typings reject SharedArrayBuffer-backed views.
  downloadBlob(new Blob([new Uint8Array(bytes)], { type }), filename);
}

/** Nearest ancestor background that isn't transparent (the panel/page colour). */
function effectiveBackground(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return "#ffffff";
}

/**
 * Serialise a chart so it renders the same outside the page: `currentColor`
 * and the font are resolved from computed styles (the file has no CSS), and
 * a background rect is added so light-on-dark charts stay legible.
 */
function standaloneSvg(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const style = getComputedStyle(svg);
  const width = Number(svg.getAttribute("width")) || svg.clientWidth;
  const height = Number(svg.getAttribute("height")) || svg.clientHeight;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("font-family", style.fontFamily);
  clone.removeAttribute("class");

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", effectiveBackground(svg));
  clone.insertBefore(bg, clone.firstChild);

  const markup = new XMLSerializer()
    .serializeToString(clone)
    .replace(/currentColor/g, style.color);
  return { markup, width, height };
}

export function svgBlob(svg: SVGSVGElement): Blob {
  const { markup } = standaloneSvg(svg);
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`], {
    type: "image/svg+xml",
  });
}

/** Rasterise at 2× so the PNG stays crisp in slides and documents. */
export async function pngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const { markup, width, height } = standaloneSvg(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Print the page (the browser's "Save as PDF" lives in the print dialog).
 * Dark mode is lifted for the duration so the report prints dark-on-white.
 */
export function printReport() {
  const html = document.documentElement;
  const wasDark = html.classList.contains("dark");
  if (wasDark) html.classList.remove("dark");
  const restore = () => {
    if (wasDark) html.classList.add("dark");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

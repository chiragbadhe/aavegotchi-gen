import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "crypto";
import { createCanvas, CanvasRenderingContext2D, loadImage } from "canvas";

type BaseParams = {
  address: `0x${string}`;
  data?: string;
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    return Math.abs(this.seed % 1000) / 1000;
  }

  nextRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function generateSeed(address: string, data?: string): number {
  const input = data ? `${address}-${data}` : address;
  const hash = createHash("sha256").update(input).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function drawPattern(canvas: CanvasRenderingContext2D) {
  const settings = {
    gridSize: 10,
    boxSize: 40,
    colors: ["#FFE8FF", "#FFIDFF", "#44106C", "#1A0335", "#672EEB"],
    offsets: [1.25, 1.35, 1.425, 1.5, 1.6, 2],
  };

  for (let i = 0; i < settings.gridSize; i++) {
    for (let j = 0; j < settings.gridSize; j++) {
      const bgColorIndex = random(0, settings.colors.length - 1);
      let elementColorIndex = random(0, settings.colors.length - 1);
      while (elementColorIndex === bgColorIndex) {
        elementColorIndex = random(0, settings.colors.length - 1);
      }

      const x = (i * settings.boxSize) % 400; // Ensure x stays within canvas width
      const y = (j * settings.boxSize) % 400; // Ensure y stays within canvas height
      const offset =
        settings.boxSize /
        settings.offsets[random(0, settings.offsets.length - 1)];

      // Draw background
      canvas.fillStyle = settings.colors[bgColorIndex];
      canvas.fillRect(x, y, settings.boxSize, settings.boxSize);

      // Draw shape
      canvas.fillStyle = settings.colors[elementColorIndex];
      canvas.beginPath();
      canvas.moveTo(x + offset, y);
      canvas.lineTo(x + settings.boxSize - offset, y);
      canvas.lineTo(x + settings.boxSize, y + offset);
      canvas.lineTo(x + settings.boxSize, y + settings.boxSize - offset);
      canvas.lineTo(x + settings.boxSize - offset, y + settings.boxSize);
      canvas.lineTo(x + offset, y + settings.boxSize);
      canvas.lineTo(x, y + settings.boxSize - offset);
      canvas.lineTo(x, y + offset);
      canvas.closePath();
      canvas.fill();
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { address } = req.query as BaseParams;

    if (!address) {
      return res
        .status(400)
        .json({ error: "Valid Ethereum address is required" });
    }

    const seed = generateSeed(address);

    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext("2d");

    drawPattern(ctx);

    // Create a linear gradient from top to bottom for the whole canvas
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(54, 54, 54, 0.37)"); // Fully transparent at the top
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.67)"); // Partially opaque black
    gradient.addColorStop(1, "rgb(0, 0, 0)"); // Fully opaque black at the bottom

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill the canvas with the gradient

    // Load and draw the image at the bottom of the canvas
    const imageUrl =
      "https://blog.aavegotchi.com/content/images/2023/07/fulllogo.png";
    const baseImage = await loadImage(imageUrl);
    const scaledWidth = 300;
    const scaledHeight = 180;
    const baseX = (canvas.width - scaledWidth) / 2;
    const baseY = canvas.height - scaledHeight; // Position at the bottom

    // Add shadow at the bottom before drawing the image
    ctx.save(); // Save the current state
    ctx.translate(baseX + scaledWidth / 2, baseY + scaledHeight / 2); // Move to center
    ctx.shadowColor = "rgb(0, 0, 0)"; // Shadow color
    ctx.shadowBlur = 60; // Shadow blur radius

    ctx.drawImage(
      baseImage,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );
    ctx.restore(); // Restore the original state

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

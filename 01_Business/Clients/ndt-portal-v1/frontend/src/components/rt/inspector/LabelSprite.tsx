import { useMemo } from 'react';
import * as THREE from 'three';
import { NDT_TYPE } from '../../../tokens/typography';

interface LabelSpriteProps {
  text:     string;
  position: [number, number, number];
  color?:   string;
}

export function LabelSprite({ text, position, color }: LabelSpriteProps) {
  const texture = useMemo(() => {
    const cfg    = NDT_TYPE.label3D;
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d')!;
    canvas.width  = cfg.canvasWidth;
    canvas.height = cfg.canvasHeight;

    // Background
    ctx.fillStyle = cfg.bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, cfg.borderRadius);
    ctx.fill();

    // Border
    ctx.strokeStyle = color ?? cfg.borderColor;
    ctx.lineWidth   = cfg.borderWidth;
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, cfg.borderRadius);
    ctx.stroke();

    // Text
    ctx.fillStyle  = cfg.textColor;
    ctx.font       = `bold ${cfg.fontSize}px ${cfg.fontFamily}`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex      = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color]);

  return (
    <sprite position={position} scale={NDT_TYPE.label3D.spriteScale}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

import * as PIXI from 'pixi.js';
import { computeRNA } from '@eternagame/rna';
import drawRNA from '@eternagame/rna-viz-2d';

import './style.css';

export default function designer() {
  // Setup PIXI
  const app = new PIXI.Application({
    resolution: devicePixelRatio,
  });

  document.body.appendChild(app.view);

  function resize() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  }

  resize();
  window.addEventListener('resize', resize);

  const rna = computeRNA(
    [-1, 13, 12, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 1, 1, 3, 4, 1, 1, 1, 1, 4, 3, 2, 3, 4, 1]
  );

  drawRNA(rna);
}

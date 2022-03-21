import { computeRNA } from '@eternagame/rna';
import drawRNA from '@eternagame/rna-viz-2d';

export default function designer() {
  const rna = computeRNA(
    [-1, 13, 12, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 1, 1, 3, 4, 1, 1, 1, 1, 4, 3, 2, 3, 4, 1]
  );

  drawRNA(rna);
}

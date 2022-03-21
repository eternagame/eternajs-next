import type { RNABase } from './Epars';
import RNALayout from './RNALayout';
import SecStruct from './SecStruct';
import Sequence from './Sequence';

export interface IRNA {
  sequence: Sequence;
  xarray: number[];
  yarray: number[];
  xbounds: number[];
  ybounds: number[];
}

export function computeRNA(pairs: number[], bases: number[]): IRNA {
  const rnaDrawer = new RNALayout(45, 45);
  rnaDrawer.setupTree(new SecStruct(pairs));
  rnaDrawer.drawTree();
  const sequence = new Sequence(bases);
  return {
    sequence,
    ...rnaDrawer.getCoords(sequence.length),
  };
}

export { RNABase, Sequence };

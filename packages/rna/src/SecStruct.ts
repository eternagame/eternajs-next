import EPars from './Epars';
import type Sequence from './Sequence';

export default class SecStruct {
  constructor(pairs: number[] = []) {
    this._pairs = pairs.slice();
  }

  public get length(): number {
    return this._pairs.length;
  }

  public get pairs(): number[] {
    return this._pairs;
  }

  /**
   * A static creator that starts from a dot-bracket notation string.
   * @param str A string in dot-bracket notation
   * @param pseudoknots If true, run through other ()-like characters too, to
   * represent pseudoknots.
   */
  public static fromParens(str: string, pseudoknots = false): SecStruct {
    const s = new SecStruct();
    s.setPairs(str, pseudoknots);
    return s;
  }

  /**
   * Filter a SecStruct for only the pairs compatible with the sequence given.
   * @param seq A Sequence against which to compare the structure.
   */
  public getSatisfiedPairs(seq: Sequence): SecStruct {
    const retPairs: number[] = new Array(this.length) as number[];

    for (let ii = 0; ii < this.length; ii++) {
      if ((this.pairs[ii] as number) < 0) {
        retPairs[ii] = -1;
      } else if ((this.pairs[ii] as number) > ii) {
        if (
          EPars.pairType(seq.nt(ii), seq.nt(this.pairs[ii] as number)) !== 0
        ) {
          retPairs[ii] = this.pairs[ii] as number;
          retPairs[this.pairs[ii] as number] = ii;
        } else {
          retPairs[ii] = -1;
          retPairs[this.pairs[ii] as number] = -1;
        }
      }
    }

    return new SecStruct(retPairs);
  }

  /**
   * Is the sequence position paired?
   * @param index
   */
  public isPaired(index: number): boolean {
    return (this._pairs[index] as number) >= 0;
  }

  /**
   * What's the sequence position's pairing partner?
   * @param index
   */
  public pairingPartner(index: number): number {
    return this._pairs[index] as number;
  }

  /**
   * Set the pairing partner to a particular value. If the position was
   * paired to begin with, unpair it first so we don't have an inconsistent
   * state.
   * @param index
   * @param pi
   */
  public setPairingPartner(index: number, pi: number): void {
    if (this.isPaired(index) && this.pairingPartner(index) !== pi) {
      this._pairs[this.pairingPartner(index)] = -1;
    }
    this._pairs[index] = pi;
  }

  /**
   * Set the position, as well as its former pairing partner, to unpaired.
   * @param index
   */
  public setUnpaired(index: number): void {
    this._pairs[this._pairs[index] as number] = -1;
    this._pairs[index] = -1;
  }

  /**
   * Returns true if there are any pairs.
   */
  public nonempty(): boolean {
    return this._pairs.filter((it) => it !== -1).length !== 0;
  }

  /**
   * Returns null if index is not part of an internal loop; returns all the
   * loop indices otherwise.
   * @param index
   */
  public isInternal(index: number): number[] | null {
    let pairStartHere = -1;
    let pairEndHere = -1;
    let pairStartThere = -1;
    let pairEndThere = -1;

    if ((this.pairs[index] as number) >= 0) {
      return null;
    }

    let walker: number = index;
    while (walker >= 0) {
      if ((this.pairs[walker] as number) >= 0) {
        pairStartHere = walker;
        pairStartThere = this.pairs[walker] as number;
        break;
      }
      walker--;
    }

    walker = index;
    while (walker < this.pairs.length) {
      if ((this.pairs[walker] as number) >= 0) {
        pairEndHere = walker;
        pairEndThere = this.pairs[walker] as number;
        break;
      }
      walker++;
    }

    if (pairStartHere < 0 || pairEndHere < 0) {
      return null;
    }

    const thereStart: number = Math.min(pairStartThere, pairEndThere);
    const thereEnd: number = Math.max(pairStartThere, pairEndThere);

    if (pairStartHere === thereStart) {
      return null;
    }

    for (let ii: number = thereStart + 1; ii < thereEnd; ii++) {
      if ((this.pairs[ii] as number) >= 0) {
        return null;
      }
    }

    const bases: number[] = [];

    for (let ii = pairStartHere; ii <= pairEndHere; ii++) {
      bases.push(ii);
    }

    for (let ii = thereStart; ii <= thereEnd; ii++) {
      bases.push(ii);
    }

    return bases;
  }

  /**
   * Return the longest stack length.
   */
  public getLongestStackLength(): number {
    let longlen = 0;

    let stackStart = -1;
    let lastStackOther = -1;

    for (let ii = 0; ii < this._pairs.length; ii++) {
      if ((this._pairs[ii] as number) > ii) {
        if (stackStart < 0) {
          stackStart = ii;
        }

        const isContinued =
          lastStackOther < 0 || this._pairs[ii] === lastStackOther - 1;

        if (isContinued) {
          lastStackOther = this._pairs[ii] as number;
        } else {
          if (stackStart >= 0 && ii - stackStart > longlen) {
            longlen = ii - stackStart;
          }

          lastStackOther = -1;
          stackStart = -1;
        }
      } else {
        if (stackStart >= 0 && ii - stackStart > longlen) {
          longlen = ii - stackStart;
        }

        stackStart = -1;
        lastStackOther = -1;
      }
    }

    return longlen;
  }

  /**
   * Set the pairs based on a passed in dot-bracket string, with or without
   * pseudoknots. Used both by the filtering functions and the constructor.
   * @param parenthesis
   * @param pseudoknots
   */
  public setPairs(parenthesis: string, pseudoknots = false) {
    this._pairs = (new Array(parenthesis.length) as number[]).fill(-1);
    const pairStack: number[] = [];

    for (let jj = 0; jj < parenthesis.length; jj++) {
      if (parenthesis.charAt(jj) === '(') {
        pairStack.push(jj);
      } else if (parenthesis.charAt(jj) === ')') {
        if (pairStack.length === 0) {
          throw new Error('Invalid parenthesis notation');
        }

        this._pairs[pairStack[pairStack.length - 1] as number] = jj;
        pairStack.pop();
      }
    }

    // If pseudoknots should be counted, manually repeat for
    // the char pairs [], {}
    if (pseudoknots) {
      for (let jj = 0; jj < parenthesis.length; jj++) {
        if (parenthesis.charAt(jj) === '[') {
          pairStack.push(jj);
        } else if (parenthesis.charAt(jj) === ']') {
          if (pairStack.length === 0) {
            throw new Error('Invalid parenthesis notation');
          }

          this._pairs[pairStack[pairStack.length - 1] as number] = jj;
          pairStack.pop();
        }
      }

      for (let jj = 0; jj < parenthesis.length; jj++) {
        if (parenthesis.charAt(jj) === '{') {
          pairStack.push(jj);
        } else if (parenthesis.charAt(jj) === '}') {
          if (pairStack.length === 0) {
            throw new Error('Invalid parenthesis notation');
          }

          this._pairs[pairStack[pairStack.length - 1] as number] = jj;
          pairStack.pop();
        }
      }
      for (let jj = 0; jj < parenthesis.length; jj++) {
        if (parenthesis.charAt(jj) === '<') {
          pairStack.push(jj);
        } else if (parenthesis.charAt(jj) === '>') {
          if (pairStack.length === 0) {
            throw new Error('Invalid parenthesis notation');
          }

          this._pairs[pairStack[pairStack.length - 1] as number] = jj;
          pairStack.pop();
        }
      }
    }

    for (let jj = 0; jj < this._pairs.length; jj++) {
      if ((this._pairs[jj] as number) >= 0)
        this._pairs[this._pairs[jj] as number] = jj;
    }
  }

  public stems(): [number, number][][] {
    const stems: [number, number][][] = [];

    for (let ii = 0; ii < this.length; ++ii) {
      const pi = this.pairingPartner(ii);
      if (ii > pi) {
        continue; // eslint-disable-line no-continue
      }

      if (this.isPaired(ii)) {
        // look through stems
        let broke = false;
        for (const stem of stems) {
          // if there is an adjacent pair, put it on
          for (const bp of stem) {
            if (
              (bp[0] === ii - 1 && bp[1] === pi + 1) ||
              (bp[0] === ii + 1 && bp[1] === pi - 1) ||
              (bp[1] === ii - 1 && bp[0] === pi + 1) ||
              (bp[1] === ii + 1 && bp[0] === pi - 1)
            ) {
              stem.push([ii, pi]);
              broke = true;
              break;
            }
          }
          if (broke) break;
        }
        if (!broke) {
          stems.push([[ii, pi]]);
        }
      }
    }

    return stems;
  }

  /**
   * Return all the nt that are in a stem with this nt
   * @param idx
   */
  public stemWith(idx: number): [number, number][] {
    const stems = this.stems();
    const pi = this.pairingPartner(idx);
    for (const stem of stems) {
      for (const bp of stem) {
        if (
          (bp[0] === idx && bp[1] === pi) ||
          (bp[1] === idx && bp[0] === pi)
        ) {
          return stem;
        }
      }
    }
    return [];
  }

  /**
   * Return the dot-bracket notation.
   * @param seq Sequence passed just for the sake of locating the cutpoint, if
   * there is one.
   * @param pseudoknots Pseudoknots, to help look for places for [] {} <>
   */
  public getParenthesis(
    seq: Sequence | null = null,
    pseudoknots = false
  ): string {
    if (pseudoknots) {
      // given partner-style array, writes dot-parens notation string. handles pseudoknots!
      // example of partner-style array: '((.))' -> [4,3,-1,1,0]
      const bpList: number[] = (new Array(this._pairs.length) as number[]).fill(
        -1
      );

      for (let ii = 0; ii < this._pairs.length; ii++) {
        if ((this._pairs[ii] as number) > ii) {
          bpList[ii] = this._pairs[ii] as number;
          bpList[this._pairs[ii] as number] = ii;
        }
      }

      const bps: number[][] = [];
      for (let ii = 0; ii < bpList.length; ++ii) {
        if (bpList[ii] !== -1 && (bpList[ii] as number) > ii) {
          bps.push([ii, bpList[ii] as number]);
        }
      }

      const stems: number[][][] = [];
      // #bps: list of bp lists
      // # i.e. '((.))' is [[0,4],[1,3]]
      // # Returns list of (list of bp lists), now sorted into stems
      // # i.e. [ list of all bps in stem 1, list of all bps in stem 2]
      // if debug: print(bps)
      for (let ii = 0; ii < bps.length; ++ii) {
        let added = false;
        for (let jj = 0; jj < stems.length; ++jj) {
          // is this bp adjacent to any element of an existing stem?
          for (let kk = 0; kk < (stems[jj] as number[][]).length; ++kk) {
            const ii0 = (bps[ii] as number[])[0] as number;
            const jjkk0 = (
              (stems[jj] as number[][])[kk] as number[]
            )[0] as number;
            const jjkk1 = (
              (stems[jj] as number[][])[kk] as number[]
            )[1] as number;
            const bpsii1 = (bps[ii] as number[])[1] as number;

            if (
              (ii0 - 1 === jjkk0 && bpsii1 + 1 === jjkk1) ||
              (ii0 + 1 === jjkk0 && bpsii1 - 1 === jjkk1) ||
              (ii0 - 1 === jjkk1 && bpsii1 + 1 === jjkk0) ||
              (ii0 + 1 === jjkk1 && bpsii1 - 1 === jjkk0)
            ) {
              // add to this stem
              (stems[jj] as number[][]).push(bps[ii] as number[]);
              added = true;
              break;
            }
          }
          if (added) break;
        }
        if (!added) {
          stems.push([bps[ii] as number[]]);
        }
      }
      // if debug: print('stems', stems)

      const dbn: string[] = (new Array(this._pairs.length) as string[]).fill(
        '.'
      );
      const delimsL = [/\(/i, /\{/i, /\[/i, /</i]; // ,'a','b','c']
      const delimsR = [/\)/i, /\}/i, /\]/i, />/i]; // ,'a','b','c']
      const charsL = ['(', '{', '[', '<'];
      const charsR = [')', '}', ']', '>'];
      if (stems.length === 0) {
        return dbn.join('');
      }
      for (let ii = 0; ii < stems.length; ++ii) {
        const stem = stems[ii] as number[][];

        let pkCtr = 0;

        const stem00 = (stem[0] as number[])[0] as number;
        const stem01 = (stem[0] as number[])[1] as number;

        const substring = dbn.join('').substring(stem00 + 1, stem01);
        // check to see how many delimiter types exist in between where stem is going to go
        // ah -- it's actually how many delimiters are only half-present, I think.
        while (
          (substring.search(delimsL[pkCtr] as RegExp) !== -1 &&
            substring.search(delimsR[pkCtr] as RegExp) === -1) ||
          (substring.search(delimsL[pkCtr] as RegExp) === -1 &&
            substring.search(delimsR[pkCtr] as RegExp) !== -1)
        ) {
          pkCtr += 1;
        }
        for (let jj = 0; jj < stem.length; ++jj) {
          const stemjj0 = (stem[jj] as number[])[0] as number;
          const stemjj1 = (stem[jj] as number[])[1] as number;

          const i = stemjj0;
          const j = stemjj1;

          dbn[i] = charsL[pkCtr] as string;
          dbn[j] = charsR[pkCtr] as string;
        }
      }
      return dbn.join('');
    }

    const biPairs: number[] = (new Array(this._pairs.length) as number[]).fill(
      -1
    );
    for (let ii = 0; ii < this._pairs.length; ii++) {
      if ((this._pairs[ii] as number) > ii) {
        biPairs[ii] = this._pairs[ii] as number;
        biPairs[this._pairs[ii] as number] = ii;
      }
    }

    let str = '';
    for (let ii = 0; ii < biPairs.length; ii++) {
      if ((biPairs[ii] as number) > ii) {
        str += '(';
      } else if ((biPairs[ii] as number) >= 0) {
        str += ')';
      } else if (seq != null && seq.hasCut(ii)) {
        str += '&';
      } else {
        str += '.';
      }
    }

    return str;
  }

  /**
   * Return a version of the secondary structure with no pseudoknots, useful
   * for visualization.
   */
  public filterForPseudoknots(): SecStruct {
    // Round-trip to remove all pseudoknots.
    const filtered: string = this.getParenthesis(null, true)
      .replace(/\{/g, '.')
      .replace(/\}/g, '.')
      .replace(/\[/g, '.')
      .replace(/\]/g, '.')
      .replace(/</g, '.')
      .replace(/>/g, '.');

    const ss = new SecStruct();
    ss.setPairs(filtered, false);
    return ss;
  }

  /**
   * Return a version of the secondary structure with only pseudoknots, useful
   * for visualization.
   */
  public onlyPseudoknots(): SecStruct {
    // Round-trip to remove all non-pseudoknots.
    const filtered: string = this.getParenthesis(null, true)
      .replace(/\(/g, '.')
      .replace(/\)/g, '.');

    const ss = new SecStruct();
    ss.setPairs(filtered, true);
    return ss;
  }

  /**
   * Return the number of base pairs in total.
   */
  public numPairs(): number {
    let ret = 0;

    for (let ii = 0; ii < this._pairs.length; ii++) {
      if ((this._pairs[ii] as number) > ii) {
        ret++;
      }
    }
    return ret;
  }

  /**
   * Return a copy of the SecStruct based on a copy of its underlying data.
   * Importantly, this requires reindexing much of the SecStruct!!
   * @param start
   * @param end
   */
  public slice(start: number, end?: number): SecStruct {
    const pairsB = this._pairs.slice(start, end);

    for (let ii = 0; ii < pairsB.length; ii++) {
      if ((pairsB[ii] as number) >= 0) pairsB[ii] -= start;
    }

    return new SecStruct(pairsB);
  }

  /**
   * The underlying data: an array of numbers. These numbers correspond to the
   * base paired index at each position. -1 means unpaired, and a number from
   * zero to len-1 indicates a pairing partner.
   */
  private _pairs: number[] = [];
}

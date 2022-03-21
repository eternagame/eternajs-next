import SecStruct from './SecStruct';

enum RotationDirection {
  CCW = -1, // counterclockwise
  CW = 1, // clockwise
}

export class RNATreeNode {
  public isPair = false;
  public children: RNATreeNode[] = [];

  public indexA = -1;
  public indexB = -1;

  public score = 0;

  public x = 0;
  public y = 0;

  public goX = 0;
  public goY = 0;

  public rotationDirection!: RotationDirection;
}

// The RNATree has a node for each unpaired base, each base pair, and each junction tracing a sort
//   of 'skeleton' through the layout.
//
//      5   4
//      x   x
//       \ /     3      2      1
// 6 x<-- x <--  x <--- x <--- x <--- x [root]
//       / \    10     11     12     / \
//      x   x                       x   x
//      7   8                      14   15
//
//      x = RNATreeNode
//
// * Root of tree is in the most exterior junction
// * Root node does not have indexA or indexB defined! It is centered at 0,0.
// * For each pair node, isPair = true, indexA and indexB are defined, and x,y center is at midpoint of two pairs.
// * For each  junction,  x,y center is at center of circle.
// * For each unpaired base node, center is at actual plot position.
// * Default rendering assumes path of RNA is counter-clockwise, different from most other codebases!
//
//       (goX,goY)         is unit vector  pointing in 'direction' from previous node into current node.
//       (crossX, crossY)  appears below as an orthogonal unit vector. For a base pair node, it points
//                              from the higher-number base to the lower-number base (consistent with
//                              counterclockwise rendering)
//
// * Above rendering can be overridden by customLayout, an array of x,y positions that makes the RNA junctions
//      look 'nice' perhaps echoing the 3D structure of the RNA. (a.k.a., "2.5D" layout). This customLayout
//      is applied to junctions that match the target structure (encoded in targetPairs). Note that
//      if the customLayout has clockwise helices in parts, that will override counterclockwise rendering of
//      any helices that are daughters through the rotationDirectionSign variable (-1 for clockwise,
//                                          +1 for counterclockwise)
//
// TODO: The recursions below copy some code, unfortunately.
// TODO: Its probably not necessary for user to initialize, drawTree, and getCoords separately -- these aren't really
//           operations that are useful in separate chunks.
//
//    -- rhiju, 2019, reviewing/updating code that was written ages ago by someone else.
//
export default class RNALayout {
  constructor(primSpace = 45, pairSpace = 45) {
    this._primarySpace = primSpace;
    this._pairSpace = pairSpace;
  }

  /**
   * Initializes the tree structure of the RNALayout based on provided BPs.
   *
   * @param pairs An array as long as the structure. -1 for unpaired bases,
   * index of the base it is paired to for a paired base
   * @param targetPairs An optional array stored in the RNALayout that shows
   * the structure of the puzzle "goal." A
   * comparison of pairs to targetPairs will influence application of the customLayout
   */
  public setupTree(
    pairs: SecStruct,
    targetPairs: SecStruct | null = null
  ): void {
    let biPairs: number[] = new Array(pairs.length) as number[];

    // / Delete old tree
    this._root = null;
    // / save for later
    this._targetPairs = targetPairs;

    if (targetPairs == null) this._targetPairs = pairs;

    // / biPairs is 'symmetrized'. Like pairs,
    // /   an array the same length as RNA
    // /   with -1 for unpaired bases, and
    // /   with the partner number for each paired base.
    biPairs.fill(-1);

    for (let ii = 0; ii < pairs.length; ii++) {
      if (ii < pairs.pairingPartner(ii)) {
        biPairs[ii] = pairs.pairingPartner(ii);
        biPairs[pairs.pairingPartner(ii)] = ii;
      }
    }

    // / Array that will be used for scoring
    // / Shifted to be effectively 1-indexed
    // / with the zero-indexed length at index 0
    this._scoreBiPairs = new Array(biPairs.length + 1) as number[];
    for (let ii = 0; ii < biPairs.length; ii++) {
      this._scoreBiPairs[ii + 1] = (biPairs[ii] as number) + 1;
    }
    this._scoreBiPairs[0] = biPairs.length;

    // / no tree if there are no pairs -- special case to be handled
    // /  separately in getCoords.
    let foundPair = false;
    for (let ii = 0; ii < biPairs.length; ii++) {
      if ((biPairs[ii] as number) >= 0) {
        foundPair = true;
        break;
      }
    }
    if (!foundPair) {
      return;
    }

    // the targetPairs that exist for the sake of seeing what matches the goal
    // need to have PKs removed.
    // AMW TODO: Rhiju, we should eventually be able to remove this condition,
    // once you work out how layouts can handle pseudoknots.
    // AMW TODO: I can't say for sure if we can make biPairs a secstruct or not
    // but for now we are keeping these objects as number[]
    biPairs = new SecStruct(biPairs).filterForPseudoknots().pairs;
    if (this._targetPairs !== null) {
      this._targetPairs = this._targetPairs.filterForPseudoknots();
    }

    this._root = new RNATreeNode();

    for (let jj = 0; jj < biPairs.length; jj++) {
      if ((biPairs[jj] as number) >= 0) {
        this.addNodesRecursive(biPairs, this._root, jj, biPairs[jj] as number);
        jj = biPairs[jj] as number;
      } else {
        const newsubnode: RNATreeNode = new RNATreeNode();
        newsubnode.isPair = false;
        newsubnode.indexA = jj;
        this._root.children.push(newsubnode);
      }
    }
  }

  /**
   * Provides actual coordinates for the layout whose structure is encoded
   * by this object.
   *
   */
  public getCoords(length: number) {
    const xarray: number[] = new Array(length) as number[];
    const yarray: number[] = new Array(length) as number[];
    const xbounds = [Number.MAX_VALUE, Number.MIN_VALUE];
    const ybounds = [Number.MAX_VALUE, Number.MIN_VALUE];

    // FIXME add documentation. And its confusing that xarray,yarray are changeable by function ('outparams').

    // If there is a root node in the layout, use the recursive function
    // starting from root. The first two nt can be in a vertical line.
    // After that, start making a circle.
    if (this._root != null) {
      this.getCoordsRecursive(this._root, xarray, yarray, xbounds, ybounds);
    } else if (xarray.length <= 4) {
      // there is no structure (no pairs)
      // really short, just place them in a vertical line
      for (let ii = 0; ii < xarray.length; ii++) {
        xarray[ii] = 0;

        const y = ii * this._primarySpace;
        yarray[ii] = y;

        ybounds[0] = Math.min(ybounds[0] as number, y);
        ybounds[1] = Math.max(ybounds[1] as number, y);
      }

      xbounds[0] = 0;
      xbounds[1] = 0;
    } else {
      // if longer, make the sequence form a circle instead
      // FIXME: there's a bit of code duplication here, somewhat inelegant...
      //   This should be easy to unify, but why is circleRadius not updated along with circleLength?
      //    Need to think through an oligo case carefully -- rhiju
      const circleLength: number =
        (xarray.length + 1) * this._primarySpace + this._pairSpace;
      const circleRadius: number = circleLength / (2 * Math.PI);

      let lengthWalker: number = this._pairSpace / 2.0;
      const goX = 0;
      const goY = 1;
      const rootX: number = goX * circleRadius;
      const rootY: number = goY * circleRadius;
      const crossX: number = -goY;
      const crossY: number = goX;
      for (let ii = 0; ii < xarray.length; ii++) {
        lengthWalker += this._primarySpace;

        const radAngle: number =
          (lengthWalker / circleLength) * 2 * Math.PI - Math.PI / 2.0;

        const x =
          rootX +
          Math.cos(radAngle) * crossX * circleRadius +
          Math.sin(radAngle) * goX * circleRadius;
        const y =
          rootY +
          Math.cos(radAngle) * crossY * circleRadius +
          Math.sin(radAngle) * goY * circleRadius;
        xarray[ii] = x;
        yarray[ii] = y;

        xbounds[0] = Math.min(xbounds[0] as number, x);
        xbounds[1] = Math.max(xbounds[1] as number, x);
        ybounds[0] = Math.min(ybounds[0] as number, y);
        ybounds[1] = Math.max(ybounds[1] as number, y);
      }
    }

    return {
      xarray,
      yarray,
      xbounds,
      ybounds,
    };
  }

  /**
   * Generate base positions for this RNALayout
   *
   * @param customLayout An array of x,y tuples defining all base positions,
   * which will override the "normal" geometry wherever the base pairs match
   * the target pairs in the structure.
   */
  public drawTree(): void {
    if (this._root != null) {
      this.drawTreeRecursive(
        this._root,
        null,
        0,
        0,
        0,
        1,
        RotationDirection.CW
      );
    }
  }

  private addNodesRecursive(
    biPairs: number[],
    rootnode: RNATreeNode,
    startIndex: number,
    endIndex: number
  ): void {
    if (startIndex > endIndex) {
      throw new Error(
        `Error occured while drawing RNA for indices ${startIndex} ${endIndex}`
      );
      // let tmp = endIndex;
      // endIndex = startIndex;
      // startIndex = tmp;
    }

    let newnode: RNATreeNode;
    if (biPairs[startIndex] === endIndex) {
      newnode = new RNATreeNode();
      newnode.isPair = true;
      newnode.indexA = startIndex;
      newnode.indexB = endIndex;

      this.addNodesRecursive(biPairs, newnode, startIndex + 1, endIndex - 1);
    } else {
      newnode = new RNATreeNode();

      for (let jj = startIndex; jj <= endIndex; jj++) {
        if ((biPairs[jj] as number) >= 0) {
          this.addNodesRecursive(biPairs, newnode, jj, biPairs[jj] as number);
          jj = biPairs[jj] as number;
        } else {
          const newsubnode: RNATreeNode = new RNATreeNode();
          newsubnode.isPair = false;
          newsubnode.indexA = jj;
          newnode.children.push(newsubnode);
        }
      }
    }

    rootnode.children.push(newnode);
  }

  private getCoordsRecursive(
    rootnode: RNATreeNode,
    xarray: number[],
    yarray: number[],
    xbounds: number[],
    ybounds: number[]
  ): void {
    // deal with linter no-param-reassign
    if (rootnode.isPair) {
      const crossX: number = -rootnode.goY * rootnode.rotationDirection;
      const crossY: number = rootnode.goX * rootnode.rotationDirection;

      const x1 = rootnode.x + (crossX * this._pairSpace) / 2.0;
      const x2 = rootnode.x - (crossX * this._pairSpace) / 2.0;
      xarray[rootnode.indexA] = x1; // eslint-disable-line no-param-reassign
      xarray[rootnode.indexB] = x2; // eslint-disable-line no-param-reassign

      const y1 = rootnode.y + (crossY * this._pairSpace) / 2.0;
      const y2 = rootnode.y - (crossY * this._pairSpace) / 2.0;
      yarray[rootnode.indexA] = y1; // eslint-disable-line no-param-reassign
      yarray[rootnode.indexB] = y2; // eslint-disable-line no-param-reassign

      xbounds[0] = Math.min(xbounds[0] as number, x1, x2); // eslint-disable-line no-param-reassign
      xbounds[1] = Math.max(xbounds[1] as number, x1, x2); // eslint-disable-line no-param-reassign
      ybounds[0] = Math.min(ybounds[0] as number, y1, y2); // eslint-disable-line no-param-reassign
      ybounds[1] = Math.max(ybounds[1] as number, y1, y2); // eslint-disable-line no-param-reassign
    } else if (rootnode.indexA >= 0) {
      const [x, y] = [rootnode.x, rootnode.y];
      xarray[rootnode.indexA] = x; // eslint-disable-line no-param-reassign
      yarray[rootnode.indexA] = y; // eslint-disable-line no-param-reassign

      xbounds[0] = Math.min(xbounds[0] as number, x); // eslint-disable-line no-param-reassign
      xbounds[1] = Math.max(xbounds[1] as number, x); // eslint-disable-line no-param-reassign
      ybounds[0] = Math.min(ybounds[0] as number, y); // eslint-disable-line no-param-reassign
      ybounds[1] = Math.max(ybounds[1] as number, y); // eslint-disable-line no-param-reassign
    }

    for (const child of rootnode.children) {
      this.getCoordsRecursive(child, xarray, yarray, xbounds, ybounds);
    }
  }

  public getRotationDirectionSign(rotationDirectionSign: number[]): void {
    if (this._root != null) {
      this.getRotationDirectionSignRecursive(this._root, rotationDirectionSign);
    } else {
      rotationDirectionSign.fill(1);
    }
  }

  private getRotationDirectionSignRecursive(
    rootnode: RNATreeNode,
    rotationDirectionSign: number[]
  ): void {
    if (rootnode.isPair) {
      rotationDirectionSign[rootnode.indexA] = rootnode.rotationDirection; // eslint-disable-line no-param-reassign
      rotationDirectionSign[rootnode.indexB] = rootnode.rotationDirection; // eslint-disable-line no-param-reassign
    } else if (rootnode.indexA >= 0) {
      rotationDirectionSign[rootnode.indexA] = rootnode.rotationDirection; // eslint-disable-line no-param-reassign
    }
    for (const child of rootnode.children) {
      this.getRotationDirectionSignRecursive(child, rotationDirectionSign);
    }
  }

  /**
   * Called only by drawTree, a wrapper that first iniitalizes the
   * customLayout, this function determines and sets the base positions for the RNA
   * structure embodied by this object.
   *
   * @param rootnode the root node for this recursive call
   * @param parentnode the parent of this subtree's root; null when this
   * function is called on the tree's root
   * @param startX a plausible starting X for root, likely to be modified
   * @param startY a plausible starting Y for root, likely to be modified
   * @param goX X component of unit vector from parent to root
   * @param goY Y component of unit vector from parent to root
   * @param rotationDirection mapping from CW (1)/CCW (-1) to 5' => 3' direction
   */
  private drawTreeRecursive(
    rootnode: RNATreeNode,
    parentnode: RNATreeNode | null,
    startX: number,
    startY: number,
    goX: number,
    goY: number,
    rotationDirection: RotationDirection = RotationDirection.CW
  ): void {
    const crossX: number = -goY * rotationDirection;
    const crossY: number = goX * rotationDirection;

    const oligoDisplacement = 0;

    rootnode.goX = goX; // eslint-disable-line no-param-reassign
    rootnode.goY = goY; // eslint-disable-line no-param-reassign
    rootnode.rotationDirection = rotationDirection; // eslint-disable-line no-param-reassign

    if (rootnode.children.length === 1) {
      rootnode.x = startX; // eslint-disable-line no-param-reassign
      rootnode.y = startY; // eslint-disable-line no-param-reassign

      if (rootnode.children[0]?.isPair) {
        this.drawTreeRecursive(
          rootnode.children[0],
          rootnode,
          startX + goX * this._primarySpace,
          startY + goY * this._primarySpace,
          goX,
          goY,
          rotationDirection
        );
      } else if (
        !rootnode.children[0]?.isPair &&
        (rootnode.children[0] as RNATreeNode).indexA < 0
      ) {
        this.drawTreeRecursive(
          rootnode.children[0] as RNATreeNode,
          rootnode,
          startX,
          startY,
          goX,
          goY,
          rotationDirection
        );
      } else {
        this.drawTreeRecursive(
          rootnode.children[0] as RNATreeNode,
          rootnode,
          startX + goX * this._primarySpace,
          startY + goY * this._primarySpace,
          goX,
          goY,
          rotationDirection
        );
      }
    } else if (rootnode.children.length > 1) {
      let npairs = 0;
      for (let ii = 0; ii < rootnode.children.length; ii++) {
        if (rootnode.children[ii]?.isPair) {
          npairs++;
        }
      }

      let circleLength =
        (rootnode.children.length + 1) * this._primarySpace +
        (npairs + 1) * this._pairSpace;
      circleLength += oligoDisplacement;

      const circleRadius = circleLength / (2 * Math.PI);
      let lengthWalker = this._pairSpace / 2.0;

      if (parentnode == null) {
        rootnode.x = goX * circleRadius; // eslint-disable-line no-param-reassign
        rootnode.y = goY * circleRadius; // eslint-disable-line no-param-reassign
      } else {
        rootnode.x = parentnode.x + goX * circleRadius; // eslint-disable-line no-param-reassign
        rootnode.y = parentnode.y + goY * circleRadius; // eslint-disable-line no-param-reassign
      }

      for (const child of rootnode.children) {
        lengthWalker += this._primarySpace;
        if (child.isPair) {
          lengthWalker += this._pairSpace / 2.0;
        }

        const radAngle =
          (lengthWalker / circleLength) * 2 * Math.PI - Math.PI / 2.0;
        const childX =
          // eslint-disable-next-line no-param-reassign
          rootnode.x +
          Math.cos(radAngle) * crossX * circleRadius +
          Math.sin(radAngle) * goX * circleRadius;
        const childY =
          // eslint-disable-next-line no-param-reassign
          rootnode.y +
          Math.cos(radAngle) * crossY * circleRadius +
          Math.sin(radAngle) * goY * circleRadius;

        const childGoX = childX - rootnode.x; // eslint-disable-line no-param-reassign
        const childGoY = childY - rootnode.y; // eslint-disable-line no-param-reassign
        const childGoLen = Math.sqrt(childGoX * childGoX + childGoY * childGoY);

        this.drawTreeRecursive(
          child,
          rootnode,
          childX,
          childY,
          childGoX / childGoLen,
          childGoY / childGoLen,
          rotationDirection
        );

        if (child.isPair) {
          lengthWalker += this._pairSpace / 2.0;
        }
      }
    } else {
      rootnode.x = startX; // eslint-disable-line no-param-reassign
      rootnode.y = startY; // eslint-disable-line no-param-reassign
    }
  }

  private readonly _primarySpace: number;
  private readonly _pairSpace: number;

  private _root: RNATreeNode | null = null;
  private _targetPairs: SecStruct | null = null;

  // / "New" method to gather NN free energies, just use the folding engine
  private _scoreBiPairs!: number[];
}

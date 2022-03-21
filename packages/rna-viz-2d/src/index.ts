import type { IRNA } from '@eternagame/rna';

export default function drawRNA(rna: IRNA /* , container: PIXI.Container */) {
  for (let i = 0; i < rna.sequence.length; ++i) {
    console.log(i);
    // const texture = getBaseTexture(rna.sequence.baseArray[i]);
    // const baseSprite = new PIXI.Sprite(PIXI.Texture.from(texture));
    // baseSprite.x = rna.xarray[i] - baseSprite.getBounds().width / 2;
    // baseSprite.y = rna.yarray[i] - baseSprite.getBounds().height / 2;
    // baseSprite.y = rna.yarray[i] - baseSprite.getBounds().height / 2;

    // baseSprite.interactive = true;
    // baseSprite.on("pointerdown", e => {
    //     console.log("base pointerdown " + i);
    //     State.instance.setProperty("bases", [i]);
    //     e.stopPropagation();
    // });
    // baseSprite.on("mouseover", e => {
    //     console.log("mouseover " + i);
    // });
    // baseSprite.on("mouseout", e => {
    //     console.log("mouseout " + i);
    // });

    // container.addChild(baseSprite);
  }
}

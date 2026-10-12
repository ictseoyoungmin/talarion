import { decodePng } from "./png.mjs";

// Deliberately narrow TL00 Ruins Lite scene-specific contamination detector:
// the top-left and top-right of the scene are plain charcoal sky. A visible
// Android status bar overlays white clock and battery/network glyphs there.
// This detector does NOT certify all game scenes and never crops screenshots.
export function detectRuinsLiteSystemBarPng(bytes) {
  const im = decodePng(bytes);
  if (im.width < 320 || im.height < 180) {
    throw new Error("TL00 Android capture is too small for system-bar inspection");
  }
  const yStart=Math.floor(im.height * 0.01);
  const yEnd=Math.max(yStart+1,Math.floor(im.height * 0.075));
  const regions=[
    [Math.floor(im.width * 0.04),Math.floor(im.width * 0.17)],
    [Math.floor(im.width * 0.83),Math.floor(im.width * 0.98)]
  ];
  const counts=regions.map(([x0,x1])=>{
    let bright=0;
    for(let y=yStart;y<yEnd;y++)for(let x=x0;x<x1;x++){
      const i=(y*im.width+x)*4;
      const r=im.data[i],g=im.data[i+1],b=im.data[i+2];
      if(r>225&&g>225&&b>225&&Math.max(r,g,b)-Math.min(r,g,b)<30) bright++;
    }
    return bright;
  });
  const threshold=Math.max(24,Math.floor(im.width*im.height*0.00015));
  return {
    schema:"talarion.tl00-android-system-ui/v1",
    suspectedStatusBar:counts[0]>=threshold&&counts[1]>=threshold,
    regions:{leftBrightPixels:counts[0],rightBrightPixels:counts[1]},
    threshold,
    dimensions:{width:im.width,height:im.height},
    authority:"scene-specific-raw-PNG-contamination-check",
    changesPixelData:false
  };
}

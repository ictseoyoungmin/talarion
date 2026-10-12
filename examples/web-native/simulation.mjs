// Pure authoritative game state shared by human-play and replay paths.
export const BEACONS = Object.freeze([[-1,-3],[1,-1],[2,1]]);
export function createGame() {
  return { tick:0, x:-3,z:-3, collected:[], moves:0, mode:"EXPLORE" };
}
export function move(game,dx,dz) {
  if (game.mode==="VICTORY") return false;
  if (![dx,dz].every(Number.isInteger) || Math.abs(dx)+Math.abs(dz)!==1) return false;
  const x=game.x+dx,z=game.z+dz;
  if (Math.abs(x)>3||Math.abs(z)>3) return false;
  game.x=x;game.z=z;game.moves++;
  for(let i=0;i<BEACONS.length;i++) {
    if (x===BEACONS[i][0]&&z===BEACONS[i][1]&&!game.collected.includes(i))
      game.collected.push(i);
  }
  if(game.collected.length===BEACONS.length) game.mode="VICTORY";
  return true;
}
export function snapshot(game) {
  return {tick:game.tick,entity:"player",state:game.mode,
    position:[game.x,0,game.z],collected:game.collected.length,
    collectedIds:[...game.collected].sort((a,b)=>a-b),moves:game.moves};
}

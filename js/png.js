// Keep source credits inside the PNG too, so they travel with the exported art.
function crc32(bytes) {
  let crc=0xffffffff;
  for (const b of bytes) {crc^=b;for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export async function pngWithCredits(blob,credits) {
  const png=new Uint8Array(await blob.arrayBuffer());
  const data=new TextEncoder().encode('Source credits\0\0\0\0\0'+credits);
  const chunk=new Uint8Array(data.length+12), view=new DataView(chunk.buffer);
  view.setUint32(0,data.length);chunk.set(new TextEncoder().encode('iTXt'),4);chunk.set(data,8);
  view.setUint32(chunk.length-4,crc32(chunk.subarray(4,chunk.length-4)));
  return new Blob([png.subarray(0,png.length-12),chunk,png.subarray(png.length-12)],{type:'image/png'});
}

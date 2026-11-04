const nbt = require('prismarine-nbt');

function value(v) { return v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value') ? v.value : v; }
function decodeVarints(input, count) {
  const data = Buffer.from(input);
  const out = new Array(count);
  let n = 0, shift = 0, index = 0;
  for (const byte of data) {
    n |= (byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7;
      if (shift > 28) throw new Error('Invalid VarInt in schematic BlockData');
    } else {
      if (index >= count) break;
      out[index++] = n >>> 0;
      n = 0; shift = 0;
    }
  }
  if (index !== count) throw new Error(`BlockData length mismatch: expected ${count}, decoded ${index}`);
  return out;
}
async function parseSchematic(buffer) {
  let parsed;
  try { parsed = await nbt.parse(buffer); }
  catch (e) { throw new Error(`NBT parse failed: ${e.message}`); }
  const root = nbt.simplify(parsed);
  const s = root.Schematic || root.schematic || root;
  const width = Number(value(s.Width)), height = Number(value(s.Height)), length = Number(value(s.Length));
  if (![width, height, length].every(Number.isInteger) || width < 1 || height < 1 || length < 1) throw new Error('Unsupported schematic: missing valid Width/Height/Length');
  const count = width * height * length;
  if (!Number.isSafeInteger(count) || count > 1000000) throw new Error('Schematic exceeds the 1,000,000 voxel safety limit');
  const rawPalette = value(s.Palette);
  const rawData = value(s.BlockData);
  if (!rawPalette || !rawData) throw new Error('Sponge schematic Palette or BlockData is missing');
  const palette = {};
  for (const [name, id] of Object.entries(rawPalette)) palette[Number(value(id))] = name;
  const blocks = decodeVarints(rawData, count);
  return { format: 'Sponge .schem', width, height, length, totalBlocks: blocks.length, palette, blocks };
}
module.exports = { parseSchematic };

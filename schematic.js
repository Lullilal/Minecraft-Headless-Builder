const nbt = require("prismarine-nbt");
const zlib = require("zlib");

function getValue(value) {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

function decodeVarints(data, expectedCount) {
  const blocks = [];
  let value = 0;
  let shift = 0;

  for (const byte of data) {
    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      blocks.push(value >>> 0);
      value = 0;
      shift = 0;

      if (blocks.length === expectedCount) break;
    } else {
      shift += 7;

      if (shift > 28) {
        throw new Error("Invalid block data: VarInt is too large");
      }
    }
  }

  if (blocks.length !== expectedCount) {
    throw new Error(
      `Block count mismatch: expected ${expectedCount}, got ${blocks.length}`
    );
  }

  return blocks;
}

async function parseSchematic(buffer) {
  let parsed;

  try {
    parsed = await nbt.parse(buffer);
  } catch (error) {
    throw new Error("Could not read NBT data: " + error.message);
  }

  const root = nbt.simplify(parsed);

  const schematic = root.Schematic || root;

  const width = Number(getValue(schematic.Width));
  const height = Number(getValue(schematic.Height));
  const length = Number(getValue(schematic.Length));

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !Number.isInteger(length) ||
    width < 1 ||
    height < 1 ||
    length < 1
  ) {
    throw new Error("Invalid schematic dimensions or unsupported format");
  }

  const palette = getValue(schematic.Palette);
  const blockData = getValue(schematic.BlockData);

  if (!palette || !blockData) {
    throw new Error("Sponge schematic Palette or BlockData is missing");
  }

  const expectedCount = width * height * length;

  if (expectedCount > 1000000) {
    throw new Error("Schematic is too large (maximum 1 million blocks)");
  }

  const paletteEntries = Object.entries(palette)
    .map(([name, id]) => [Number(getValue(id)), name])
    .sort((a, b) => a[0] - b[0]);

  const paletteById = Object.fromEntries(paletteEntries);

  const blocks = decodeVarints(
    Buffer.from(blockData),
    expectedCount
  );

  return {
    format: "Sponge Schematic",
    width,
    height,
    length,
    totalBlocks: blocks.length,
    palette: paletteById,
    blocks
  };
}

module.exports = { parseSchematic };

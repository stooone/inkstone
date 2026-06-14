// Returns the asset file that a given character is found in.
const assetForCharacter = (x) => `characters_v2/${Math.floor(x.charCodeAt(0) / 256)}`;

export { assetForCharacter };

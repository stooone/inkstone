import { check, Match } from '/src/store/meteor-mock';

const Character = Match.Where((x) => check(x, String) || x.length === 1);

const CharacterData = {
  character: Character,
  decomposition: String,
  definition: Match.Maybe(String),
  etymology: Match.Maybe(Object),
  pinyin: [String],
  radical: Character,
  matches: [Match.Maybe([Match.Integer])],
  strokes: [String],
  medians: [[[Number]]],
  dependencies: Object,
  components: [Object],
};

// Returns the asset file that a given character is found in.
const assetForCharacter = (x) => `characters_v2/${Math.floor(x.charCodeAt(0) / 256)}`;

export { CharacterData, assetForCharacter };

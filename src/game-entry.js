/* =====================================================================
 * Entry point for using the character system INSIDE the Limonat game
 * (no UI, no Three.js). Bundle it for the game's classic <script> tags:
 *
 *   npx esbuild src/game-entry.js --bundle --format=iife --global-name=LimonatCC --outfile=limonat-cc.js
 *
 * Then, in the game, after js/character.js:
 *   const r = LimonatCC.validateDocument(json);          // untrusted JSON → checked config
 *   if (r.config) VR.CHARACTERS.push(LimonatCC.toLimonatCharacter(r.config, 'player_1'));
 * ===================================================================== */
import './assets/index.js';
import { compile } from './core/compile.js';
import { validateDocument, extractJson, baseConfig } from './schema/validate.js';
import { toLimonatDef } from './export/limonat.js';
import { SCHEMA_VERSION } from './core/constants.js';

/** A ready VR.CHARACTERS entry from a validated character config. */
export function toLimonatCharacter(config, id) {
  return toLimonatDef(compile(config), { name: config.name, id });
}

export { compile, validateDocument, extractJson, baseConfig, toLimonatDef, SCHEMA_VERSION };

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "game/constants/game.js";
import { Game } from "engine/Game.js";
import { BattleScene } from "./scenes/BattleScene.js";

export class BombermanGame extends Game {
	scene = new BattleScene(this.frameTime, this.camera);

	constructor() {
		super("body", SCREEN_WIDTH, SCREEN_HEIGHT);
	}
}


import { drawTile } from "engine/context.js";
import { Entity } from "engine/Entity.js";
import { TILE_SIZE } from "game/constants/game.js";
import { tileMap } from "game/constants/LevelData.js";

export class LevelMap extends Entity {
	constructor() {
		super({ x: 0, y: 0 });

		this.tileMap = [...tileMap];
		this.image = document.querySelector("img#stage");
		this.stageImage = new OffscreenCanvas(1024, 1024);

		this.buildStage();
	}

	updateStageImageAt(columnIndex, rowIndex, tile) {
		const context = this.stageImage.getContext("2d");
		drawTile(
			context,
			this.image,
			tile,
			columnIndex * TILE_SIZE,
			rowIndex * TILE_SIZE,
			TILE_SIZE
		);
	}

	buildStage() {
		for (let rowIndex = 0; rowIndex < this.tileMap.length; rowIndex++) {
			for (
				let columnIndex = 0;
				columnIndex < this.tileMap[rowIndex].length;
				columnIndex++
			) {
				const tile = this.tileMap[rowIndex][columnIndex];
				this.updateStageImageAt(columnIndex, rowIndex, tile);
			}
		}
	}

	update = () => undefined;

	draw(context, camera) {
		context.drawImage(this.stageImage, -camera.position.x, -camera.position.y);
	}
}

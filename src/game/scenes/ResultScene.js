import { Scene } from "engine/Scene.js";
import * as control from "engine/inputHandler.js";
import { Control } from "game/constants/controls.js";
import {
	SCREEN_WIDTH,
	SCREEN_HEIGHT,
	NO_PLAYERS,
} from "game/constants/game.js";

export class ResultScene extends Scene {
	/**
	 * @param {{wins:number[], maxWins:number}} gameState
	 * @param {number} winnerId  前のラウンドの勝者ID（-1 のときは全滅）
	 * @param {Array<{id:number,color:any}>} playerConfigs 直近のプレイヤー設定（今は未使用でもOK）
	 * @param {{onRematch:()=>void, onBackToRoom:()=>void}} callbacks
	 */
	constructor(gameState, winnerId, playerConfigs, callbacks) {
		super();
		this.gameState = gameState;
		this.winnerId = winnerId;
		this.playerConfigs = playerConfigs || [];

		this.onRematch = callbacks.onRematch;
		this.onBackToRoom = callbacks.onBackToRoom;

		this.menuOptions = ["もう一度バトル", "ルームに戻る"];
		this.selectedIndex = 0;
		this.timer = 0;
	}

	update(time) {
		this.timer += time.secondsPassed;

		// メニュー操作はとりあえず 1P の入力だけ見る
		if (control.isControlPressed(0, Control.UP)) {
			this.selectedIndex =
				(this.selectedIndex + this.menuOptions.length - 1) %
				this.menuOptions.length;
		}
		if (control.isControlPressed(0, Control.DOWN)) {
			this.selectedIndex = (this.selectedIndex + 1) % this.menuOptions.length;
		}

		if (
			control.isControlPressed(0, Control.START) ||
			control.isControlPressed(0, Control.ACTION)
		) {
			const selected = this.menuOptions[this.selectedIndex];
			if (selected === "もう一度バトル" && this.onRematch) {
				this.onRematch();
			} else if (selected === "ルームに戻る" && this.onBackToRoom) {
				this.onBackToRoom();
			}
		}
	}

	draw(context) {
		// 背景
		context.fillStyle = "#202030";
		context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		// 上部タイトルバー
		const barY = 16;
		context.fillStyle = "#3c4b7a";
		context.fillRect(24, barY, SCREEN_WIDTH - 48, 32);
		context.strokeStyle = "#111422";
		context.lineWidth = 2;
		context.strokeRect(24.5, barY + 0.5, SCREEN_WIDTH - 49, 31);

		context.save();
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.font = "bold 20px sans-serif";
		context.fillStyle = "#ffffff";
		context.fillText("リザルト", SCREEN_WIDTH / 2, barY + 16);
		context.restore();

		// 勝者メッセージ
		context.save();
		context.textAlign = "center";
		context.textBaseline = "top";
		context.font = "bold 18px monospace";
		if (this.winnerId != null && this.winnerId >= 0) {
			context.fillStyle = "#ffff80";
			context.fillText(`${this.winnerId + 1}P WIN!`, SCREEN_WIDTH / 2, 64);
		} else {
			context.fillStyle = "#ffffff";
			context.fillText("DRAW", SCREEN_WIDTH / 2, 64);
		}
		context.restore();

		// スコア一覧
		const tableTop = 96;
		const colW = Math.floor(SCREEN_WIDTH / NO_PLAYERS);

		context.save();
		context.textAlign = "center";
		context.textBaseline = "top";
		context.font = "12px monospace";

		for (let id = 0; id < NO_PLAYERS; id++) {
			const xCenter = colW * id + colW / 2;
			const wins = this.gameState.wins[id] ?? 0;

			context.fillStyle = id === this.winnerId ? "#ffff80" : "#ffffff";

			context.fillText(`${id + 1}P`, xCenter, tableTop);
			context.fillText(`WIN: ${wins}`, xCenter, tableTop + 20);
		}
		context.restore();

		// メニュー
		context.save();
		context.textAlign = "left";
		context.textBaseline = "top";
		context.font = "14px monospace";
		const startY = SCREEN_HEIGHT - 80;
		const baseX = Math.floor(SCREEN_WIDTH / 2 - 80);
		const arrowX = baseX - 20;

		for (let i = 0; i < this.menuOptions.length; i++) {
			const y = startY + i * 22;
			const isSelected = i === this.selectedIndex;
			context.fillStyle = isSelected ? "#ffff80" : "#ffffff";
			context.fillText(this.menuOptions[i], baseX, y);
			if (isSelected && Math.floor(this.timer * 4) % 2 === 0) {
				context.fillText("▶", arrowX, y);
			}
		}
		context.restore();
	}
}

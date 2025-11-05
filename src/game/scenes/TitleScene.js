import { Scene } from "engine/Scene.js";
import * as control from "engine/inputHandler.js";
import { Control } from "game/constants/controls.js";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "game/constants/game.js";

export class TitleScene extends Scene {
	constructor(onBattleModeSelected) {
		super();
		this.onBattleModeSelected = onBattleModeSelected;
		this.options = ["NORMAL GAME", "BATTLE MODE", "PASSWORD"];
		this.selectedIndex = 1; // デフォルトで BATTLE MODE
		this.blinkTimer = 0;
	}

	update(time) {
		this.blinkTimer += time.secondsPassed;

		if (control.isControlPressed(0, Control.UP)) {
			this.selectedIndex =
				(this.selectedIndex + this.options.length - 1) % this.options.length;
		}

		if (control.isControlPressed(0, Control.DOWN)) {
			this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
		}

		if (
			control.isControlPressed(0, Control.START) ||
			control.isControlPressed(0, Control.ACTION)
		) {
			const option = this.options[this.selectedIndex];

			if (option === "BATTLE MODE") {
				// ★ここでルーム選択へ
				this.onBattleModeSelected();
			}
			// NORMAL / PASSWORD は今はまだ未実装でOK
		}
	}

	draw(context) {
		// --- 背景：レトロな青空 ---
		context.fillStyle = "#0040c8";
		context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		// 下のビル群シルエット（それっぽく並べる）
		const groundY = SCREEN_HEIGHT - 40;
		for (let x = 0; x < SCREEN_WIDTH; x += 24) {
			const h = 20 + ((x * 13) % 30); // ランダムっぽく高さを変える
			context.fillStyle = "#6060a0";
			context.fillRect(x, groundY - h, 18, h);
		}

		const centerX = SCREEN_WIDTH / 2;

		// --- タイトルロゴっぽい文字 ---
		context.textAlign = "center";
		context.textBaseline = "top";

		// 「SUPER」
		context.font = "bold 24px sans-serif";
		context.fillStyle = "#ffffff";
		context.fillText("ECC", centerX, 24);

		// 「BOMBERMAN」：上が黄色→下が赤のグラデーション
		context.font = "bold 32px sans-serif";
		const gradient = context.createLinearGradient(0, 64, 0, 112);
		gradient.addColorStop(0, "#ffe680");
		gradient.addColorStop(0.5, "#ff8c1a");
		gradient.addColorStop(1, "#d01010");
		context.fillStyle = gradient;
		context.fillText("BOMBERMAN", centerX, 56);

		// --- メニュー ---
		context.textAlign = "left";
		context.font = "bold 14px monospace";
		const startY = 132;

		for (let i = 0; i < this.options.length; i++) {
			const y = startY + i * 18;
			const isSelected = i === this.selectedIndex;

			context.fillStyle = isSelected ? "#ffff80" : "#ffffff";
			context.fillText(this.options[i], 96, y);

			// 選択中の行に点滅する矢印を表示
			if (isSelected && Math.floor(this.blinkTimer * 4) % 2 === 0) {
				context.fillText("▶", 80, y);
			}
		}

		// --- フッター ---
		context.textAlign = "center";
		context.font = "10px monospace";
		context.fillStyle = "#ffffff";
		context.fillText("PRESS START", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 18);
	}
}

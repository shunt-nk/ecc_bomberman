import { SCREEN_WIDTH, STAGE_OFFSET_Y } from "game/constants/game.js";
import { drawText } from "game/utils/drawText.js";

export class BattleHud {
	image = document.querySelector("img#hud");

	// [分, 秒]
	clock = [3, 0];
	clockTimer = 0;
	timeUp = false;

	constructor(time, state) {
		this.state = state;

		const baseTime =
			time && typeof time.previous === "number" ? time.previous : 0;

		this.clockTimer = baseTime.previous + 1000;
		// 時間切れフラグ
		this.timeUp = false;
	}

	// time はもう使わない。呼び出し側は this.hud.update() だけでOK
	update(time) {
		// すでにタイムアップなら何もしない
		if (this.timeUp) return;

		// 1秒ごとにカウントダウン
		if (time.previous < this.clockTimer) return;

		this.clockTimer = time.previous + 1000;
		this.clock[1]--;

		if (this.clock[1] < 0) {
			this.clock[0]--;
			this.clock[1] = 59;
		}

		if (this.clock[0] < 0) {
			this.clock[0] = 0;
			this.clock[1] = 0;
		}

		// ★ 0:00 になったらフラグON
		if (this.clock[0] === 0 && this.clock[1] === 0) {
			this.timeUp = true;
		}
	}

	draw(context) {
		// HUD背景
		context.drawImage(
			this.image,
			9,
			40,
			SCREEN_WIDTH,
			STAGE_OFFSET_Y,
			0,
			0,
			SCREEN_WIDTH,
			STAGE_OFFSET_Y
		);

		// 時計
		drawText(
			context,
			`${String(this.clock[0])}:${String(this.clock[1]).padStart(2, "0")}`,
			32,
			8
		);

		// ★ state / wins が無ければスコアは描かない（クラッシュ防止）
		if (!this.state || !this.state.wins) return;

		const wins = this.state.wins;

		// 勝利数を表示
		for (let id = 0; id < wins.length; id++) {
			drawText(context, String(wins[id]), 104 + id * 32, 8);
		}
	}
}

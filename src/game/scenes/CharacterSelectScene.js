import { Scene } from "engine/Scene.js";
import * as control from "engine/inputHandler.js";
import { Control } from "game/constants/controls.js";
import {
	SCREEN_WIDTH,
	SCREEN_HEIGHT,
	NO_PLAYERS,
} from "game/constants/game.js";
import {
	BombermanColor,
	BombermanPlayerData,
} from "game/constants/bonberman.js";
import { getClient } from "../../net/client.js";

// 画面に出す候補（SFCっぽい5色）
const CHOICES = [
	BombermanColor.WHITE,
	BombermanColor.BLACK,
	BombermanColor.RED,
	BombermanColor.BLUE,
	BombermanColor.GREEN,
];
const NUM_COLORS = CHOICES.length;

// 文字の描画ヘルパ（中央寄せ）
function drawCenteredText(ctx, txt, y, font, fill) {
	ctx.save();
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	ctx.font = font;
	ctx.fillStyle = fill;
	ctx.fillText(txt, SCREEN_WIDTH / 2, y);
	ctx.restore();
}

export class CharacterSelectScene extends Scene {
	constructor(onComplete, options = {}) {
		super();
		this.onComplete = onComplete;

		this.localPlayerId = options.localPlayerId ?? 0;
		this.roomPlayers = options.roomPlayers ?? [];
		this.roomId = options.roomId ?? null;

		// 自分がホストかどうか（ルーム情報に isHost があればそれを使う）
		const me =
			this.roomPlayers.find((p) => p.id === this.localPlayerId) || null;
		this.isHost = me ? !!me.isHost : this.localPlayerId === 0;

		// 全員ロック済みかどうか（クライアント側で slots から計算する）
		this.allLocked = false;

		// ネットクライアント
		this.net = getClient();
		this.setupNetHandlers();

		// プレイヤー数（ルームにいる人数 or NO_PLAYERS）
		const maxPlayers =
			this.roomPlayers && this.roomPlayers.length > 0
				? this.roomPlayers.length
				: NO_PLAYERS;

		// 選択スロット
		this.slots = Array.from({ length: maxPlayers }, (_, id) => ({
			id,
			colorIndex: id, // とりあえず P1→0, P2→1...
			locked: false,
		}));

		this.cursorIndex = this.localPlayerId;
	}

	setupNetHandlers() {
		this.net.on("charSelectState", (payload) => {
			console.log("[CS] charSelectState:", payload);
			if (!payload || !payload.players) return;

			// サーバから送られてきた状態をローカルスロットに反映
			for (const slot of this.slots) {
				const p = payload.players.find((pp) => pp.id === slot.id);
				if (!p) continue;
				slot.colorIndex = p.colorIndex;
				slot.locked = p.locked;
			}

			// allLocked はローカルの slots から再計算
			this.allLocked =
				this.slots.length > 0 && this.slots.every((s) => s.locked);
			console.log(
				"[CS] slots after state:",
				this.slots,
				"allLocked:",
				this.allLocked
			);
		});

		this.net.on("charSelectDone", (payload) => {
			console.log("[CS] charSelectDone received:", payload);
			if (!payload || !payload.configs) return;

			// サーバから { id, colorIndex } が飛んでくる想定
			const configs = payload.configs.map((c) => {
				const data = BombermanPlayerData[c.id];
				const baseColor = data?.color; // 必要なら colorIndex から色を引き直しても良い
				return {
					id: c.id,
					color: baseColor,
				};
			});

			this.onComplete(configs);
		});
	}

	update(time) {
		// 自分のスロット
		const slot = this.slots[this.localPlayerId];
		if (!slot) return;

		const inputIndex = 0; // 各クライアントは「ローカル1P入力」を見る

		// ロックされていない間は、色変更とロック操作
		if (!slot.locked) {
			let changed = false;
			let nextIndex = slot.colorIndex;

			if (control.isControlPressed(inputIndex, Control.LEFT)) {
				nextIndex = (slot.colorIndex + NUM_COLORS - 1) % NUM_COLORS;
				changed = true;
			}
			if (control.isControlPressed(inputIndex, Control.RIGHT)) {
				nextIndex = (slot.colorIndex + 1) % NUM_COLORS;
				changed = true;
			}

			if (changed) {
				// ローカル更新
				slot.colorIndex = nextIndex;

				// サーバーにも通知
				this.net.send("charSelectSetColor", {
					roomId: this.roomId,
					colorIndex: nextIndex,
				});
			}

			// 決定ボタンでロック
			if (
				control.isControlPressed(inputIndex, Control.ACTION) ||
				control.isControlPressed(inputIndex, Control.START)
			) {
				console.log("[CS] lock request from player", this.localPlayerId);

				// ローカル即ロック
				slot.locked = true;

				// サーバーへロック送信
				this.net.send("charSelectSetLocked", {
					roomId: this.roomId,
					locked: true,
				});
			}
		}

		// ローカル側でも allLocked を再確認しておく
		this.allLocked = this.slots.length > 0 && this.slots.every((s) => s.locked);

		// 全員ロック済み ＋ 自分がホスト のときだけ「バトル開始」入力を見る
		if (this.allLocked && this.isHost) {
			if (control.isControlPressed(inputIndex, Control.START)) {
				console.log("[CS] host start battle");
				this.net.send("charSelectStartBattle", {
					roomId: this.roomId,
				});
			}
		}
	}

	draw(context) {
		// レトロな背景
		context.fillStyle = "#30384c";
		context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		// 上部パネル（SFC風タイトル）
		const grad = context.createLinearGradient(0, 0, 0, 40);
		grad.addColorStop(0, "#d7d7ff");
		grad.addColorStop(1, "#7aa2ff");
		context.fillStyle = grad;
		context.fillRect(24, 12, SCREEN_WIDTH - 48, 40);
		context.strokeStyle = "#203060";
		context.lineWidth = 2;
		context.strokeRect(24, 12, SCREEN_WIDTH - 48, 40);

		drawCenteredText(
			context,
			"キャラクターセレクト",
			19,
			"bold 18px sans-serif",
			"#00163a"
		);

		// 上段の色パレット
		const bandY = 70;
		const cellW = 52;
		const bandLeft = Math.floor((SCREEN_WIDTH - CHOICES.length * cellW) / 2);
		for (let i = 0; i < CHOICES.length; i++) {
			const x = bandLeft + i * cellW;
			context.fillStyle = "#1c2133";
			context.fillRect(x, bandY, 44, 44);
			context.strokeStyle = "#6d6d9a";
			context.strokeRect(x + 0.5, bandY + 0.5, 44, 44);

			const color = CHOICES[i];
			const swatch =
				{
					[BombermanColor.WHITE]: "#ffffff",
					[BombermanColor.BLACK]: "#3b3b3b",
					[BombermanColor.RED]: "#ff5252",
					[BombermanColor.BLUE]: "#4aa3ff",
					[BombermanColor.GREEN]: "#63d86b",
				}[color] || "#fff";

			context.fillStyle = swatch;
			context.beginPath();
			context.arc(x + 22, bandY + 22, 12, 0, Math.PI * 2);
			context.fill();
			context.strokeStyle = "#000000";
			context.stroke();
		}

		// 下段のプレイヤースロット
		this.drawPlayerSlots(context);

		// 状態に応じたメッセージ
		if (!this.allLocked) {
			drawCenteredText(
				context,
				"色を選んで決定ボタンでロックしてください",
				SCREEN_HEIGHT - 40,
				"10px sans-serif",
				"#ffffff"
			);
		} else {
			if (this.isHost) {
				drawCenteredText(
					context,
					"全員の準備ができました。Enterキーでバトル開始！",
					SCREEN_HEIGHT - 40,
					"10px sans-serif",
					"#ffff80"
				);
			} else {
				drawCenteredText(
					context,
					"ホストがバトルを開始するのを待っています...",
					SCREEN_HEIGHT - 40,
					"10px sans-serif",
					"#ffffff"
				);
			}
		}
	}

	drawPlayerSlots(context) {
		const baseY = 120;
		const baseX = 32;
		const slotWidth = 40;
		const slotHeight = 24;
		const gap = 8;

		const COLORS = ["#ffffff", "#3b3b3b", "#ff5252", "#4aa3ff", "#63d86b"];

		for (let i = 0; i < this.slots.length; i++) {
			const slot = this.slots[i];
			const x = baseX + i * (slotWidth + gap);
			const y = baseY;

			// 枠
			context.lineWidth = 2;
			if (slot.id === this.localPlayerId) {
				context.strokeStyle = "#ffff80"; // 自分は黄色枠
			} else {
				context.strokeStyle = "#ffffff";
			}
			if (slot.locked) {
				context.strokeStyle = "#ff8080"; // ロック済みは赤枠
			}

			context.strokeRect(x + 0.5, y + 0.5, slotWidth, slotHeight);

			// プレイヤー番号 (P1, P2, ...)
			context.font = "10px monospace";
			context.fillStyle = "#ffffff";
			context.textAlign = "left";
			context.textBaseline = "middle";
			context.fillText(`P${slot.id + 1}`, x + 4, y + slotHeight / 2);

			// 選択している色のミニ表示
			const colorIndex = slot.colorIndex % COLORS.length;
			const color = COLORS[colorIndex];

			context.fillStyle = color;
			context.fillRect(x + slotWidth - 14, y + 4, 10, slotHeight - 8);
		}
	}
}

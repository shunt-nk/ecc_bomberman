// src/game/scenes/RoomScene.js

import { Scene } from "engine/Scene.js";
import * as control from "engine/inputHandler.js";
import { Control } from "game/constants/controls.js";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "game/constants/game.js";
import { getClient } from "../../net/client.js"; // ★ 相対パスに注意

export class RoomScene extends Scene {
	constructor(onReadyAllPlayers) {
		super();

		this.onReadyAllPlayers = onReadyAllPlayers;

		// ネットクライアント
		this.net = getClient();

		// 画面状態
		this.menuOptions = ["ルームを作成", "ルームに参加"];
		this.menuIndex = 0;
		this.mode = "menu"; // "menu" | "joining" | "host" | "join"
		this.blinkTimer = 0;

		// ルーム情報
		this.roomId = null;
		this.playerId = null;
		this.players = []; // { id, isHost, isReady } の想定

		this.setupNetHandlers();
	}

	setupNetHandlers() {
		// ルーム作成完了
		this.net.on("roomCreated", (payload) => {
			this.roomId = payload.roomId;
			this.playerId = payload.playerId;
			this.players = payload.players || [];
			this.mode = "host";
		});

		// ルーム参加完了
		this.net.on("roomJoined", (payload) => {
			this.roomId = payload.roomId;
			this.playerId = payload.playerId;
			this.players = payload.players || [];
			this.mode = "join";
		});

		// ルーム状態更新（誰が入った/出た/READY変更など）
		this.net.on("roomUpdate", (payload) => {
			this.players = payload.players || [];
		});

		// ホストがゲーム開始した合図
		this.net.on("gameStart", (payload) => {
			// payload.configs: [{ id, color }, ...] を想定
			if (this.onReadyAllPlayers) {
				this.onReadyAllPlayers(this.playerId, this.players, this.roomId);
			}
		});
	}

	// --- サーバーへの送信系 ---

	sendCreateRoom() {
		this.mode = "joining";
		this.net.send("createRoom", {});
	}

	sendJoinRoom() {
		this.mode = "joining";
		// ひとまず「空いてるルームに参加」的なAPIを想定
		this.net.send("joinAny", {});
	}

	sendToggleReady() {
		if (!this.roomId) return;
		this.net.send("setReady", { roomId: this.roomId });
	}

	sendStartGame() {
		if (!this.roomId) return;
		this.net.send("startGame", { roomId: this.roomId });
	}

	// --- メインループ ---

	update(time) {
		this.blinkTimer += time.secondsPassed;

		// 1: メニュー（ルーム作成/参加）
		if (this.mode === "menu") {
			if (control.isControlPressed(0, Control.UP)) {
				this.menuIndex =
					(this.menuIndex + this.menuOptions.length - 1) %
					this.menuOptions.length;
			}
			if (control.isControlPressed(0, Control.DOWN)) {
				this.menuIndex = (this.menuIndex + 1) % this.menuOptions.length;
			}

			if (
				control.isControlPressed(0, Control.START) ||
				control.isControlPressed(0, Control.ACTION)
			) {
				const selected = this.menuOptions[this.menuIndex];
				if (selected === "ルームを作成") {
					this.sendCreateRoom();
				} else {
					this.sendJoinRoom();
				}
			}
			return;
		}

		// 2: サーバー応答待ち
		if (this.mode === "joining") {
			return;
		}

		// 3: ホスト画面
		if (this.mode === "host") {
			// READY トグル
			if (control.isControlPressed(0, Control.ACTION)) {
				this.sendToggleReady();
			}

			// 全員 READY になったら START でゲーム開始
			const allReady =
				this.players.length > 0 && this.players.every((p) => p.isReady);

			if (allReady && control.isControlPressed(0, Control.START)) {
				this.sendStartGame();
			}
			return;
		}

		// 4: 参加者画面
		if (this.mode === "join") {
			// 自分の READY トグル
			if (control.isControlPressed(0, Control.ACTION)) {
				this.sendToggleReady();
			}
			// ホストの startGame を待つだけ
			return;
		}
	}

	// --- 描画 ---

	draw(context) {
		// 背景
		context.fillStyle = "#202438";
		context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		// タイトルバー
		const barY = 16;
		context.fillStyle = "#3c4b7a";
		context.fillRect(24, barY, SCREEN_WIDTH - 48, 32);
		context.strokeStyle = "#111422";
		context.lineWidth = 2;
		context.strokeRect(24.5, barY + 0.5, SCREEN_WIDTH - 49, 31);

		// タイトル文字
		context.save();
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.font = "bold 20px sans-serif";
		context.fillStyle = "#ffffff";
		context.fillText("ルーム選択", SCREEN_WIDTH / 2, barY + 16);
		context.restore();

		// ★ デバッグ用：現在の mode を左上に表示
		context.save();
		context.textAlign = "left";
		context.textBaseline = "top";
		context.font = "10px monospace";
		context.fillStyle = "#ffcc88";
		context.fillText(`MODE: ${this.mode}`, 8, 48);
		context.restore();

		if (this.mode === "menu") {
			this.drawMenu(context);
		} else if (this.mode === "joining") {
			this.drawJoining(context);
		} else if (this.mode === "host") {
			this.drawHost(context);
		} else if (this.mode === "join") {
			this.drawJoin(context);
		}
	}

	drawMenu(context) {
		context.save();
		context.font = "bold 14px monospace";
		context.textBaseline = "top";
		context.textAlign = "left";

		const startY = 80;
		const baseX = Math.floor(SCREEN_WIDTH / 2 - 60);
		const arrowX = baseX - 20;

		for (let i = 0; i < this.menuOptions.length; i++) {
			const y = startY + i * 24;
			const isSelected = i === this.menuIndex;

			context.fillStyle = isSelected ? "#ffff80" : "#ffffff";
			context.fillText(this.menuOptions[i], baseX, y);

			if (isSelected && Math.floor(this.blinkTimer * 4) % 2 === 0) {
				context.fillText("▶", arrowX, y);
			}
		}

		context.font = "10px monospace";
		context.fillStyle = "#ffffff";
		context.textAlign = "center";
		context.fillText(
			"↑↓で選択 / Enterで決定",
			SCREEN_WIDTH / 2,
			SCREEN_HEIGHT - 24
		);
		context.restore();
	}

	drawJoining(context) {
		context.save();
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.font = "bold 16px monospace";
		context.fillStyle = "#ffffff";
		context.fillText(
			"サーバーに接続中...",
			SCREEN_WIDTH / 2,
			SCREEN_HEIGHT / 2
		);
		context.restore();
	}

	drawHost(context) {
		context.save();
		context.textAlign = "left";
		context.textBaseline = "top";
		context.font = "12px monospace";
		context.fillStyle = "#ffffff";

		context.fillText(`ルームID: ${this.roomId || "----"}`, 32, 64);
		context.fillText(`あなた: プレイヤー${(this.playerId ?? 0) + 1}`, 32, 80);

		const startY = 110;
		for (let i = 0; i < this.players.length; i++) {
			const p = this.players[i];
			const y = startY + i * 18;
			const mark = p.isHost ? "[HOST]" : "      ";
			const ready = p.isReady ? "準備完了" : "準備待ち";
			context.fillText(`${mark} P${p.id + 1}: ${ready}`, 32, y);
		}

		context.textAlign = "center";
		const blink = Math.floor(this.blinkTimer * 2) % 2 === 0;
		context.fillStyle = blink ? "#ffff80" : "#ffffff";
		context.fillText(
			"[Space]で準備完了 / [Enter]でスタート",
			SCREEN_WIDTH / 2,
			SCREEN_HEIGHT - 32
		);

		context.restore();
	}

	drawJoin(context) {
		context.save();
		context.textAlign = "left";
		context.textBaseline = "top";
		context.font = "12px monospace";
		context.fillStyle = "#ffffff";

		context.fillText(`ルームID: ${this.roomId || "----"}`, 32, 64);
		context.fillText(`あなた: プレイヤー${(this.playerId ?? 0) + 1}`, 32, 80);

		const startY = 110;
		for (let i = 0; i < this.players.length; i++) {
			const p = this.players[i];
			const y = startY + i * 18;
			const mark = p.isHost ? "[HOST]" : "      ";
			const ready = p.isReady ? "準備完了" : "準備待ち";
			context.fillText(`${mark} P${p.id + 1}: ${ready}`, 32, y);
		}

		context.textAlign = "center";
		const blink = Math.floor(this.blinkTimer * 2) % 2 === 0;
		context.fillStyle = blink ? "#ffff80" : "#ffffff";
		context.fillText(
			"[Space]キーで準備完了 / ホストの開始待ち",
			SCREEN_WIDTH / 2,
			SCREEN_HEIGHT - 32
		);

		context.restore();
	}
}

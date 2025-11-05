import { Scene } from "engine/Scene.js";
import { BombermanStateType } from "game/constants/bonberman.js";
import {
	HALF_TILE_SIZE,
	NO_PLAYERS,
	STAGE_OFFSET_Y,
} from "game/constants/game.js";
import { BattleHud } from "game/entities/BattleHud.js";
import { Bomberman } from "game/entities/Bomberman.js";
import { Stage } from "game/entities/Stage.js";
import { BlockSystem } from "game/systems/BlockSystem.js";
import { BombSystem } from "game/systems/BombSystem.js";
import { PowerupSystem } from "game/systems/PowerupSystem.js";
import { getClient } from "../../net/client.js";

export class BattleScene extends Scene {
	players = [];

	constructor(time, camera, playerConfigs, gameState, onEnd, options = {}) {
		super();

		const initialTime = time || {
			previous: 0,
			secondsPassed: 0,
			delta: 0,
		};

		this.lastTime = initialTime;

		// ★ ここ大事：state と onEnd を正しく保持
		this.gameState = gameState; // { wins: [...], maxWins: ... }
		this.onEnd = onEnd; // ラウンド終了時に呼ぶ関数

		this.localPlayerId = options.localPlayerId ?? 0;
		this.roomId = options.roomId ?? null; // ★ RoomScene から後で渡してもらう
		this.net = getClient();
		this.setupNetHandlers();

		this.stage = new Stage();
		this.hud = new BattleHud(initialTime, this.gameState);
		this.powerupSystem = new PowerupSystem(initialTime, this.players);
		this.blockSystem = new BlockSystem(
			this.stage.updateMapAt,
			this.stage.getCollisionTileAt,
			this.powerupSystem.add
		);
		this.bombSystem = new BombSystem(
			this.stage.collisionMap,
			this.blockSystem.add
		);

		// configs が無ければ従来通り NO_PLAYERS 人分を生成
		const configs =
			Array.isArray(playerConfigs) && playerConfigs.length
				? playerConfigs
				: Array.from({ length: NO_PLAYERS }, (_, id) => ({
						id,
						color: undefined,
				  }));

		for (const cfg of configs) {
			this.addPlayer(cfg.id, initialTime, cfg.color);
		}

		this.initialPlayerCount = this.players.length;

		camera.position = { x: HALF_TILE_SIZE, y: -STAGE_OFFSET_Y };
	}

	setupNetHandlers() {
		// 他プレイヤーの状態更新を受信
		this.net.on("playerStateUpdate", (payload) => {
			// payload: { id, x, y, direction }
			if (!payload) return;
			const { id, x, y, direction } = payload;

			const player = this.players.find((p) => p.id === id);
			if (!player) return;

			// 自分のキャラは自前で動かすので上書きしない
			if (player.isLocal) return;

			player.position.x = x;
			player.position.y = y;
			if (direction != null) {
				player.direction = direction;
			}
		});

		// ★ 他プレイヤーの爆弾設置
		this.net.on("bombPlaced", (payload) => {
			if (!payload) return;
			const { playerId, row, column, strength } = payload;

			const cell = { row, column };

			// 爆弾が爆発したときに呼ばれるコールバック（残弾を戻すやつ）
			const owner = this.players.find((p) => p.id === playerId);
			const onExplode =
				owner && owner.handleBombExploded
					? owner.handleBombExploded.bind(owner)
					: () => {};

			const bombTime = this.lastTime || {
				previous: 0,
				secondsPassed: 0,
				delta: 0,
			};

			console.log("[client] bombPlaced:", payload);
			this.bombSystem.add(cell, strength, bombTime, onExplode);
		});
	}

	removePlayer = (id) => {
		const index = this.players.findIndex((player) => player.id === id);
		if (index < 0) return;
		this.players.splice(index, 1);
	};

	addPlayer(id, time, colorOverride) {
		const isLocal = id === this.localPlayerId;
		// ★ Bomberman から呼ばれる「爆弾設置」コールバックを用意
		const onBombPlaced = (cell, strength, bombTime, onExplode) => {
			// まずローカルに爆弾を追加
			this.bombSystem.add(cell, strength, bombTime, onExplode);

			// ローカルプレイヤーならサーバーへも通知
			if (isLocal && this.net && this.roomId != null) {
				this.net.send("placeBomb", {
					roomId: this.roomId,
					row: cell.row,
					column: cell.column,
					strength,
				});
			}
		};

		this.players.push(
			new Bomberman(
				id,
				time,
				this.stage.getCollisionTileAt,
				onBombPlaced,
				this.removePlayer,
				{ color: colorOverride, isLocal: id === this.localPlayerId }
			)
		);
	}

	update(time) {
		this.lastTime = time;
		// time.delta が来る形でも来ない形でも一応保険
		// const dt = time && typeof time.delta === "number" ? time.delta : 16;

		// ① HUD 更新 ＆ タイムアップ確認
		if (this.hud && this.hud.update) {
			this.hud.update(time);

			// BattleHud 内で this.timeUp = true にしている前提
			if (this.hud.timeUp) {
				if (typeof this.onEnd === "function") {
					// -1 = タイムアップ or 引き分け扱い
					this.onEnd(-1);
				}
				return;
			}
		}

		// ② ブロック／爆弾／パワーアップは常に進める
		this.powerupSystem.update(time);
		this.blockSystem.update(time);
		this.bombSystem.update(time);

		// ③ 全プレイヤーの更新（もう freeze は見ない）
		for (const player of this.players) {
			player.update(time);
		}

		// ④ ローカルプレイヤーの位置をサーバーへ送信
		const me = this.players.find((p) => p.isLocal);
		if (me && this.net && this.roomId != null) {
			this.net.send("playerState", {
				roomId: this.roomId, // サーバー側では使ってないけど付けておいてOK
				id: me.id,
				x: me.position.x,
				y: me.position.y,
				direction: me.direction,
			});
		}

		// ⑤ 勝敗チェック
		this.checkEndGame();
	}

	checkEndGame() {
		// onEnd が関数じゃなければ何もしない（保険）
		if (typeof this.onEnd !== "function") return;

		// テスト用：1人だけで始まっている場合
		if (this.initialPlayerCount <= 1) {
			if (this.players.length === 0) {
				this.onEnd(-1);
			}
			return;
		}

		// 2人以上なら、まだ2人以上残ってる間は続行
		if (this.players.length > 1) return;

		const isLastPlayerAlive =
			this.players.length > 0 &&
			this.players[0].currentState.type !== BombermanStateType.DEATH;

		this.onEnd(isLastPlayerAlive ? this.players[0].id : -1);
	}

	draw(context, camera) {
		this.stage.draw(context, camera);
		this.hud.draw(context);
		this.blockSystem.draw(context, camera);
		this.powerupSystem.draw(context, camera);
		this.bombSystem.draw(context, camera);

		for (const player of this.players) {
			player.draw(context, camera);
		}
	}
}

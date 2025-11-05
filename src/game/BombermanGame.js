import {
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	NO_PLAYERS,
	MAX_WINS,
} from "game/constants/game.js";
import { Game } from "engine/Game.js";
import { BattleScene } from "./scenes/BattleScene.js";
import { TitleScene } from "./scenes/TitleScene.js";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene.js";
import { RoomScene } from "./scenes/RoomScene.js";
import { ResultScene } from "./scenes/ResultScene.js";

export class BombermanGame extends Game {
	constructor() {
		super("body", SCREEN_WIDTH, SCREEN_HEIGHT);

		this.localPlayerId = 0; // デフォルトは 0(P1)。後でRoomSceneから上書き。

		// 勝ち数などゲーム全体の状態
		this.gameState = {
			wins: new Array(NO_PLAYERS).fill(0),
			maxWins: MAX_WINS,
		};

		// 直近の対戦で使ったプレイヤー設定（id と color）
		this.lastConfigs = null;

		// バトル終了時に呼ばれる（BattleScene から）
		this.handleBattleEnd = (winnerId) => {
			// 勝者に1ポイント加算（-1 のときは全滅扱いでスキップ）
			if (winnerId != null && winnerId >= 0) {
				this.gameState.wins[winnerId] += 1;
			}

			// リザルト画面へ遷移
			this.scene = new ResultScene(this.gameState, winnerId, this.lastConfigs, {
				onRematch: () => this.gotoCharacterSelect(), // もう一度バトル
				onBackToRoom: () => this.gotoRoomScene(), // ルームへ戻る
			});
		};

		// バトル開始
		this.gotoBattle = (configs) => {
			this.lastConfigs = configs;
			this.scene = new BattleScene(
				null,
				this.camera,
				configs,
				this.gameState,
				(winnerId) => this.handleBattleEnd(winnerId),
				{ localPlayerId: this.localPlayerId, roomId: this.roomId }
			);
		};

		// キャラクターセレクトへ
		this.gotoCharacterSelect = () => {
			this.scene = new CharacterSelectScene(this.gotoBattle, {
				localPlayerId: this.localPlayerId,
				roomPlayers: this.roomPlayers,
				roomId: this.roomId,
			});
		};

		// ルーム選択へ
		this.gotoRoomScene = () => {
			this.scene = new RoomScene((playerId, players, roomId) => {
				this.localPlayerId = playerId;
				this.roomPlayers = players;
				this.roomId = roomId;

				this.gotoCharacterSelect();
			});
		};

		// 起動時はタイトルから
		this.scene = new TitleScene(() => this.gotoRoomScene());
	}
}


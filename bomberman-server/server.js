const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

let nextClientId = 1;
const rooms = new Map(); // roomId -> { roomId, players: [ { clientId, ws, id, isHost, isReady, colorIndex, charLocked } ] }

function broadcastCharSelect(room) {
	const players = room.players.map((p) => ({
		id: p.id,
		colorIndex: p.colorIndex,
		locked: p.charLocked,
	}));

	const allLocked =
		room.players.length > 0 && room.players.every((p) => p.charLocked);

	const payload = {
		players,
		allLocked,
	};

	console.log("[server] broadcastCharSelect:", payload);

	for (const p of room.players) {
		send(p.ws, "charSelectState", payload);
	}
}

function makeRoomId() {
	return String(Math.floor(1000 + Math.random() * 9000)); // 4桁
}

function playersView(room) {
	return room.players.map((p) => ({
		id: p.id,
		isHost: p.isHost,
		isReady: p.isReady,
		colorIndex: p.colorIndex,
		charLocked: p.charLocked,
	}));
}

function send(ws, type, payload) {
	ws.send(JSON.stringify({ type, payload }));
}

function broadcastRoom(room) {
	const payload = { roomId: room.roomId, players: playersView(room) };
	for (const p of room.players) {
		send(p.ws, "roomUpdate", payload);
	}
}

wss.on("connection", (ws) => {
	const clientId = nextClientId++;
	ws.clientId = clientId;
	ws.roomId = null;

	console.log("[server] client connected:", clientId);

	ws.on("message", (data) => {
		let msg;
		try {
			msg = JSON.parse(data.toString());
		} catch (e) {
			console.error("[server] invalid message", e);
			return;
		}

		const { type, payload } = msg;
		console.log("[server] recv:", type, payload);

		// ルーム作成
		if (type === "createRoom") {
			const roomId = makeRoomId();
			const room = {
				roomId,
				players: [],
			};
			rooms.set(roomId, room);

			const player = {
				clientId,
				ws,
				id: 0,
				isHost: true,
				isReady: false,
				colorIndex: 0,
				charLocked: false,
			};
			room.players.push(player);
			ws.roomId = roomId;

			send(ws, "roomCreated", {
				roomId,
				playerId: player.id,
				players: playersView(room),
			});
			return;
		}

		// どこかのルームに参加
		if (type === "joinAny") {
			let room =
				Array.from(rooms.values()).find((r) => r.players.length < 5) || null;

			if (!room) {
				const roomId = makeRoomId();
				room = { roomId, players: [] };
				rooms.set(roomId, room);
			}

			const player = {
				clientId,
				ws,
				id: room.players.length,
				isHost: room.players.length === 0,
				isReady: false,
				colorIndex: room.players.length,
				charLocked: false,
			};
			room.players.push(player);
			ws.roomId = room.roomId;

			send(ws, "roomJoined", {
				roomId: room.roomId,
				playerId: player.id,
				players: playersView(room),
			});

			broadcastRoom(room);
			return;
		}

		// READY 切り替え
		if (type === "setReady") {
			const room = rooms.get(ws.roomId);
			if (!room) return;
			const p = room.players.find((p) => p.clientId === clientId);
			if (!p) return;
			p.isReady = !p.isReady;
			broadcastRoom(room);
			return;
		}

		// ロビーから「ゲーム開始」→ キャラセレへ
		if (type === "startGame") {
			const room = rooms.get(ws.roomId);
			if (!room) return;
			const host = room.players[0];
			if (!host || host.clientId !== clientId) {
				console.log("[server] non-host tried to start game");
				return;
			}

			const configs = room.players.map((p) => ({
				id: p.id,
				color: null,
			}));

			for (const p of room.players) {
				send(p.ws, "gameStart", { configs });
			}
			return;
		}

		// キャラセレ中：色変更
		if (type === "charSelectSetColor") {
			const room = rooms.get(ws.roomId);
			if (!room) return;

			const player = room.players.find((p) => p.clientId === clientId);
			if (!player || player.charLocked) return;

			const desired = payload.colorIndex;

			// すでにロック済みのプレイヤーがこの色を使っていたら禁止
			const taken = room.players.some(
				(p) => p.charLocked && p.colorIndex === desired
			);
			if (taken) {
				return;
			}

			player.colorIndex = desired;
			broadcastCharSelect(room);
			return;
		}

		// キャラセレ中：ロック／ロック解除
		if (type === "charSelectSetLocked") {
			const room = rooms.get(ws.roomId);
			if (!room) return;
			const player = room.players.find((p) => p.clientId === clientId);
			if (!player) return;

			player.charLocked = !!payload.locked;
			console.log(
				"[server] charSelectSetLocked client",
				clientId,
				"locked =",
				player.charLocked
			);

			// ロック状態が変わったことを全員へ通知
			broadcastCharSelect(room);
			return;
		}

		// キャラセレ：ホストがバトル開始を押した
		if (type === "charSelectStartBattle") {
			const room = rooms.get(ws.roomId);
			if (!room) return;

			const host = room.players[0];
			if (!host || host.clientId !== clientId) {
				console.log("[server] non-host tried to start battle");
				return;
			}

			const allLocked =
				room.players.length > 0 && room.players.every((p) => p.charLocked);
			console.log("[server] startBattle allLocked?", allLocked);
			if (!allLocked) {
				console.log("[server] tried to start battle before all locked");
				return;
			}

			const configs = room.players.map((p) => ({
				id: p.id,
				colorIndex: p.colorIndex,
			}));

			console.log("[server] sending charSelectDone:", configs);

			for (const p of room.players) {
				send(p.ws, "charSelectDone", { configs });
			}

			return;
		}

		if (type === "placeBomb") {
			const room = rooms.get(ws.roomId);
			if (!room) return;

			const sender = room.players.find((p) => p.clientId === clientId);
			if (!sender) return;

			const out = {
				playerId: sender.id,
				row: payload.row,
				column: payload.column,
				strength: payload.strength,
			};

			console.log("[server] placeBomb from", sender.id, "at", out);

			// 送り主以外のクライアントに配信
			for (const p of room.players) {
				if (p.clientId === clientId) continue;
				send(p.ws, "bombPlaced", out);
			}
			return;
		}

		if (type === "playerState") {
			const room = rooms.get(ws.roomId);
			if (!room) return;

			const sender = room.players.find((p) => p.clientId === clientId);
			if (!sender) return;

			// 位置情報を保存しておきたいならここで持っておいてもOK
			sender.x = payload.x;
			sender.y = payload.y;
			sender.direction = payload.direction;

			const out = {
				id: sender.id,
				x: payload.x,
				y: payload.y,
				direction: payload.direction,
			};

			// 送り主以外のクライアントに配信
			for (const p of room.players) {
				if (p.clientId === clientId) continue;
				send(p.ws, "playerStateUpdate", out);
			}
			return;
		}
	});

	ws.on("close", () => {
		console.log("[server] client disconnected:", clientId);
		const room = rooms.get(ws.roomId);
		if (!room) return;
		room.players = room.players.filter((p) => p.clientId !== clientId);
		if (room.players.length === 0) {
			rooms.delete(room.roomId);
		} else {
			// ホストが抜けたら先頭をホストに
			room.players[0].isHost = true;
			broadcastRoom(room);
		}
	});
});

console.log("[server] listening on ws://localhost:8080");

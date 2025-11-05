// src/net/client.js

// 自分のPCのIP（例：192.168.0.23 に必ず書き換える）
const LOCAL_MACHINE_WS_URL = "ws://10.200.3.177:8080/";

// ローカルで開いているか（localhost）かどうかで切り替え
const WS_URL =
	location.hostname === "localhost" || location.hostname === "127.0.0.1"
		? "ws://localhost:8080/"
		: LOCAL_MACHINE_WS_URL;

class NetClient {
	socket = null;
	isOpen = false;
	listeners = new Map();

	constructor(url) {
		this.socket = new WebSocket(url);

		this.socket.addEventListener("open", () => {
			this.isOpen = true;
			console.log("[net] connected");
		});

		this.socket.addEventListener("message", (event) => {
			try {
				const msg = JSON.parse(event.data);
				this.handleMessage(msg);
			} catch (e) {
				console.error("[net] invalid message", e);
			}
		});

		this.socket.addEventListener("close", () => {
			this.isOpen = false;
			console.log("[net] disconnected");
		});
	}

	handleMessage(msg) {
		const { type, payload } = msg;
		const set = this.listeners.get(type);
		if (!set) return;
		for (const handler of set) {
			handler(payload);
		}
	}

	on(type, handler) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type).add(handler);
	}

	off(type, handler) {
		const set = this.listeners.get(type);
		if (!set) return;
		set.delete(handler);
	}

	send(type, payload = {}) {
		if (!this.isOpen || this.socket.readyState !== WebSocket.OPEN) {
			console.warn("[net] send before open", type, payload);
			return;
		}
		this.socket.send(JSON.stringify({ type, payload }));
	}
}

let client = null;

export function getClient() {
	if (!client) {
		client = new NetClient(WS_URL);
	}
	return client;
}

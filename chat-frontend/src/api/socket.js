// src/api/socket.js
import { io } from "socket.io-client";
import { API_BASE } from "./api";

export const socket = io(API_BASE, { autoConnect: false, withCredentials: true });

export function connectSocketWithToken(token) {
  if (!token) {
    try { socket.disconnect(); } catch (e) {}
    return;
  }
  socket.auth = { token };
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  try {
    socket.auth = {};
    socket.disconnect();
  } catch (e) {
    console.warn("Socket disconnect error", e);
  }
}

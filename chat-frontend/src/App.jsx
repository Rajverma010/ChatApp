// frontend/src/App.jsx
import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const API_BASE = "http://localhost:4000";

const socket = io(API_BASE, {
  autoConnect: false, // we'll connect after we know the user
});

function App() {
  const [user, setUser] = useState(null); // { _id, username }
  const [usernameInput, setUsernameInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]); // [{userId, username}]
  const [activeUser, setActiveUser] = useState(null); // {userId, username}
  const [messages, setMessages] = useState([]); // current conversation
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Connect socket only after user is set
  useEffect(() => {
    if (!user) return;

    socket.auth = { userId: user._id, username: user.username };
    socket.connect();

    // Receive updated online users
    socket.on("onlineUsers", (list) => {
      setOnlineUsers(list);
    });

    // Receive private messages
    socket.on("privateMessage", (msg) => {
      // Only add message if it belongs to current open conversation
      setMessages((prev) => {
        if (
          (msg.from === user._id && msg.to === activeUser?.userId) ||
          (msg.to === user._id && msg.from === activeUser?.userId)
        ) {
          return [...prev, msg];
        }
        return prev;
      });
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("privateMessage");
      socket.disconnect();
    };
  }, [user, activeUser?.userId]);

  // Handle username submit (register/login)
  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (!trimmed) return;

    try {
      const res = await axios.post(`${API_BASE}/api/users`, {
        username: trimmed,
      });
      setUser(res.data);
    } catch (err) {
      console.error(err);
      alert("Error logging in/creating user");
    }
  };

  // Load conversation when activeUser changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !activeUser) return;
      setLoadingMessages(true);
      try {
        const res = await axios.get(`${API_BASE}/api/messages`, {
          params: { from: user._id, to: activeUser.userId },
        });
        setMessages(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [user, activeUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeUser) return;

    socket.emit("privateMessage", {
      toUserId: activeUser.userId,
      content: messageInput.trim(),
    });

    setMessageInput("");
  };

  const isLoggedIn = !!user;

  return (
    <div style={styles.app}>
      {/* Left: sidebar */}
      <div style={styles.sidebar}>
        {!isLoggedIn ? (
          <form onSubmit={handleLogin} style={styles.loginForm}>
            <h2>Login / Register</h2>
            <input
              type="text"
              placeholder="Enter username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.button}>
              Continue
            </button>
          </form>
        ) : (
          <div style={styles.userBox}>
            <div>
              Logged in as: <strong>{user.username}</strong>
            </div>
          </div>
        )}

        <h3 style={{ marginLeft: 10 }}>Online Users</h3>
        <div style={styles.usersList}>
          {onlineUsers.length === 0 && <p style={{ padding: 10 }}>No one online</p>}
          {onlineUsers.map((u) => (
            <div
              key={u.userId}
              style={{
                ...styles.userItem,
                backgroundColor:
                  activeUser?.userId === u.userId ? "#007bff" : "transparent",
                color: activeUser?.userId === u.userId ? "#fff" : "#000",
                fontStyle: u.userId === user?._id ? "italic" : "normal",
              }}
              onClick={() => {
                if (u.userId === user?._id) return;
                setActiveUser(u);
              }}
            >
              {u.username}
              {u.userId === user?._id ? " (You)" : ""}
            </div>
          ))}
        </div>
      </div>

      {/* Right: main chat area */}
      <div style={styles.main}>
        {!isLoggedIn ? (
          <div style={styles.centerMessage}>Please login to start chatting.</div>
        ) : !activeUser ? (
          <div style={styles.centerMessage}>
            Select an online user from the left to start a private chat.
          </div>
        ) : (
          <>
            <div style={styles.chatHeader}>
              Chat with: <strong>{activeUser.username}</strong>
            </div>
            <div style={styles.chatArea}>
              {loadingMessages ? (
                <div style={styles.centerMessage}>Loading messages...</div>
              ) : messages.length === 0 ? (
                <div style={styles.centerMessage}>No messages yet. Say hi 👋</div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.from === user._id;
                  const time = new Date(msg.createdAt).toLocaleTimeString();
                  return (
                    <div
                      key={msg._id}
                      style={{
                        ...styles.message,
                        alignSelf: isMe ? "flex-end" : "flex-start",
                        backgroundColor: isMe ? "#d1ffd1" : "#f1f1f1",
                        textAlign: isMe ? "right" : "left",
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {msg.fromUsername} • {time}
                      </div>
                      <div>{msg.content}</div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} style={styles.messageForm}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                style={styles.input}
              />
              <button
                type="submit"
                style={styles.button}
                disabled={!messageInput.trim()}
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    height: "100vh",
    fontFamily: "sans-serif",
  },
  sidebar: {
    width: 260,
    borderRight: "1px solid #ddd",
    display: "flex",
    flexDirection: "column",
  },
  loginForm: {
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  userBox: {
    padding: 10,
    borderBottom: "1px solid #ddd",
  },
  usersList: {
    flex: 1,
    overflowY: "auto",
  },
  userItem: {
    padding: "8px 10px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    padding: 10,
    borderBottom: "1px solid #ddd",
    backgroundColor: "#f7f7f7",
  },
  chatArea: {
    flex: 1,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflowY: "auto",
  },
  messageForm: {
    display: "flex",
    gap: 8,
    padding: 10,
    borderTop: "1px solid #ddd",
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 4,
    border: "1px solid #ccc",
  },
  button: {
    padding: "8px 14px",
    borderRadius: 4,
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
  },
  centerMessage: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#777",
  },
  message: {
    maxWidth: "70%",
    padding: "6px 8px",
    borderRadius: 6,
  },
};

export default App;

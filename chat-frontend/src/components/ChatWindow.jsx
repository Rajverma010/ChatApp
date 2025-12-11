import React, { useRef, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  Avatar,
  CircularProgress,
  Button,
  TextField,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { stringToColor } from "../utils/stringToColor";

export default function ChatWindow({
  user,
  activeRoom,
  activeUser,
  messages,
  loadingMessages,
  messageInput,
  setMessageInput,
  onSendMessage,
}) {
  const messagesEndRef = useRef(null);
  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const headerTitle = activeUser ? activeUser.username : activeRoom?.name;

  return (
    <>
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", bgcolor: "background.paper" }}>
        {activeUser || activeRoom ? (
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: stringToColor(activeUser?.username || activeRoom?.name) }}>
              {(activeUser?.username || activeRoom?.name || "?").charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6" fontWeight={600} color="text.primary">{headerTitle}</Typography>
          </Stack>
        ) : (
          <Typography variant="h6" color="text.secondary">Select a room or user to start chatting 🚀</Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 3, backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.02), transparent)" }}>
        {loadingMessages ? (
          <Box sx={{ height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography color="text.secondary">Loading messages...</Typography>
          </Box>
        ) : messages.length === 0 && (activeUser || activeRoom) ? (
          <Box sx={{ height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Typography color="text.secondary">No messages yet. Start the conversation! 💬</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {messages.map((msg) => {
              const isMe = msg.from === user._id;
              const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const senderName = msg.fromUsername || (isMe ? user.username : activeUser?.username || "User");

              return (
                <Box key={msg._id} sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                  <Box sx={{ maxWidth: "65%", bgcolor: isMe ? "primary.light" : "background.paper", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", boxShadow: 1, p: 1.5 }}>
                    {activeRoom && !isMe && (
                      <Typography variant="caption" fontWeight={700} sx={{ color: stringToColor(senderName), display: "block", mb: 0.3 }}>
                        {senderName}
                      </Typography>
                    )}
                    <Typography variant="body1" color="text.primary">{msg.content}</Typography>
                    <Typography variant="caption" sx={{ float: "right", mt: 0.5, color: "text.secondary", fontSize: "0.7rem" }}>{time}</Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Stack>
        )}
      </Box>

      {(activeUser || activeRoom) && (
        <Box component="form" onSubmit={onSendMessage} sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              variant="outlined"
              size="medium"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              sx={{ "& fieldset": { borderRadius: 30 } }}
              autoFocus
            />
            <Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={!messageInput.trim()} sx={{ borderRadius: 30, minWidth: 100, px: 2 }}>
              Send
            </Button>
          </Stack>
        </Box>
      )}
    </>
  );
}

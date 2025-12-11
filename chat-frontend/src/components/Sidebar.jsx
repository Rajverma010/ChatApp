import React from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Stack,
  IconButton,
  TextField,
  Avatar,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import GroupIcon from "@mui/icons-material/Group";
import { stringToColor } from "../utils/stringToColor";

export default function Sidebar({
  user,
  rooms,
  newRoomName,
  setNewRoomName,
  onCreateRoom,
  onlineUsers,
  activeRoom,
  activeUser,
  onSelectRoom,
  onSelectUser,
}) {
  return (
    <Box sx={{ width: 300, borderRight: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column" }}>
      {/* Rooms */}
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" fontWeight={700} color="text.secondary">Rooms</Typography>
        <List dense disablePadding sx={{ mt: 1 }}>
          {rooms.map((r) => {
            const selected = activeRoom?._id === r._id;
            return (
              <ListItemButton
                key={r._id}
                selected={selected}
                onClick={() => onSelectRoom(r)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.light",
                    color: "primary.contrastText",
                    "& .MuiListItemText-primary": { fontWeight: 600 },
                  },
                }}
              >
                <GroupIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                <ListItemText primary={r.name || "Unnamed room"} primaryTypographyProps={{ color: "text.primary" }} />
              </ListItemButton>
            );
          })}
        </List>

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="New room..."
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            variant="outlined"
          />
          <IconButton color="primary" onClick={onCreateRoom} disabled={!newRoomName.trim()} size="small">
            <AddIcon />
          </IconButton>
        </Stack>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Online users */}
      <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
        <Typography variant="overline" fontWeight={700} color="text.secondary">Online Users</Typography>
        <List dense disablePadding sx={{ mt: 1 }}>
          {onlineUsers.map((u) => {
            const selected = activeUser?.userId === u.userId;
            const isMe = u.userId === user._id;
            return (
              <ListItemButton
                key={u.userId}
                selected={selected}
                disabled={isMe}
                onClick={() => onSelectUser(u)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.light",
                    color: "primary.contrastText",
                    "& .MuiListItemText-primary": { fontWeight: 600 },
                  },
                }}
              >
                <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: stringToColor(u.username) }}>
                  {u.username.charAt(0).toUpperCase()}
                </Avatar>
                <ListItemText primary={u.username} primaryTypographyProps={{ color: "text.primary" }} />
                {isMe && <Chip label="You" size="small" color="primary" variant="outlined" sx={{ ml: 1, height: 18 }} />}
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}

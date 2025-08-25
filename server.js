import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Chat server is running' });
});

// In-memory storage
const users = {
  'lev': { username: 'lev', password: 'lev' },
  'cin': { username: 'cin', password: 'cin' }
};

let messages = [];
const connectedUsers = new Map();
const userStatus = new Map();
const typingUsers = new Map();
const readReceipts = new Map();

// Authentication endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (users[username] && users[username].password === password) {
    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    url: `/uploads/${req.file.filename}`
  });
});

// Get chat history
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

// Search messages
app.get('/api/search', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.json([]);
  }
  
  const searchResults = messages.filter(message => 
    message.content.toLowerCase().includes(query.toLowerCase()) ||
    message.username.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json(searchResults);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', (username) => {
    connectedUsers.set(socket.id, username);
    userStatus.set(username, 'online');
    
    // Broadcast user status update
    io.emit('user_status_update', { username, status: 'online' });
    socket.broadcast.emit('user_joined', username);
    
    // Send chat history to newly connected user
    socket.emit('chat_history', messages);
    
    // Send current online users
    const onlineUsers = Array.from(userStatus.entries()).filter(([_, status]) => status === 'online');
    socket.emit('online_users', onlineUsers);
  });

  // Handle new messages
  socket.on('send_message', (data) => {
    const message = {
      id: Date.now() + Math.random(),
      username: data.username,
      content: data.content,
      type: data.type || 'text',
      attachment: data.attachment || null,
      timestamp: new Date().toISOString(),
      edited: false,
      editedAt: null
    };

    // Add to messages array and keep only last 100
    messages.push(message);
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }

    // Clear typing status
    typingUsers.delete(data.username);
    io.emit('user_stopped_typing', data.username);

    // Broadcast message to all connected clients
    io.emit('new_message', message);
  });

  // Handle message editing
  socket.on('edit_message', (data) => {
    const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
    if (messageIndex !== -1 && messages[messageIndex].username === data.username) {
      messages[messageIndex].content = data.newContent;
      messages[messageIndex].edited = true;
      messages[messageIndex].editedAt = new Date().toISOString();
      
      io.emit('message_edited', {
        messageId: data.messageId,
        newContent: data.newContent,
        editedAt: messages[messageIndex].editedAt
      });
    }
  });

  // Handle message deletion
  socket.on('delete_message', (data) => {
    const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
    if (messageIndex !== -1 && messages[messageIndex].username === data.username) {
      messages.splice(messageIndex, 1);
      io.emit('message_deleted', data.messageId);
    }
  });

  // Handle typing indicators
  socket.on('typing', (username) => {
    typingUsers.set(username, Date.now());
    socket.broadcast.emit('user_typing', username);
  });

  socket.on('stop_typing', (username) => {
    typingUsers.delete(username);
    socket.broadcast.emit('user_stopped_typing', username);
  });

  // Handle read receipts
  socket.on('mark_as_read', (data) => {
    const { messageId, username } = data;
    if (!readReceipts.has(messageId)) {
      readReceipts.set(messageId, new Set());
    }
    readReceipts.get(messageId).add(username);
    
    io.emit('message_read', { messageId, readBy: username });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const username = connectedUsers.get(socket.id);
    if (username) {
      connectedUsers.delete(socket.id);
      userStatus.set(username, 'offline');
      typingUsers.delete(username);
      
      // Broadcast user status update
      io.emit('user_status_update', { username, status: 'offline' });
      socket.broadcast.emit('user_left', username);
      io.emit('user_stopped_typing', username);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Clean up old typing indicators
setInterval(() => {
  const now = Date.now();
  for (const [username, timestamp] of typingUsers.entries()) {
    if (now - timestamp > 3000) { // 3 seconds timeout
      typingUsers.delete(username);
      io.emit('user_stopped_typing', username);
    }
  }
}, 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
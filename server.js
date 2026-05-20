const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database paths
const MESSAGES_DB_PATH = path.join(__dirname, 'data', 'messages.json');
const USERS_DB_PATH = path.join(__dirname, 'data', 'users.json');
const CHAT_DB_PATH = path.join(__dirname, 'data', 'chats.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// ==================== DATABASES ====================

let users = [];
let messages = [];
let chats = [];
let onlineUsers = new Map();
let typingUsers = new Map();

// Load users
function loadUsers() {
    try {
        if (fs.existsSync(USERS_DB_PATH)) {
            users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf8'));
        } else {
            users = [
                {
                    id: "FATMA-001",
                    name: "Fatma Hassan",
                    phone: "+255712345678",
                    gender: "female",
                    avatar: "👩",
                    online: false,
                    lastSeen: new Date().toISOString()
                },
                {
                    id: "AISHA-002",
                    name: "Aisha Juma",
                    phone: "+255765432109",
                    gender: "female",
                    avatar: "👩",
                    online: false,
                    lastSeen: new Date().toISOString()
                },
                {
                    id: "MARIAM-003",
                    name: "Mariam Salim",
                    phone: "+255756789012",
                    gender: "female",
                    avatar: "👩",
                    online: false,
                    lastSeen: new Date().toISOString()
                },
                {
                    id: "CURRENT-USER",
                    name: "Tracker User",
                    phone: "+255700000000",
                    gender: "male",
                    avatar: "👨",
                    online: true,
                    lastSeen: new Date().toISOString()
                }
            ];
            saveUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
}

// Load messages
function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_DB_PATH)) {
            messages = JSON.parse(fs.readFileSync(MESSAGES_DB_PATH, 'utf8'));
        } else {
            messages = [];
            saveMessages();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        messages = [];
    }
}

function saveMessages() {
    fs.writeFileSync(MESSAGES_DB_PATH, JSON.stringify(messages, null, 2));
}

// Load chats
function loadChats() {
    try {
        if (fs.existsSync(CHAT_DB_PATH)) {
            chats = JSON.parse(fs.readFileSync(CHAT_DB_PATH, 'utf8'));
        } else {
            chats = [];
            saveChats();
        }
    } catch (error) {
        console.error('Error loading chats:', error);
        chats = [];
    }
}

function saveChats() {
    fs.writeFileSync(CHAT_DB_PATH, JSON.stringify(chats, null, 2));
}

// Get or create chat between two users
function getOrCreateChat(userId1, userId2) {
    let chat = chats.find(c => 
        (c.user1 === userId1 && c.user2 === userId2) ||
        (c.user1 === userId2 && c.user2 === userId1)
    );
    
    if (!chat) {
        chat = {
            id: Date.now().toString(),
            user1: userId1,
            user2: userId2,
            createdAt: new Date().toISOString(),
            lastMessage: null,
            lastMessageTime: null
        };
        chats.push(chat);
        saveChats();
    }
    
    return chat;
}

// Add message
function addMessage(senderId, receiverId, message, type = 'text') {
    const newMessage = {
        id: Date.now().toString(),
        senderId: senderId,
        receiverId: receiverId,
        message: message,
        type: type,
        status: 'sent',
        timestamp: new Date().toISOString(),
        read: false
    };
    
    messages.push(newMessage);
    saveMessages();
    
    // Update chat last message
    const chat = getOrCreateChat(senderId, receiverId);
    chat.lastMessage = message;
    chat.lastMessageTime = newMessage.timestamp;
    saveChats();
    
    return newMessage;
}

// Mark message as delivered
function markAsDelivered(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message && message.status === 'sent') {
        message.status = 'delivered';
        saveMessages();
        return message;
    }
    return null;
}

// Mark message as read
function markAsRead(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
        message.status = 'read';
        message.read = true;
        saveMessages();
        return message;
    }
    return null;
}

// Get user by ID
function getUserById(userId) {
    return users.find(u => u.id === userId);
}

// Get all messages between two users
function getMessagesBetweenUsers(userId1, userId2) {
    return messages.filter(m => 
        (m.senderId === userId1 && m.receiverId === userId2) ||
        (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Update user status
function updateUserStatus(userId, isOnline) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.online = isOnline;
        user.lastSeen = new Date().toISOString();
        saveUsers();
        return user;
    }
    return null;
}

// ==================== API ROUTES ====================

// Get all users
app.get('/api/users', (req, res) => {
    const usersWithStatus = users.map(user => ({
        ...user,
        online: onlineUsers.has(user.id),
        lastSeen: user.lastSeen
    }));
    res.json({ success: true, users: usersWithStatus });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
    const user = getUserById(req.params.id);
    if (user) {
        res.json({ success: true, user: { ...user, online: onlineUsers.has(user.id) } });
    } else {
        res.status(404).json({ success: false, error: 'User not found' });
    }
});

// Get messages between users
app.get('/api/messages/:userId1/:userId2', (req, res) => {
    const messages = getMessagesBetweenUsers(req.params.userId1, req.params.userId2);
    res.json({ success: true, messages });
});

// Get all chats for user
app.get('/api/chats/:userId', (req, res) => {
    const userChats = chats.filter(c => c.user1 === req.params.userId || c.user2 === req.params.userId);
    const chatsWithUsers = userChats.map(chat => {
        const otherUserId = chat.user1 === req.params.userId ? chat.user2 : chat.user1;
        const otherUser = getUserById(otherUserId);
        const unreadCount = messages.filter(m => 
            m.receiverId === req.params.userId && 
            m.senderId === otherUserId && 
            !m.read
        ).length;
        
        return {
            ...chat,
            otherUser: otherUser ? { ...otherUser, online: onlineUsers.has(otherUserId) } : null,
            unreadCount
        };
    });
    res.json({ success: true, chats: chatsWithUsers });
});

// Send message via API
app.post('/api/messages', (req, res) => {
    const { senderId, receiverId, message, type } = req.body;
    const newMessage = addMessage(senderId, receiverId, message, type || 'text');
    
    // Emit to receiver if online
    if (onlineUsers.has(receiverId)) {
        io.to(receiverId).emit('new-message', newMessage);
    }
    
    res.json({ success: true, message: newMessage });
});

// Mark message as read
app.put('/api/messages/:messageId/read', (req, res) => {
    const message = markAsRead(req.params.messageId);
    if (message) {
        if (onlineUsers.has(message.senderId)) {
            io.to(message.senderId).emit('message-read', { messageId: message.id });
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        users: users.length,
        messages: messages.length,
        onlineUsers: onlineUsers.size,
        timestamp: new Date().toISOString()
    });
});

// ==================== WEBSOCKET EVENTS ====================

io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);
    
    let currentUserId = null;
    
    // User login/set userId
    socket.on('user-online', (data) => {
        currentUserId = data.userId;
        socket.join(currentUserId);
        onlineUsers.set(currentUserId, socket.id);
        
        const user = updateUserStatus(currentUserId, true);
        
        // Broadcast to all users that this user is online
        io.emit('user-status-change', {
            userId: currentUserId,
            online: true,
            lastSeen: new Date().toISOString()
        });
        
        // Send online users list to the new user
        const onlineUsersList = Array.from(onlineUsers.keys());
        socket.emit('online-users', { users: onlineUsersList });
        
        console.log(`✅ User ${currentUserId} is now online`);
    });
    
    // Send message
    socket.on('send-message', (data) => {
        const { senderId, receiverId, message, type } = data;
        
        const newMessage = addMessage(senderId, receiverId, message, type || 'text');
        
        // Send to receiver if online
        if (onlineUsers.has(receiverId)) {
            io.to(receiverId).emit('new-message', newMessage);
            // Mark as delivered immediately if receiver is online
            const delivered = markAsDelivered(newMessage.id);
            socket.emit('message-delivered', { messageId: newMessage.id });
        } else {
            // Receiver is offline, just store
            socket.emit('message-sent', { messageId: newMessage.id });
        }
        
        // Send back to sender with updated status
        socket.emit('message-status', {
            messageId: newMessage.id,
            status: onlineUsers.has(receiverId) ? 'delivered' : 'sent'
        });
        
        // Notify typing stop
        if (typingUsers.has(senderId)) {
            typingUsers.delete(senderId);
            if (onlineUsers.has(receiverId)) {
                io.to(receiverId).emit('user-stopped-typing', { userId: senderId });
            }
        }
    });
    
    // User is typing
    socket.on('typing', (data) => {
        const { userId, receiverId, isTyping } = data;
        
        if (isTyping) {
            typingUsers.set(userId, setTimeout(() => {
                typingUsers.delete(userId);
                if (onlineUsers.has(receiverId)) {
                    io.to(receiverId).emit('user-stopped-typing', { userId });
                }
            }, 2000));
            
            if (onlineUsers.has(receiverId)) {
                io.to(receiverId).emit('user-typing', { userId });
            }
        } else {
            typingUsers.delete(userId);
            if (onlineUsers.has(receiverId)) {
                io.to(receiverId).emit('user-stopped-typing', { userId });
            }
        }
    });
    
    // Mark message as read
    socket.on('mark-read', (data) => {
        const { messageId, senderId } = data;
        const message = markAsRead(messageId);
        
        if (message && onlineUsers.has(senderId)) {
            io.to(senderId).emit('message-read', { messageId: message.id });
        }
    });
    
    // Voice call request
    socket.on('call-user', (data) => {
        const { callerId, receiverId, callType } = data;
        
        if (onlineUsers.has(receiverId)) {
            io.to(receiverId).emit('incoming-call', {
                callerId: callerId,
                callerName: getUserById(callerId)?.name,
                callType: callType,
                callId: Date.now().toString()
            });
        } else {
            socket.emit('call-failed', { message: 'User is offline' });
        }
    });
    
    // Accept call
    socket.on('accept-call', (data) => {
        const { callerId, receiverId, callId } = data;
        if (onlineUsers.has(callerId)) {
            io.to(callerId).emit('call-accepted', {
                receiverId: receiverId,
                receiverName: getUserById(receiverId)?.name,
                callId: callId
            });
        }
    });
    
    // Reject call
    socket.on('reject-call', (data) => {
        const { callerId, receiverId } = data;
        if (onlineUsers.has(callerId)) {
            io.to(callerId).emit('call-rejected', { message: 'Call rejected' });
        }
    });
    
    // WebRTC signaling
    socket.on('webrtc-offer', (data) => {
        const { to, offer } = data;
        if (onlineUsers.has(to)) {
            io.to(to).emit('webrtc-offer', { from: currentUserId, offer });
        }
    });
    
    socket.on('webrtc-answer', (data) => {
        const { to, answer } = data;
        if (onlineUsers.has(to)) {
            io.to(to).emit('webrtc-answer', { from: currentUserId, answer });
        }
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
        const { to, candidate } = data;
        if (onlineUsers.has(to)) {
            io.to(to).emit('webrtc-ice-candidate', { from: currentUserId, candidate });
        }
    });
    
    // User disconnect
    socket.on('disconnect', () => {
        if (currentUserId) {
            onlineUsers.delete(currentUserId);
            updateUserStatus(currentUserId, false);
            
            io.emit('user-status-change', {
                userId: currentUserId,
                online: false,
                lastSeen: new Date().toISOString()
            });
            
            console.log(`🔴 User ${currentUserId} went offline`);
        }
        console.log('🔴 User disconnected:', socket.id);
    });
});

// Initialize
loadUsers();
loadMessages();
loadChats();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('💬 FEMALE CHAT SYSTEM - COMPLETE');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`👩 Users: ${users.length}`);
    console.log(`💬 Messages: ${messages.length}`);
    console.log(`📱 Online users: ${onlineUsers.size}`);
    console.log('='.repeat(60));
});

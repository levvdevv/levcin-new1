import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  LogOut, 
  MessageCircle, 
  Smile, 
  Paperclip, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  CheckCheck,
  X,
  Image,
  FileText,
  Video,
  Download
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useDropzone } from 'react-dropzone';

interface Message {
  id: number;
  username: string;
  content: string;
  type: 'text' | 'emoji' | 'attachment';
  attachment?: {
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
  };
  timestamp: string;
  edited: boolean;
  editedAt?: string;
}

interface ChatRoomProps {
  username: string;
  onLogout: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ username, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [readReceipts, setReadReceipts] = useState<Map<number, Set<string>>>(new Map());
  const [notifications, setNotifications] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // File drop zone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const fileData = await response.json();
        
        if (socketRef.current && isConnected) {
          socketRef.current.emit('send_message', {
            username,
            content: `Shared ${fileData.originalName}`,
            type: 'attachment',
            attachment: fileData,
          });
        }
      }
    } catch (error) {
      console.error('File upload failed:', error);
    }
  }, [username, isConnected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io();

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current?.emit('join', username);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('chat_history', (history: Message[]) => {
      setMessages(history);
    });

    socketRef.current.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      
      // Show notification if message is from another user
      if (message.username !== username) {
        showNotification(message.username, message.content);
        setNotifications(prev => [...prev, `New message from ${message.username}`]);
      }
    });

    socketRef.current.on('online_users', (users: [string, string][]) => {
      setOnlineUsers(users.filter(([_, status]) => status === 'online').map(([user]) => user));
    });

    socketRef.current.on('user_status_update', ({ username: user, status }) => {
      if (status === 'online') {
        setOnlineUsers(prev => [...prev.filter(u => u !== user), user]);
      } else {
        setOnlineUsers(prev => prev.filter(u => u !== user));
      }
    });

    socketRef.current.on('user_typing', (user: string) => {
      setTypingUsers(prev => [...prev.filter(u => u !== user), user]);
    });

    socketRef.current.on('user_stopped_typing', (user: string) => {
      setTypingUsers(prev => prev.filter(u => u !== user));
    });

    socketRef.current.on('message_edited', ({ messageId, newContent, editedAt }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, edited: true, editedAt }
          : msg
      ));
    });

    socketRef.current.on('message_deleted', (messageId: number) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    });

    socketRef.current.on('message_read', ({ messageId, readBy }) => {
      setReadReceipts(prev => {
        const newReceipts = new Map(prev);
        if (!newReceipts.has(messageId)) {
          newReceipts.set(messageId, new Set());
        }
        newReceipts.get(messageId)?.add(readBy);
        return newReceipts;
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [username]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when they come into view
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = parseInt(entry.target.getAttribute('data-message-id') || '0');
          if (messageId && socketRef.current) {
            socketRef.current.emit('mark_as_read', { messageId, username });
          }
        }
      });
    });

    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, username]);

  const showNotification = (sender: string, content: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${sender}`, {
        body: content.length > 50 ? content.substring(0, 50) + '...' : content,
        icon: '/vite.svg'
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && socketRef.current && isConnected) {
      socketRef.current.emit('send_message', {
        username,
        content: newMessage.trim(),
        type: 'text',
      });
      setNewMessage('');
      setShowEmojiPicker(false);
    }
  };

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', username);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('stop_typing', username);
      }, 1000);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleEditMessage = (messageId: number, content: string) => {
    setEditingMessage(messageId);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (editingMessage && editContent.trim() && socketRef.current) {
      socketRef.current.emit('edit_message', {
        messageId: editingMessage,
        username,
        newContent: editContent.trim(),
      });
      setEditingMessage(null);
      setEditContent('');
    }
  };

  const handleDeleteMessage = (messageId: number) => {
    if (socketRef.current && window.confirm('Are you sure you want to delete this message?')) {
      socketRef.current.emit('delete_message', { messageId, username });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mimetype.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Enhanced Chat</h1>
            <p className="text-sm text-gray-500">
              {isConnected ? `${onlineUsers.length} online` : 'Connecting...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {showSearch && (
              <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-10">
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Search
                  </button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {searchResults.map((result) => (
                      <div key={result.id} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium text-gray-900">{result.username}</div>
                        <div className="text-gray-600">{result.content}</div>
                        <div className="text-xs text-gray-400">{formatTime(result.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <span className="text-sm text-gray-600">Logged in as {username}</span>
          <button
            onClick={onLogout}
            className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">{notifications[notifications.length - 1]}</span>
            <button
              onClick={() => setNotifications([])}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Online Users */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Online:</span>
          {onlineUsers.map((user, index) => (
            <span key={user} className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              {user}
              {index < onlineUsers.length - 1 && <span className="mx-1">,</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isDragActive && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
              <Paperclip className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Drop files here to share</p>
            </div>
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-message-id={message.id}
              className={`flex ${message.username === username ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative group ${
                  message.username === username
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-xs font-medium ${
                    message.username === username ? 'text-blue-100' : 'text-gray-600'
                  }`}>
                    {message.username}
                  </span>
                  <span className={`text-xs ${
                    message.username === username ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </span>
                  {message.edited && (
                    <span className={`text-xs italic ${
                      message.username === username ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      (edited)
                    </span>
                  )}
                </div>
                
                {editingMessage === message.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-2 py-1 text-gray-900 border border-gray-300 rounded text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessage(null)}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.type === 'attachment' && message.attachment ? (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded">
                          {getFileIcon(message.attachment.mimetype)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {message.attachment.originalName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(message.attachment.size)}
                            </p>
                          </div>
                          <a
                            href={message.attachment.url}
                            download={message.attachment.originalName}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        {message.attachment.mimetype.startsWith('image/') && (
                          <img
                            src={message.attachment.url}
                            alt={message.attachment.originalName}
                            className="max-w-full h-auto rounded"
                          />
                        )}
                        <p className="text-sm">{message.content}</p>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    
                    {/* Read receipts */}
                    {message.username === username && (
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        {readReceipts.get(message.id)?.size ? (
                          <CheckCheck className="w-3 h-3 text-blue-300" />
                        ) : (
                          <Check className="w-3 h-3 text-blue-300" />
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Message actions */}
                {message.username === username && editingMessage !== message.id && (
                  <div className="absolute right-0 top-0 -mr-16 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                    <button
                      onClick={() => handleEditMessage(message.id, message.content)}
                      className="p-1 text-gray-600 hover:text-blue-600 bg-white rounded shadow"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1 text-gray-600 hover:text-red-600 bg-white rounded shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-200 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type your message..."
              className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!isConnected}
            />
            
            <div className="absolute right-2 top-2 flex space-x-1">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
            
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 z-10">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onDrop(Array.from(files));
            }
          }}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ChatRoom;
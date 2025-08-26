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
  Download,
  Phone,
  VideoIcon,
  Gift
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useDropzone } from 'react-dropzone';
import GifPicker from './GifPicker';
import VideoCallModal from './VideoCallModal';
import {
  Message,
  User,
  sendMessage,
  subscribeToMessages,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  updateUserStatus,
  updateTypingStatus,
  subscribeToUsers,
  uploadFile,
  searchMessages
} from '../services/chatService';
import { Timestamp } from 'firebase/firestore';

interface ChatRoomProps {
  username: string;
  onLogout: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ username, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    show: boolean;
    caller: string;
  }>({ show: false, caller: '' });
  
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

    try {
      const fileData = await uploadFile(file);
      
      await sendMessage({
        username,
        content: `Shared ${fileData.originalName}`,
        type: 'attachment',
        attachment: fileData,
        edited: false
      });
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed. Please try again.');
    }
  }, [username]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  useEffect(() => {
    // Set user as online
    updateUserStatus(username, 'online');

    // Subscribe to messages
    const unsubscribeMessages = subscribeToMessages((newMessages) => {
      setMessages(newMessages);
      
      // Show notification for new messages from other users
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.username !== username) {
        showNotification(lastMessage.username, lastMessage.content);
        setNotifications(prev => [...prev, `New message from ${lastMessage.username}`]);
      }
    });

    // Subscribe to users
    const unsubscribeUsers = subscribeToUsers(setUsers);

    // Set user as offline when component unmounts
    return () => {
      updateUserStatus(username, 'offline');
      unsubscribeMessages();
      unsubscribeUsers();
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
          const messageId = entry.target.getAttribute('data-message-id');
          if (messageId) {
            markMessageAsRead(messageId, username);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      try {
        await sendMessage({
          username,
          content: newMessage.trim(),
          type: 'text',
          edited: false
        });
        setNewMessage('');
        setShowEmojiPicker(false);
        
        // Stop typing
        updateTypingStatus(username, false);
      } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message. Please try again.');
      }
    }
  };

  const handleTyping = () => {
    updateTypingStatus(username, true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(username, false);
    }, 1000);
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleGifSelect = async (gifUrl: string) => {
    try {
      await sendMessage({
        username,
        content: gifUrl,
        type: 'gif',
        edited: false
      });
    } catch (error) {
      console.error('Failed to send GIF:', error);
    }
    setShowGifPicker(false);
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    // For demo, we'll just show the video call modal
    setShowVideoCall(true);
  };

  const handleAcceptCall = () => {
    setShowVideoCall(true);
    setIncomingCall({ show: false, caller: '' });
  };

  const handleDeclineCall = () => {
    setIncomingCall({ show: false, caller: '' });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchMessages(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessage(messageId);
    setEditContent(content);
  };

  const handleSaveEdit = async () => {
    if (editingMessage && editContent.trim()) {
      try {
        await editMessage(editingMessage, editContent.trim(), username);
        setEditingMessage(null);
        setEditContent('');
      } catch (error) {
        console.error('Failed to edit message:', error);
        alert('Failed to edit message. Please try again.');
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteMessage(messageId);
      } catch (error) {
        console.error('Failed to delete message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  const formatTime = (timestamp: Timestamp | any) => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleTimeString('en-US', {
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

  const onlineUsers = users.filter(user => user.status === 'online');
  const typingUsers = users.filter(user => user.typing && user.username !== username);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Firestore Chat</h1>
            <p className="text-sm text-gray-500">
              {onlineUsers.length} online
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 md:p-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            
            {showSearch && (
              <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72 md:w-80 z-10">
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
          
          {/* Call buttons */}
          <button
            onClick={() => handleStartCall('voice')}
            className="p-1.5 md:p-2 text-gray-600 hover:text-green-600 transition-colors"
            title="Start voice call"
          >
            <Phone className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          
          <button
            onClick={() => handleStartCall('video')}
            className="p-1.5 md:p-2 text-gray-600 hover:text-blue-600 transition-colors"
            title="Start video call"
          >
            <VideoIcon className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          
          <span className="hidden md:inline text-sm text-gray-600">Logged in as {username}</span>
          <button
            onClick={onLogout}
            className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors duration-200 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
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
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 overflow-x-auto">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Online:</span>
          <div className="flex items-center space-x-2 whitespace-nowrap">
            {onlineUsers.map((user, index) => (
              <span key={user.username} className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                {user.username}
                {index < onlineUsers.length - 1 && <span className="mx-1">,</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Drag and Drop Overlay */}
      <div 
        {...getRootProps()}
        className={`${isDragActive ? 'fixed inset-0 z-50' : 'hidden'}`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
              <Paperclip className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Drop files here to share</p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <div className="flex items-center space-x-1 md:space-x-2 mb-1">
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
                            className="max-w-full h-auto rounded max-h-64"
                          />
                        )}
                        <p className="text-sm">{message.content}</p>
                      </div>
                    ) : message.type === 'gif' ? (
                      <div className="space-y-2">
                        <img
                          src={message.content}
                          alt="GIF"
                          className="max-w-full h-auto rounded max-h-48 md:max-h-64"
                        />
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    
                    {/* Read receipts */}
                    {message.username === username && (
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        {message.readBy && message.readBy.length > 1 ? (
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
                  <div className="absolute right-0 top-0 -mr-12 md:-mr-16 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
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
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2 md:space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type your message..."
              className="w-full px-3 md:px-4 py-2 pr-16 md:pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
            />
            
            <div className="absolute right-2 top-2 flex space-x-0.5 md:space-x-1">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-0.5 md:p-1 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Smile className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setShowGifPicker(!showGifPicker)}
                className="p-0.5 md:p-1 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Gift className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-0.5 md:p-1 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 z-10 scale-75 md:scale-100 origin-bottom-right">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
            
            {showGifPicker && (
              <GifPicker
                onGifSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px]"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5" />
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
      
      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
      />
      
      {/* Incoming Call Modal */}
      <VideoCallModal
        isOpen={incomingCall.show}
        onClose={() => setIncomingCall({ show: false, caller: '' })}
        isIncoming={true}
        callerName={incomingCall.caller}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
    </div>
  );
};

export default ChatRoom;
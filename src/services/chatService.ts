import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  setDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export interface Message {
  id: string;
  username: string;
  content: string;
  type: 'text' | 'emoji' | 'attachment' | 'gif';
  attachment?: {
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
  };
  timestamp: Timestamp;
  edited: boolean;
  editedAt?: Timestamp;
  readBy: string[];
}

export interface User {
  username: string;
  status: 'online' | 'offline';
  lastSeen: Timestamp;
  typing: boolean;
}

// Messages
export const sendMessage = async (messageData: Omit<Message, 'id' | 'timestamp' | 'readBy'>) => {
  try {
    await addDoc(collection(db, 'messages'), {
      ...messageData,
      timestamp: serverTimestamp(),
      readBy: [messageData.username]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const subscribeToMessages = (callback: (messages: Message[]) => void) => {
  const q = query(
    collection(db, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data()
      } as Message);
    });
    callback(messages);
  });
};

export const editMessage = async (messageId: string, newContent: string, username: string) => {
  try {
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      content: newContent,
      edited: true,
      editedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error editing message:', error);
    throw error;
  }
};

export const deleteMessage = async (messageId: string) => {
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

export const markMessageAsRead = async (messageId: string, username: string) => {
  try {
    const messageRef = doc(db, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (messageDoc.exists()) {
      const data = messageDoc.data();
      const readBy = data.readBy || [];
      
      if (!readBy.includes(username)) {
        await updateDoc(messageRef, {
          readBy: [...readBy, username]
        });
      }
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

// Users
export const updateUserStatus = async (username: string, status: 'online' | 'offline') => {
  try {
    const userRef = doc(db, 'users', username);
    await setDoc(userRef, {
      username,
      status,
      lastSeen: serverTimestamp(),
      typing: false
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user status:', error);
  }
};

export const updateTypingStatus = async (username: string, typing: boolean) => {
  try {
    const userRef = doc(db, 'users', username);
    await updateDoc(userRef, {
      typing,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
};

export const subscribeToUsers = (callback: (users: User[]) => void) => {
  const q = query(collection(db, 'users'));

  return onSnapshot(q, (snapshot) => {
    const users: User[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });
    callback(users);
  });
};

// File upload
export const uploadFile = async (file: File): Promise<{
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}> => {
  try {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.name}`;
    const storageRef = ref(storage, `uploads/${filename}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    
    return {
      filename,
      originalName: file.name,
      size: file.size,
      mimetype: file.type,
      url
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Search messages
export const searchMessages = async (searchQuery: string): Promise<Message[]> => {
  try {
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    const messages: Message[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as Message;
      if (
        data.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.username.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        messages.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    return messages.reverse();
  } catch (error) {
    console.error('Error searching messages:', error);
    return [];
  }
};
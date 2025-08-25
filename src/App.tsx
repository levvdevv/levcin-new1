import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ChatRoom from './components/ChatRoom';

function App() {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const storedUser = sessionStorage.getItem('chatUser');
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const handleLogin = (username: string) => {
    setUser(username);
    sessionStorage.setItem('chatUser', username);
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('chatUser');
  };

  return (
    <div className="App">
      {user ? (
        <ChatRoom username={user} onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
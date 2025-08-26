// Simple authentication service
// In production, you should use Firebase Auth or a proper auth system

const users = {
  'lev': { username: 'lev', password: 'lev' },
  'cin': { username: 'cin', password: 'cin' }
};

export const login = async (username: string, password: string): Promise<{ success: boolean; username?: string; message?: string }> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (users[username as keyof typeof users] && users[username as keyof typeof users].password === password) {
    return { success: true, username };
  } else {
    return { success: false, message: 'Invalid username or password' };
  }
};
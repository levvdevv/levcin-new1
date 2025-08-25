import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const GifPicker: React.FC<GifPickerProps> = ({ onGifSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Using Giphy API (you'll need to get a free API key from developers.giphy.com)
  const GIPHY_API_KEY = 'your_giphy_api_key_here'; // Replace with actual API key
  
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }

    setLoading(true);
    try {
      // For demo purposes, using trending GIFs since we don't have API key
      const trendingGifs = [
        'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
        'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
        'https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif',
        'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
        'https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif',
        'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif'
      ];
      
      setGifs(trendingGifs.map((url, index) => ({ 
        id: index, 
        images: { fixed_height: { url } } 
      })));
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load trending GIFs on mount
    searchGifs('trending');
  }, []);

  const handleGifClick = (gifUrl: string) => {
    onGifSelect(gifUrl);
    onClose();
  };

  return (
    <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-lg w-80 h-96 z-20">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Choose a GIF</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchGifs(searchQuery)}
            placeholder="Search GIFs..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="p-2 h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading GIFs...</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifClick(gif.images.fixed_height.url)}
                className="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt="GIF"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
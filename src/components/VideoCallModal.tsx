import React, { useRef, useEffect, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, X } from 'lucide-react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIncoming?: boolean;
  callerName?: string;
  onAccept?: () => void;
  onDecline?: () => void;
}

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  isIncoming = false,
  callerName,
  onAccept,
  onDecline
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');

  useEffect(() => {
    if (isOpen && !isIncoming) {
      startLocalVideo();
    }
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, isIncoming]);

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallStatus('connected');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setCallStatus('ended');
    onClose();
  };

  const handleAcceptCall = () => {
    if (onAccept) {
      onAccept();
      startLocalVideo();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl h-3/4 relative overflow-hidden">
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="text-white">
            <h3 className="font-medium">
              {isIncoming ? `Incoming call from ${callerName}` : 'Video Call'}
            </h3>
            <p className="text-sm text-gray-300">
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'connected' && 'Connected'}
              {callStatus === 'ended' && 'Call ended'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative w-full h-full">
          {/* Remote Video (main) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
          />
          
          {/* Local Video (picture-in-picture) */}
          <div className="absolute top-20 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          {isIncoming && callStatus === 'connecting' ? (
            <div className="flex space-x-4">
              <button
                onClick={handleAcceptCall}
                className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-full transition-colors"
              >
                <Phone className="w-6 h-6" />
              </button>
              <button
                onClick={onDecline || onClose}
                className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="flex space-x-4">
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoEnabled 
                    ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
              
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full transition-colors ${
                  isAudioEnabled 
                    ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
              
              <button
                onClick={endCall}
                className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
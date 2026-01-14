'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, Loader2, CheckCircle, XCircle, Mic, Square, AlertTriangle, Info } from 'lucide-react';
import { Mp3Encoder } from '@breezystack/lamejs';

type AccountInfo = {
  accountStatus?: string;
  phoneNumberInfo?: Record<string, unknown>;
};

type ResponsePayload = {
  type: 'upload' | 'send' | 'media-check';
  data: Record<string, unknown>;
};

const MP3_MIME_TYPE = 'audio/mpeg';
const MP3_EXTENSION = 'mp3';
const RECORDING_MIME_TYPE = 'audio/webm;codecs=opus';

export default function WhatsAppAudioTest() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [mediaId, setMediaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [response, setResponse] = useState<ResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mp3EncoderRef = useRef<InstanceType<typeof Mp3Encoder> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendTemplate, setSendTemplate] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/send-audio');
      const data = (await res.json()) as AccountInfo;
      setAccountInfo(data);
    } catch (err) {
      console.error('Failed to get account info:', err);
    }
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: RECORDING_MIME_TYPE });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          setConverting(true);
          setError(null);

          const audioBlob = new Blob(audioChunksRef.current, { type: RECORDING_MIME_TYPE });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 44100 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const channelData = audioBuffer.getChannelData(0);
          const samples = new Int16Array(channelData.length);
          for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]));
            samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          mp3EncoderRef.current = new Mp3Encoder(1, audioBuffer.sampleRate, 128);
          const mp3Data = mp3EncoderRef.current.encodeBuffer(samples);
          const mp3End = mp3EncoderRef.current.flush();

          const mp3Buffer = new ArrayBuffer(mp3Data.buffer.byteLength + mp3End.buffer.byteLength);
          new Uint8Array(mp3Buffer).set(new Uint8Array(mp3Data.buffer));
          new Uint8Array(mp3Buffer).set(new Uint8Array(mp3End.buffer), mp3Data.buffer.byteLength);
          const mp3Blob = new Blob([mp3Buffer], { type: MP3_MIME_TYPE });
          const mp3File = new File([mp3Blob], `recording.${MP3_EXTENSION}`, { type: MP3_MIME_TYPE });
          setAudioFile(mp3File);
        } catch (err: unknown) {
          setError('Failed to convert audio to MP3: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
          setConverting(false);
          stream?.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err: unknown) {
      setError('Failed to access microphone: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError(null);
    }
  };

  const uploadAudio = async () => {
    if (!audioFile) {
      setError('Please select an audio file first');
      return;
    }

    setUploading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const res = await fetch('/api/whatsapp/send-audio', {
        method: 'PUT',
        body: formData,
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (res.ok) {
        const mediaIdValue = typeof data.mediaId === 'string' ? data.mediaId : '';
        setMediaId(mediaIdValue);
        setResponse({ type: 'upload', data });
      } else {
        setError((typeof data.error === 'string' ? data.error : null) || 'Failed to upload audio');
      }
    } catch (err: unknown) {
      setError('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const sendAudio = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    if (!audioUrl && !mediaId) {
      setError('Please provide an audio URL or upload a file first');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/whatsapp/send-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneNumber,
          audioUrl: audioUrl || undefined,
          audioId: mediaId || undefined,
          sendTemplate: sendTemplate,
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (res.ok) {
        setResponse({ type: 'send', data });
      } else {
        setError(JSON.stringify(data, null, 2));
      }
    } catch (err: unknown) {
      setError('Send failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const renderMessageId = () => {
    if (!response || response.type !== 'send') {
      return null;
    }

    const responseWithMessage = response.data as {
      messageId?: string;
      messages?: Array<{ id?: string }>;
    };

    const directMessageId =
      typeof responseWithMessage.messageId === 'string' ? responseWithMessage.messageId : null;

    const nestedMessageId =
      Array.isArray(responseWithMessage.messages) && responseWithMessage.messages.length > 0
        ? responseWithMessage.messages.find(
            (message): message is { id: string } => typeof message?.id === 'string',
          )?.id ?? null
        : null;

    const messageId = directMessageId ?? nestedMessageId;

    if (!messageId) {
      return null;
    }

    return (
      <p className="text-sm text-green-700 mb-2">
        Message ID: {messageId}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-green-500 rounded-full p-3">
              <Send className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">WhatsApp Audio Sender</h1>
          </div>

          {/* Account Status */}
          {accountInfo && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">Account Status</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Quality: {accountInfo.accountStatus || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 24-Hour Window Warning */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">Important: 24-Hour Window Rule</p>
                <p className="text-xs text-yellow-700 mt-1">
                  You can only send free-form messages (like audio) to users who have messaged you in the last 24 hours. 
                  For new conversations, enable &quot;Send Template First&quot; below.
                </p>
              </div>
            </div>
          </div>

          {/* Phone Number Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g., 94711803296 (without +)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Enter number with country code, without + (e.g., 94711803296)</p>
          </div>

          {/* Template Message Option */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendTemplate}
                onChange={(e) => setSendTemplate(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-800">Send Template Message First</p>
                <p className="text-xs text-purple-600 mt-1">
                  Check this if it&apos;s the first message or it&apos;s been {'>'} 24 hours since user&apos;s last message
                </p>
              </div>
            </label>
          </div>

          {/* Method 1: Upload Audio File */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Method 1: Upload Audio File</h2>
            
            <div className="flex gap-2 mb-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isRecording ? (
                  <Square className="w-4 h-4 inline mr-2" />
                ) : (
                  <Mic className="w-4 h-4 inline mr-2" />
                )}
                {isRecording ? 'Stop Recording' : 'Record Audio'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Choose File
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {converting && (
              <div className="mb-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm text-yellow-700">
                  <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
                  Converting to MP3...
                </p>
              </div>
            )}
            {audioFile && (
              <div className="mb-3 p-3 bg-white rounded border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Selected:</strong> {audioFile.name} ({(audioFile.size / 1024).toFixed(2)} KB)
                </p>
              </div>
            )}
            <button
              onClick={uploadAudio}
              disabled={!audioFile || uploading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 inline mr-2" />
              )}
              {uploading ? 'Uploading...' : 'Upload to WhatsApp'}
            </button>
            {mediaId && (
              <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                <p className="text-sm text-green-700 mb-2">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  <strong>Media ID:</strong> {mediaId}
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/whatsapp/check-media?mediaId=${mediaId}`);
                      const data = await res.json();
                      setResponse({ type: 'media-check', data });
                    } catch (err: unknown) {
                      setError('Failed to check media: ' + (err instanceof Error ? err.message : String(err)));
                    }
                  }}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Check Media Info
                </button>
              </div>
            )}
          </div>

          {/* Method 2: Audio URL */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Method 2: Audio URL</h2>
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">URL must be publicly accessible and HTTPS</p>
          </div>

          {/* Send Button */}
          <button
            onClick={sendAudio}
            disabled={loading || (!audioUrl && !mediaId) || !phoneNumber}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 inline mr-2" />
            )}
            {loading ? 'Sending...' : 'Send Audio Message'}
          </button>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                  <pre className="text-xs text-red-700 whitespace-pre-wrap">{error}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Success Display */}
          {response && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 mb-2">
                    {response.type === 'upload' ? 'Upload Successful' : 'Message Sent Successfully'}
                  </h3>
                  {response.type === 'send' && renderMessageId()}
                  <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Troubleshooting Guide */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Troubleshooting Guide</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-800">✅ Message Sent but Not Received?</p>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>24-Hour Window:</strong> Enable &quot;Send Template First&quot; for new/old conversations</li>
                  <li><strong>Phone Number:</strong> Verify the number is registered on WhatsApp</li>
                  <li><strong>Test Mode:</strong> Your account might be in test mode - add the number to allowed list</li>
                  <li><strong>Message Limits:</strong> Check if you&apos;ve hit daily/hourly rate limits</li>
                </ul>
              </div>
              <div className="mt-3">
                <p className="font-medium text-gray-800">📋 Quick Checks:</p>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Verify WHATSAPP_ACCESS_TOKEN is set in .env</li>
                  <li>Check server logs for detailed API responses</li>
                  <li>Test with your own WhatsApp number first</li>
                  <li>Ensure audio format is supported (AAC, AMR, MP3, MP4, OGG)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
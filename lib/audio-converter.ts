import { Mp3Encoder } from '@breezystack/lamejs';

export const MP3_MIME_TYPE = 'audio/mpeg';
export const MP3_EXTENSION = 'mp3';
export const RECORDING_MIME_TYPE = 'audio/webm;codecs=opus';

export async function convertToMp3(audioBlob: Blob): Promise<File> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 44100 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const samples = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const mp3Encoder = new Mp3Encoder(1, audioBuffer.sampleRate, 128);
  const mp3Data = mp3Encoder.encodeBuffer(samples);
  const mp3End = mp3Encoder.flush();

  const mp3Buffer = new ArrayBuffer(mp3Data.buffer.byteLength + mp3End.buffer.byteLength);
  new Uint8Array(mp3Buffer).set(new Uint8Array(mp3Data.buffer));
  new Uint8Array(mp3Buffer).set(new Uint8Array(mp3End.buffer), mp3Data.buffer.byteLength);
  const mp3Blob = new Blob([mp3Buffer], { type: MP3_MIME_TYPE });
  const mp3File = new File([mp3Blob], `audio-${Date.now()}.${MP3_EXTENSION}`, { type: MP3_MIME_TYPE });
  
  return mp3File;
}

export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim();
}

export function getFileExtension(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  const parts = normalized.split('/');
  return parts.length > 1 ? parts[1] : 'mp3';
}

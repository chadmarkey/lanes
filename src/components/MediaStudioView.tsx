import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AudioLines,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  MicOff,
  Music,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Square,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type { Lane, LibraryItem, LyriaModelId, MediaStudioTab } from '../lib/types';
import { resolveApiUrl } from '../lib/tauri';
import { ErrorNote } from './Marks';

interface MediaStudioViewProps {
  activeTab: MediaStudioTab;
  lanes: Lane[];
  onSelectTab: (tab: MediaStudioTab) => void;
  onSaveToLibrary: (payload: {
    name: string;
    laneId: string;
    kind: LibraryItem['kind'];
    preview: string;
  }) => Promise<boolean | void>;
  onSendTranscriptToAssistant: (text: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

interface LiveTranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;
const IMAGE_SIZES = ['1K', '2K'] as const;
const VIDEO_ASPECT_RATIOS: { id: '16:9' | '9:16'; label: string }[] = [
  { id: '16:9', label: '16:9 Landscape' },
  { id: '9:16', label: '9:16 Portrait' },
];
const LIVE_VOICES = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'] as const;
const LYRIA_MODELS: { id: LyriaModelId; label: string; detail: string }[] = [
  { id: 'lyria-3-clip-preview', label: 'Lyria 3 Clip', detail: '30s studio clip' },
  { id: 'lyria-3-pro-preview', label: 'Lyria 3 Pro', detail: 'Full-length track' },
];
const MUSIC_PRESETS = [
  'Warm midcentury jazz trio, brushed snare, upright bass, mellow electric piano, 92 BPM',
  'Calm ambient Rhodes and warm analog tape pads for deep focus, gentle pulse, instrumental',
  'Acoustic nylon guitar and cello duet in a sunlit wooden room, intimate organic production',
] as const;

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
  return URL.createObjectURL(blob);
}

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({
        base64,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function float32ToPcm16Base64(input: Float32Array): string {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.length / 2);
  const floats = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i++) {
    floats[i] = view.getInt16(i * 2, true) / 32768;
  }
  return floats;
}

export function MediaStudioView({
  activeTab,
  lanes,
  onSelectTab,
  onSaveToLibrary,
  onSendTranscriptToAssistant,
  onNotify,
}: MediaStudioViewProps) {
  const publicLanes = lanes.filter((l) => !l.isPrivate);
  const defaultLaneId = publicLanes[0]?.id ?? lanes[0]?.id ?? 'lanes-build';

  // --- Images state (gemini-nano-banana-2.1) ---
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState<(typeof IMAGE_ASPECT_RATIOS)[number]>('1:1');
  const [imageSize, setImageSize] = useState<(typeof IMAGE_SIZES)[number]>('1K');
  const [editSource, setEditSource] = useState<{ base64: string; mimeType: string; dataUrl: string; name: string } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<{
    dataUrl: string;
    mimeType: string;
    text: string;
    prompt: string;
  } | null>(null);

  // --- Video state (gemini-omni-1.2-flash) ---
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoSource, setVideoSource] = useState<{ base64: string; mimeType: string; dataUrl: string; name: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<{ dataUrl: string; mimeType: string; prompt: string } | null>(null);

  // --- Music state (Lyria 3: lyria-3-clip-preview / lyria-3-pro-preview) ---
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicModel, setMusicModel] = useState<LyriaModelId>('lyria-3-clip-preview');
  const [musicSource, setMusicSource] = useState<{ base64: string; mimeType: string; dataUrl: string; name: string } | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicElapsed, setMusicElapsed] = useState(0);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [generatedMusic, setGeneratedMusic] = useState<{
    audioUrl: string;
    mimeType: string;
    lyrics: string;
    model: string;
    prompt: string;
  } | null>(null);
  const musicBlobUrlRef = useRef<string | null>(null);

  // --- Live Voice state (gemini-3.8-live) ---
  const [voiceName, setVoiceName] = useState<(typeof LIVE_VOICES)[number]>('Zephyr');
  const [voiceInstruction, setVoiceInstruction] = useState(
    'You are the calm voice assistant inside Lanes. Keep responses direct and conversational.'
  );
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [liveMuted, setLiveMuted] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<LiveTranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // --- Transcribe Audio state (gemini-3.5-transcribe) ---
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    mutedRef.current = liveMuted;
  }, [liveMuted]);

  // Video elapsed counter
  useEffect(() => {
    if (!videoLoading) {
      setVideoElapsed(0);
      return;
    }
    const timer = window.setInterval(() => {
      setVideoElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [videoLoading]);

  // Audio recording timer
  useEffect(() => {
    if (!recording) {
      setRecordSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  // Music elapsed counter
  useEffect(() => {
    if (!musicLoading) {
      setMusicElapsed(0);
      return;
    }
    const timer = window.setInterval(() => {
      setMusicElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [musicLoading]);

  // Cleanup live voice, recorder, and music blob URL on unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (musicBlobUrlRef.current) {
        URL.revokeObjectURL(musicBlobUrlRef.current);
        musicBlobUrlRef.current = null;
      }
    };
  }, []);

  async function handleImageFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readFileAsBase64(file);
      setEditSource({ ...read, name: file.name });
      setImageError(null);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not read image.');
    }
  }

  async function handleGenerateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/gemini/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageBase64: editSource?.base64,
          mimeType: editSource?.mimeType,
          aspectRatio: imageAspectRatio,
          imageSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed.');
      }
      setGeneratedImage({
        dataUrl: data.imageDataUrl,
        mimeType: data.mimeType || 'image/png',
        text: data.text || '',
        prompt,
      });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not generate image.');
    } finally {
      setImageLoading(false);
    }
  }

  async function handleVideoFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readFileAsBase64(file);
      setVideoSource({ ...read, name: file.name });
      setVideoError(null);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Could not read photo.');
    }
  }

  async function handleAnimateVideo() {
    if ((!videoSource && !videoPrompt.trim()) || videoLoading) return;
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/gemini/video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt.trim() || 'Animate this photo with smooth, natural motion.',
          imageBase64: videoSource?.base64,
          mimeType: videoSource?.mimeType,
          aspectRatio: videoAspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Video animation failed.');
      }
      setGeneratedVideo({
        dataUrl: data.videoDataUrl,
        mimeType: data.mimeType || 'video/mp4',
        prompt: videoPrompt.trim() || videoSource?.name || 'Animated clip',
      });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Could not animate video.');
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleMusicImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readFileAsBase64(file);
      setMusicSource({ ...read, name: file.name });
      setMusicError(null);
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Could not read reference image.');
    }
  }

  async function handleGenerateMusic() {
    const prompt = musicPrompt.trim();
    if (!prompt || musicLoading) return;
    setMusicLoading(true);
    setMusicError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/gemini/music'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: musicModel,
          imageBase64: musicSource?.base64,
          mimeType: musicSource?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Music generation failed.');
      }
      if (musicBlobUrlRef.current) {
        URL.revokeObjectURL(musicBlobUrlRef.current);
      }
      const mimeType = data.mimeType || 'audio/wav';
      const audioUrl = base64ToBlobUrl(data.audioBase64, mimeType);
      musicBlobUrlRef.current = audioUrl;
      setGeneratedMusic({
        audioUrl,
        mimeType,
        lyrics: data.lyrics || '',
        model: data.model || musicModel,
        prompt,
      });
      onNotify('Generated music track');
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Could not generate music.');
    } finally {
      setMusicLoading(false);
    }
  }

  function clearScheduledPlayback() {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }

  function playPcm24Chunk(base64: string) {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    const floats = base64Pcm16ToFloat32(base64);
    if (floats.length === 0) return;

    const buffer = ctx.createBuffer(1, floats.length, 24000);
    buffer.getChannelData(0).set(floats);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.015, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  }

  function stopLiveSession() {
    clearScheduledPlayback();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      void inputCtxRef.current.close();
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      void outputCtxRef.current.close();
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setLiveStatus('idle');
    setLiveMuted(false);
  }

  async function startLiveSession() {
    if (liveStatus !== 'idle') return;
    setLiveError(null);
    setLiveStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        voice: voiceName,
        instruction: voiceInstruction,
      });
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (mutedRef.current) return;
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const samples = event.inputBuffer.getChannelData(0);
          const audio = float32ToPcm16Base64(samples);
          wsRef.current.send(JSON.stringify({ audio }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            data?: string;
            text?: string;
            error?: string;
          };
          if (msg.type === 'ready') {
            setLiveStatus('live');
          } else if (msg.type === 'audio' && msg.data) {
            playPcm24Chunk(msg.data);
          } else if (msg.type === 'interrupted') {
            clearScheduledPlayback();
          } else if (msg.type === 'inputTranscript' && msg.text) {
            const text = msg.text;
            setLiveTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'user') {
                return [...prev.slice(0, -1), { ...last, text: `${last.text}${text}` }];
              }
              return [...prev, { id: `u-${Date.now()}`, role: 'user', text }];
            });
          } else if (msg.type === 'outputTranscript' && msg.text) {
            const text = msg.text;
            setLiveTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, text: `${last.text}${text}` }];
              }
              return [...prev, { id: `a-${Date.now()}`, role: 'assistant', text }];
            });
          } else if (msg.type === 'error') {
            setLiveError(msg.error || 'Voice session encountered an error.');
            stopLiveSession();
          } else if (msg.type === 'closed') {
            stopLiveSession();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setLiveError('Could not connect to the live voice WebSocket endpoint.');
        stopLiveSession();
      };

      ws.onclose = () => {
        stopLiveSession();
      };
    } catch (err) {
      setLiveError(
        err instanceof Error
          ? err.message
          : 'Microphone access was denied or unavailable for live voice.'
      );
      stopLiveSession();
    }
  }

  async function transcribeBase64(audioBase64: string, mimeType: string) {
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const res = await fetch(resolveApiUrl('/api/gemini/transcribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Transcription failed.');
      }
      setTranscript((prev) => (prev ? `${prev}\n${data.transcript}` : data.transcript));
      onNotify('Transcribed audio');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Could not transcribe audio.');
    } finally {
      setTranscribing(false);
    }
  }

  async function handleToggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const idx = dataUrl.indexOf(',');
          const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
          void transcribeBase64(base64, (blob.type || 'audio/webm').split(';')[0]);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Microphone access is required to record audio.'
      );
    }
  }

  async function handleAudioFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const read = await readFileAsBase64(file);
      await transcribeBase64(read.base64, read.mimeType);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Could not read audio file.');
    }
  }

  const tabs: { id: MediaStudioTab; label: string; model: string; icon: typeof ImageIcon }[] = [
    { id: 'images', label: 'Images', model: 'gemini-nano-banana-2.1', icon: ImageIcon },
    { id: 'video', label: 'Animate Video', model: 'gemini-omni-1.2-flash', icon: Film },
    { id: 'music', label: 'Music', model: 'lyria-3-clip-preview', icon: Music },
    { id: 'voice', label: 'Live Voice', model: 'gemini-3.8-live', icon: AudioLines },
    { id: 'transcribe', label: 'Transcribe Audio', model: 'gemini-3.5-transcribe', icon: Mic },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-4 py-6 md:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="m-0 text-[24px] font-semibold tracking-tight"
            style={{ color: 'var(--l-text)' }}
          >
            Media &amp; Voice
          </h1>
          <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
            Create and edit images, animate photos into video, compose music with Lyria 3, hold live voice sessions, and transcribe audio.
          </p>
        </div>

        {/* Mode tabs */}
        <div
          role="tablist"
          aria-label="Media and voice tools"
          className="flex flex-wrap items-center gap-1 rounded-[10px] border p-1"
          style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTab(tab.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: active ? 'var(--l-raised)' : 'transparent',
                  color: active ? 'var(--l-text)' : 'var(--l-muted)',
                  boxShadow: active ? 'var(--l-shadow-raised)' : 'none',
                }}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Create & Edit Images (gemini-nano-banana-2.1) */}
      {activeTab === 'images' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section
            className="flex flex-col gap-4 rounded-[14px] border p-5 lg:col-span-5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                {editSource ? 'Edit image' : 'Create image'}
              </h2>
              <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                gemini-nano-banana-2.1
              </span>
            </div>

            <div>
              <label
                htmlFor="media-image-prompt"
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: 'var(--l-muted)' }}
              >
                Prompt
              </label>
              <textarea
                id="media-image-prompt"
                rows={4}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={
                  editSource
                    ? 'Describe what to change in the uploaded image…'
                    : 'Describe an image to create, e.g. a sunlit walnut desk with ceramic pottery in warm travertine light…'
                }
                className="w-full resize-none rounded-[10px] border p-3 text-[14px] leading-[1.5] outline-none placeholder:text-[var(--l-muted)]"
                style={{
                  backgroundColor: 'var(--l-bg)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              />
            </div>

            {/* Optional edit source upload */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Source image (optional, for editing)
                </span>
                {editSource && (
                  <button
                    type="button"
                    onClick={() => setEditSource(null)}
                    className="inline-flex items-center gap-1 text-[12px] hover:underline"
                    style={{ color: 'var(--l-accent)' }}
                  >
                    <X size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {editSource ? (
                <div
                  className="flex items-center gap-3 rounded-[10px] border p-2.5"
                  style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
                >
                  <img
                    src={editSource.dataUrl}
                    alt={editSource.name}
                    className="h-14 w-14 rounded-[7px] border object-cover"
                    style={{ borderColor: 'var(--l-line)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                      {editSource.name}
                    </p>
                    <p className="m-0 text-[11px]" style={{ color: 'var(--l-muted)' }}>
                      Editing mode active
                    </p>
                  </div>
                </div>
              ) : (
                <label
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed px-3 py-3 text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                  style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-muted)' }}
                >
                  <Upload size={14} aria-hidden="true" />
                  <span>Upload photo to edit</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageFileUpload(e)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {/* Aspect ratio & resolution */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Aspect ratio
                </span>
                <div className="flex flex-wrap gap-1">
                  {IMAGE_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setImageAspectRatio(ratio)}
                      className="h-7 rounded-[7px] border px-2 text-[12px] font-medium tabular-nums transition-colors"
                      style={{
                        backgroundColor: imageAspectRatio === ratio ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: imageAspectRatio === ratio ? 'var(--l-accent)' : 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Resolution
                </span>
                <div className="flex gap-1.5">
                  {IMAGE_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setImageSize(sz)}
                      className="h-7 flex-1 rounded-[7px] border px-2.5 text-[12px] font-medium transition-colors"
                      style={{
                        backgroundColor: imageSize === sz ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: imageSize === sz ? 'var(--l-accent)' : 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {imageError && <ErrorNote message={imageError} />}

            <button
              type="button"
              disabled={imageLoading || !imagePrompt.trim()}
              onClick={() => void handleGenerateImage()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-45"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {imageLoading ? (
                <>
                  <LoaderCircle size={15} className="lanes-spin" />
                  <span>{editSource ? 'Editing image…' : 'Creating image…'}</span>
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  <span>{editSource ? 'Apply edit' : 'Create image'}</span>
                </>
              )}
            </button>
          </section>

          <section
            className="flex flex-col justify-between rounded-[14px] border p-5 lg:col-span-7"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            {generatedImage ? (
              <div className="flex flex-col gap-3">
                <div
                  className="overflow-hidden rounded-[12px] border"
                  style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
                >
                  <img
                    src={generatedImage.dataUrl}
                    alt={generatedImage.prompt}
                    className="block max-h-[460px] w-full object-contain"
                  />
                </div>
                {generatedImage.text && (
                  <p className="m-0 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                    {generatedImage.text}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const comma = generatedImage.dataUrl.indexOf(',');
                      setEditSource({
                        base64: comma >= 0 ? generatedImage.dataUrl.slice(comma + 1) : '',
                        mimeType: generatedImage.mimeType,
                        dataUrl: generatedImage.dataUrl,
                        name: 'generated-image.png',
                      });
                      onNotify('Loaded generated image as edit source');
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    <Wand2 size={13} />
                    <span>Edit this image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const comma = generatedImage.dataUrl.indexOf(',');
                      setVideoSource({
                        base64: comma >= 0 ? generatedImage.dataUrl.slice(comma + 1) : '',
                        mimeType: generatedImage.mimeType,
                        dataUrl: generatedImage.dataUrl,
                        name: 'generated-image.png',
                      });
                      onSelectTab('video');
                      onNotify('Sent image to Animate Video');
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    <Film size={13} />
                    <span>Animate into video</span>
                  </button>
                  <a
                    href={generatedImage.dataUrl}
                    download="lanes-image.png"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void onSaveToLibrary({
                        name: `image-${Date.now().toString().slice(-4)}.png`,
                        laneId: defaultLaneId,
                        kind: 'image',
                        preview: generatedImage.prompt,
                      })
                    }
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                  >
                    <span>Save to Library</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center">
                <ImageIcon size={24} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                <p className="m-0 text-[15px] font-medium" style={{ color: 'var(--l-text)' }}>
                  Your image canvas is ready
                </p>
                <p className="m-0 max-w-[360px] text-[13px]" style={{ color: 'var(--l-muted)' }}>
                  Enter a prompt to generate a fresh visual, or upload an image on the left to edit it with natural language.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Animate Images into Video (gemini-omni-1.2-flash via Interactions API) */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section
            className="flex flex-col gap-4 rounded-[14px] border p-5 lg:col-span-5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Animate photo into video
              </h2>
              <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                gemini-omni-1.2-flash
              </span>
            </div>

            {/* Source photo */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Starting photo
                </span>
                {videoSource && (
                  <button
                    type="button"
                    onClick={() => setVideoSource(null)}
                    className="inline-flex items-center gap-1 text-[12px] hover:underline"
                    style={{ color: 'var(--l-accent)' }}
                  >
                    <X size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {videoSource ? (
                <div
                  className="overflow-hidden rounded-[10px] border"
                  style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-bg)' }}
                >
                  <img
                    src={videoSource.dataUrl}
                    alt={videoSource.name}
                    className="block max-h-[180px] w-full object-contain"
                  />
                  <div
                    className="border-t px-3 py-1.5 text-[12px]"
                    style={{ borderColor: 'var(--l-line)', color: 'var(--l-muted)' }}
                  >
                    {videoSource.name}
                  </div>
                </div>
              ) : (
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-4 py-6 text-center text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                  style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-muted)' }}
                >
                  <Upload size={18} aria-hidden="true" />
                  <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                    Upload a photo to animate
                  </span>
                  <span className="text-[12px]">PNG, JPG, or WebP starting frame</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleVideoFileUpload(e)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            <div>
              <label
                htmlFor="media-video-prompt"
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: 'var(--l-muted)' }}
              >
                Motion prompt
              </label>
              <textarea
                id="media-video-prompt"
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe camera movement and motion, e.g. slow dolly-in as afternoon sunlight shifts across the room…"
                className="w-full resize-none rounded-[10px] border p-3 text-[14px] leading-[1.5] outline-none placeholder:text-[var(--l-muted)]"
                style={{
                  backgroundColor: 'var(--l-bg)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              />
            </div>

            {/* Aspect Ratio: 16:9 Landscape or 9:16 Portrait */}
            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Aspect ratio
              </span>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    type="button"
                    onClick={() => setVideoAspectRatio(ratio.id)}
                    className="h-9 rounded-[8px] border px-3 text-[13px] font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: videoAspectRatio === ratio.id ? 'var(--l-selected)' : 'var(--l-bg)',
                      borderColor: videoAspectRatio === ratio.id ? 'var(--l-accent)' : 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {videoError && <ErrorNote message={videoError} />}

            <button
              type="button"
              disabled={videoLoading || (!videoSource && !videoPrompt.trim())}
              onClick={() => void handleAnimateVideo()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-45"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {videoLoading ? (
                <>
                  <LoaderCircle size={15} className="lanes-spin" />
                  <span className="tabular-nums">Rendering video ({videoElapsed}s)…</span>
                </>
              ) : (
                <>
                  <Film size={15} />
                  <span>Generate video</span>
                </>
              )}
            </button>
          </section>

          <section
            className="flex flex-col justify-between rounded-[14px] border p-5 lg:col-span-7"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            {generatedVideo ? (
              <div className="flex flex-col gap-3">
                <div
                  className="overflow-hidden rounded-[12px] border"
                  style={{ borderColor: 'var(--l-line)', backgroundColor: 'var(--l-terminal)' }}
                >
                  <video
                    src={generatedVideo.dataUrl}
                    controls
                    playsInline
                    loop
                    className="block max-h-[460px] w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px]" style={{ color: 'var(--l-muted)' }}>
                    {generatedVideo.prompt}
                  </span>
                  <a
                    href={generatedVideo.dataUrl}
                    download="lanes-animated-video.mp4"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                    style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                  >
                    <Download size={13} />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center">
                <Film size={24} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                <p className="m-0 text-[15px] font-medium" style={{ color: 'var(--l-text)' }}>
                  Ready to animate
                </p>
                <p className="m-0 max-w-[360px] text-[13px]" style={{ color: 'var(--l-muted)' }}>
                  Upload a photo, choose 16:9 landscape or 9:16 portrait, and describe the motion to render a clip with Omni Flash.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: Generate Music (Lyria 3: lyria-3-clip-preview & lyria-3-pro-preview) */}
      {activeTab === 'music' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section
            className="flex flex-col gap-4 rounded-[14px] border p-5 lg:col-span-5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Generate music
              </h2>
              <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                {musicModel}
              </span>
            </div>

            {/* Model selector: Lyria 3 Clip vs Pro */}
            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Lyria model
              </span>
              <div className="grid grid-cols-2 gap-2">
                {LYRIA_MODELS.map((m) => {
                  const selected = musicModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMusicModel(m.id)}
                      className="flex flex-col items-start rounded-[9px] border px-3 py-2 text-left transition-colors"
                      style={{
                        backgroundColor: selected ? 'var(--l-selected)' : 'var(--l-bg)',
                        borderColor: selected ? 'var(--l-accent)' : 'var(--l-line)',
                      }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                        {m.label}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--l-muted)' }}>
                        {m.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Music prompt */}
            <div>
              <label
                htmlFor="media-music-prompt"
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: 'var(--l-muted)' }}
              >
                Composition prompt
              </label>
              <textarea
                id="media-music-prompt"
                rows={4}
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="Describe genre, instrumentation, tempo, vocals, or mood…"
                className="w-full resize-none rounded-[10px] border p-3 text-[14px] leading-[1.5] outline-none placeholder:text-[var(--l-muted)]"
                style={{
                  backgroundColor: 'var(--l-bg)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MUSIC_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMusicPrompt(preset)}
                    className="rounded-[7px] border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: 'var(--l-bg)',
                      borderColor: 'var(--l-line)',
                      color: 'var(--l-muted)',
                    }}
                  >
                    {idx === 0 ? 'Midcentury jazz trio' : idx === 1 ? 'Ambient Rhodes focus' : 'Acoustic guitar & cello'}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional visual mood reference image */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                  Reference image (optional mood cue)
                </span>
                {musicSource && (
                  <button
                    type="button"
                    onClick={() => setMusicSource(null)}
                    className="inline-flex items-center gap-1 text-[12px] hover:underline"
                    style={{ color: 'var(--l-accent)' }}
                  >
                    <X size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {musicSource ? (
                <div
                  className="flex items-center gap-3 rounded-[10px] border p-2.5"
                  style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
                >
                  <img
                    src={musicSource.dataUrl}
                    alt={musicSource.name}
                    className="h-12 w-12 rounded-[7px] border object-cover"
                    style={{ borderColor: 'var(--l-line)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                      {musicSource.name}
                    </p>
                    <p className="m-0 text-[11px]" style={{ color: 'var(--l-muted)' }}>
                      Image-inspired composition active
                    </p>
                  </div>
                </div>
              ) : (
                <label
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed px-3 py-3 text-[13px] transition-colors hover:bg-[var(--l-hover)]"
                  style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-muted)' }}
                >
                  <Upload size={14} aria-hidden="true" />
                  <span>Attach image for mood inspiration</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleMusicImageUpload(e)}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {musicError && <ErrorNote message={musicError} />}

            <button
              type="button"
              disabled={musicLoading || !musicPrompt.trim()}
              onClick={() => void handleGenerateMusic()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-45"
              style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
            >
              {musicLoading ? (
                <>
                  <LoaderCircle size={15} className="lanes-spin" />
                  <span className="tabular-nums">Composing track ({musicElapsed}s)…</span>
                </>
              ) : (
                <>
                  <Music size={15} />
                  <span>Generate music</span>
                </>
              )}
            </button>
          </section>

          <section
            className="flex flex-col justify-between rounded-[14px] border p-5 lg:col-span-7"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            {generatedMusic ? (
              <div className="flex flex-col gap-4">
                <div
                  className="flex flex-col gap-3 rounded-[12px] border p-4"
                  style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Music size={16} style={{ color: 'var(--l-accent)' }} />
                      <span className="text-[14px] font-semibold" style={{ color: 'var(--l-text)' }}>
                        Generated audio
                      </span>
                    </div>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                      {generatedMusic.model}
                    </span>
                  </div>

                  <audio
                    controls
                    src={generatedMusic.audioUrl}
                    className="w-full"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--l-muted)' }}>
                      {generatedMusic.prompt}
                    </span>
                    <a
                      href={generatedMusic.audioUrl}
                      download={
                        generatedMusic.mimeType.includes('mpeg')
                          ? 'lanes-lyria-track.mp3'
                          : 'lanes-lyria-track.wav'
                      }
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                      style={{
                        backgroundColor: 'var(--l-bg)',
                        borderColor: 'var(--l-line-strong)',
                        color: 'var(--l-text)',
                      }}
                    >
                      <Download size={13} />
                      <span>Download audio</span>
                    </a>
                  </div>
                </div>

                {generatedMusic.lyrics && (
                  <div
                    className="rounded-[12px] border p-4"
                    style={{ backgroundColor: 'var(--l-bg)', borderColor: 'var(--l-line)' }}
                  >
                    <h3 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--l-muted)' }}>
                      Lyrics &amp; notes
                    </h3>
                    <pre
                      className="m-0 max-h-[260px] overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-[1.6]"
                      style={{ color: 'var(--l-text)' }}
                    >
                      {generatedMusic.lyrics}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center">
                <Music size={24} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                <p className="m-0 text-[15px] font-medium" style={{ color: 'var(--l-text)' }}>
                  Lyria 3 audio studio is ready
                </p>
                <p className="m-0 max-w-[380px] text-[13px]" style={{ color: 'var(--l-muted)' }}>
                  Choose Lyria 3 Clip for 30-second sketches or Lyria 3 Pro for full-length tracks. Optionally attach an image to guide the mood.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: Real-time Voice Conversations (gemini-3.8-live) */}
      {activeTab === 'voice' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section
            className="flex flex-col gap-4 rounded-[14px] border p-5 lg:col-span-5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Real-time voice session
              </h2>
              <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                gemini-3.8-live
              </span>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-medium" style={{ color: 'var(--l-muted)' }}>
                Voice
              </span>
              <div className="flex flex-wrap gap-1.5">
                {LIVE_VOICES.map((voice) => (
                  <button
                    key={voice}
                    type="button"
                    disabled={liveStatus !== 'idle'}
                    onClick={() => setVoiceName(voice)}
                    className="h-8 rounded-[8px] border px-3 text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: voiceName === voice ? 'var(--l-selected)' : 'var(--l-bg)',
                      borderColor: voiceName === voice ? 'var(--l-accent)' : 'var(--l-line)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {voice}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="live-voice-instruction"
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: 'var(--l-muted)' }}
              >
                Session instruction
              </label>
              <textarea
                id="live-voice-instruction"
                rows={3}
                disabled={liveStatus !== 'idle'}
                value={voiceInstruction}
                onChange={(e) => setVoiceInstruction(e.target.value)}
                className="w-full resize-none rounded-[10px] border p-3 text-[13px] leading-[1.5] outline-none disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--l-bg)',
                  borderColor: 'var(--l-line-strong)',
                  color: 'var(--l-text)',
                }}
              />
            </div>

            {liveError && <ErrorNote message={liveError} />}

            <div className="flex items-center gap-2">
              {liveStatus === 'idle' ? (
                <button
                  type="button"
                  onClick={() => void startLiveSession()}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[9px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                >
                  <PhoneCall size={15} />
                  <span>Start voice conversation</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLiveMuted((m) => !m)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border px-3.5 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)]"
                    style={{
                      backgroundColor: liveMuted ? 'var(--l-needs-soft)' : 'var(--l-bg)',
                      borderColor: liveMuted ? 'var(--l-needs)' : 'var(--l-line-strong)',
                      color: 'var(--l-text)',
                    }}
                  >
                    {liveMuted ? <MicOff size={15} /> : <Mic size={15} />}
                    <span>{liveMuted ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopLiveSession}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[9px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--l-bad)', color: 'var(--l-on-bad)' }}
                  >
                    <PhoneOff size={15} />
                    <span>{liveStatus === 'connecting' ? 'Cancel' : 'End session'}</span>
                  </button>
                </>
              )}
            </div>
          </section>

          <section
            className="flex flex-col rounded-[14px] border p-5 lg:col-span-7"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div
              className="mb-3 flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--l-line)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      liveStatus === 'live'
                        ? 'var(--l-ok)'
                        : liveStatus === 'connecting'
                          ? 'var(--l-needs)'
                          : 'var(--l-line-strong)',
                  }}
                />
                <span className="text-[13px] font-medium" style={{ color: 'var(--l-text)' }}>
                  {liveStatus === 'live'
                    ? liveMuted
                      ? 'Connected · microphone muted'
                      : 'Live conversation active · listening'
                    : liveStatus === 'connecting'
                      ? 'Connecting to Gemini Live…'
                      : 'Not connected'}
                </span>
              </div>
              {liveTranscripts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLiveTranscripts([])}
                  className="text-[12px] hover:underline"
                  style={{ color: 'var(--l-muted)' }}
                >
                  Clear transcript
                </button>
              )}
            </div>

            <div className="flex min-h-[280px] flex-1 flex-col gap-3 overflow-y-auto">
              {liveTranscripts.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <AudioLines size={24} style={{ color: 'var(--l-muted)' }} aria-hidden="true" />
                  <p className="m-0 text-[15px] font-medium" style={{ color: 'var(--l-text)' }}>
                    Speak naturally with Gemini Live
                  </p>
                  <p className="m-0 max-w-[360px] text-[13px]" style={{ color: 'var(--l-muted)' }}>
                    Audio streams at 16 kHz input and plays back at 24 kHz with automatic interruption handling and live captions.
                  </p>
                </div>
              ) : (
                liveTranscripts.map((entry) => (
                  <div
                    key={entry.id}
                    className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className="max-w-[85%] rounded-[12px] border px-3.5 py-2 text-[14px] leading-[1.5]"
                      style={{
                        backgroundColor: entry.role === 'user' ? 'var(--l-raised)' : 'var(--l-bg)',
                        borderColor: 'var(--l-line)',
                        color: 'var(--l-text)',
                      }}
                    >
                      <span
                        className="mb-0.5 block text-[11px] font-medium"
                        style={{ color: 'var(--l-muted)' }}
                      >
                        {entry.role === 'user' ? 'You' : `Gemini · ${voiceName}`}
                      </span>
                      {entry.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: Audio Transcription (gemini-3.5-transcribe) */}
      {activeTab === 'transcribe' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section
            className="flex flex-col gap-4 rounded-[14px] border p-5 lg:col-span-5"
            style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--l-text)' }}>
                Record or upload audio
              </h2>
              <span className="font-mono text-[11px]" style={{ color: 'var(--l-muted)' }}>
                gemini-3.5-transcribe
              </span>
            </div>

            <button
              type="button"
              disabled={transcribing}
              onClick={() => void handleToggleRecording()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-45"
              style={{
                backgroundColor: recording ? 'var(--l-bad)' : 'var(--l-accent)',
                color: recording ? 'var(--l-on-bad)' : 'var(--l-on-accent)',
              }}
            >
              {recording ? (
                <>
                  <Square size={14} fill="currentColor" />
                  <span className="tabular-nums">Stop recording ({recordSeconds}s)</span>
                </>
              ) : (
                <>
                  <Mic size={15} />
                  <span>Record from microphone</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--l-faint)' }}>
              <span className="h-px flex-1" style={{ backgroundColor: 'var(--l-line)' }} />
              <span>or</span>
              <span className="h-px flex-1" style={{ backgroundColor: 'var(--l-line)' }} />
            </div>

            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-4 py-6 text-center text-[13px] transition-colors hover:bg-[var(--l-hover)]"
              style={{ borderColor: 'var(--l-line-strong)', color: 'var(--l-muted)' }}
            >
              <Upload size={18} aria-hidden="true" />
              <span className="font-medium" style={{ color: 'var(--l-text)' }}>
                Upload an audio recording
              </span>
              <span className="text-[12px]">MP3, WAV, WebM, or M4A</span>
              <input
                type="file"
                accept="audio/*"
                disabled={transcribing}
                onChange={(e) => void handleAudioFileUpload(e)}
                className="sr-only"
              />
            </label>

            {transcribing && (
              <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--l-muted)' }}>
                <LoaderCircle size={14} className="lanes-spin" style={{ color: 'var(--l-accent)' }} />
                <span>Transcribing audio…</span>
              </div>
            )}

            {transcribeError && <ErrorNote message={transcribeError} />}
          </section>

          <section
            className="flex flex-col gap-3 rounded-[14px] border p-5 lg:col-span-7"
            style={{ backgroundColor: 'var(--l-panel)', borderColor: 'var(--l-line)' }}
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="media-transcript-output"
                className="text-[14px] font-semibold"
                style={{ color: 'var(--l-text)' }}
              >
                Transcript
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!transcript.trim()}
                  onClick={() => {
                    void navigator.clipboard.writeText(transcript);
                    onNotify('Copied transcript');
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium whitespace-nowrap hover:bg-[var(--l-hover)] disabled:opacity-40"
                  style={{ backgroundColor: 'var(--l-raised)', borderColor: 'var(--l-line-strong)', color: 'var(--l-text)' }}
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  disabled={!transcript.trim()}
                  onClick={() => void onSendTranscriptToAssistant(transcript.trim())}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--l-accent)', color: 'var(--l-on-accent)' }}
                >
                  <Send size={12} />
                  <span>Send to Assistant</span>
                </button>
              </div>
            </div>

            <textarea
              id="media-transcript-output"
              rows={11}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Spoken words will appear here after recording or uploading an audio clip."
              className="w-full flex-1 resize-none rounded-[10px] border p-3.5 text-[14px] leading-[1.6] outline-none placeholder:text-[var(--l-muted)]"
              style={{
                backgroundColor: 'var(--l-bg)',
                borderColor: 'var(--l-line)',
                color: 'var(--l-text)',
              }}
            />

            <p className="m-0 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--l-muted)' }}>
              <Sparkles size={12} aria-hidden="true" />
              <span>You can also dictate straight into any lane or Assistant thread using the microphone button in the composer.</span>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

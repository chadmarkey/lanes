import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import type { WebSocket } from 'ws';
import type { GeminiModelId, GroundingSource } from '../lib/types.ts';

const VALID_GEMINI_MODELS = new Set<GeminiModelId>([
  'gemini-4-hydrogen',
  'gemini-4-neon',
  'gemini-4-carbon',
  'gemini-3.1-flash-lite',
]);

const MODEL_LABELS: Record<GeminiModelId, string> = {
  'gemini-4-hydrogen': 'Gemini 4 Hydrogen',
  'gemini-4-neon': 'Gemini 4 Neon',
  'gemini-4-carbon': 'Gemini 4 Carbon',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
};

const ALLOWED_IMAGE_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
const ALLOWED_IMAGE_SIZES = new Set(['1K', '2K']);
const ALLOWED_VIDEO_ASPECT_RATIOS = new Set(['16:9', '9:16']);
const ALLOWED_VOICES = new Set(['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir']);

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment. Select a Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function resolveChatModel(requested?: string, useSearch?: boolean): GeminiModelId {
  if (useSearch) {
    return 'gemini-4-hydrogen';
  }
  if (requested && VALID_GEMINI_MODELS.has(requested as GeminiModelId)) {
    return requested as GeminiModelId;
  }
  return 'gemini-4-hydrogen';
}

export async function generateChatReply(opts: {
  message: string;
  laneName: string;
  lanePurpose?: string;
  instructions?: string;
  modelId?: string;
  useSearch?: boolean;
  mode?: string;
  isPrivate?: boolean;
  approvedMemory?: string[];
  history?: { role: string; text: string }[];
}): Promise<{ reply: string; modelLabel: string; sources: GroundingSource[] }> {
  const {
    message,
    laneName,
    lanePurpose,
    instructions,
    modelId,
    useSearch = false,
    mode = 'Build',
    isPrivate,
  } = opts;

  if (isPrivate) {
    return {
      reply: `Kept on-device in private lane "${laneName}" (Qwen 30B local · ${mode}). Logged your request: "${message.slice(0, 140)}". No cloud model or external tool was contacted.`,
      modelLabel: 'Qwen 30B (local)',
      sources: [],
    };
  }

  const ai = getGeminiClient();
  const resolvedModel = resolveChatModel(modelId, useSearch);

  const systemParts = [
    'You are responding inside Lanes, a calm expert workspace.',
    `Active lane: ${laneName}${lanePurpose ? ` — ${lanePurpose}` : ''}.`,
    `Mode: ${mode}. Reply directly in plain prose, concise and actionable, without exclamation marks or filler.`,
    useSearch
      ? 'Google Search grounding is enabled. Cite up-to-date facts clearly and concisely.'
      : '',
    instructions ? `Lane AGENTS.md instructions:\n${instructions}` : '',
    opts.approvedMemory && opts.approvedMemory.length > 0
      ? `Approved lane memory notes:\n${opts.approvedMemory.map((m) => `- ${m}`).join('\n')}`
      : '',
  ].filter(Boolean);

  const historyContents = (opts.history ?? []).slice(-12).map((h) => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text.slice(0, 4000) }],
  }));

  const response = await ai.models.generateContent({
    model: resolvedModel,
    contents: [...historyContents, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: systemParts.join('\n\n'),
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seenUris = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of rawChunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      sources.push({
        uri,
        title: title?.trim() || uri,
      });
    }
  }

  const label = useSearch
    ? `${MODEL_LABELS[resolvedModel]} · Search`
    : MODEL_LABELS[resolvedModel];

  return {
    reply: response.text?.trim() || 'Done.',
    modelLabel: label,
    sources,
  };
}

export async function generateOrEditImage(opts: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  aspectRatio?: string;
  imageSize?: string;
}): Promise<{ imageDataUrl: string; mimeType: string; text: string; interactionId?: string }> {
  const ai = getGeminiClient();
  const aspectRatio = ALLOWED_IMAGE_ASPECT_RATIOS.has(opts.aspectRatio ?? '')
    ? (opts.aspectRatio as string)
    : '1:1';
  const imageSize = ALLOWED_IMAGE_SIZES.has(opts.imageSize ?? '')
    ? (opts.imageSize as string)
    : '1K';

  const input =
    opts.imageBase64 && opts.mimeType
      ? [
          {
            type: 'image' as const,
            data: opts.imageBase64,
            mime_type: opts.mimeType,
          },
          {
            type: 'text' as const,
            text: opts.prompt,
          },
        ]
      : opts.prompt;

  const interaction = await ai.interactions.create({
    model: 'gemini-nano-banana-2.1',
    input,
    response_modalities: ['image', 'text'],
    generation_config: {
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      },
    } as Record<string, unknown>,
  });

  let base64Data = interaction.output_image?.data ?? '';
  let outMime = interaction.output_image?.mime_type ?? 'image/png';
  let text = interaction.output_text ?? '';

  if (!base64Data && Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part.type === 'image' && part.data) {
            base64Data = part.data;
            outMime = part.mime_type || 'image/png';
          } else if (part.type === 'text' && part.text && !text) {
            text = part.text;
          }
        }
      }
    }
  }

  if (!base64Data) {
    throw new Error(
      text
        ? `No image was returned by gemini-nano-banana-2.1: ${text}`
        : 'gemini-nano-banana-2.1 returned no image output.'
    );
  }

  return {
    imageDataUrl: `data:${outMime};base64,${base64Data}`,
    mimeType: outMime,
    text: text.trim(),
    interactionId: interaction.id,
  };
}

export async function animateImageToVideo(opts: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  aspectRatio?: string;
}): Promise<{ videoDataUrl: string; mimeType: string; interactionId?: string }> {
  const ai = getGeminiClient();
  const aspectRatio = ALLOWED_VIDEO_ASPECT_RATIOS.has(opts.aspectRatio ?? '')
    ? (opts.aspectRatio as '16:9' | '9:16')
    : '16:9';

  const input =
    opts.imageBase64 && opts.mimeType
      ? [
          {
            type: 'image' as const,
            mime_type: opts.mimeType,
            data: opts.imageBase64,
          },
          {
            type: 'text' as const,
            text: opts.prompt,
          },
        ]
      : opts.prompt;

  const interaction = await ai.interactions.create(
    {
      model: 'gemini-omni-1.2-flash',
      input,
      background: false,
      store: false,
      stream: false,
      response_format: {
        type: 'video',
        aspect_ratio: aspectRatio,
      } as Record<string, unknown>,
    },
    { timeout: 300000 }
  );

  let videoBase64 = interaction.output_video?.data ?? '';
  let videoMime = interaction.output_video?.mime_type ?? 'video/mp4';

  if (!videoBase64 && Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part.type === 'video' && part.data) {
            videoBase64 = part.data;
            videoMime = part.mime_type || 'video/mp4';
          }
        }
      }
    }
  }

  if (!videoBase64) {
    throw new Error('gemini-omni-1.2-flash completed without returning video data.');
  }

  return {
    videoDataUrl: `data:${videoMime};base64,${videoBase64}`,
    mimeType: videoMime,
    interactionId: interaction.id,
  };
}

const ALLOWED_MUSIC_MODELS = new Set(['lyria-3-clip-preview', 'lyria-3-pro-preview']);

export async function generateMusicTrack(opts: {
  prompt: string;
  model?: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<{ audioBase64: string; mimeType: string; lyrics: string; model: string }> {
  const ai = getGeminiClient();
  const model = ALLOWED_MUSIC_MODELS.has(opts.model ?? '')
    ? (opts.model as 'lyria-3-clip-preview' | 'lyria-3-pro-preview')
    : 'lyria-3-clip-preview';

  const contents =
    opts.imageBase64 && opts.mimeType
      ? {
          parts: [
            { text: opts.prompt },
            {
              inlineData: {
                data: opts.imageBase64,
                mimeType: opts.mimeType,
              },
            },
          ],
        }
      : opts.prompt;

  const responseStream = await ai.models.generateContentStream({
    model,
    contents,
  });

  const audioChunks: string[] = [];
  let mimeType = 'audio/wav';
  let lyrics = '';

  for await (const chunk of responseStream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        audioChunks.push(part.inlineData.data);
        if (part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
      }
      if (part.text && !lyrics) {
        lyrics = part.text.trim();
      }
    }
  }

  const audioBase64 = audioChunks.join('');
  if (!audioBase64) {
    throw new Error(`${model} completed without returning audio data.`);
  }

  return {
    audioBase64,
    mimeType,
    lyrics,
    model,
  };
}

export async function transcribeAudioBuffer(opts: {
  audioBase64: string;
  mimeType: string;
}): Promise<{ transcript: string }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: opts.mimeType,
            data: opts.audioBase64,
          },
        },
        {
          text: 'Transcribe this audio accurately. Return only the spoken transcript.',
        },
      ],
    },
  });

  const transcript = response.text?.trim() ?? '';
  if (!transcript) {
    throw new Error('No speech was detected in the recording.');
  }
  return { transcript };
}

export async function attachLiveVoiceSession(
  clientWs: WebSocket,
  opts: { voiceName?: string; systemInstruction?: string } = {}
): Promise<void> {
  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini API key unavailable.';
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', error: message }));
      clientWs.close(1011, 'Missing API key');
    }
    return;
  }

  const voiceName = ALLOWED_VOICES.has(opts.voiceName ?? '') ? (opts.voiceName as string) : 'Zephyr';
  const systemInstruction =
    opts.systemInstruction?.trim() ||
    'You are the calm, direct voice assistant inside Lanes. Speak clearly and concisely in plain prose.';

  const sendSafe = (payload: Record<string, unknown>) => {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  let closed = false;
  try {
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        systemInstruction,
      },
      callbacks: {
        onopen: () => {
          sendSafe({ type: 'ready', model: 'gemini-3.8-live', voiceName });
        },
        onmessage: (message: LiveServerMessage) => {
          const serverContent = message.serverContent;
          if (!serverContent) return;

          if (serverContent.inputTranscription?.text) {
            sendSafe({
              type: 'inputTranscript',
              text: serverContent.inputTranscription.text,
            });
          }
          if (serverContent.outputTranscription?.text) {
            sendSafe({
              type: 'outputTranscript',
              text: serverContent.outputTranscription.text,
            });
          }
          for (const part of serverContent.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              sendSafe({ type: 'audio', data: part.inlineData.data });
            }
          }
          if (serverContent.interrupted) {
            sendSafe({ type: 'interrupted' });
          }
          if (serverContent.turnComplete) {
            sendSafe({ type: 'turnComplete' });
          }
        },
        onerror: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Gemini Live session error.';
          sendSafe({ type: 'error', error: msg });
        },
        onclose: () => {
          if (!closed) {
            sendSafe({ type: 'closed' });
          }
        },
      },
    });

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          audio?: string;
          text?: string;
        };
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch {
        // ignore malformed frames
      }
    });

    clientWs.on('close', () => {
      closed = true;
      try {
        session.close();
      } catch {
        // ignore close errors
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start Gemini Live voice session.';
    sendSafe({ type: 'error', error: message });
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.close(1011, 'Live session error');
    }
  }
}

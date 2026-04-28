// Voice messages — Discord requires the attachment to include `duration_secs`
// and `waveform` (base64-encoded byte-per-tick amplitude buffer).
//
// Usage:
//   const file = voiceMessageFile({ data: oggBuf, durationSecs: 3.4, waveform: bytes });
//   await ch.send({ files: [file], voiceMessage: true, ...attachmentMetadata(file) });

import type { RestFile } from "./rest.js";

export interface VoiceMessageInput {
  /** Audio data (must be opus-encoded OGG; 48kHz mono recommended). */
  data: Uint8Array;
  /** Length of the audio in seconds. */
  durationSecs: number;
  /**
   * Waveform: array of 0..255 amplitude samples (~256 bytes typical).
   * Will be base64-encoded for the attachment metadata.
   */
  waveform: Uint8Array;
  /** Filename. Default "voice-message.ogg". */
  name?: string;
}

export interface VoiceMessageBundle {
  file: RestFile;
  /** Pass these alongside `files: [...]` in send opts to register attachment metadata. */
  attachmentsMeta: { id: number; filename: string; duration_secs: number; waveform: string }[];
}

/** Build a voice-message attachment + the matching `attachments` metadata array. */
export function voiceMessage(input: VoiceMessageInput): VoiceMessageBundle {
  const name = input.name ?? "voice-message.ogg";
  const waveform = Buffer.from(input.waveform).toString("base64");
  return {
    file: { name, data: input.data, type: "audio/ogg" },
    attachmentsMeta: [
      {
        id: 0,
        filename: name,
        duration_secs: input.durationSecs,
        waveform,
      },
    ],
  };
}

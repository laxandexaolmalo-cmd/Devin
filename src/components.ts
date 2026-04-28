// Object-literal helpers for message components & modal text inputs.
// Keep these as factory functions, NOT a builder class — easier for LLMs to generate.

import { ButtonStyle, ComponentType, TextInputStyle } from "./types.js";

export type Emoji = string | { name?: string; id?: string; animated?: boolean };

// ── Buttons ────────────────────────────────────────────────────────────────

export interface ButtonOptions {
  customId: string;
  label?: string;
  style?: "primary" | "secondary" | "success" | "danger" | keyof typeof ButtonStyle;
  emoji?: Emoji;
  disabled?: boolean;
}

export function button(opts: ButtonOptions) {
  return {
    type: ComponentType.Button,
    custom_id: opts.customId,
    label: opts.label,
    style: styleFor(opts.style ?? "Primary"),
    emoji: opts.emoji ? toEmoji(opts.emoji) : undefined,
    disabled: opts.disabled,
  };
}

export function linkButton(opts: { url: string; label?: string; emoji?: Emoji; disabled?: boolean }) {
  return {
    type: ComponentType.Button,
    style: ButtonStyle.Link,
    url: opts.url,
    label: opts.label,
    emoji: opts.emoji ? toEmoji(opts.emoji) : undefined,
    disabled: opts.disabled,
  };
}

/** Premium SKU button (style 6). Opens the in-Discord checkout flow for `skuId`. */
export function premiumButton(opts: { skuId: string; disabled?: boolean }) {
  return {
    type: ComponentType.Button,
    style: ButtonStyle.Premium,
    sku_id: opts.skuId,
    disabled: opts.disabled,
  };
}

// ── Selects ────────────────────────────────────────────────────────────────

export interface StringSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: Emoji;
  default?: boolean;
}

export interface SelectBase {
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export function stringSelect(opts: SelectBase & { options: StringSelectOption[] }) {
  return {
    type: ComponentType.StringSelect,
    custom_id: opts.customId,
    placeholder: opts.placeholder,
    min_values: opts.minValues,
    max_values: opts.maxValues,
    disabled: opts.disabled,
    options: opts.options.map((o) => ({
      label: o.label,
      value: o.value,
      description: o.description,
      emoji: o.emoji ? toEmoji(o.emoji) : undefined,
      default: o.default,
    })),
  };
}

export function userSelect(opts: SelectBase) {
  return baseSelect(ComponentType.UserSelect, opts);
}
export function roleSelect(opts: SelectBase) {
  return baseSelect(ComponentType.RoleSelect, opts);
}
export function mentionableSelect(opts: SelectBase) {
  return baseSelect(ComponentType.MentionableSelect, opts);
}
export function channelSelect(opts: SelectBase & { channelTypes?: number[] }) {
  return { ...baseSelect(ComponentType.ChannelSelect, opts), channel_types: opts.channelTypes };
}

function baseSelect(type: number, opts: SelectBase) {
  return {
    type,
    custom_id: opts.customId,
    placeholder: opts.placeholder,
    min_values: opts.minValues,
    max_values: opts.maxValues,
    disabled: opts.disabled,
  };
}

// ── Action row ─────────────────────────────────────────────────────────────

/** Group up to 5 buttons or 1 select into a row. Pass children directly. */
export function row(...children: unknown[]) {
  return {
    type: ComponentType.ActionRow,
    components: children,
  };
}

// ── Text input (modals only) ───────────────────────────────────────────────

export interface TextInputOptions {
  customId: string;
  label: string;
  style?: "short" | "paragraph";
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

export function textInput(opts: TextInputOptions) {
  return {
    type: ComponentType.TextInput,
    custom_id: opts.customId,
    label: opts.label,
    style: opts.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short,
    placeholder: opts.placeholder,
    value: opts.value,
    required: opts.required,
    min_length: opts.minLength,
    max_length: opts.maxLength,
  };
}

// ── Modal ──────────────────────────────────────────────────────────────────

export interface ModalDef {
  customId: string;
  title: string;
  /** One row per field. */
  inputs: ReturnType<typeof textInput>[];
}

export function buildModalPayload(m: ModalDef) {
  return {
    custom_id: m.customId,
    title: m.title,
    components: m.inputs.map((i) => ({
      type: ComponentType.ActionRow,
      components: [i],
    })),
  };
}

// ── Components V2 (2025) ───────────────────────────────────────────────────
// To use V2 you MUST set the IS_COMPONENTS_V2 flag on the message
// (Supa.js does this automatically when you pass `componentsV2: true` or use
// `containerV2()` at the top-level). V2 messages cannot also have content,
// embeds, polls, or stickers.

export type MediaUrl = string | { url: string };

function media(m: MediaUrl): { url: string } {
  return typeof m === "string" ? { url: m } : m;
}

/** Markdown text block (V2). */
export function textDisplay(content: string) {
  return { type: ComponentType.TextDisplay, content };
}

/** Visual divider (V2). */
export function separator(opts: { divider?: boolean; spacing?: "small" | "large" } = {}) {
  return {
    type: ComponentType.Separator,
    divider: opts.divider,
    spacing: opts.spacing === "large" ? 2 : 1,
  };
}

/** Section (V2): up to 3 TextDisplay components + an accessory (button or thumbnail). */
export function section(opts: {
  text: string | string[];
  accessory: ReturnType<typeof button> | ReturnType<typeof linkButton> | ReturnType<typeof thumbnail>;
}) {
  const texts = Array.isArray(opts.text) ? opts.text : [opts.text];
  return {
    type: ComponentType.Section,
    components: texts.slice(0, 3).map(textDisplay),
    accessory: opts.accessory,
  };
}

/** Thumbnail (V2): a small image to the side of a Section. */
export function thumbnail(opts: { url: MediaUrl | string; description?: string; spoiler?: boolean }) {
  const m = typeof opts.url === "string" ? opts.url : opts.url.url;
  return {
    type: ComponentType.Thumbnail,
    media: { url: m },
    description: opts.description,
    spoiler: opts.spoiler,
  };
}

/** Media gallery (V2): up to 10 images/videos in a grid. */
export function mediaGallery(items: { url: MediaUrl | string; description?: string; spoiler?: boolean }[]) {
  return {
    type: ComponentType.MediaGallery,
    items: items.slice(0, 10).map((i) => ({
      media: media(i.url),
      description: i.description,
      spoiler: i.spoiler,
    })),
  };
}

/** File component (V2): renders an attached file. Use "attachment://name.ext". */
export function fileComponent(opts: { url: string; spoiler?: boolean }) {
  return { type: ComponentType.File, file: { url: opts.url }, spoiler: opts.spoiler };
}

/** Container (V2): groups child components, optional accent color stripe + spoiler. */
export function container(opts: {
  /** Children: text/section/mediaGallery/separator/file/actionRow */
  children: unknown[];
  accentColor?: number;
  spoiler?: boolean;
}) {
  return {
    type: ComponentType.Container,
    components: opts.children,
    accent_color: opts.accentColor,
    spoiler: opts.spoiler,
  };
}

// ── Internal ───────────────────────────────────────────────────────────────

function styleFor(s: ButtonOptions["style"]): number {
  if (typeof s === "number") return s;
  const k = (typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1) : "Primary") as keyof typeof ButtonStyle;
  return ButtonStyle[k] ?? ButtonStyle.Primary;
}

function toEmoji(e: Emoji) {
  if (typeof e === "string") {
    const m = /^<?(a)?:?(\w+):(\d+)>?$/.exec(e);
    if (m) return { name: m[2], id: m[3], animated: m[1] === "a" };
    return { name: e };
  }
  return e;
}

import { z } from "zod";

export const CaptureKind = z.enum(["image", "pdf", "link", "youtube", "text"]);
export const CaptureStatus = z.enum([
  "queued",
  "processing",
  "ready",
  "needs_attention",
  "deleting",
  "failed",
]);
export const FailureCategory = z.enum([
  "authentication_required",
  "paywall",
  "robots_denied",
  "bot_protection",
  "unsupported_content",
  "empty_content",
  "captions_unavailable",
  "invalid_url",
  "unsafe_url",
  "fetch_timeout",
  "transient",
  "unknown",
]);

export const Entity = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["person", "company", "product", "technology", "place", "concept", "other"]),
});

export const SourceClue = z.object({
  title: z.string().max(500).nullable(),
  author: z.string().max(300).nullable(),
  publication: z.string().max(300).nullable(),
  publishedAt: z.string().datetime().nullable(),
});

const AnalysisFields = z.object({
  language: z.string().min(2).max(20),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(4000),
  keyIdeas: z.array(z.string().min(1).max(800)).min(1).max(12),
  entities: z.array(Entity).max(30),
  topics: z.array(z.string().min(1).max(80)).min(1).max(10),
  source: SourceClue,
  confidence: z.number().min(0).max(1),
});

// Text sources are already extracted before analysis, so asking the model to
// echo them back wastes output tokens. Images and PDFs still need OCR output.
export const TextItemAnalysis = AnalysisFields;
export const ItemAnalysis = AnalysisFields.extend({
  extractedText: z.string().min(1),
});

const ImageMimeType = z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ImageUpload = z.object({
    fileName: z.string().min(1).max(255),
    mimeType: ImageMimeType,
    sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
});
const PdfUpload = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});

export const CreateUploadRequest = z.object({
  files: z.array(z.union([ImageUpload, PdfUpload])).min(1).max(20),
}).superRefine(({ files }, context) => {
  if (files.some((file) => file.mimeType === "application/pdf") && files.length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Upload one PDF at a time", path: ["files"] });
  }
});

export const CreateImageCaptureRequest = z.object({
  assets: z.array(z.object({
    objectKey: z.string().min(1).max(1024),
    fileName: z.string().min(1).max(255),
    mimeType: ImageMimeType,
    sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
  })).min(1).max(20),
  note: z.string().trim().max(2000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const CreatePdfCaptureRequest = z.object({
  asset: z.object({
    objectKey: z.string().min(1).max(1024),
    fileName: z.string().min(1).max(255),
    mimeType: z.literal("application/pdf"),
    sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  }),
  note: z.string().trim().max(2000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const CreateLinkCapturesRequest = z.object({
  links: z.array(z.object({
    url: z.string().url().max(4096),
    note: z.string().trim().max(2000).nullable().optional(),
  })).min(1).max(50),
  capturedAt: z.string().datetime().optional(),
});

export const CreateTextCaptureRequest = z.object({
  text: z.string().trim().min(1).max(250_000),
  note: z.string().trim().max(2000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const UpdateCaptureRequest = z.object({
  note: z.string().trim().max(2000).nullable().optional(),
  archived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const DigestSettings = z.object({
  timezone: z.string().min(1).max(100),
  weekday: z.number().int().min(0).max(6),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  preferredLanguage: z.string().min(2).max(20).default("en"),
  enabled: z.boolean().default(true),
});

export const RelationType = z.enum(["complements", "updates", "contradicts", "recurring_theme"]);
export const DigestRelation = z.object({
  currentCaptureId: z.string().uuid(),
  priorCaptureId: z.string().uuid(),
  type: RelationType,
  explanation: z.string().min(1).max(1500),
  currentEvidence: z.string().min(1).max(1200),
  priorEvidence: z.string().min(1).max(1200),
  confidence: z.number().min(0).max(1),
});

export const DigestSynthesis = z.object({
  title: z.string().min(1).max(300),
  overview: z.string().min(1).max(3000),
  themes: z.array(z.object({
    name: z.string().min(1).max(100),
    summary: z.string().min(1).max(1200),
    captureIds: z.array(z.string().uuid()).min(1),
  })).max(12),
  relations: z.array(DigestRelation).max(100),
});

export type CaptureKind = z.infer<typeof CaptureKind>;
export type CaptureStatus = z.infer<typeof CaptureStatus>;
export type TextItemAnalysis = z.infer<typeof TextItemAnalysis>;
export type ItemAnalysis = z.infer<typeof ItemAnalysis>;
export type DigestSettings = z.infer<typeof DigestSettings>;
export type DigestSynthesis = z.infer<typeof DigestSynthesis>;

import { describe, expect, it } from "vitest";
import { CreateLinkCapturesRequest, CreatePdfCaptureRequest, CreateTextCaptureRequest, CreateUploadRequest, DigestSettings } from "./index.js";

describe("contracts", () => {
  it("caps bulk link imports at 50", () => {
    const links = Array.from({ length: 51 }, (_, index) => ({ url: `https://example.com/${index}` }));
    expect(CreateLinkCapturesRequest.safeParse({ links }).success).toBe(false);
  });

  it("allows the supported image formats", () => {
    expect(CreateUploadRequest.safeParse({ files: [{ fileName: "book.heic", mimeType: "image/heic", sizeBytes: 20 }] }).success).toBe(true);
  });

  it("accepts up to 20 images and rejects more", () => {
    const image = { fileName: "screenshot.png", mimeType: "image/png" as const, sizeBytes: 20 };
    expect(CreateUploadRequest.safeParse({ files: Array.from({ length: 20 }, () => image) }).success).toBe(true);
    expect(CreateUploadRequest.safeParse({ files: Array.from({ length: 21 }, () => image) }).success).toBe(false);
  });

  it("accepts one PDF up to 25 MB and rejects mixed PDF/image uploads", () => {
    const pdf = { fileName: "report.pdf", mimeType: "application/pdf" as const, sizeBytes: 25 * 1024 * 1024 };
    expect(CreateUploadRequest.safeParse({ files: [pdf] }).success).toBe(true);
    expect(CreatePdfCaptureRequest.safeParse({ asset: { objectKey: "user/report.pdf", ...pdf } }).success).toBe(true);
    expect(CreateUploadRequest.safeParse({ files: [pdf, { fileName: "page.png", mimeType: "image/png", sizeBytes: 20 }] }).success).toBe(false);
  });

  it("accepts meaningful pasted text and caps it at 250,000 characters", () => {
    expect(CreateTextCaptureRequest.safeParse({ text: "A useful idea worth remembering." }).success).toBe(true);
    expect(CreateTextCaptureRequest.safeParse({ text: "   " }).success).toBe(false);
    expect(CreateTextCaptureRequest.safeParse({ text: "a".repeat(250_001) }).success).toBe(false);
  });

  it("validates digest local time", () => {
    expect(DigestSettings.safeParse({ timezone: "America/New_York", weekday: 0, localTime: "18:00", preferredLanguage: "en", enabled: true }).success).toBe(true);
    expect(DigestSettings.safeParse({ timezone: "UTC", weekday: 0, localTime: "25:00", preferredLanguage: "en", enabled: true }).success).toBe(false);
  });
});

import { z } from "zod";

export const env = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_ITEM_MODEL: z.string().default("gpt-5.6-luna"),
  OPENAI_DIGEST_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  SUPADATA_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
}).parse(process.env);

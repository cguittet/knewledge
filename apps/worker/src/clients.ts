import OpenAI from "openai";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
export const resend = new Resend(env.RESEND_API_KEY);


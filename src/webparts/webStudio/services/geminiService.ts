import { ThemeConfig } from "../types";
import {
  buildThemeGenerationQuery,
  parseAndCompleteThemeFromAiResponse
} from "./themeGeneration";

/** Lambda Function URL for document summary (hardcoded until moved to config). */
const AWS_LAMBDA_DOCUMENT_SUMMARY_URL =
  "https://7wsfueiftfkijt3fnbylooalqa0hytqh.lambda-url.eu-north-1.on.aws/";

const AWS_LAMBDA_AI_MODE = "GENERAL_AI";

type LambdaAiResponse = {
  success?: boolean;
  mode?: string;
  output?: string;
  error?: string;
  message?: string;
};

const resolveAwsLambdaApiKey = (): string => {
  return "";
};

const buildAwsLambdaRequestHeaders = (
  base: Record<string, string> = {}
): Record<string, string> => {
  const headers = { ...base };
  const apiKey = resolveAwsLambdaApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
};

const invokeLambdaJsonWrapped = async (
  inner: Record<string, unknown>,
  signal?: AbortSignal
): Promise<any> => {
  const response = await fetch(AWS_LAMBDA_DOCUMENT_SUMMARY_URL, {
    method: "POST",
    headers: buildAwsLambdaRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json"
    }),
    body: JSON.stringify({ body: JSON.stringify(inner) }),
    signal
  });
  const rawBody = await response.text();
  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      response.ok
        ? "AWS-Lambda returned a non-JSON response."
        : `AWS-Lambda request failed (${response.status}).`
    );
  }
  if (!response.ok) {
    console.warn("[AWS Lambda response]", {
      requestMode: inner.mode,
      requestPayload: inner,
      status: response.status,
      response: data
    });
    throw new Error(String(data?.message || data?.error || `AWS-Lambda failed (${response.status}).`));
  }
  if (data?.success === false) {
    throw new Error(String(data?.message || data?.error || "AWS-Lambda reported success: false."));
  }
  console.log("[AWS Lambda response]", {
    requestMode: inner.mode,
    requestPayload: inner,
    response: data
  });
  return data;
};

const extractLambdaOutput = (data: LambdaAiResponse): string | null => {
  const output = typeof data?.output === "string" ? data.output.trim() : "";
  return output || null;
};

const buildTranslateQuery = (text: string, targetLang: string): string =>
  `Translate into ${targetLang}. Preserve the original line breaks and text structure.\n` +
  "Return ONLY the translated text, no explanations.\n\n" +
  `Text:\n${text}`;

export const generateThemeFromPrompt = async (prompt: string): Promise<ThemeConfig | null> => {
  if (!prompt || !prompt.trim()) return null;

  try {
    const data = await invokeLambdaJsonWrapped({
      mode: AWS_LAMBDA_AI_MODE,
      query: buildThemeGenerationQuery(prompt)
    });

    const text = extractLambdaOutput(data);
    if (!text) return null;

    return parseAndCompleteThemeFromAiResponse(text);
  } catch (error: any) {
    console.error("Lambda generateTheme error:", error.message || error);
    return null;
  }
};

export const translateText = async (text: string, targetLang: string): Promise<string | null> => {
  if (!text || !text.trim()) return null;

  try {
    const data = await invokeLambdaJsonWrapped({
      mode: AWS_LAMBDA_AI_MODE,
      query: buildTranslateQuery(text, targetLang)
    });

    return extractLambdaOutput(data);
  } catch (error: any) {
    console.error("Lambda translateText error:", error.message || error);
    return null;
  }
};

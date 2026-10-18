import OpenAI from "openai";
import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type AskModel = (messages: ChatCompletionMessageParam[], tools?: ChatCompletionTool[]) => Promise<ChatCompletionMessage>;

export function createModel(env: Record<string, string | undefined> = process.env) : AskModel {
    const apiKey = env.LLM_API_KEY?.trim();
    const baseURL = env.LLM_BASE_URL?.trim();
    const model = env.LLM_MODEL?.trim();
    if(!apiKey) {
        throw new Error("LLM_API_KEY 环境变量未设置");
    }
    if(!baseURL) {
        throw new Error("LLM_BASE_URL 环境变量未设置");
    }
    if(!model) {
        throw new Error("LLM_MODEL 环境变量未设置");
    }
    let url: URL;
    try{ url = new URL(baseURL); } catch (error) {throw new Error("LLM_BASE_URL 环境变量格式错误");}
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if((url.protocol !== "https:" && !(local && url.protocol === "http:"))){
        throw new Error("LLM_BASE_URL 环境变量格式错误");
    }
    
    const client = new OpenAI({apiKey, baseURL, timeout: 30000, maxRetries: 0});
    return async (messages, tools) => {
        const response = await client.chat.completions.create({
            model,
            messages,
            ...(tools?.length ? {tools, tool_choice: "auto" as const} : {}),
            stream: false,
            max_tokens: 2048,
        });
        const choice = response.choices[0];
        if(!choice) {
            throw new Error("模型返回空响应");
        }
        if(!["stop", "tool_calls"].includes(choice.finish_reason)) {
            throw new Error(`模型返回非正常响应：${choice.finish_reason}`);
        }
        return choice.message;
    };
}
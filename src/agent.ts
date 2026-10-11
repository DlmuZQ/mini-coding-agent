import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AskModel } from "./model";
import { executeReadFile, readFileTool } from "./read-file";

export type Trace = (label: string, data: unknown) => void;
function visibleMessage(message: ChatCompletionMessageParam): object {
    const result = {role: message.role, content: message.content};
    if(message.role === "assistant") return {...result, tool_calls: message.tool_calls};
    if(message.role === "tool") return {...result, tool_call_id: message.tool_call_id};
    return result;
}

export const SYSTEM_PROMPT = `你是一个只读 Coding Agent，用中文简洁回答。
关于本地代码的问题，必须先用 read_file 获取证据，在根据实际文件回答并指出文件名。`;

export async function runAgent(options: {
    prompt: string;
    workspace: string; 
    askModel: AskModel;
    trace?: Trace;
    maxRounds?: number;
}): Promise<string> {
    const {prompt, workspace, askModel, trace = () => {}, maxRounds = 6} = options;
    if(!prompt.trim()) throw new Error("prompt 不能为空");
    if(!Number.isInteger(maxRounds) || maxRounds < 1) throw new Error("maxRounds 必须为正整数");
    const messages: ChatCompletionMessageParam[] = [
        {role: "system", content: SYSTEM_PROMPT},
        {role: "user", content: prompt},
    ];
    for(let round = 1; round <= maxRounds; round++) {
        trace(`请求 ${round}：messages + tools(公开字段)`, {messages: structuredClone(messages.map(visibleMessage)), tools:[readFileTool]});
        const assistant = await askModel(messages); // 1. 模型决策
        trace(`响应 ${round}：assistant`, visibleMessage(assistant));
        messages.push(assistant); // 工具请求本身必须保留，不能只保存工具结果

        const calls = assistant.tool_calls ?? [];
        if(calls.length === 0) {
            const answer = assistant.content?.trim() || assistant.refusal?.trim();
            if(!answer) throw new Error("模型返回空响应");
            return answer; //没有工具调用，直接返回回答
        }
        for(const call of calls) {
            if(call.type !== "function") throw new Error("工具调用类型错误");
            const content = call.function.name === "read_file" ? 
            await executeReadFile(workspace, call.function.arguments) : //2. 宿主执行
            JSON.stringify({ok: false, error: "不支持的工具"});
            const result: ChatCompletionMessageParam = {role: "tool", content, tool_call_id: call.id};
            trace(`工具 ${call.id}：result`, result);
            messages.push(result); // 3. 结果回灌，然后进入下一轮。
        }
    }
    throw new Error(`达到最大轮数 ${maxRounds}，但模型没有返回回答`);
}
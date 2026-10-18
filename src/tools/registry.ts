import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { ToolError} from "./types";
import type { JsonValue, ToolContext, ToolDefinition } from "./types";

type RegisteredTool = {
    description: ChatCompletionTool;
    // 校验通过才执行必包，保留 Args 类型，不用 any 把参数强转成可信
    prepare: (value: unknown, context: ToolContext) => () => Promise<JsonValue>;
}

export class ToolRegistry {
    #tools = new Map<string, RegisteredTool>();

    register<Args, Output extends JsonValue>(tool: ToolDefinition<Args, Output>): this {
        if(!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) throw new Error(`工具名称格式无效: ${tool.name}`);
        if(this.#tools.has(tool.name)) throw new Error(`工具名称已存在: ${tool.name}`);
        const { name, description, parameters, validate, execute } = tool;
        this.#tools.set(name, {
            description: {
                type: "function",
                function: {
                    name,
                    description,
                    parameters: structuredClone(parameters),
                },
            },
            prepare: (value: unknown, context) => {
                if(!validate(value)) throw new ToolError("INVALID_ARGUMENTS");
                return () => execute(value, context);
            },
        });
        return this;
    }

    get(name: string): RegisteredTool | undefined {
        const tool = this.#tools.get(name);
        return tool && {...tool, description: structuredClone(tool.description)};
    }

    modelTools() : ChatCompletionTool[] {
        return [...this.#tools.values()].map(tool => structuredClone(tool.description));
    }
}
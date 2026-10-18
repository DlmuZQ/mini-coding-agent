export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ToolContext = {workspace: string};

//设计错误信息，便于人工或者模型理解错误原因
export const ERROR_MESSAGES = {
    UNKNOWN_TOOL: "未注册该工具。",
    INVALID_JSON: "工具参数必须是有效 JSON。",
    INVALID_ARGUMENTS: "该工具参数不符合定义，请检查必填项、类型与额外字段。",
    INVALID_PATH: "path 必须是工作区的相对路径，且不能包含空字符串。",
    OUTSIDE_WORKSPACE: "路径超出工作区范围。",
    RESTRICTED_PATH: "路径被限制，请检查。",
    NOT_FOUND: "文件或目录不存在。",
    BINARY_FILE: "文件是二进制文件，无法处理。",
    INVALID_UTF8: "文件包含无效的 UTF-8 字符。",
    READ_FAILED: "读取文件失败。",
    EXECUTE_FAILED: "工具执行失败，内部异常。",
    TOO_LARGE: "文件太大吵过 32 KiB，展示支持。",
} as const;
export type ToolErrorCode = keyof typeof ERROR_MESSAGES;
export type ToolResult<T extends JsonValue = JsonValue> = 
    | { ok: true; data: T }
    | { ok: false; error: {code : ToolErrorCode; message: string}};

export class ToolError extends Error {
    constructor(readonly code: ToolErrorCode) {super(ERROR_MESSAGES[code]);}
}
export function failure(code: ToolErrorCode): ToolResult<never> {
    return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

export type ToolDefinition<Args, Output extends JsonValue> = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    validate: (value: unknown) => value is Args;
    execute: (args: Args, context: ToolContext) => Promise<Output>;
};
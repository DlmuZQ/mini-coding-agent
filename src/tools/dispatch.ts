import type { ToolRegistry } from "./registry";
import { failure, ToolError}  from "./types";
import type { ToolContext, ToolResult } from "./types";

export async function dispatchTool(
    registry: ToolRegistry,
    call: {name: string; arguments: string},
    context: ToolContext,
): Promise<ToolResult> {
    const tool = registry.get(call.name);
    if(!tool) return failure("UNKNOWN_TOOL");
    let value: unknown;
    try {
        value = JSON.parse(call.arguments);
    } catch (error) {
        return failure("INVALID_JSON");
    }
    try {
        const execute = tool.prepare(value, context);
        return {ok: true, data: await execute()}; //校验，尚未执行工具
    } catch (error) {
        return failure(error instanceof ToolError ? error.code : "EXECUTE_FAILED");
    }
}
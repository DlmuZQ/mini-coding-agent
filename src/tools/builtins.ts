import { readFileTool } from "../read-file";
import { ToolRegistry } from "./registry";

export function createBuiltinRegistry(): ToolRegistry {
    return new ToolRegistry().register(readFileTool);
}
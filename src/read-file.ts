import {open, realpath, stat} from 'node:fs/promises';
import path, { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { ToolError } from './tools/types';
import type { ToolDefinition } from './tools/types';

const MAX_FILE_BYTES = 32 * 1024;

export type ReadFileArgs = {path: string};
export type ReadFileData = {path: string; content: string};

export function validateReadFile(value: unknown): value is ReadFileArgs {
    return value !== null && typeof value === "object" && !Array.isArray(value) && 
    Object.keys(value).length === 1 && Object.hasOwn(value, "path") && 
    "path" in value && typeof value.path === "string" && /\S/.test(value.path);
}

// 描述信息，给模型识别
export const readFileTool: ToolDefinition<ReadFileArgs, ReadFileArgs> = {
  name: 'read_file',
  description: '读取工作区目录下的文件内容, 最大 32 KiB。path 必须为相对路径。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '相对路径，必须以 ./ 开头' },
    },
    required: ['path'],
    additionalProperties: false,
  },
  validate: validateReadFile,
  execute: (args, context) => readFile(context.workspace, args.path),
};

function checkPath(root: string, target: string): void {
  const path = relative(root, target);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error("拒绝读取工作区目录外的文件。");
  }
  if(path.split(sep).some((part) => part.startsWith(".") || part === "node_modules")) {
    throw new Error("不能读取隐藏文件、隐藏目录或者 node_modules。");
  }
}

export async function readFile(workspace: string, path: string): Promise<ReadFileData> {
    try {
        if(isAbsolute(path) || win32.isAbsolute(path) || path.startsWith("\0")) {
            throw new ToolError("INVALID_PATH");
        }
        const root = await realpath(workspace);
        const candidate = resolve(root, path);
        checkPath(root, candidate);
        const target = await realpath(candidate);
        checkPath(root, target);
        if(!(await stat(target)).isFile()) {
            throw new ToolError("NOT_FOUND");
        }

        const file = await open(target, "r");
        try {
            // 有界读取，文件多大时拒绝，不把不完整的伪装为完整的文件
            const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
            let total = 0;
            while (total < buffer.length) {
                const { bytesRead } = await file.read(buffer, total, buffer.length - total);
                if(bytesRead === 0) {
                    break;
                }
                total += bytesRead;
            }
            if(total > MAX_FILE_BYTES) {
                throw new ToolError("TOO_LARGE");
            }
            const bytes = buffer.subarray(0, total);
            let content: string;
            try {
                content = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
            } catch (error) {
                throw new ToolError("INVALID_UTF8");
            }
            return {path, content};
        } finally {
            await file.close();
        }
    } catch (error) {
        if(error instanceof ToolError) throw error;
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if(code === "ENOENT" || code === "ENOTDIR") throw new ToolError("NOT_FOUND");
        throw new ToolError("READ_FAILED");
    }
}
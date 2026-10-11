import {open, realpath, stat} from 'node:fs/promises';
import path, { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

const MAX_FILE_BYTES = 32 * 1024;

// 描述信息，给模型识别
export const readFileTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '读取工作区目录下的文件内容, 最大 32 KiB。path 必须为相对路径。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对路径，必须以 ./ 开头' },
      },
    },
  },
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

export async function executeReadFile(workspace: string, argumentsJson: string): Promise<string> {
    try {
        let args: unknown;
        try {
            args = JSON.parse(argumentsJson);
        } catch (error) {
            throw new Error("解析参数失败。");
        }
        if (!args || typeof args !== "object" || Array.isArray(args) || !("path" in args)
        || typeof args.path !== "string" || !args.path.trim() || Object.keys(args).length !== 1) {
            throw new Error("参数必须且仅有一个 path 字段。");
        }
        if(isAbsolute(args.path) || win32.isAbsolute(args.path) || args.path.startsWith("\0")) {
            throw new Error("path 必须是工作区的相对路径。");
        }
        const root = await realpath(workspace);
        const candidate = resolve(root, args.path);
        checkPath(root, candidate);
        const target = await realpath(candidate);
        checkPath(root, target);
        if(!(await stat(target)).isFile()) {
            throw new Error("只能读取普通文件。");
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
                throw new Error("文件太大吵过 32 KiB，展示支持。");
            }
            const bytes = buffer.subarray(0, total);
            let content: string;
            try {
                content = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
            } catch (error) {
                throw new Error("文件编码错误，不是 UTF-8 编码。");
            }
            return JSON.stringify({ok: true, path: args.path, content});
        } finally {
            await file.close();
        }
    } catch (error) {
        const message = error instanceof Error && !("code" in error) ? error.message : "文件不存在或者无法读取";
        return JSON.stringify({ok: false, error: message});
    }
}
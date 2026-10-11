import {realpath, stat} from "node:fs/promises";
import {resolve} from "node:path";
import { fileURLToPath } from "node:url";
import {parseArgs} from "node:util";
import {runAgent} from "./agent";
import {createModel} from "./model";

async function main(): Promise<void> {
    const {values} = parseArgs({
        options: {
            prompt: {type: "string", short: "p"},
            workspace: {type: "string", short: "w"},
            trace: {type: "boolean", short: "t", default: false},
            help: {type: "boolean", short: "h", default: false},
        },
    });
    if(values.help) {
        console.log(`只读 Coding Agent，用中文简洁回答。`);
        console.log(`Options:`);
        console.log(`  -w, --workspace <path>  Workspace directory (default: .)`);
        console.log(`  -t, --trace            Trace the agent's actions`);
        console.log(`  -h, --help             Show this help message`);
        return;
    }
    const workspace = await realpath(values.workspace ? resolve(values.workspace) : fileURLToPath(new URL("../workspace", import.meta.url)));
    if(!(await stat(workspace)).isDirectory()) {
        throw new Error("Workspace 必须是目录");
    }
    const askModel = createModel();
    const answer = await runAgent({
        prompt: values.prompt ?? "请读取 pricing.ts: 免费运费门槛和基础运费分别是多少？请给出依据",
        workspace, 
        askModel, 
        trace: values.trace ? (label, data) => console.error(`\n[${label}]\n${JSON.stringify(data, null, 2)}`): undefined, 
        maxRounds: 6});
    console.log(answer);
}

main().catch((error:unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
})
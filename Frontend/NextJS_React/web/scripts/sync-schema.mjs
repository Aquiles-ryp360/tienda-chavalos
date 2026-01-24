import fs from "node:fs";
import path from "node:path";

const root = process.cwd(); // ...\Frontend\NextJS_React\web

const src = path.resolve(root, "..", "..", "..", "Base_de_datos", "Prisma", "schema.prisma");
const dst = path.resolve(root, "prisma", "schema.prisma");

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);

console.log(`[sync-schema] OK -> ${dst}`);

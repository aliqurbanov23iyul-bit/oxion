import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
export function terminal() {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  output.isTTY = process.stdout.isTTY;
  output.columns = process.stdout.columns;
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: !!process.stdin.isTTY,
  });
  return {
    question: (text) => rl.question(text),
    async secret(text) {
      process.stdout.write(text);
      muted = true;
      try {
        return await rl.question("");
      } finally {
        muted = false;
        process.stdout.write("\n");
      }
    },
    close: () => rl.close(),
  };
}

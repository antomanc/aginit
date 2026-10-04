import pc from 'picocolors';

export const logger = {
  info: (msg: string) => console.log(pc.cyan('ℹ ') + msg),
  success: (msg: string) => console.log(pc.green('✓ ') + msg),
  warn: (msg: string) => console.log(pc.yellow('⚠ ') + msg),
  error: (msg: string) => console.error(pc.red('✖ ') + msg),
  dim: (msg: string) => console.log(pc.dim(msg)),
  step: (step: number, total: number, msg: string) => {
    console.log(pc.bold(pc.magenta(`[${step}/${total}] `)) + pc.bold(msg));
  },
  banner: (title: string, subtitle?: string) => {
    console.log();
    console.log(pc.bold(pc.cyan(title)));
    if (subtitle) {
      console.log(pc.dim(subtitle));
    }
    console.log();
  }
};

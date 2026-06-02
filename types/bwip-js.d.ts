declare module "bwip-js" {
  type ToBufferOptions = Record<string, string | number | boolean | undefined>;

  const bwipjs: {
    toBuffer(options: ToBufferOptions): Promise<Buffer>;
  };

  export default bwipjs;
}

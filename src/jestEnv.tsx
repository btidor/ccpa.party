import Environment from "jest-environment-jsdom";

export default class TestEnvironment extends Environment {
  async setup() {
    await super.setup();
    // Polyfill TextEncoder and TextDecoder
    // https://stackoverflow.com/a/57713960
    if (typeof this.global.TextEncoder === "undefined") {
      const { TextEncoder, TextDecoder } = require("util");
      this.global.TextEncoder = TextEncoder;
      this.global.TextDecoder = TextDecoder;
    }
    // Polyfill URL.createObjectURL for js-untar
    if (typeof this.global.URL.createObjectURL === "undefined") {
      Object.defineProperty(this.global.URL, "createObjectURL", {
        value: () => "",
      });
    }
  }
}

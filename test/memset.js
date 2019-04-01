var imports = {memory: new WebAssembly.Memory({initial:2})};
// FIXME `read/snarf/etc` is engine-specific, need a better way to read a file
// https://stackoverflow.com/questions/46159438/how-to-read-webassembly-file-it-javascript-from-the-local-file-system-with-nativ
const module = new WebAssembly.Module(read('mem.wasm', 'binary'));
const instance = new WebAssembly.Instance(module, { "env" : imports }).exports;
var u8_data = new Uint8Array(imports["memory"]["buffer"]);

function check(arr, start, count, value) {
  for (let i = start; i < start + count; ++i) {
    if (u8_data[i] != value)
      return false;
  }
  return true;
}

const begin = instance.__heap_base + 5;
const val = 11;
const count = 16;

instance.memset(begin, val, count);

var passed = check(u8_data, begin, count, val);
passed = passed && check(u8_data, begin - 4, 4, 0);
passed = passed && check(u8_data, begin + count, 4, 0);

const val2 = 16;

instance.memset(begin + 4, val2, count - 8);

passed = passed && check(u8_data, begin - 4, 4, 0);
passed = passed &&check(u8_data, begin, 4, val);
passed = passed &&check(u8_data, begin + 4, count - 8, val2);
passed = passed &&check(u8_data, begin + count - 4, 4, val);
passed = passed && check(u8_data, begin + count, 4, 0);

instance.memset(begin, 0, count);

passed = passed && check(u8_data, begin - 4, count + 8, 0);

if (passed)
  print("PASS");
else
  print("FAIL");


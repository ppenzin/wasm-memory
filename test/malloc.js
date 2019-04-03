var imports = {memory: new WebAssembly.Memory({initial:2})};
// FIXME `read/snarf/etc` is engine-specific, need a better way to read a file
// https://stackoverflow.com/questions/46159438/how-to-read-webassembly-file-it-javascript-from-the-local-file-system-with-nativ
const module = new WebAssembly.Module(read('mem.wasm', 'binary'));
const instance = new WebAssembly.Instance(module, { "env" : imports }).exports;
var u8_data = new Uint8Array(imports["memory"]["buffer"]);

function uchar2int32(arr, off) {
  // Convert 4 uint8 values to a single int32 value
  var u8arr = new Uint8Array([arr[off], arr[off+1], arr[off+2], arr[off+3]]);
  return new Int32Array(u8arr.buffer)[0];
}

function check(arr, start, count, value) {
  for (let i = start; i < start + count; ++i) {
    if (u8_data[i] != value)
      return false;
  }
  return true;
}

var ptr = instance.malloc(256);

var passed = (ptr == instance.__heap_base + 8);
passed = passed && (uchar2int32(u8_data, instance.__heap_base + 4) == 256);

if (passed)
  print("PASS");
else
  print("FAIL");


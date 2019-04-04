var imports = {memory: new WebAssembly.Memory({initial:2})};
// FIXME `read/snarf/etc` is engine-specific, need a better way to read a file
// https://stackoverflow.com/questions/46159438/how-to-read-webassembly-file-it-javascript-from-the-local-file-system-with-nativ
const module = new WebAssembly.Module(read('mem.wasm', 'binary'));
const instance = new WebAssembly.Instance(module, { "env" : imports }).exports;
var u8_data = new Uint8Array(imports["memory"]["buffer"]);

// Convert 4 uint8 values to a single int32 value
function uchar2int32(arr, off) {
  var u8arr = new Uint8Array([arr[off], arr[off+1], arr[off+2], arr[off+3]]);
  return new Int32Array(u8arr.buffer)[0];
}

var ptr = instance.malloc(6);

/* Expected heap (starts at __heap_base):
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 6
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 */
var passed = (uchar2int32(u8_data, instance.__heap_base) == 0)
          && (uchar2int32(u8_data, instance.__heap_base + 4) == 6)
          && (ptr == instance.__heap_base + 8);

ptr = instance.malloc(4);

/* Expected heap (starts at __heap_base):
 * ------------------------
 * (void *) free list == 0
 * ------------------------
 * (size_t) chunk size = 6
 * ------------------------
 * 6 bytes (previous alloc)
 * + 6 bytes to get to
 * 12 bytes required
 * between chunks
 * ------------------------
 * (size_t) chunk size = 4
 * ------------------------
 * (void *) alloc == ptr
 * ------------------------
 */

passed = passed && (uchar2int32(u8_data, instance.__heap_base) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 6)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 4)
                && (ptr == instance.__heap_base + 20);

if (passed)
  print("PASS");
else
  print("FAIL");


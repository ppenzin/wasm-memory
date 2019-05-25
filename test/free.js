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

// Write a four byte integer into the byte array
function write_int32(arr, off, val) {
  var i32arr = new Int32Array([val]);
  var u8arr = new Uint8Array(i32arr.buffer);
  for (var i = 0; i < u8arr.length; ++i) {
    arr[off + i] = u8arr[i];
  }
}

/**** Free the only chunk in the heap ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 8
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 * (size_t) chunk size = 0 (empty)
 */
write_int32(u8_data, instance.__heap_base, 0);
write_int32(u8_data, instance.__heap_base + 4, 8);
write_int32(u8_data, instance.__heap_base + 20, 0);

instance.free(instance.__heap_base + 8);

// Expect the chunk would be deallocated without getting added to the free list
var passed = (uchar2int32(u8_data, instance.__heap_base) == 0)
             && (uchar2int32(u8_data, instance.__heap_base + 4) == 0)
             && (uchar2int32(u8_data, instance.__heap_base + 20) == 0);

/**** Free a non-tail chunk ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 8
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 * (size_t) chunk size = 16
 */
write_int32(u8_data, instance.__heap_base, 0);
write_int32(u8_data, instance.__heap_base + 4, 8);
write_int32(u8_data, instance.__heap_base + 20, 16);

instance.free(instance.__heap_base + 8);

/* Expected (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 16
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 16);


if (passed) {
  print("PASS");
} else {
  print("FAIL");
}

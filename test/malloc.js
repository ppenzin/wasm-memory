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

/**** Allocate with empty heap ****/
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

/**** Add one more alloc ****/
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

/**** Claim an empty chunk ****/

// Make second chunk free
write_int32(u8_data, instance.__heap_base + 20, 0); // Linked list ptr 1
write_int32(u8_data, instance.__heap_base + 24, 0); // Linked list ptr 2
// Second size value at the end of the chunk
write_int32(u8_data, instance.__heap_base + 28,
            uchar2int32(u8_data, instance.__heap_base + 16));

// Set up pointer to the free list
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 16);

ptr = instance.malloc(4); // Claim the same value

// Same heap structure as the previous case 
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 6)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 4)
                && (ptr == instance.__heap_base + 20);

if (passed)
  print("PASS");
else
  print("FAIL");

